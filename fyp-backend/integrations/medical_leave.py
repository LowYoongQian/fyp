import json
import os
import re

import google.generativeai as genai
import httpx

from integrations.private_storage import ensure_private_bucket


ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}


def has_valid_signature(data: bytes, mime_type: str) -> bool:
    signatures = {
        "application/pdf": (b"%PDF-",),
        "image/png": (b"\x89PNG\r\n\x1a\n",),
        "image/jpeg": (b"\xff\xd8\xff",),
    }
    return any(data.startswith(signature) for signature in signatures.get(mime_type, ()))


def verify_medical_document(data: bytes, mime_type: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Document verification is not configured")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-flash-lite-latest", generation_config={"temperature": 0})
    prompt = """Inspect this uploaded document. Decide whether its visible format is consistent with a medical certificate supporting leave. This is format screening, not proof of authenticity. Look for a clinic/provider, patient, issue date, leave dates or duration, and doctor/signature/stamp cues. Return JSON only: {\"verdict\":\"valid|needs_review|invalid\",\"confidence\":0.0,\"summary\":\"short plain English\",\"signals\":[\"...\"],\"missing\":[\"...\"]}. Use invalid only when clearly unrelated, unreadable, or not a medical document."""
    response = model.generate_content([prompt, {"mime_type": mime_type, "data": data}], request_options={"timeout": 15})
    raw = (response.text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.I)
    result = json.loads(raw)
    verdict = str(result.get("verdict", "needs_review")).lower()
    if verdict not in {"valid", "needs_review", "invalid"}:
        verdict = "needs_review"
    return {
        "verdict": verdict,
        "confidence": max(0.0, min(1.0, float(result.get("confidence", 0)))),
        "summary": str(result.get("summary", "Document needs staff review"))[:500],
        "signals": [str(v)[:100] for v in result.get("signals", [])][:10],
        "missing": [str(v)[:100] for v in result.get("missing", [])][:10],
    }


def _storage_config() -> tuple[str, str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_MEDICAL_LEAVE_BUCKET", "medical-leave")
    if not url or not key:
        raise RuntimeError("Medical document storage is not configured")
    return url, key, bucket


def upload_private_document(path: str, data: bytes, mime_type: str) -> None:
    url, key, bucket = _storage_config()
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    with httpx.Client(timeout=30, headers=headers) as client:
        ensure_private_bucket(client, url, bucket, 5 * 1024 * 1024, ALLOWED_TYPES)
        client.post(f"{url}/storage/v1/object/{bucket}/{path}",
                    headers={"Content-Type": mime_type}, content=data).raise_for_status()


def delete_private_document(path: str) -> None:
    url, key, bucket = _storage_config()
    httpx.request("DELETE", f"{url}/storage/v1/object/{bucket}",
                  headers={"Authorization": f"Bearer {key}", "apikey": key},
                  json={"prefixes": [path]}, timeout=30).raise_for_status()


def download_private_document(path: str) -> bytes:
    url, key, bucket = _storage_config()
    response = httpx.get(f"{url}/storage/v1/object/{bucket}/{path}", headers={"Authorization": f"Bearer {key}", "apikey": key}, timeout=30)
    response.raise_for_status()
    return response.content

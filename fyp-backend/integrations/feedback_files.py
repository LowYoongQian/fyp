"""Private complaint attachments; provision storage on first upload."""
import os

import httpx

from integrations.private_storage import ensure_private_bucket

MAX_SIZE = 5 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}


def _config():
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("Feedback storage is not configured")
    return url, {"Authorization": f"Bearer {key}", "apikey": key}


def upload(path, data, mime):
    url, headers = _config()
    with httpx.Client(timeout=30, headers=headers) as client:
        ensure_private_bucket(client, url, "student-feedback", MAX_SIZE, ALLOWED_TYPES)
        client.post(f"{url}/storage/v1/object/student-feedback/{path}",
                    content=data, headers={"Content-Type": mime}).raise_for_status()


def download(path):
    url, headers = _config()
    response = httpx.get(f"{url}/storage/v1/object/student-feedback/{path}", headers=headers, timeout=30)
    response.raise_for_status()
    return response.content


def delete(path):
    url, headers = _config()
    httpx.request("DELETE", f"{url}/storage/v1/object/student-feedback", headers=headers,
                  json={"prefixes": [path]}, timeout=30).raise_for_status()

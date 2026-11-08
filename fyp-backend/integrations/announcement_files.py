import os
from urllib.parse import quote

import httpx
from fastapi import HTTPException, Response


ALLOWED_TYPES = {
    "application/pdf", "image/png", "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _config() -> tuple[str, str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_ANNOUNCEMENT_BUCKET", "course-announcements")
    if not url or not key:
        raise RuntimeError("Announcement storage is not configured")
    return url, key, bucket


def upload(path: str, data: bytes, mime_type: str) -> None:
    url, key, bucket = _config()
    auth = {"Authorization": f"Bearer {key}", "apikey": key}
    with httpx.Client(timeout=30) as client:
        response = client.post(f"{url}/storage/v1/object/{bucket}/{path}", headers={**auth, "Content-Type": mime_type}, content=data)
        if response.status_code == 404:
            created = client.post(f"{url}/storage/v1/bucket", headers={**auth, "Content-Type": "application/json"}, json={
                "id": bucket, "name": bucket, "public": False,
                "file_size_limit": 5 * 1024 * 1024,
                "allowed_mime_types": sorted(ALLOWED_TYPES),
            })
            if created.status_code not in (200, 201, 409):
                created.raise_for_status()
            response = client.post(f"{url}/storage/v1/object/{bucket}/{path}", headers={**auth, "Content-Type": mime_type}, content=data)
        response.raise_for_status()


def download(path: str) -> bytes:
    url, key, bucket = _config()
    response = httpx.get(f"{url}/storage/v1/object/{bucket}/{path}", headers={"Authorization": f"Bearer {key}", "apikey": key}, timeout=30)
    response.raise_for_status()
    return response.content


def attachment_response(row) -> Response:
    """One announcement's stored file as a download, for any audience that may see the notice.

    The file name goes out in both header forms (plain and UTF-8), so spaces, quotes or non-Latin letters neither break the response nor
    arrive under another name; control characters are dropped so a name can never add a header line."""
    if not row.attachment_path:
        raise HTTPException(404, "Attachment not found")
    try:
        data = download(row.attachment_path)
    except Exception as exc:
        raise HTTPException(503, "Download failed") from exc
    name = os.path.basename((row.attachment_name or "attachment").replace("\\", "/")) or "attachment"
    plain = "".join(ch for ch in name if 32 <= ord(ch) < 127 and ch not in '"\\') or "attachment"
    return Response(data, media_type=row.attachment_mime_type or "application/octet-stream", headers={
        "Content-Disposition": f"attachment; filename=\"{plain}\"; filename*=UTF-8''{quote(name, safe='')}",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })

import os

import httpx


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

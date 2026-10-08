"""Private complaint attachments; provision storage on first upload."""
import os

import httpx

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
        bucket = client.get(f"{url}/storage/v1/bucket/student-feedback")
        # Older Storage versions wrap missing-bucket errors in HTTP 400.
        missing = bucket.status_code == 404
        if bucket.status_code == 400:
            error = bucket.json()
            missing = error.get("code") == "NoSuchBucket" or error.get("message") == "Bucket not found"
        if missing:
            created = client.post(f"{url}/storage/v1/bucket", json={
                "id": "student-feedback", "name": "student-feedback", "public": False,
                "file_size_limit": MAX_SIZE, "allowed_mime_types": sorted(ALLOWED_TYPES),
            })
            if created.status_code not in (200, 201, 409):
                created.raise_for_status()
            bucket = client.get(f"{url}/storage/v1/bucket/student-feedback")
        bucket.raise_for_status()
        if bucket.json().get("public") is not False:
            raise RuntimeError("Feedback bucket must be private")
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

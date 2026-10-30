"""Private registration photos; a dedicated bucket, never the complaint bucket."""
import base64
import uuid

import cv2
import httpx
import numpy as np

from integrations.feedback_files import _config
from integrations.private_storage import ensure_private_bucket

BUCKET = "face-registration-photos"
MAX_SIZE = 1024 * 1024
MAX_SIDE = 640


def make_photo(image_base64):
    """Re-encode the already-verified capture: bounded size, no EXIF or other metadata."""
    image = cv2.imdecode(np.frombuffer(base64.b64decode(image_base64, validate=True), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("not an image")
    scale = MAX_SIDE / max(image.shape[:2])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok or len(data) > MAX_SIZE:
        raise ValueError("photo too large")
    return data.tobytes()


def new_key(student_id):
    # Fresh key per registration, so a reset followed by re-registration cannot reuse an old object.
    return f"{student_id}/{uuid.uuid4()}.jpg"


def upload(key, data):
    url, headers = _config()
    with httpx.Client(timeout=15, headers=headers) as client:
        ensure_private_bucket(client, url, BUCKET, MAX_SIZE, {"image/jpeg"})
        client.post(f"{url}/storage/v1/object/{BUCKET}/{key}", content=data,
                    headers={"Content-Type": "image/jpeg"}).raise_for_status()


def download(key):
    url, headers = _config()
    response = httpx.get(f"{url}/storage/v1/object/{BUCKET}/{key}", headers=headers, timeout=15)
    response.raise_for_status()
    return response.content


def delete(key):
    url, headers = _config()
    httpx.request("DELETE", f"{url}/storage/v1/object/{BUCKET}", headers=headers,
                  json={"prefixes": [key]}, timeout=15).raise_for_status()

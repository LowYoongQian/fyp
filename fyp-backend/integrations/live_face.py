"""Server-side evidence, independent of client liveness flags and timings."""
import base64
import binascii
import logging
import struct

import cv2
import numpy as np
from fastapi import HTTPException

from integrations import face


def extract_live_embedding(image_base64):
    if not face._DEEPFACE_AVAILABLE:
        raise HTTPException(503, "Face verification is unavailable. Please try again later.")
    try:
        import torch  # noqa: F401 — a missing server verifier must fail closed, not blame the camera.
    except ImportError as exc:
        raise HTTPException(503, "Server liveness verification is unavailable. Please try again later.") from exc
    try:
        face.DeepFace.build_model("Fasnet", task="spoofing")
    except Exception as exc:
        logging.getLogger(__name__).warning("Server liveness model unavailable (%s)", type(exc).__name__)
        raise HTTPException(503, "Server liveness verification is unavailable. Please try again later.") from exc
    try:
        raw = base64.b64decode(image_base64, validate=True)
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if image is None or image.size > 12_000_000:
            raise HTTPException(422, "Use a clear camera photo within the supported size.")
        faces = face.DeepFace.extract_faces(img_path=image, enforce_detection=True,
            anti_spoofing=True, color_face="bgr", normalize_face=False)
        if len(faces) != 1:
            raise HTTPException(422, "Keep only your face visible in the camera.")
        if "is_real" not in faces[0]:
            raise HTTPException(503, "Server liveness verification is unavailable. Please try again later.")
        if not faces[0]["is_real"]:
            raise HTTPException(403, "Liveness could not be verified. Use your camera, not a photo or screen.")
        # Reuse the detected/aligned crop: no second detection or spoof-model pass.
        crop = np.asarray(faces[0]["face"], dtype=np.uint8)
        result = face.DeepFace.represent(img_path=crop, model_name="ArcFace", detector_backend="skip")
        vector = result[0]["embedding"]
        if len(vector) != 512 or not np.isfinite(vector).all():
            raise HTTPException(503, "Face verification is unavailable. Please try again later.")
        return struct.pack("f" * len(vector), *vector)
    except HTTPException:
        raise
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(422, "Face could not be verified. Use good lighting and scan again.") from exc
    except Exception as exc:
        logging.getLogger(__name__).exception("Server face/liveness verification failed")
        raise HTTPException(503, "Face verification is temporarily unavailable. Please try again later.") from exc

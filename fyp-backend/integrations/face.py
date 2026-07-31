"""Face recognition boundary: deepface/ArcFace in, plain bytes and floats out.

Lives here rather than in a router because two routers need it — registration
(routers/students.py) and check-in (routers/sessions.py). Having sessions import from
students made one HTTP layer depend on another; this module is the shared edge instead.

deepface is an optional heavy dependency. Absence is reported as a 503 at the moment of
use, never silently skipped: a check-in that quietly bypassed face matching would record
attendance nobody verified.
"""
import base64
import logging
import math
import struct

import cv2
import numpy as np
from fastapi import HTTPException

logger = logging.getLogger(__name__)


# Try to import deepface; fall back gracefully so the app runs without it.
try:
    from deepface import DeepFace  # type: ignore
    _DEEPFACE_AVAILABLE = True
except ImportError:
    _DEEPFACE_AVAILABLE = False



def _extract_face_embedding(image_base64: str, enforce_detection: bool = True) -> bytes:
    """Extract a 512-d ArcFace embedding from a base64-encoded JPEG/PNG.

    Uses DeepFace with the ArcFace model (report §2.2.2). The returned bytes are
    512 little-endian C floats (2048 bytes total), matching the
    FaceEmbedding.embedding column schema.

    enforce_detection=True (registration): reject images with no detectable face,
    so a garbage vector can never be stored as someone's identity. check-in
    passes False for tolerance — a wrong face is caught by the cosine threshold.
    """
    if not _DEEPFACE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Face recognition is unavailable: the ArcFace model (deepface) is not installed."
        )
    try:
        img_bytes = base64.b64decode(image_base64)
        img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("could not decode image bytes")
        result = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            enforce_detection=enforce_detection,
        )
        embedding = result[0]["embedding"]  # list of 512 floats
        return struct.pack("f" * len(embedding), *embedding)
    except HTTPException:
        raise
    except Exception as e:
        # This one except covers four unrelated failures - no face found by the
        # detector, undecodable bytes, a TensorFlow/Keras error, and OOM - and
        # collapses them into the same 400. Without this log the only copy of the
        # reason is the response body, so a client that drops it (the Flutter
        # registration screen did) leaves no record anywhere. Log before raising:
        # a 400 whose cause is unknowable server-side is not a handled error.
        logger.exception(
            "Face embedding extraction failed (enforce_detection=%s, bytes=%d)",
            enforce_detection, len(image_base64),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Face embedding extraction failed: {e}. Ensure a clear face is visible in the image."
        )


def _embedding_to_floats(b: bytes) -> list[float]:
    n = len(b) // 4
    return list(struct.unpack("f" * n, b))


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """Return cosine distance in [0, 2]; 0 = identical, 2 = opposite."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 1.0
    return 1.0 - dot / (na * nb)


# Threshold below which two embeddings are considered the same person.
#
# NOTE: 0.40 is NOT deepface's tuned threshold for ArcFace — that is 0.68
# (see deepface/config/threshold.py; 0.40 is Facenet's cosine value). 0.40 is a
# deliberate ~41% tightening, chosen because the two error types are asymmetric
# here: a false rejection just makes a legitimate student retake the photo, while
# a false acceptance admits an impostor and produces exactly the proxy-attendance
# record this system exists to prevent. Report §3.1.2 documents this reasoning.
#
# To be validated in Project II by measuring FAR/FRR over genuine vs impostor
# embedding pairs across candidate thresholds, and loosened if the false
# rejection rate proves too high for real classroom conditions.
_FACE_MATCH_THRESHOLD = 0.40

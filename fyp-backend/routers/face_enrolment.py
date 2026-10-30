"""One-time live face registration; only an administrator can unlock it by reset."""
import json
import logging
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.database import get_db, SessionLocal
from db.models import FaceEmbedding, FaceEnrolmentRequest, FacePhotoCleanup, Student, User, UserNotification
from domain.account_security import active, lock_user
from domain.audit import log_audit_event
from integrations import face_photos
from integrations.live_face import extract_live_embedding
from utils.security import require_admin, require_student, verify_password
from utils.timeutil import iso_utc, utcnow
from utils.db_helpers import require_own_profile

router = APIRouter(tags=["Face registration"])
OPEN_STATUSES = ("authorised", "pending")


class FaceCaptureSubmit(BaseModel):
    image_base64: str = Field(min_length=1, max_length=8_000_000)
    # Explicit null means first registration; a reset returns a new revision.
    registration_version: str | None = Field(max_length=100)


class FaceReset(BaseModel):
    current_password: SecretStr = Field(min_length=1, max_length=255)
    confirm_reset: Literal[True]
    registration_version: str = Field(min_length=1, max_length=100)


def face_version(face):
    # A revision, not a biometric hash: stale admin tabs cannot reset a new face.
    return f"{face.id}:{iso_utc(face.updated_at)}" if face else None


def face_state(face):
    return {"is_face_registered": bool(face and face.is_active),
            "registration_version": face_version(face)}


def audit(db, actor, action, student):
    log_audit_event(db, user_id=str(actor.id), user_name=actor.profile_name or actor.email,
        user_role=actor.role, category="admin" if actor.role == "admin" else "student",
        action=action, details=f"Student {student.id}; registered {student.is_face_registered}", commit=False)


def lock_student(db, student_id):
    row = db.query(Student).filter(Student.id == student_id).populate_existing().with_for_update().first()
    if not row:
        raise HTTPException(404, "Student not found.")
    return row


def retire_requests(db, student_id):
    # Legacy approvals must never reactivate an identity after this flow takes over.
    db.query(FaceEnrolmentRequest).filter(
        FaceEnrolmentRequest.student_id == student_id, FaceEnrolmentRequest.status.in_(OPEN_STATUSES)
    ).update({"status": "expired", "candidate_embedding": None, "token_hash": None}, synchronize_session=False)


def owe_photo(db, key):
    """Record, in the caller's transaction, that this stored photo must be deleted."""
    if key:
        db.merge(FacePhotoCleanup(object_key=key))


# Tombstone prefix: a cleanup row named CLAIMED + key means cleanup has committed to deleting that object.
CLAIMED = "claimed:"


def settle_photo(db, key):
    """Delete an owed registration photo without ever leaving a usable claim on a deleted object.

    Ownership protocol (the cleanup row is the token shared with registration finalization, submit_capture):
      1. CLAIM, one committed transaction: lock the intent row (FOR UPDATE SKIP LOCKED); if a face row already
         references the key, just withdraw the stale intent; otherwise replace the intent with a CLAIMED
         tombstone row. After this commit finalization finds no intent and refuses to attach the photo.
      2. Delete the object. This is idempotent and runs with no database lock held.
      3. Delete the tombstone in a second commit.
    A failure in 1 changes nothing (the object still exists and the intent still stands). A failure or crash
    in 2 or 3 leaves the tombstone, which any worker retries until the object is gone; the tombstone can never
    be attached, so a deleted object can never be referenced. Duplicate workers are harmless (delete is
    idempotent). Lock order: registration takes user -> student -> intent row; this takes only the intent row.
    Returns True when the key is settled (or already handled), False when it is still owed.
    """
    if not key:
        return True
    try:
        intent = db.query(FacePhotoCleanup).filter_by(object_key=key).populate_existing().with_for_update(skip_locked=True).first()
        if intent is not None:
            if db.query(FaceEmbedding.id).filter(FaceEmbedding.photo_key == key).first():
                db.delete(intent)  # stale intent for an attached photo: withdraw it, keep the object
                db.commit()
                return True
            db.delete(intent)
            db.merge(FacePhotoCleanup(object_key=CLAIMED + key))
            db.commit()  # 1. claim
        elif db.query(FacePhotoCleanup).filter_by(object_key=key).count():
            return False  # another process holds the intent right now
        elif not db.query(FacePhotoCleanup).filter_by(object_key=CLAIMED + key).count():
            return True  # nothing owed: finalization or another worker already handled it
        face_photos.delete(key)  # 2. idempotent
        db.query(FacePhotoCleanup).filter_by(object_key=CLAIMED + key).delete()
        db.commit()  # 3. forget the tombstone
        return True
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        logging.getLogger(__name__).warning("Face photo cleanup deferred (%s)", type(exc).__name__)
        return False


# A cleanup row younger than this may belong to a registration still in flight, so the worker leaves it alone.
CLEANUP_GRACE = timedelta(minutes=10)


def tombstone_photo(db, key):
    """Durably owe the delete of an object that must never be attached, then try to delete it now."""
    try:
        db.merge(FacePhotoCleanup(object_key=CLAIMED + key))
        db.commit()
    except Exception:
        db.rollback()  # the pre-upload intent, if it still exists, keeps the object recoverable
    settle_photo(db, key)


def stage_photo(db, student_id, image_base64):
    """Store the verified capture before locking; None (never an error) if it cannot be kept safely.

    The delete intent is committed BEFORE the upload, so a timeout that hides a successful upload, or a
    database outage afterwards, can never leave an object nobody knows about. A successful registration
    removes the intent in the same transaction that attaches the photo.

    Upload lifetime vs cleanup (PHOTO-04): the worker may claim, delete and forget the intent while this upload is
    still pending, and the upload can then create the object afterwards. So, once the upload returns (success or
    error) the intent is re-checked; if cleanup has already taken it, the now-existing object is tombstoned and
    deleted rather than attached, so it is never left unreferenced. Bounded assumptions, not guarantees: the
    HTTP client's timeouts bound a normal upload to seconds and the worker's grace period is 10 minutes, so
    cleanup overtaking a live upload is exceptional; and a remote write that lands only AFTER this request has
    given up (client timeout) and finished its own delete cannot be seen here. That last case would need a
    periodic bucket reconciliation, which is not implemented.
    """
    try:
        photo = face_photos.make_photo(image_base64)
        key = face_photos.new_key(student_id)
    except Exception as exc:
        logging.getLogger(__name__).warning("Registration photo not saved (%s)", type(exc).__name__)
        return None
    try:
        owe_photo(db, key)
        db.commit()
    except Exception as exc:
        db.rollback()
        logging.getLogger(__name__).warning("Registration photo not saved (%s)", type(exc).__name__)
        return None
    try:
        face_photos.upload(key, photo)
    except Exception as exc:
        logging.getLogger(__name__).warning("Registration photo not saved (%s)", type(exc).__name__)
        tombstone_photo(db, key)  # the object may exist despite the error, even if cleanup already forgot the intent
        return None
    if not db.query(FacePhotoCleanup).filter_by(object_key=key).count():
        # Cleanup took the intent while the upload was pending: the object now exists but may not be attached.
        tombstone_photo(db, key)
        return None
    return key


def expire_requests():
    # Retain cleanup for old deployments' candidates, without permitting approval.
    with SessionLocal() as db:
        expired = db.query(FaceEnrolmentRequest).filter(
            FaceEnrolmentRequest.status.in_(OPEN_STATUSES), FaceEnrolmentRequest.expires_at <= utcnow()
        ).limit(100).with_for_update(skip_locked=True).all()
        for row in expired:
            row.status, row.candidate_embedding, row.token_hash = "expired", None, None
            log_audit_event(db, user_role="system", category="admin", action="FACE_ENROLMENT_EXPIRED",
                details=f"Face request {row.id}; student {row.student_id}", commit=False)
        db.commit()


def due_photo_keys(db, grace=CLEANUP_GRACE):
    # Intents wait out the grace period (an in-flight registration may still attach them); tombstones never wait.
    rows = db.query(FacePhotoCleanup.object_key).filter(or_(
        FacePhotoCleanup.object_key.like(CLAIMED + "%"), FacePhotoCleanup.created_at <= utcnow() - grace)).limit(20).all()
    return [key[len(CLAIMED):] if key.startswith(CLAIMED) else key for (key,) in rows]


def settle_due_photos(db, grace=CLEANUP_GRACE):
    # The selection is only a hint: settle_photo re-checks every row under its own protocol, so a stale key is harmless.
    for key in due_photo_keys(db, grace):
        settle_photo(db, key)


def retry_photo_cleanups():
    with SessionLocal() as db:
        settle_due_photos(db)


@router.get("/students/me/face/status")
def student_face_status(db: Session = Depends(get_db), actor: User = Depends(require_student)):
    student = require_own_profile(db, Student, actor.id, "Student")
    face = db.query(FaceEmbedding).filter_by(student_id=student.id).first()
    return face_state(face)


@router.get("/admin/students/{student_id}/face")
def admin_face_status(student_id: str, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    if not db.get(Student, student_id):
        raise HTTPException(404, "Student not found.")
    return face_state(db.query(FaceEmbedding).filter_by(student_id=student_id).first())


@router.get("/admin/students/{student_id}/face/photo")
def admin_face_photo(student_id: str, registration_version: str | None = Query(None, max_length=100),
                     db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    # The key is read from the database for the current active registration, never from the caller.
    if not db.get(Student, student_id):
        raise HTTPException(404, "Student not found.")
    face = db.query(FaceEmbedding).filter_by(student_id=student_id).first()
    if not face or not face.is_active:
        raise HTTPException(404, "Not registered.")
    if registration_version is not None and registration_version != face_version(face):
        raise HTTPException(409, "This registration changed. Refresh the student details.")
    if not face.photo_key:
        raise HTTPException(404, "Photo unavailable.")
    try:
        data = face_photos.download(face.photo_key)
    except Exception as exc:
        if getattr(getattr(exc, "response", None), "status_code", None) in (400, 404):
            raise HTTPException(404, "Photo unavailable.")  # the object is gone (e.g. cleaned up): not an outage
        logging.getLogger(__name__).warning("Registration photo unreadable (%s)", type(exc).__name__)
        raise HTTPException(502, "Photo storage is unavailable. Try again later.")
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


def submit_capture(body, db, actor):
    active(actor)
    student = require_own_profile(db, Student, actor.id, "Student")
    student_id, actor_id = student.id, actor.id
    face = db.query(FaceEmbedding).filter_by(student_id=student_id).first()
    if face and face.is_active:
        raise HTTPException(409, "Your face is already registered. Visit the administration office if it needs to be reset.")
    if body.registration_version != face_version(face):
        raise HTTPException(409, "Your face registration status changed. Refresh and start a new scan.")
    # Release the read transaction before expensive inference, then revalidate
    # identity/session and revision under the same student lock used by check-in.
    db.commit()
    embedding = extract_live_embedding(body.image_base64)
    photo_key = stage_photo(db, student_id, body.image_base64)
    try:
        actor = lock_user(db, actor_id, require_session=bool(db.info.get("security_session_id")))
        if actor.role != "student":
            raise HTTPException(403, "Student permission required.")
        student = lock_student(db, student_id)
        if str(student.user_id) != str(actor.id):
            raise HTTPException(403, "This student profile is no longer linked to your account.")
        face = db.query(FaceEmbedding).filter_by(student_id=student_id).populate_existing().first()
        if (face and face.is_active) or body.registration_version != face_version(face):
            raise HTTPException(409, "Your face registration status changed. Refresh and start a new scan.")
        if photo_key:
            # Take the shared ownership token last. A missing row means cleanup already won, so attach nothing.
            intent = db.query(FacePhotoCleanup).filter_by(object_key=photo_key).populate_existing().with_for_update().first()
            if intent is None:
                photo_key = None
            else:
                db.delete(intent)
        if face:
            owe_photo(db, face.photo_key)
            face.embedding, face.is_active, face.sample_count, face.updated_at = embedding, True, 1, utcnow()
            face.photo_key = photo_key
        else:
            face = FaceEmbedding(student_id=student_id, embedding=embedding, is_active=True, updated_at=utcnow(), photo_key=photo_key)
            db.add(face)
        student.is_face_registered = True
        retire_requests(db, student_id)
        audit(db, actor, "FACE_REGISTERED", student)
        db.commit()
    except Exception:
        # Stale revision, lost lock or failed commit: the intent is already durable, so only try to delete now.
        try:
            db.rollback()
        except Exception:
            pass
        settle_photo(db, photo_key)
        raise
    return {**face_state(face), "photo_saved": bool(photo_key),
            "message": "Your face is registered. Only the administration office can reset it."}


@router.post("/admin/students/{student_id}/face/reset")
def reset_face(student_id: str, body: FaceReset, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    actor = lock_user(db, actor.id, require_session=bool(db.info.get("security_session_id")))
    if actor.role != "admin":
        raise HTTPException(403, "Admin permission required.")
    if not verify_password(body.current_password.get_secret_value(), actor.password_hash):
        raise HTTPException(403, "Your current password is incorrect. Please try again.")
    student = lock_student(db, student_id)
    face = db.query(FaceEmbedding).filter_by(student_id=student_id).populate_existing().first()
    if not face or not face.is_active or body.registration_version != face_version(face):
        raise HTTPException(409, "This registered face has already changed or been reset. Refresh before trying again.")
    previous_version = face_version(face)
    # Keep the row so in-flight check-in refreshes can reject it cleanly, but
    # erase the biometric bytes. Attendance records and their evidence stay intact.
    old_photo = face.photo_key
    face.embedding, face.is_active, face.updated_at, face.photo_key = b"", False, utcnow(), None
    owe_photo(db, old_photo)
    student.is_face_registered = False
    retire_requests(db, student_id)
    audit(db, actor, "FACE_RESET", student)
    if student.user_id:
        db.add(UserNotification(user_id=student.user_id, kind="face_registration_reset",
            title="Register your face again",
            body="An administrator reset your face registration. Open the app to complete a new live scan; your attendance history is unchanged.",
            dedupe_key=f"face_reset:{previous_version}",
            payload=json.dumps({"student_id": str(student.id)})))
    db.commit()
    cleaned = settle_photo(db, old_photo)
    return {**face_state(face), "photo_cleanup_pending": not cleaned, "message": "Face reset confirmed. The student must register again in the app."}


@router.post("/students/me/face/challenge", include_in_schema=False)
def retired_challenge(actor: User = Depends(require_student)):
    raise HTTPException(410, "Supervised face enrolment has been retired. Update the app to use one-time face registration.")


@router.get("/admin/students/{student_id}/face-enrolment", include_in_schema=False)
@router.post("/admin/students/{student_id}/face-enrolment", include_in_schema=False)
@router.put("/admin/students/{student_id}/face-enrolment/{request_id}", include_in_schema=False)
def retired_approval(actor: User = Depends(require_admin)):
    raise HTTPException(410, "Face approval has been retired. Use Students → Reset face after an office identity check.")

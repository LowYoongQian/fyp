"""One-time live face registration; only an administrator can unlock it by reset."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy.orm import Session

from db.database import get_db, SessionLocal
from db.models import FaceEmbedding, FaceEnrolmentRequest, Student, User, UserNotification
from domain.account_security import active, lock_user
from domain.audit import log_audit_event
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
    actor = lock_user(db, actor_id, require_session=bool(db.info.get("security_session_id")))
    if actor.role != "student":
        raise HTTPException(403, "Student permission required.")
    student = lock_student(db, student_id)
    if str(student.user_id) != str(actor.id):
        raise HTTPException(403, "This student profile is no longer linked to your account.")
    face = db.query(FaceEmbedding).filter_by(student_id=student_id).populate_existing().first()
    if (face and face.is_active) or body.registration_version != face_version(face):
        raise HTTPException(409, "Your face registration status changed. Refresh and start a new scan.")
    if face:
        face.embedding, face.is_active, face.sample_count, face.updated_at = embedding, True, 1, utcnow()
    else:
        face = FaceEmbedding(student_id=student_id, embedding=embedding, is_active=True, updated_at=utcnow())
        db.add(face)
    student.is_face_registered = True
    retire_requests(db, student_id)
    audit(db, actor, "FACE_REGISTERED", student)
    db.commit()
    return {**face_state(face), "message": "Your face is registered. Only the administration office can reset it."}


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
    face.embedding, face.is_active, face.updated_at = b"", False, utcnow()
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
    return {**face_state(face), "message": "Face reset confirmed. The student must register again in the app."}


@router.post("/students/me/face/challenge", include_in_schema=False)
def retired_challenge(actor: User = Depends(require_student)):
    raise HTTPException(410, "Supervised face enrolment has been retired. Update the app to use one-time face registration.")


@router.get("/admin/students/{student_id}/face-enrolment", include_in_schema=False)
@router.post("/admin/students/{student_id}/face-enrolment", include_in_schema=False)
@router.put("/admin/students/{student_id}/face-enrolment/{request_id}", include_in_schema=False)
def retired_approval(actor: User = Depends(require_admin)):
    raise HTTPException(410, "Face approval has been retired. Use Students → Reset face after an office identity check.")

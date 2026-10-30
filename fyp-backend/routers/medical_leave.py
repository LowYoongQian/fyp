import json
import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.database import get_db
from db.models import AttendanceRequest, Course, CourseStaffAssignment, Enrolment, Lecturer, Student, User
from integrations.medical_leave import ALLOWED_TYPES, delete_private_document, download_private_document, has_valid_signature, upload_private_document, verify_medical_document
from domain.record_pages import RecordFilters, status_counts
from domain.notification_inbox import notify_administrators
from routers.attendance_features import add_notification
from utils.db_helpers import require_own_profile
from utils.security import require_student
from utils.timeutil import iso_utc

router = APIRouter(prefix="/students/me/medical-leave", tags=["Medical leave"])


def serialize(row: AttendanceRequest, course: Course, group: str) -> dict:
    return {
        "id": row.id, "course_id": row.course_id, "course_code": course.course_code,
        "course_name": course.course_name, "class_group": group,
        "start_date": row.start_date.isoformat() if row.start_date else None,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "reason": row.reason, "file_name": row.proof_file_name,
        "file_type": row.proof_mime_type, "file_size": row.proof_size,
        "status": row.status, "remarks": row.reviewer_note,
        "submitted_at": iso_utc(row.created_at), "ai_verdict": row.ai_verdict,
        "ai_confidence": row.ai_confidence, "ai_summary": row.ai_summary,
    }


@router.get("")
def list_medical_leave(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = db.query(AttendanceRequest, Course, Enrolment).join(Course, Course.id == AttendanceRequest.course_id).join(
        Enrolment, (Enrolment.course_id == AttendanceRequest.course_id) & (Enrolment.student_id == student.id)
    ).filter(AttendanceRequest.student_id == student.id, AttendanceRequest.request_type == "leave",
             AttendanceRequest.proof_path.isnot(None)).order_by(AttendanceRequest.created_at.desc()).all()
    return [serialize(row, course, enrolment.class_group) for row, course, enrolment in rows]


@router.post("", status_code=201)
def submit_medical_leave(
    course_id: str = Form(...), start_date: date = Form(...), end_date: date = Form(...),
    reason: str = Form(...), proof: UploadFile = File(...), db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    student = require_own_profile(db, Student, current_user.id, "Student")
    enrolment = db.query(Enrolment).filter(Enrolment.student_id == student.id, Enrolment.course_id == course_id).first()
    course = db.get(Course, course_id)
    if not enrolment or not course:
        raise HTTPException(404, "Enrolled course not found")
    if end_date < start_date:
        raise HTTPException(400, "End date cannot be before start date")
    clean_reason = reason.strip()
    if len(clean_reason) < 5 or len(clean_reason) > 1000:
        raise HTTPException(400, "Add a short medical reason")
    mime_type = (proof.content_type or "").lower()
    if mime_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Use a PDF, PNG, or JPG file")
    data = proof.file.read(5 * 1024 * 1024 + 1)
    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "File must be under 5 MB")
    if not has_valid_signature(data, mime_type):
        raise HTTPException(415, "File content does not match its format")
    try:
        ai = verify_medical_document(data, mime_type)
    except Exception as exc:
        logging.getLogger(__name__).warning("Medical screening unavailable: %s", type(exc).__name__)
        ai = {"verdict": "needs_review", "confidence": None,
              "summary": "Automatic screening was unavailable. An administrator must review your document.",
              "signals": [], "missing": []}
    if ai["verdict"] == "invalid":
        raise HTTPException(422, ai["summary"] or "This does not look like a medical certificate")
    extension = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}[mime_type]
    path = f"{student.id}/{uuid.uuid4().hex}{extension}"
    try:
        upload_private_document(path, data, mime_type)
    except Exception as exc:
        raise HTTPException(503, "Upload failed. Try again") from exc
    row = AttendanceRequest(
        student_id=student.id, course_id=course.id, request_type="leave", reason=clean_reason,
        start_date=start_date, end_date=end_date, proof_path=path,
        proof_file_name=os.path.basename((proof.filename or f"medical-proof{extension}").replace("\\", "/")).replace('"', "")[:255],
        proof_mime_type=mime_type, proof_size=len(data), ai_verdict=ai["verdict"],
        ai_confidence=ai["confidence"], ai_summary=ai["summary"], ai_details=json.dumps(ai),
    )
    try:
        db.add(row)
        db.flush()
        staff_ids = {course.lecturer_id} if course.lecturer_id else set()
        staff_ids.update(a.lecturer_id for a in db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == course.id).all())
        for lecturer in db.query(Lecturer).filter(Lecturer.id.in_(staff_ids)).all() if staff_ids else []:
            add_notification(db, lecturer.user_id, "attendance_request", "New medical leave",
                             f"{student.name} submitted medical leave for {course.course_code}.",
                             f"request:{row.id}:submitted", {"request_id": row.id})
        notify_administrators(db, "medical_submission", "New medical leave request",
            f"{student.name} submitted a medical leave request.", f"medical:{row.id}:submitted", {"request_id": row.id})
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_private_document(path)
        except Exception:
            logging.getLogger(__name__).exception("Failed to remove uncommitted medical proof")
        raise
    db.refresh(row)
    return serialize(row, course, enrolment.class_group)


@router.get("/page")
def medical_leave_page(filters: RecordFilters = Depends(), db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    base = db.query(AttendanceRequest).filter(AttendanceRequest.student_id == student.id,
        AttendanceRequest.request_type == "leave", AttendanceRequest.proof_path.isnot(None))
    stats = status_counts(base, AttendanceRequest.status)
    group = select(Enrolment.class_group).where(Enrolment.student_id == student.id,
        Enrolment.course_id == AttendanceRequest.course_id).order_by(Enrolment.id).limit(1).scalar_subquery()
    query = base.with_entities(AttendanceRequest, Course, group).join(Course, Course.id == AttendanceRequest.course_id)
    if filters.status != "All":
        query = query.filter(AttendanceRequest.status == filters.status.lower())
    query = filters.apply(query, AttendanceRequest.created_at, [Course.course_name, Course.course_code,
        AttendanceRequest.reason, AttendanceRequest.id])
    return filters.fetch(query, [AttendanceRequest.created_at.desc(), AttendanceRequest.id.desc()],
                         lambda row: serialize(row[0], row[1], row[2] or ""), stats, id_column=AttendanceRequest.id)


@router.get("/{request_id}/proof")
def get_medical_proof(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    row = db.query(AttendanceRequest).filter(AttendanceRequest.id == request_id,
        AttendanceRequest.student_id == student.id, AttendanceRequest.proof_path.isnot(None)).first()
    if not row:
        raise HTTPException(404, "Medical proof not found")
    try:
        data = download_private_document(row.proof_path)
    except Exception as exc:
        raise HTTPException(503, "Download failed") from exc
    return Response(data, media_type=row.proof_mime_type or "application/octet-stream", headers={
        "Content-Disposition": "attachment; filename=medical-proof",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })

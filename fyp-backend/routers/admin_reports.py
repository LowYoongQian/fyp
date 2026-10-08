import logging
import uuid
from datetime import datetime
from typing import Any, List, Literal, Optional
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import (
    AttendanceRecord,
    AttendanceRequest,
    ClassSession,
    Course,
    Student,
    StudentFeedback,
    User,
)
from domain.audit import log_admin_action
from domain.medical_leave import review_attendance_request
from integrations import feedback_files
from integrations.medical_leave import download_private_document
from utils.db_helpers import get_or_404
from utils.security import require_admin, require_student
from utils.timeutil import iso_utc

router = APIRouter(prefix="/admin/reports", tags=["Admin Reports"])
student_router = APIRouter(prefix="/students/me/feedback", tags=["Student Feedback"])

# --- Pydantic Schemas ---
class StudentFeedbackResponse(BaseModel):
    id: Any
    student_id: Optional[Any] = None
    student_name: str
    student_code: str
    subject: str
    category: str
    message: str
    priority: str = "Medium"
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    status: str
    admin_notes: Optional[str] = ""
    student_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class FeedbackUpdate(BaseModel):
    status: Literal["Pending", "In Progress", "Resolved"]
    admin_notes: Optional[str] = None
    student_response: Optional[str] = None

class MCReportResponse(BaseModel):
    id: Any
    source: str = "attendance"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    reason: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    student_id: Any
    student_name: str
    student_code: str
    course_name: str
    course_code: str
    mc_proof_url: Optional[str] = None
    timestamp: datetime
    status: str
    flag_reason: Optional[str] = None

    class Config:
        from_attributes = True

class MCReportUpdate(BaseModel):
    status: str
    source: str = "attendance"

# --- Endpoints ---

def _feedback_student(db, user):
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        raise HTTPException(404, "Student profile not found")
    return student


def _feedback_attachment(item):
    if not item.attachment_path:
        raise HTTPException(404, "Attachment not found")
    try:
        data = feedback_files.download(item.attachment_path)
    except Exception as exc:
        raise HTTPException(503, "Attachment download failed. Please try again.") from exc
    return Response(data, media_type=item.attachment_type, headers={
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(item.attachment_name, safe=""),
    })


@student_router.get("", response_model=List[StudentFeedbackResponse], response_model_exclude={"__all__": {"admin_notes"}})
def student_feedback_list(db: Session = Depends(get_db), user: User = Depends(require_student)):
    student = _feedback_student(db, user)
    return db.query(StudentFeedback).filter(StudentFeedback.student_id == student.id).order_by(StudentFeedback.created_at.desc()).all()


@student_router.post("", response_model=StudentFeedbackResponse, response_model_exclude={"admin_notes"}, status_code=201)
async def student_feedback_create(
    subject: str = Form(..., min_length=1, max_length=200),
    message: str = Form(..., min_length=1, max_length=10000),
    category: Literal["Attendance Discrepancy", "Face Verification Issue", "Lecturer Feedback", "System Bug", "General Inquiry"] = Form(...),
    priority: Literal["Low", "Medium", "High", "Urgent"] = Form("Medium"),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), user: User = Depends(require_student),
):
    student = _feedback_student(db, user)
    if not subject.strip() or not message.strip():
        raise HTTPException(422, "Subject and message cannot be blank")
    item = StudentFeedback(id=str(uuid.uuid4()), student_id=student.id, student_name=student.name,
                           student_code=student.student_code, subject=subject.strip(), message=message.strip(),
                           category=category, priority=priority, status="Pending")
    if attachment:
        data = await attachment.read(feedback_files.MAX_SIZE + 1)
        mime = attachment.content_type
        signatures = {"application/pdf": b"%PDF-", "image/png": b"\x89PNG\r\n\x1a\n", "image/jpeg": b"\xff\xd8\xff"}
        if not data or len(data) > feedback_files.MAX_SIZE:
            raise HTTPException(422, "Attachment must be between 1 byte and 5 MB")
        if mime not in signatures or not data.startswith(signatures[mime]):
            raise HTTPException(422, "Upload a PDF, PNG or JPEG file")
        item.attachment_path = f"{student.id}/{item.id}"
        item.attachment_name = (attachment.filename or "attachment").replace("\\", "/").split("/")[-1][:255] or "attachment"
        item.attachment_type = mime
        try:
            feedback_files.upload(item.attachment_path, data, mime)
        except Exception as exc:
            logging.getLogger(__name__).exception("Feedback attachment upload failed")
            raise HTTPException(503, "Attachment upload failed. Your ticket was not submitted.") from exc
    db.add(item)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if item.attachment_path:
            try:
                feedback_files.delete(item.attachment_path)
            except Exception:
                logging.getLogger(__name__).exception("Failed to remove uncommitted feedback attachment")
        raise
    db.refresh(item)
    return item


@student_router.get("/{feedback_id}/attachment")
def student_feedback_attachment(feedback_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_student)):
    student = _feedback_student(db, user)
    item = db.query(StudentFeedback).filter(StudentFeedback.id == str(feedback_id), StudentFeedback.student_id == student.id).first()
    if not item:
        raise HTTPException(404, "Feedback not found")
    return _feedback_attachment(item)


@router.get("/feedback/{feedback_id}/attachment")
def admin_feedback_attachment(feedback_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return _feedback_attachment(get_or_404(db, StudentFeedback, str(feedback_id), detail="Feedback not found"))

@router.get("/feedback", response_model=List[StudentFeedbackResponse])
def get_feedback_reports(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(StudentFeedback)
    if status and status != "All":
        query = query.filter(StudentFeedback.status == status)
    if category and category != "All":
        query = query.filter(StudentFeedback.category == category)
    return query.order_by(StudentFeedback.created_at.desc()).all()


@router.put("/feedback/{feedback_id}", response_model=StudentFeedbackResponse)
def update_feedback_status(
    feedback_id: uuid.UUID,
    body: FeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    item = get_or_404(db, StudentFeedback, str(feedback_id), detail="Feedback report not found")
    item.status = body.status
    if body.admin_notes is not None:
        item.admin_notes = body.admin_notes
    if body.student_response is not None:
        item.student_response = body.student_response
    db.commit()
    db.refresh(item)
    return item


@router.get("/mc", response_model=List[MCReportResponse])
def get_mc_reports(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Query attendance records that have MC proof attached or MC status
    query = db.query(
        AttendanceRecord.id,
        AttendanceRecord.student_id,
        Student.name.label("student_name"),
        Student.student_code.label("student_code"),
        Course.course_name.label("course_name"),
        Course.course_code.label("course_code"),
        AttendanceRecord.mc_proof_url,
        AttendanceRecord.marked_at,
        AttendanceRecord.status,
        AttendanceRecord.flag_reason
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).join(
        ClassSession, AttendanceRecord.session_id == ClassSession.id
    ).join(
        Course, ClassSession.course_id == Course.id
    ).filter(
        (AttendanceRecord.mc_proof_url != None) | (AttendanceRecord.status == "mc_pending") | (AttendanceRecord.status == "mc_approved") | (AttendanceRecord.status == "mc_rejected")
    )

    if status and status != "All":
        if status == "Pending":
            query = query.filter(AttendanceRecord.status == "mc_pending")
        elif status == "Approved":
            query = query.filter(AttendanceRecord.status == "mc_approved")
        elif status == "Rejected":
            query = query.filter(AttendanceRecord.status == "mc_rejected")

    results = query.order_by(AttendanceRecord.marked_at.desc()).all()
    
    reports = []
    for r in results:
        reports.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.student_name,
            "student_code": r.student_code,
            "course_name": r.course_name,
            "course_code": r.course_code,
            "mc_proof_url": r.mc_proof_url,
            "timestamp": r.marked_at,   # outward key kept: the web report table reads it
            "status": "Approved" if r.status == "mc_approved" else "Rejected" if r.status == "mc_rejected" else "Pending",
            "flag_reason": r.flag_reason or "Medical Leave Certificate"
        })
    requests = db.query(AttendanceRequest, Student, Course).join(
        Student, Student.id == AttendanceRequest.student_id,
    ).join(Course, Course.id == AttendanceRequest.course_id).filter(
        AttendanceRequest.request_type == "leave", AttendanceRequest.proof_path.isnot(None),
    )
    if status and status != "All":
        requests = requests.filter(AttendanceRequest.status == status.lower())
    for row, student, course in requests.all():
        reports.append({
            "id": row.id, "source": "request", "student_id": student.id,
            "student_name": student.name, "student_code": student.student_code,
            "course_name": course.course_name, "course_code": course.course_code,
            "timestamp": iso_utc(row.created_at), "status": row.status.title(),
            "start_date": row.start_date.isoformat() if row.start_date else None,
            "end_date": row.end_date.isoformat() if row.end_date else None,
            "reason": row.reason, "file_name": row.proof_file_name,
            "file_type": row.proof_mime_type, "flag_reason": row.reviewer_note,
        })
    return sorted(reports, key=lambda item: str(item["timestamp"]), reverse=True)


@router.get("/mc/{request_id}/proof")
def get_mc_proof(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    row = db.query(AttendanceRequest).filter(
        AttendanceRequest.id == request_id, AttendanceRequest.request_type == "leave",
        AttendanceRequest.proof_path.isnot(None),
    ).first()
    if not row:
        raise HTTPException(404, "Medical proof not found")
    try:
        data = download_private_document(row.proof_path)
    except Exception as exc:
        raise HTTPException(503, "Download failed") from exc
    return Response(data, media_type=row.proof_mime_type or "application/octet-stream",
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.put("/mc/{record_id}", response_model=dict)
def update_mc_status(
    record_id: str,
    body: MCReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if body.source == "request":
        row = db.query(AttendanceRequest).filter(
            AttendanceRequest.id == record_id, AttendanceRequest.request_type == "leave",
            AttendanceRequest.proof_path.isnot(None),
        ).with_for_update().first()
        if not row:
            raise HTTPException(404, "Medical leave request not found")
        review_attendance_request(db, row, body.status.strip().lower(), current_user.id, "")
        db.commit()
        log_admin_action(db, current_user, "REVIEW_MEDICAL_LEAVE", f"Request {row.id}: {row.status}")
        return {"message": f"MC status updated to {body.status}"}
    if body.source != "attendance":
        raise HTTPException(400, "Invalid MC source")
    rec = get_or_404(db, AttendanceRecord, str(record_id), detail="Attendance record not found")
    new_status = body.status.lower()
    if new_status == "approved":
        rec.status = "mc_approved"
    elif new_status == "rejected":
        rec.status = "mc_rejected"
    else:
        rec.status = "mc_pending"
    db.commit()
    return {"message": f"MC status updated to {body.status}"}

import logging
import json
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
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import String, cast, case, literal, select

from db.database import get_db
from db.models import (
    AttendanceRecord,
    AttendanceRequest,
    ClassSession,
    Course,
    Student,
    StudentFeedback,
    User,
    UserNotification,
)
from domain.audit import log_admin_action
from domain.record_pages import RecordFilters, status_counts
from domain.medical_leave import review_attendance_request
from domain.notification_inbox import notify_administrators
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
    admin_notes: Optional[str] = Field(None, max_length=5000)
    student_response: Optional[str] = Field(None, max_length=5000)

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
    status: Literal["Approved", "Rejected"]
    source: Literal["attendance", "request"] = "attendance"
    reviewer_note: str = Field("", max_length=1000)

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
        notify_administrators(db, "feedback_submission", "New student feedback",
            f"{student.name} submitted a feedback report.", f"feedback:{item.id}:submitted", {"feedback_id": item.id})
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


def feedback_page(db, filters, student_id=None, category="All"):
    query = db.query(StudentFeedback)
    if student_id:
        query = query.filter(StudentFeedback.student_id == student_id)
    stats = status_counts(query, StudentFeedback.status) if student_id else {}
    if filters.status != "All":
        query = query.filter(StudentFeedback.status == filters.status)
    if category != "All":
        query = query.filter(StudentFeedback.category == category)
    query = filters.apply(query, StudentFeedback.created_at, [StudentFeedback.id, StudentFeedback.student_name,
        StudentFeedback.student_code, StudentFeedback.subject, StudentFeedback.message, StudentFeedback.category])
    return filters.fetch(query, [StudentFeedback.created_at.desc(), StudentFeedback.id.desc()],
        lambda row: StudentFeedbackResponse.model_validate(row).model_dump(exclude={"admin_notes"} if student_id else set()), stats)


@student_router.get("/page")
def student_feedback_page(filters: RecordFilters = Depends(), db: Session = Depends(get_db), user: User = Depends(require_student)):
    return feedback_page(db, filters, _feedback_student(db, user).id)


@router.get("/feedback/page")
def admin_feedback_page(filters: RecordFilters = Depends(), category: str = Query("All", max_length=64),
                        db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return feedback_page(db, filters, category=category)


@router.get("/mc/page")
def admin_mc_page(filters: RecordFilters = Depends(), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    # One SQL UNION before filtering/sorting/pagination; never fetch both whole tables.
    attendance = select(AttendanceRecord.id.label("id"), literal("attendance").label("source"),
        AttendanceRecord.student_id, Student.name.label("student_name"), Student.student_code,
        Course.course_name, Course.course_code, AttendanceRecord.mc_proof_url,
        AttendanceRecord.marked_at.label("timestamp"),
        case((AttendanceRecord.status == "mc_approved", "Approved"),
             (AttendanceRecord.status == "mc_rejected", "Rejected"), else_="Pending").label("status"),
        AttendanceRecord.flag_reason, cast(literal(None), String).label("start_date"),
        cast(literal(None), String).label("end_date"), cast(literal(None), String).label("reason"),
        cast(literal(None), String).label("file_name"), cast(literal(None), String).label("file_type"),
    ).join(Student, AttendanceRecord.student_id == Student.id).join(ClassSession, AttendanceRecord.session_id == ClassSession.id
    ).join(Course, ClassSession.course_id == Course.id).where(
        AttendanceRecord.mc_proof_url.isnot(None) | AttendanceRecord.status.in_(["mc_pending", "mc_approved", "mc_rejected"]))
    requests = select(AttendanceRequest.id, literal("request"), AttendanceRequest.student_id,
        Student.name, Student.student_code, Course.course_name, Course.course_code,
        cast(literal(None), String), AttendanceRequest.created_at,
        case((AttendanceRequest.status == "approved", "Approved"),
             (AttendanceRequest.status == "rejected", "Rejected"),
             (AttendanceRequest.status == "cancelled", "Cancelled"), else_="Pending"),
        AttendanceRequest.reviewer_note, cast(AttendanceRequest.start_date, String), cast(AttendanceRequest.end_date, String),
        AttendanceRequest.reason, AttendanceRequest.proof_file_name, AttendanceRequest.proof_mime_type,
    ).join(Student, AttendanceRequest.student_id == Student.id).join(Course, AttendanceRequest.course_id == Course.id
    ).where(AttendanceRequest.request_type == "leave", AttendanceRequest.proof_path.isnot(None))
    reports = attendance.union_all(requests).subquery()
    query = db.query(reports)
    if filters.status != "All":
        query = query.filter(reports.c.status == filters.status)
    query = filters.apply(query, reports.c.timestamp, [reports.c.student_name, reports.c.student_code,
        reports.c.course_name, reports.c.course_code])
    return filters.fetch(query, [reports.c.timestamp.desc(), reports.c.source, reports.c.id.desc()],
                         lambda row: dict(row._mapping))


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
    item = db.query(StudentFeedback).filter_by(id=str(feedback_id)).populate_existing().with_for_update().first()
    if not item:
        raise HTTPException(404, "Feedback report not found")
    previous_status, previous_response = item.status, item.student_response
    item.status = body.status
    if body.admin_notes is not None:
        item.admin_notes = body.admin_notes
    if body.student_response is not None:
        item.student_response = body.student_response
    if item.status != previous_status or item.student_response != previous_response:
        student = db.get(Student, item.student_id)
        if student and student.user_id:
            db.add(UserNotification(user_id=student.user_id, kind="feedback_response",
                title="Your feedback has an update", body="An administrator updated your feedback report. Open Contact Admin to view it.",
                dedupe_key=f"feedback:{item.id}:update:{uuid.uuid4()}", payload=json.dumps({"feedback_id": item.id})))
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
        review_attendance_request(db, row, body.status.strip().lower(), current_user.id, body.reviewer_note)
        db.commit()
        log_admin_action(db, current_user, "REVIEW_MEDICAL_LEAVE", f"Request {row.id}: {row.status}")
        return {"message": f"MC status updated to {body.status}"}
    if body.source != "attendance":
        raise HTTPException(400, "Invalid MC source")
    rec = db.query(AttendanceRecord).filter_by(id=str(record_id)).populate_existing().with_for_update().first()
    if not rec:
        raise HTTPException(404, 'Attendance record not found')
    previous_status = rec.status
    if body.reviewer_note.strip():
        rec.flag_reason = body.reviewer_note.strip()
    new_status = body.status.lower()
    if new_status == "approved":
        rec.status = "mc_approved"
    elif new_status == "rejected":
        rec.status = "mc_rejected"
    else:
        rec.status = "mc_pending"
    if previous_status != rec.status and new_status in ('approved', 'rejected'):
        student = db.get(Student, rec.student_id)
        if student and student.user_id:
            db.add(UserNotification(user_id=student.user_id, kind='request_decision',
                title=f'Medical certificate {new_status}',
                body='Your medical certificate was reviewed. Open medical leave to view the outcome.',
                dedupe_key=f'mc_review:{rec.id}:{uuid.uuid4()}',
                payload=json.dumps({'attendance_record_id': str(rec.id)})))
    db.commit()
    return {"message": f"MC status updated to {body.status}"}

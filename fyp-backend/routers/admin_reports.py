from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel

from utils.database import get_db
from utils.models import User, StudentFeedback, AttendanceRecord, Student, ClassSession, Course
from utils.security import require_admin
from utils.db_helpers import get_or_404

router = APIRouter(prefix="/admin/reports", tags=["Admin Reports"])

# --- Pydantic Schemas ---
class StudentFeedbackResponse(BaseModel):
    id: Any
    student_id: Optional[Any] = None
    student_name: str
    student_code: str
    subject: str
    category: str
    message: str
    status: str
    admin_notes: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True

class FeedbackUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class MCReportResponse(BaseModel):
    id: Any
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

# --- Endpoints ---

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
    feedback_id: str,
    body: FeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    item = get_or_404(db, StudentFeedback, str(feedback_id), "Feedback report not found")
    item.status = body.status
    if body.admin_notes is not None:
        item.admin_notes = body.admin_notes
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
        AttendanceRecord.timestamp,
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

    results = query.order_by(AttendanceRecord.timestamp.desc()).all()
    
    reports = []
    for r in results:
        reports.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.student_name,
            "student_code": r.student_code,
            "course_name": r.course_name,
            "course_code": r.course_code,
            "mc_proof_url": r.mc_proof_url or "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800",
            "timestamp": r.timestamp,
            "status": "Approved" if r.status == "mc_approved" else "Rejected" if r.status == "mc_rejected" else "Pending",
            "flag_reason": r.flag_reason or "Medical Leave Certificate"
        })
    return reports


@router.put("/mc/{record_id}", response_model=dict)
def update_mc_status(
    record_id: str,
    body: MCReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    rec = get_or_404(db, AttendanceRecord, str(record_id), "Attendance record not found")
    new_status = body.status.lower()
    if new_status == "approved":
        rec.status = "mc_approved"
    elif new_status == "rejected":
        rec.status = "mc_rejected"
    else:
        rec.status = "mc_pending"
    db.commit()
    return {"message": f"MC status updated to {body.status}"}

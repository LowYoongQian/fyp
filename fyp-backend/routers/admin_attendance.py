from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import timedelta
from utils.timeutil import iso_utc, utcnow
from typing import List

from db.database import get_db
from domain.session_sync import sync_class_sessions
from domain.scheduler import get_course_group_slots, session_window_utc
from db.models import User, Student, Course, Enrolment, ClassSession, AttendanceRecord
from utils.security import require_admin
from domain.attendance import require_session_enrolment
from domain.attendance_audit import attendance_snapshot, audit_attendance_edit
from utils.db_helpers import get_or_404
from schemas import (
    AdminAttendanceUpdateResponse, AdminAttendanceUpdate
)

router = APIRouter(prefix="/admin", tags=["Admin Attendance"])

# =====================================================================
# ATTENDANCE MONITORING & OVERRIDES
# =====================================================================

@router.get("/sessions", response_model=List[dict])
def get_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Persisting auto-open/close is owned by sync_class_sessions (throttled).
    # This handler then only READS and derives display status in-memory.
    sync_class_sessions()

    sessions = db.query(ClassSession).options(
        joinedload(ClassSession.course).joinedload(Course.lecturer)
    ).order_by(func.coalesce(ClassSession.scheduled_start, ClassSession.opened_at).desc(), ClassSession.id).all()

    # One clock for the whole response. Reading it per session let rows in the same
    # list be judged against different instants, so a list crossing a slot boundary
    # could contradict itself.
    now_utc = utcnow()
    result = []

    for s in sessions:
        course = s.course
        lecturer = course.lecturer if course else None

        is_open = s.is_open
        closed_at = s.closed_at

        if is_open:
            slots = get_course_group_slots(db, s.course_id, s.class_group)
            sched_start, sched_end = session_window_utc(s, slots)
            # An unscheduled session has no start time, so "not started yet" falls back
            # to a 10 minute grace window after it was opened.
            not_started_before = sched_start or (s.opened_at + timedelta(minutes=10))

            if now_utc > sched_end:
                is_open = False
                status_str = "Closed"
            elif now_utc < not_started_before:
                status_str = "Active"
            else:
                status_str = "On Going"
        else:
            status_str = {"scheduled": "Scheduled", "needs_attention": "Needs Review", "cancelled": "Cancelled"}.get(s.status, "Closed")
            
        result.append({
            "id": s.id,
            "course_id": s.course_id,
            "course_code": course.course_code if course else "Unknown",
            "course_name": course.course_name if course else "Unknown",
            "lecturer_name": lecturer.name if lecturer else "Unknown",
            "lecturer_role": lecturer.role if lecturer else "Lecturer",
            "class_group": s.class_group,
            "scheduled_start": iso_utc(s.scheduled_start),
            "scheduled_end": iso_utc(s.scheduled_end),
            "opened_at": iso_utc(s.opened_at),
            "closed_at": iso_utc(closed_at),
            "class_status": s.status,
            "is_open": is_open,
            "status": status_str
        })

    return result

@router.get("/sessions/{session_id}/attendance", response_model=dict)
def get_admin_session_attendance(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    session = get_or_404(db, ClassSession, session_id, "Session")

    course = get_or_404(db, Course, session.course_id, detail="Course associated with session not found")

    # Fetch all students enrolled in this course group
    query = db.query(Student).join(Enrolment).filter(Enrolment.course_id == session.course_id)
    if session.class_group != "All":
        query = query.filter(Enrolment.class_group == session.class_group)
    enrolled_students = query.all()

    # Fetch attendance records for this session
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == str(session_id)).all()
    record_map = {r.student_id: r for r in records}
    # A later allocation/group change must not hide the student's saved history
    # for this exact dated class; current group members still appear unrecorded.
    current_ids = {student.id for student in enrolled_students}
    historical_ids = set(record_map) - current_ids
    if historical_ids:
        enrolled_students.extend(db.query(Student).filter(Student.id.in_(historical_ids)).all())

    # Build student attendance status list
    attendance_list = []
    for s in enrolled_students:
        rec = record_map.get(s.id)
        if rec:
            attendance_list.append({
                "student_id": s.id,
                "student_name": s.name,
                "student_code": s.student_code,
                "status": rec.status,
                "marked_at": iso_utc(rec.marked_at),
                "method": rec.method,
                "confidence_score": rec.confidence_score,
                # Outward names kept for the clients: the column is network_verified,
                # and liveness_passed is NULL on rows where no check was attempted
                # (system-marked absences) while the web table types it as a boolean.
                "wifi_verified": bool(rec.network_verified),
                "liveness_passed": bool(rec.liveness_passed),
                "network_verified": getattr(rec, 'network_verified', False),
                "source_ip": getattr(rec, 'source_ip', None),
                "verify_detail": getattr(rec, 'verify_detail', None)
            })
        else:
            attendance_list.append({
                "student_id": s.id,
                "student_name": s.name,
                "student_code": s.student_code,
                "status": "unmarked",
                "marked_at": None,
                "confidence_score": None,
                "wifi_verified": False,
                "liveness_passed": False
            })

    return {
        "session_id": session.id,
        "course_name": course.course_name,
        "course_code": course.course_code,
        "class_group": session.class_group,
        "is_open": session.is_open,
        "class_status": session.status,
        "scheduled_start": iso_utc(session.scheduled_start),
        "scheduled_end": iso_utc(session.scheduled_end),
        "opened_at": iso_utc(session.opened_at),
        "closed_at": iso_utc(session.closed_at),
        "attendance_list": attendance_list
    }

@router.put("/attendance/{session_id}/{student_id}", response_model=AdminAttendanceUpdateResponse)
def update_admin_attendance(
    session_id: str, 
    student_id: str, 
    body: AdminAttendanceUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    if body.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'present' or 'absent'.")
        
    session = get_or_404(db, ClassSession, session_id, "Session")
    get_or_404(db, Student, student_id, "Student")
    # Same rule the lecturer override enforces. Being an admin is authority over WHOSE
    # register you may edit, not licence to invent a record for a student who never
    # took the course — that record would still land in attendance rates and the risk model.
    require_session_enrolment(db, session, student_id)

    # Serialise edits, including the first attendance row, so before/after timestamps
    # reflect each committed change rather than two admins racing the same student.
    student = db.query(Student).filter(Student.id == student_id).with_for_update().one()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.student_id == student_id
    ).first()

    before = attendance_snapshot(record)
    recorded_at = utcnow()
    if record:
        record.status = body.status
        record.method = f"admin_override:{current_user.id}"
        record.network_verified = body.wifi_verified
        record.liveness_passed = body.liveness_passed
        record.marked_at = recorded_at
    else:
        record = AttendanceRecord(
            session_id=str(session_id),
            student_id=str(student_id),
            status=body.status,
            method=f"admin_override:{current_user.id}",
            confidence_score=1.0,
            network_verified=body.wifi_verified,
            liveness_passed=body.liveness_passed,
            marked_at=recorded_at
        )
        db.add(record)

    audit_attendance_edit(db, current_user, session, student, before, record)
    db.commit()
    return {"message": "Attendance record updated successfully", "marked_at": iso_utc(recorded_at), "method": record.method}

"""Apply approved leave without replacing actual attendance or unrelated classes."""
import json

from fastapi import HTTPException

from db.models import (
    AttendanceRecord,
    AttendanceRequest,
    ClassSession,
    Course,
    Enrolment,
    Student,
    UserNotification,
)
from utils.timeutil import local_offset, utcnow


def _credit_leave(db, request, session):
    enrolment = db.query(Enrolment).filter(
        Enrolment.student_id == request.student_id,
        Enrolment.course_id == session.course_id,
    ).first()
    if not enrolment or session.class_group not in ("All", enrolment.class_group):
        return
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == request.student_id,
        AttendanceRecord.session_id == session.id,
    ).first()
    if record and record.status not in ("absent", "mc_pending", "mc_rejected"):
        return
    if not record:
        record = AttendanceRecord(student_id=request.student_id, session_id=session.id)
        db.add(record)
    record.status = "leave"
    record.method = f"staff_override:{request.reviewer_user_id}"
    record.marked_at = request.reviewed_at or utcnow()
    db.flush()


def apply_approved_medical_leave(db, session):
    start = session.scheduled_start or session.opened_at
    if session.status != "completed" or not start:
        return
    class_date = (start + local_offset()).date()
    requests = db.query(AttendanceRequest).filter(
        AttendanceRequest.course_id == session.course_id,
        AttendanceRequest.request_type == "leave",
        AttendanceRequest.status == "approved",
        AttendanceRequest.session_id.is_(None),
        AttendanceRequest.start_date <= class_date,
        AttendanceRequest.end_date >= class_date,
    ).order_by(AttendanceRequest.reviewed_at.asc()).all()
    for request in requests:
        _credit_leave(db, request, session)


def review_attendance_request(db, row, decision, reviewer_id, note):
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be approved or rejected")
    if row.status != "pending":
        raise HTTPException(409, "This request has already been reviewed")
    row.status, row.reviewer_user_id = decision, reviewer_id
    row.reviewer_note, row.reviewed_at = note.strip() or None, utcnow()
    db.flush()
    if decision == "approved":
        if row.session_id:
            session = db.get(ClassSession, row.session_id)
            if row.request_type == "leave":
                _credit_leave(db, row, session)
            else:
                record = db.query(AttendanceRecord).filter(
                    AttendanceRecord.student_id == row.student_id,
                    AttendanceRecord.session_id == row.session_id,
                ).first()
                if not record:
                    record = AttendanceRecord(student_id=row.student_id, session_id=row.session_id)
                    db.add(record)
                record.status, record.method = "present", f"staff_override:{reviewer_id}"
        elif row.start_date and row.end_date:
            for session in db.query(ClassSession).filter(
                ClassSession.course_id == row.course_id, ClassSession.status == "completed",
            ).all():
                apply_approved_medical_leave(db, session)
    student, course = db.get(Student, row.student_id), db.get(Course, row.course_id)
    if student.user_id:
        db.add(UserNotification(
            user_id=student.user_id, kind="request_decision", title=f"Request {decision}",
            body=f"Your {row.request_type} request for {course.course_code} was {decision}.",
            dedupe_key=f"request:{row.id}:{decision}",
            payload=json.dumps({"request_id": row.id}),
        ))

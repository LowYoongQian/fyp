"""Keep attendance edits and the timestamps/evidence they replace in one transaction."""
import json

from domain.audit import log_audit_event
from utils.timeutil import iso_utc


def attendance_snapshot(record):
    if record is None:
        return None
    return {"status": record.status, "marked_at": iso_utc(record.marked_at), "method": record.method,
            "network_verified": record.network_verified, "liveness_passed": record.liveness_passed,
            "source_ip": record.source_ip, "confidence_score": record.confidence_score}


def audit_attendance_edit(db, user, session, student, before, record):
    log_audit_event(db, user_id=user.id, user_name=user.profile_name or user.email,
        user_role=user.role, category="admin" if user.role == "admin" else "staff", action="Attendance record updated",
        details=json.dumps({"session_id": str(session.id), "student_id": str(student.id),
            "student_code": student.student_code, "student_name": student.name,
            "course_id": str(session.course_id), "course_code": session.course.course_code,
            "class_group": session.class_group, "scheduled_start": iso_utc(session.scheduled_start),
            "scheduled_end": iso_utc(session.scheduled_end), "before": before, "after": attendance_snapshot(record)},
            sort_keys=True), commit=False)

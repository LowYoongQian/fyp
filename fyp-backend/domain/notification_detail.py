"""Read-only detail of the record a notice refers to, for people whose page has no view of it.

The notice itself is the capability: it must belong to the caller, and the record id is read from its stored payload on
the server (never supplied by the client). Access is re-checked against the caller's CURRENT role and assignments, so a
notice that outlived someone's access shows nothing. No workflow status is read for change or changed here.
"""
import json
import re

from fastapi import HTTPException

from db.models import AttendanceRequest, ClassMeeting, ClassSession, Course, Enrolment, Lecturer, Student, UserNotification
from utils.db_helpers import my_course_ids
from utils.timeutil import iso_utc

SESSION_KINDS = {"class_needs_attention", "class_attention_escalated", "class_cancelled", "replacement_class"}
REQUEST_KINDS = {"attendance_request", "medical_submission", "request_decision"}
UUID_TEXT = re.compile(r"^[0-9a-fA-F-]{32,36}$")


def _payload(row):
    try:
        data = json.loads(row.payload or "{}")
    except (ValueError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def _record_id(data, *names):
    for name in names:
        value = data.get(name)
        if isinstance(value, str) and UUID_TEXT.match(value):
            return value
    return None


def _staff_course_ids(db, user):
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == user.id).first()
    return set(my_course_ids(db, lecturer.id)) if lecturer else set()


def _student(db, user):
    return db.query(Student).filter(Student.user_id == user.id).first()


def _may_see_course(db, user, course_id, class_group=None, student=None):
    if user.role == "admin":
        return True
    if user.role == "lecturer":
        return course_id in _staff_course_ids(db, user)
    if user.role == "student":
        student = student or _student(db, user)
        if not student:
            return False
        enrolment = db.query(Enrolment).filter(Enrolment.student_id == student.id, Enrolment.course_id == course_id).first()
        return bool(enrolment) and (not class_group or class_group == "All" or enrolment.class_group == class_group)
    return False


def _session_item(db, session, course):
    meeting = db.get(ClassMeeting, session.meeting_id) if session.meeting_id else None
    lecturer = db.get(Lecturer, meeting.lecturer_id) if meeting and meeting.lecturer_id else None
    original = db.get(ClassSession, session.replacement_for_session_id) if session.replacement_for_session_id else None
    return {
        "id": session.id, "course_code": course.course_code, "course_name": course.course_name,
        "class_group": session.class_group, "status": session.status, "room": session.room or (meeting.room if meeting else None),
        "scheduled_start": iso_utc(session.scheduled_start), "scheduled_end": iso_utc(session.scheduled_end),
        "opened_at": iso_utc(session.opened_at), "closed_at": iso_utc(session.closed_at),
        "cancelled_at": iso_utc(session.cancelled_at), "cancel_reason": session.cancel_reason,
        "is_replacement": bool(session.replacement_for_session_id), "lecturer_name": lecturer.name if lecturer else None,
        "replaces": {"scheduled_start": iso_utc(original.scheduled_start), "scheduled_end": iso_utc(original.scheduled_end),
                     "status": original.status} if original else None,
    }


def _request_item(row, course, student, viewer):
    return {
        "id": row.id, "request_type": row.request_type, "status": row.status,
        "course_code": course.course_code, "course_name": course.course_name,
        # Staff and administrators need to know whose request it is; students only ever see their own.
        "student_name": student.name if student and viewer.role != "student" else None,
        "student_code": student.student_code if student and viewer.role != "student" else None,
        "reason": row.reason, "reviewer_note": row.reviewer_note, "created_at": iso_utc(row.created_at),
        "reviewed_at": iso_utc(row.reviewed_at), "session_id": row.session_id,
        "start_date": row.start_date.isoformat() if row.start_date else None,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "has_proof": bool(row.proof_path), "proof_file_name": row.proof_file_name,
    }


def notification_detail(db, user, notification_id):
    row = db.query(UserNotification).filter(UserNotification.id == notification_id, UserNotification.user_id == user.id).first()
    if not row:
        raise HTTPException(404, "Notification not found.")
    data = _payload(row)
    if row.kind in SESSION_KINDS:
        session_id = _record_id(data, "class_id")
        session = db.get(ClassSession, session_id) if session_id else None
        course = db.get(Course, session.course_id) if session else None
        if not session or not course:
            raise HTTPException(404, "This class is no longer available.")
        if not _may_see_course(db, user, session.course_id, session.class_group):
            raise HTTPException(403, "You no longer have access to this class.")
        return {"kind": "session", "item": _session_item(db, session, course)}
    if row.kind in REQUEST_KINDS:
        request_id = _record_id(data, "request_id")
        request = db.get(AttendanceRequest, request_id) if request_id else None
        course = db.get(Course, request.course_id) if request else None
        if not request or not course:
            raise HTTPException(404, "This request is no longer available.")
        student = db.get(Student, request.student_id)
        owner_ok = user.role == "student" and student is not None and student.user_id == user.id
        if not (owner_ok or (user.role != "student" and _may_see_course(db, user, request.course_id))):
            raise HTTPException(403, "You no longer have access to this request.")
        return {"kind": "request", "item": _request_item(request, course, student, user)}
    raise HTTPException(404, "This notification has no detail view.")

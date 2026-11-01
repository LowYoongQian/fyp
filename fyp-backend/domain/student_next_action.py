"""The single next step shown to a student (STUDENT-NEXT-06), decided once on the server for the web dashboard and the mobile app.

Order: an open class this student can still check into comes first. If a face is not registered yet, that is offered instead, because it
blocks the check-in. With no open class, an outstanding required setup comes next (face), then the recommended one (a verified personal
email, used for notices and password resets only, never as a sign-in), then the next class this semester. Nothing here changes data.
"""
from sqlalchemy.orm import Session

from db.models import Enrolment, Student, User


def _session_brief(item: dict) -> dict:
    return {key: item[key] for key in ("id", "course_id", "course_code", "course_name", "class_group", "scheduled_start", "scheduled_end", "room")}


def decide(db: Session, user: User, student: Student, open_sessions: list, upcoming) -> dict:
    waiting = sorted((s for s in open_sessions if not s["already_checked_in"]),
                     key=lambda s: (s["scheduled_start"] is None, s["scheduled_start"] or "", str(s["id"])))
    checked_in = len(open_sessions) - len(waiting)
    base = {"checked_in": checked_in, "waiting": len(waiting), "face_registered": bool(student.is_face_registered),
            "email_verified": bool(user.recovery_email_verified), "session": None, "next_class": None}
    face = bool(student.is_face_registered)
    if waiting:
        return {**base, "action": "check_in" if face else "register_face", "session": _session_brief(waiting[0])}
    if not face:
        return {**base, "action": "register_face"}
    if not user.recovery_email_verified:
        return {**base, "action": "verify_email"}
    if upcoming:
        starts, ends, meeting, course = upcoming
        return {**base, "action": "view_next_class", "next_class": {
            "course_id": course.id, "course_code": course.course_code, "course_name": course.course_name, "role": meeting.role,
            "room": meeting.room, "day": meeting.day, "start": meeting.start, "end": meeting.end,
            "starts_at_local": starts.strftime("%Y-%m-%dT%H:%M"), "meeting_id": meeting.id}}
    enrolled = db.query(Enrolment.id).filter(Enrolment.student_id == student.id).first() is not None
    return {**base, "action": "none", "reason": "no_upcoming_class" if enrolled else "no_enrolment"}

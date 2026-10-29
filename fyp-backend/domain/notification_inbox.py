"""Recipient-owned inbox counts and destinations; no workflow status is changed."""
import json
from uuid import uuid4

from sqlalchemy import String, and_, case, cast, exists, func, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from db.models import AttendanceRequest, Student, User, UserNotification
from utils.timeutil import iso_utc, utcnow

TAB_KINDS = {
    "admin": {
        "feedback_submission": "admin_reports_feedback", "medical_submission": "admin_reports_mc",
        "attendance_request": "admin_attendance", "class_needs_attention": "admin_attendance",
        "class_attention_escalated": "admin_attendance", "timetable_change": "admin_timetable",
        "class_cancelled": "admin_timetable", "replacement_class": "admin_timetable",
        "course_announcement": "admin_announcements", "general_announcement": "admin_announcements",
    },
    "student": {
        "feedback_response": "student_contact", "request_decision": "student_mc",
        "timetable_change": "student_timetable", "class_cancelled": "student_timetable",
        "replacement_class": "student_timetable",
    },
    "lecturer": {
        "attendance_request": "attendance", "timetable_change": "timetable",
        "class_cancelled": "timetable", "replacement_class": "timetable",
        "course_announcement": "course_announcements",
    },
}
DEFAULT_TABS = {"admin": "admin_dashboard", "student": "student_dashboard", "lecturer": "dashboard"}


def tab_expression(role):
    rules = [(UserNotification.kind == kind, tab) for kind, tab in TAB_KINDS[role].items()]
    if role == "student":
        # Preserve legacy/mobile decision kinds; corrections belong on Dashboard.
        owner_students = select(Student.id).where(Student.user_id == UserNotification.user_id).correlate(UserNotification)
        correction = exists().where(and_(AttendanceRequest.request_type == "correction",
            AttendanceRequest.student_id.in_(owner_students),
            func.replace(UserNotification.dedupe_key, "-", "").like(
                "request:" + func.replace(cast(AttendanceRequest.id, String), "-", "") + ":%"))).correlate(UserNotification)
        rules.insert(0, (and_(UserNotification.kind == "request_decision", correction), "student_dashboard"))
    return case(*rules, else_=DEFAULT_TABS[role])


def inbox_counts(db, user):
    target = tab_expression(user.role)
    counts = dict(db.query(target, func.count(UserNotification.id)).filter(
        UserNotification.user_id == user.id, UserNotification.read_at.is_(None)
    ).group_by(target).all())
    return {"unread_count": sum(counts.values()), "by_tab": counts}


def public_notification(row, target):
    try:
        payload = json.loads(row.payload or "{}")
    except (ValueError, TypeError):
        payload = {}
    return {"id": row.id, "kind": row.kind, "title": row.title, "body": row.body,
        "payload": payload if isinstance(payload, dict) else {}, "target_tab": target,
        "is_read": row.read_at is not None, "created_at": iso_utc(row.created_at)}


def enqueue_notification(db, user_id, kind, title, body, dedupe_key, payload=None):
    if not user_id:
        return
    # Concurrent tabs/workers may discover the same notice; ignore only that
    # dedupe conflict, without rolling back the associated business transaction.
    insert = postgres_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    db.execute(insert(UserNotification).values(id=str(uuid4()), user_id=user_id, kind=kind,
        title=title, body=body, dedupe_key=dedupe_key, payload=json.dumps(payload or {}), created_at=utcnow())
        .on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"]))


def notify_administrators(db, kind, title, body, dedupe_key, payload):
    # The caller commits the business change and recipient notices together.
    for (user_id,) in db.query(User.id).filter(User.role == "admin", User.status == "Active"):
        enqueue_notification(db, user_id, kind, title, body, dedupe_key, payload)

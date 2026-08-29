import json
import math
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import (
    Announcement, AttendanceRecord, AttendanceRequest, ClassMeeting, ClassSession, Course,
    CourseStaffAssignment, Enrolment, Lecturer, Student, User, UserNotification,
)
from domain.attendance import session_hours
from domain.announcements import visible_announcements
from utils.db_helpers import my_course_ids, require_own_profile
from utils.security import get_current_user, require_lecturer, require_student
from utils.timeutil import campus_now, iso_utc, local_offset, utcnow

router = APIRouter(tags=["Attendance experience"])
TARGET_RATE = 80.0


class AttendanceRequestCreate(BaseModel):
    course_id: str
    session_id: str | None = None
    request_type: str
    reason: str = Field(min_length=10, max_length=1000)


class AttendanceRequestReview(BaseModel):
    status: str
    note: str = Field(default="", max_length=1000)


def add_notification(db: Session, user_id: str, kind: str, title: str, body: str,
                     dedupe_key: str, payload: dict | None = None) -> None:
    if not user_id or db.query(UserNotification.id).filter(
        UserNotification.user_id == user_id,
        UserNotification.dedupe_key == dedupe_key,
    ).first():
        return
    db.add(UserNotification(
        user_id=user_id, kind=kind, title=title, body=body,
        dedupe_key=dedupe_key,
        payload=json.dumps(payload or {}, separators=(",", ":")),
    ))


def ensure_course_announcement_notifications(db: Session, user: User, student: Student) -> None:
    enrolments = db.query(Course.course_code, Enrolment.class_group).join(
        Enrolment, Enrolment.course_id == Course.id).filter(Enrolment.student_id == student.id).all()
    courses = {code for code, _group in enrolments if code}
    groups: dict[str, set[str]] = {}
    for code, group in enrolments:
        if code and group:
            groups.setdefault(code.upper(), set()).add(group)
    programmes = {student.programme.code} if getattr(student, "programme", None) else set()
    for row in visible_announcements(db, "students", programmes, courses, groups):
        if not row.creator_user_id:
            continue
        add_notification(db, user.id, "course_announcement", row.title,
            f"{row.target_course_code}: {row.content[:180]}", f"announcement:{row.id}",
            {"announcement_id": row.id, "course_code": row.target_course_code})


def notify_timetable_change(db: Session, meeting: ClassMeeting, old_slot: str) -> None:
    course = meeting.course or db.get(Course, meeting.course_id)
    if meeting.lecturer_id:
        lecturer = db.get(Lecturer, meeting.lecturer_id)
        if lecturer and lecturer.user_id:
            new_slot = f"{meeting.day} {meeting.start}-{meeting.end}, {meeting.room}"
            add_notification(
                db, lecturer.user_id, "timetable_change", "Class time changed",
                f"{course.course_code}: {old_slot} → {new_slot}",
                f"meeting:{meeting.id}:{meeting.day}:{meeting.start}:{meeting.end}:{meeting.room}",
                {"meeting_id": meeting.id, "course_id": meeting.course_id},
            )
    enrolments = db.query(Enrolment).filter(Enrolment.course_id == meeting.course_id).all()
    for enrolment in enrolments:
        if meeting.class_group and enrolment.class_group != meeting.class_group:
            continue
        student = db.get(Student, enrolment.student_id)
        if student and student.user_id:
            new_slot = f"{meeting.day} {meeting.start}-{meeting.end}, {meeting.room}"
            add_notification(
                db, student.user_id, "timetable_change", "Class time changed",
                f"{course.course_code}: {old_slot} → {new_slot}",
                f"meeting:{meeting.id}:{meeting.day}:{meeting.start}:{meeting.end}:{meeting.room}",
                {"meeting_id": meeting.id, "course_id": meeting.course_id},
            )


def _request_dict(row: AttendanceRequest, course: Course, student: Student | None = None) -> dict:
    return {
        "id": row.id,
        "student_id": row.student_id,
        "student_name": student.name if student else None,
        "student_code": student.student_code if student else None,
        "course_id": row.course_id,
        "course_code": course.course_code,
        "course_name": course.course_name,
        "session_id": row.session_id,
        "request_type": row.request_type,
        "reason": row.reason,
        "status": row.status,
        "reviewer_note": row.reviewer_note,
        "created_at": iso_utc(row.created_at),
        "reviewed_at": iso_utc(row.reviewed_at),
        "start_date": row.start_date.isoformat() if row.start_date else None,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "proof_file_name": row.proof_file_name,
        "has_proof": bool(row.proof_path),
        "ai_verdict": row.ai_verdict,
        "ai_confidence": row.ai_confidence,
        "ai_summary": row.ai_summary,
    }


def _next_meeting(db: Session, student: Student):
    enrolments = db.query(Enrolment).filter(Enrolment.student_id == student.id).all()
    groups = {e.course_id: e.class_group for e in enrolments}
    meetings = db.query(ClassMeeting, Course).join(Course, Course.id == ClassMeeting.course_id).filter(
        ClassMeeting.course_id.in_(list(groups))
    ).all() if groups else []
    now = campus_now()
    candidates = []
    for meeting, course in meetings:
        if meeting.class_group and meeting.class_group != groups.get(meeting.course_id):
            continue
        try:
            weekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].index(meeting.day)
            days = (weekday - now.weekday()) % 7
            starts = datetime.combine((now + timedelta(days=days)).date(), datetime.strptime(meeting.start, "%H:%M").time())
            ends = datetime.combine(starts.date(), datetime.strptime(meeting.end, "%H:%M").time())
            if ends < now:
                starts += timedelta(days=7)
                ends += timedelta(days=7)
            candidates.append((starts, ends, meeting, course))
        except (ValueError, TypeError):
            continue
    return min(candidates, key=lambda item: item[0]) if candidates else None


def _ensure_reminder(db: Session, current_user: User, student: Student) -> None:
    item = _next_meeting(db, student)
    if not item:
        return
    starts, _, meeting, course = item
    minutes = int((starts - campus_now()).total_seconds() // 60)
    if 0 <= minutes <= 60:
        date_key = starts.strftime("%Y-%m-%d")
        add_notification(
            db, current_user.id, "class_reminder", "Class starts soon",
            f"{course.course_code} starts at {meeting.start} in {meeting.room}.",
            f"reminder:{meeting.id}:{date_key}",
            {"meeting_id": meeting.id, "course_id": course.id, "starts_in_minutes": minutes},
        )


@router.get("/students/me/attendance-overview")
def student_attendance_overview(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    enrolments = db.query(Enrolment, Course).join(Course, Course.id == Enrolment.course_id).filter(
        Enrolment.student_id == student.id
    ).all()
    course_ids = [course.id for _, course in enrolments]
    sessions = db.query(ClassSession).filter(
        ClassSession.course_id.in_(course_ids), ClassSession.status == "completed"
    ).all() if course_ids else []
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.session_id.in_([s.id for s in sessions]),
    ).all() if sessions else []
    record_by_session = {r.session_id: r for r in records}

    targets = []
    for enrolment, course in enrolments:
        held = [s for s in sessions if s.course_id == course.id and s.class_group in ("All", enrolment.class_group)]
        total = sum(session_hours(s.opened_at, s.closed_at,
                                  scheduled_start=s.scheduled_start, scheduled_end=s.scheduled_end) for s in held)
        earned = sum(
            session_hours(s.opened_at, s.closed_at,
                          scheduled_start=s.scheduled_start, scheduled_end=s.scheduled_end) for s in held
            if record_by_session.get(s.id) and record_by_session[s.id].status in ("present", "leave")
        )
        rate = round((earned / total * 100) if total else 100.0, 1)
        average = (total / len(held)) if held else 2.0
        needed = 0 if rate >= TARGET_RATE else math.ceil(
            max(0.0, (TARGET_RATE / 100 * total - earned) / ((1 - TARGET_RATE / 100) * average))
        )
        targets.append({
            "course_id": course.id, "course_code": course.course_code, "course_name": course.course_name,
            "current_rate": rate, "target_rate": TARGET_RATE, "sessions_needed": needed,
            "risk": "safe" if rate >= TARGET_RATE else ("warning" if rate >= 70 else "high"),
            "message": "Target met" if needed == 0 else f"Attend the next {needed} class{'es' if needed != 1 else ''} to reach 80%.",
        })

    upcoming = _next_meeting(db, student)
    open_sessions = db.query(ClassSession).filter(
        ClassSession.course_id.in_(course_ids), ClassSession.is_open == True  # noqa: E712
    ).all() if course_ids else []
    group_by_course = {enrolment.course_id: enrolment.class_group for enrolment, _ in enrolments}
    active = next((session for session in open_sessions if session.class_group in (
        "All", group_by_course.get(session.course_id)
    )), None)
    readiness = {"state": "no_class", "title": "No upcoming class", "next_class": None, "checks": []}
    if upcoming:
        starts, ends, meeting, course = upcoming
        minutes = max(0, int((starts - campus_now()).total_seconds() // 60))
        readiness = {
            "state": "ready" if student.is_face_registered else "action_needed",
            "title": "Ready for check-in" if student.is_face_registered else "Set up face recognition",
            "next_class": {
                "course_code": course.course_code, "course_name": course.course_name,
                "role": meeting.role, "room": meeting.room, "day": meeting.day,
                "start": meeting.start, "end": meeting.end, "starts_in_minutes": minutes,
            },
            "checks": [
                {"label": "Timetable", "ready": True, "detail": f"{meeting.day}, {meeting.start}"},
                {"label": "Face profile", "ready": bool(student.is_face_registered), "detail": "Ready" if student.is_face_registered else "Set up required"},
                {"label": "Session window", "ready": active is not None, "detail": "Open now" if active else "Opens near class time"},
            ],
        }
    _ensure_reminder(db, current_user, student)
    db.commit()
    return {"readiness": readiness, "targets": targets}


@router.get("/students/me/attendance-requests")
def student_requests(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = db.query(AttendanceRequest, Course).join(Course, Course.id == AttendanceRequest.course_id).filter(
        AttendanceRequest.student_id == student.id
    ).order_by(AttendanceRequest.created_at.desc()).all()
    return [_request_dict(row, course) for row, course in rows]


@router.get("/students/me/attendance-sessions")
def student_attendance_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Closed assigned sessions, including absences that have no AttendanceRecord."""
    student = require_own_profile(db, Student, current_user.id, "Student")
    enrolments = db.query(Enrolment).filter(Enrolment.student_id == student.id).all()
    groups = {row.course_id: row.class_group for row in enrolments}
    if not groups:
        return []
    sessions = db.query(ClassSession, Course).join(Course, Course.id == ClassSession.course_id).filter(
        ClassSession.course_id.in_(list(groups)), ClassSession.status == "completed"
    ).order_by(ClassSession.scheduled_start.asc().nullslast()).all()
    assigned_sessions = [
        (session, course) for session, course in sessions
        if session.class_group in ("All", groups[session.course_id])
    ]
    semester_start = None
    if assigned_sessions:
        first_opened = assigned_sessions[0][0].scheduled_start or assigned_sessions[0][0].opened_at
        semester_start = first_opened.date() - timedelta(days=first_opened.weekday())
    session_ids = [session.id for session, _ in assigned_sessions]
    records = {
        row.session_id: row for row in db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.session_id.in_(session_ids),
        ).all()
    }
    meetings = db.query(ClassMeeting).filter(
        ClassMeeting.course_id.in_(list(groups))
    ).all()
    lecturer_ids = {meeting.lecturer_id for meeting in meetings if meeting.lecturer_id}
    lecturer_by_id = {
        row.id: row for row in db.query(Lecturer).filter(Lecturer.id.in_(lecturer_ids)).all()
    } if lecturer_ids else {}
    approved_requests = {
        row.session_id: row for row in db.query(AttendanceRequest).filter(
            AttendanceRequest.student_id == student.id,
            AttendanceRequest.session_id.in_(session_ids),
            AttendanceRequest.status == "approved",
        ).order_by(AttendanceRequest.reviewed_at.asc()).all()
    } if session_ids else {}
    actor_ids = {
        request.reviewer_user_id for request in approved_requests.values()
        if request.reviewer_user_id
    }
    for record in records.values():
        method = record.method or ""
        if ":" in method and method.split(":", 1)[0] in ("admin_override", "staff_override"):
            actor_ids.add(method.split(":", 1)[1])
    actor_by_id = {
        row.id: row for row in db.query(User).filter(User.id.in_(actor_ids)).all()
    } if actor_ids else {}

    def actor_name(user_id: str | None, fallback: str) -> str:
        user = actor_by_id.get(user_id) if user_id else None
        return (user.profile_name or user.email) if user else fallback

    def matching_meeting(session: ClassSession) -> ClassMeeting | None:
        local_start = session.opened_at + local_offset()
        day = local_start.strftime("%A")
        start = local_start.strftime("%H:%M")
        candidates = [
            meeting for meeting in meetings
            if meeting.course_id == session.course_id
            and meeting.day == day
            and meeting.start == start
        ]
        if session.class_group == "All":
            return next((meeting for meeting in candidates if not meeting.class_group), None)
        return next(
            (meeting for meeting in candidates if meeting.class_group == session.class_group),
            None,
        )

    def session_dict(session: ClassSession, course: Course) -> dict:
        meeting = matching_meeting(session)
        record = records.get(session.id)
        request = approved_requests.get(session.id)
        class_type = meeting.role if meeting else (
            "Lecture" if session.class_group == "All" else "Class"
        )
        lecturer = lecturer_by_id.get(meeting.lecturer_id) if meeting else course.lecturer
        method = record.method if record else ""
        if method and ":" in method and method.split(":", 1)[0] in ("admin_override", "staff_override"):
            taken_by = actor_name(method.split(":", 1)[1], "Staff")
        elif request and request.reviewer_user_id:
            taken_by = actor_name(request.reviewer_user_id, "Staff")
        elif record and record.source_ip == "Staff Override":
            taken_by = "Staff"
        elif record and record.status == "absent":
            taken_by = "System"
        elif record:
            taken_by = "Student (You)"
        else:
            taken_by = "System"
        return {
            "session_id": session.id, "course_id": course.id,
            "course_code": course.course_code, "course_name": course.course_name,
            "class_group": session.class_group,
            "enrolled_group": groups[session.course_id],
            "class_type": class_type,
            "room": meeting.room if meeting else None,
            "staff_name": lecturer.name if lecturer else "Not assigned",
            "staff_role": class_type,
            "status": record.status if record else "absent",
            "taken_by": taken_by,
            "taken_at": iso_utc(request.reviewed_at) if request and request.reviewed_at else iso_utc(record.marked_at) if record else None,
            "network_ip": record.source_ip if record else None,
            "device_ip": record.local_ip if record else None,
            "device_id": record.device_id if record else None,
            "opened_at": iso_utc(session.opened_at),
            "closed_at": iso_utc(session.closed_at),
            "week_number": ((session.opened_at.date() - semester_start).days // 7) + 1 if semester_start else 1,
        }

    return [session_dict(session, course) for session, course in reversed(assigned_sessions)]


@router.post("/students/me/attendance-requests", status_code=201)
def create_student_request(body: AttendanceRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    kind = body.request_type.strip().lower()
    if kind not in ("leave", "correction"):
        raise HTTPException(400, "Request type must be leave or correction")
    enrolment = db.query(Enrolment).filter(Enrolment.student_id == student.id, Enrolment.course_id == body.course_id).first()
    course = db.get(Course, body.course_id)
    if not enrolment or not course:
        raise HTTPException(404, "Enrolled course not found")
    session = db.get(ClassSession, body.session_id) if body.session_id else None
    if not session:
        raise HTTPException(400, "Select the class session for this request")
    if session and (session.course_id != course.id or session.class_group not in ("All", enrolment.class_group)):
        raise HTTPException(403, "This class session is not assigned to you")
    duplicate = db.query(AttendanceRequest.id).filter(
        AttendanceRequest.student_id == student.id,
        AttendanceRequest.course_id == course.id,
        AttendanceRequest.session_id == body.session_id,
        AttendanceRequest.request_type == kind,
        AttendanceRequest.status == "pending",
    ).first()
    if duplicate:
        raise HTTPException(409, "A matching request is already pending")
    row = AttendanceRequest(student_id=student.id, course_id=course.id, session_id=body.session_id,
                            request_type=kind, reason=body.reason.strip())
    db.add(row)
    db.flush()
    staff_ids = {course.lecturer_id} if course.lecturer_id else set()
    staff_ids.update(a.lecturer_id for a in db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == course.id).all())
    for lecturer in db.query(Lecturer).filter(Lecturer.id.in_(staff_ids)).all() if staff_ids else []:
        add_notification(db, lecturer.user_id, "attendance_request", "New attendance request",
                         f"{student.name} sent a {kind} request for {course.course_code}.",
                         f"request:{row.id}:submitted", {"request_id": row.id})
    db.commit()
    db.refresh(row)
    return _request_dict(row, course)


@router.patch("/students/me/attendance-requests/{request_id}/cancel")
def cancel_student_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    row = db.query(AttendanceRequest).filter(AttendanceRequest.id == request_id, AttendanceRequest.student_id == student.id).first()
    if not row:
        raise HTTPException(404, "Request not found")
    if row.status != "pending":
        raise HTTPException(409, "Only pending requests can be cancelled")
    row.status = "cancelled"
    db.commit()
    return {"message": "Request cancelled"}


@router.get("/lecturers/me/attendance-requests")
def lecturer_requests(status: str = "pending", db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    query = db.query(AttendanceRequest, Course, Student).join(Course, Course.id == AttendanceRequest.course_id).join(Student, Student.id == AttendanceRequest.student_id)
    if current_user.role != "admin":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        query = query.filter(AttendanceRequest.course_id.in_(my_course_ids(db, lecturer.id)))
    if status != "all":
        query = query.filter(AttendanceRequest.status == status)
    return [_request_dict(row, course, student) for row, course, student in query.order_by(AttendanceRequest.created_at.desc()).all()]


@router.patch("/lecturers/me/attendance-requests/{request_id}")
def review_request(request_id: str, body: AttendanceRequestReview, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    decision = body.status.strip().lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be approved or rejected")
    row = db.get(AttendanceRequest, request_id)
    if not row:
        raise HTTPException(404, "Request not found")
    if row.status != "pending":
        raise HTTPException(409, "This request has already been reviewed")
    if current_user.role != "admin":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        if row.course_id not in my_course_ids(db, lecturer.id):
            raise HTTPException(403, "This request is outside your courses")
    if decision == "approved" and row.session_id:
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == row.student_id, AttendanceRecord.session_id == row.session_id
        ).first()
        if record:
            record.status = "leave" if row.request_type == "leave" else "present"
            record.method = "staff_adjustment"
        else:
            db.add(AttendanceRecord(student_id=row.student_id, session_id=row.session_id,
                                    status="leave" if row.request_type == "leave" else "present",
                                    method="staff_adjustment"))
    row.status, row.reviewer_user_id, row.reviewer_note, row.reviewed_at = decision, current_user.id, body.note.strip() or None, utcnow()
    student = db.get(Student, row.student_id)
    course = db.get(Course, row.course_id)
    add_notification(db, student.user_id, "request_decision", f"Request {decision}",
                     f"Your {row.request_type} request for {course.course_code} was {decision}.",
                     f"request:{row.id}:{decision}", {"request_id": row.id})
    db.commit()
    return _request_dict(row, course, student)


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "student":
        student = require_own_profile(db, Student, current_user.id, "Student")
        _ensure_reminder(db, current_user, student)
        ensure_course_announcement_notifications(db, current_user, student)
        db.commit()
    rows = db.query(UserNotification).filter(UserNotification.user_id == current_user.id).order_by(UserNotification.created_at.desc()).limit(50).all()
    return [{
        "id": row.id, "kind": row.kind, "title": row.title, "body": row.body,
        "payload": json.loads(row.payload or "{}"), "is_read": row.read_at is not None,
        "created_at": iso_utc(row.created_at),
    } for row in rows]


@router.patch("/notifications/{notification_id}/read")
def read_notification(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.query(UserNotification).filter(UserNotification.id == notification_id, UserNotification.user_id == current_user.id).first()
    if not row:
        raise HTTPException(404, "Notification not found")
    row.read_at = row.read_at or utcnow()
    db.commit()
    return {"message": "Notification marked as read"}

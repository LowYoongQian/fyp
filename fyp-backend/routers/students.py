from datetime import datetime, timedelta

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict

from db.database import get_db
from utils.timeutil import iso_utc, utcnow
from db.models import (
    User, Student, FaceEmbedding, Enrolment, Course,
    ClassSession, AttendanceRecord, CourseStaffAssignment,
)
from utils.security import require_student
from utils.db_helpers import require_own_profile
from domain.attendance import session_hours, attendance_rate_percent, completed_class_count
from integrations.face import (
    _embedding_to_floats,
    _cosine_distance, _FACE_MATCH_THRESHOLD,
)
from domain import student_next_action, timetable_access
from domain.scheduler import calculate_schedule, get_course_group_slots, meeting_key_for, session_end_utc
from domain.session_sync import sync_class_sessions
from routers.attendance_features import _next_meeting
from routers.face_enrolment import FaceCaptureSubmit, submit_capture, face_version, lock_student
from integrations.live_face import extract_live_embedding
from domain.account_security import lock_user
from domain.face_self_test import issue_self_test, consume_self_test

router = APIRouter(prefix="/students", tags=["Students"])


class FaceSelfTestSubmit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str = Field(min_length=1, max_length=8_000_000)
    challenge_token: str = Field(min_length=40, max_length=100)
    liveness_passed: bool


@router.post("/me/face", status_code=200)
def register_face(body: FaceCaptureSubmit, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    return submit_capture(body, db, current_user)


def self_test_profile(db, actor):
    student = require_own_profile(db, Student, actor.id, "Student")
    stored = db.query(FaceEmbedding).filter_by(student_id=student.id, is_active=True).populate_existing().first()
    if not stored:
        raise HTTPException(400, "No registered face found. Register your face first.")
    return student, stored


@router.post("/me/face/self-test/challenge")
def create_face_self_test_challenge(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    actor = lock_user(db, current_user.id, require_session=True)
    student = require_own_profile(db, Student, actor.id, "Student")
    lock_student(db, student.id)
    student, stored = self_test_profile(db, actor)
    return issue_self_test(db, student.id, db.info["security_session_id"], face_version(stored))


@router.post("/me/face/verify", include_in_schema=False)
@router.post("/me/face/self-test")
def verify_face_only(body: FaceSelfTestSubmit, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    # The old image-only verifier now has exactly the same security contract.
    student, stored = self_test_profile(db, current_user)
    student_id, actor_id = student.id, current_user.id
    version, registered = face_version(stored), bytes(stored.embedding)
    consume_self_test(db, body.challenge_token, student_id, db.info["security_session_id"], version)
    if not body.liveness_passed:
        return {"passed": False, "reason": "liveness_incomplete",
                "message": "Complete both camera movements and try again."}
    try:
        live = extract_live_embedding(body.image_base64)
    except HTTPException as exc:
        if exc.status_code not in (403, 422):
            raise
        # Only fixed safe messages; never return biometric values or model errors.
        return {"passed": False, "reason": "live_capture_failed",
                "message": "A live face could not be verified. Use good lighting, keep only your face visible and scan again."}
    distance = _cosine_distance(_embedding_to_floats(live), _embedding_to_floats(registered))
    # Logout, reassignment or face reset during inference invalidates this result.
    actor = lock_user(db, actor_id, require_session=True)
    lock_student(db, student_id)
    current_student, current_face = self_test_profile(db, actor)
    if current_student.id != student_id or face_version(current_face) != version:
        raise HTTPException(409, "Your registered face changed during this self-test. Start a new scan.")
    passed = distance <= _FACE_MATCH_THRESHOLD
    return {"passed": passed, "reason": "matched" if passed else "face_mismatch",
            "message": "Live face matched your registered profile. No attendance was recorded." if passed else
                       "Your face could not be matched to your registered profile. Look directly at the camera and try again."}


@router.get("/me/courses")
def get_my_courses(semester_id: Optional[UUID] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Courses this student is enrolled in, with timetable info for the app. The web timetable passes one semester_id."""
    sync_class_sessions()
    student = require_own_profile(db, Student, current_user.id, "Student")
    query = (
        db.query(Course, Enrolment.class_group)
        .join(Enrolment, Enrolment.course_id == Course.id)
        .filter(Enrolment.student_id == student.id)
    )
    if semester_id:
        # Must be in this student's scope and current; otherwise the request is refused and no schedule is returned.
        query = query.filter(Course.semester_id == timetable_access.require_viewable_semester(db, current_user, str(semester_id)).id)
    # With no semester requested (the mobile app) only current-semester schedules come back; an upcoming or ended one never does.
    rows = [(c, group) for c, group in query.all() if timetable_access.schedule_viewable(c)]

    # Calculate deterministic clash-free schedules
    schedule_map = calculate_schedule(db)

    # Everything the loop needs, fetched once per query instead of once per course.
    course_ids = [c.id for c, _ in rows]
    assignments_by_course = {}
    for a in db.query(CourseStaffAssignment).filter(
        CourseStaffAssignment.course_id.in_(course_ids)
    ).all():
        assignments_by_course.setdefault(a.course_id, []).append(a)

    # Attendance rate: closed-only, present+leave, HOURS-weighted — the one policy in
    # domain/attendance.py, shared with /students/me/enrolments and the risk model. This
    # endpoint once counted present-only over a flat session count and treated "open but
    # past today" as held, so the app and the web dashboard disagreed for one student.
    sessions_by_course = {}
    for sid, cid, sgroup, opened, closed_at, scheduled_start, scheduled_end in db.query(
        ClassSession.id, ClassSession.course_id, ClassSession.class_group,
        ClassSession.opened_at, ClassSession.closed_at,
        ClassSession.scheduled_start, ClassSession.scheduled_end,
    ).filter(
        ClassSession.course_id.in_(course_ids),
        ClassSession.status == "completed",
    ).order_by(ClassSession.scheduled_start.asc().nullslast(), ClassSession.id.asc()).all():
        sessions_by_course.setdefault(cid, []).append(
            (sid, sgroup, session_hours(opened, closed_at,
                                        scheduled_start=scheduled_start, scheduled_end=scheduled_end)))

    attended = {
        (student.id, sid) for (sid,) in db.query(AttendanceRecord.session_id).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.status.in_(["present", "leave"]),
        ).all()
    }

    result = []
    for c, group in rows:
        assignments = assignments_by_course.get(c.id, [])
        course_sessions = sessions_by_course.get(c.id, [])
        attendance_rate = attendance_rate_percent(
            course_sessions, attended, student.id, group)
        completed = completed_class_count(course_sessions, attended, student.id, group)

        # 1. Primary Lecture Slot
        # "id" is the meeting_key ("Lecture-<uuid>") — the same key that indexes
        # schedule_map. It is stable and unique per timetable row. Do NOT derive
        # it arithmetically from c.id: those are UUID strings, so c.id * 10 + 1
        # raises TypeError and c.id * 10 silently returns 360 junk characters.
        lect_slot = schedule_map.get(f"Lecture-{c.id}")
        if lect_slot:
            lecturer_assign = next((a for a in assignments if a.role == 'Lecturer'), None)
            lecturer_name = lecturer_assign.lecturer.name if (lecturer_assign and lecturer_assign.lecturer) else (c.lecturer.name if c.lecturer else "TBA")

            result.append({
                "id": f"Lecture-{c.id}",
                "course_id": c.id,
                "course_code": c.course_code,
                "course_name": c.course_name,
                "class_group": group,
                "schedule_day": lect_slot["day"],
                "meeting_id": lect_slot.get("meeting_id"),
                "schedule_start": lect_slot["start"],
                "schedule_end": lect_slot["end"],
                "schedule_room": lect_slot["room"],
                "lecturer_name": lecturer_name,
                "role": "Lecture",
                "attendance_rate": attendance_rate,
                "completed_classes": completed,
            })
        
        # 2 & 3. Tutor / Practical — this student's group only, one row per staff assignment. A course may have several
        # assignments in the same role and each owns its meeting; keeping only the first hid the rest from the student.
        for role in ("Tutor", "Practical"):
            for assign in (a for a in assignments if a.role == role):
                key = meeting_key_for(role, c.id, assign.id, group)
                slot = schedule_map.get(key)
                if not slot:
                    continue
                result.append({
                    "id": key,
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "class_group": group,
                    "schedule_day": slot["day"],
                    "meeting_id": slot.get("meeting_id"),
                    "schedule_start": slot["start"],
                    "schedule_end": slot["end"],
                    "schedule_room": slot["room"],
                    "lecturer_name": assign.lecturer.name if assign.lecturer else "TBA",
                    "role": role,
                    "attendance_rate": attendance_rate,
                    "completed_classes": completed,
                })
    from domain.semesters import semester_dict
    terms = {str(c.id): semester_dict(c.semester) if c.semester_id else None for c, _ in rows}
    for entry in result:
        entry["semester"] = terms.get(str(entry.get("course_id")))
    return result


def _open_sessions(db: Session, student: Student) -> list:
    """Open classes this student is enrolled for (course and group), still inside their window and their semester."""
    rows = (
        db.query(ClassSession, Course, Enrolment.class_group)
        .join(Enrolment, Enrolment.course_id == ClassSession.course_id)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(
            Enrolment.student_id == student.id,
            ClassSession.is_open == True,
            (ClassSession.class_group == "All") | (ClassSession.class_group == Enrolment.class_group),
        )
        .all()
    )

    # Read-only: exclude sessions already past their scheduled end in-memory.
    # Persisting the close is owned by sync_class_sessions (called above) and the
    # check-in guard, so this GET stays idempotent (see J in the review doc).
    now_utc = utcnow()
    from domain.semesters import campus_date, within_semester
    rows = [
        (s, c, cg) for s, c, cg in rows
        if now_utc <= session_end_utc(s, get_course_group_slots(db, s.course_id, s.class_group))
        and within_semester(c.semester if c.semester_id else None, campus_date(now_utc))
    ]

    # Which of these sessions the student has already checked into.
    session_ids = [s.id for s, _, _ in rows]
    checked_in = set()
    if session_ids:
        recs = (
            db.query(AttendanceRecord.session_id)
            .filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
            )
            .all()
        )
        checked_in = {r[0] for r in recs}

    return [
        {
            "id": s.id,
            "course_id": s.course_id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "class_group": s.class_group,
            "opened_at": iso_utc(s.opened_at),
            "scheduled_start": iso_utc(s.scheduled_start),
            "scheduled_end": iso_utc(s.scheduled_end),
            "room": s.room,
            "is_replacement": s.replacement_for_session_id is not None,
            "is_open": s.is_open,
            "already_checked_in": s.id in checked_in,
        }
        for s, c, _ in rows
    ]


@router.get("/me/active-sessions")
def get_my_active_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Open sessions matching this student's enrolments (course + group)."""
    sync_class_sessions()
    return _open_sessions(db, require_own_profile(db, Student, current_user.id, "Student"))


@router.get("/me/next-action")
def get_my_next_action(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """The one thing this student should do next (check in, register a face, verify an email, or see the next class).

    One server decision for the web dashboard and the mobile app. Read-only: nothing is created, opened or sent."""
    sync_class_sessions()
    student = require_own_profile(db, Student, current_user.id, "Student")
    return student_next_action.decide(db, current_user, student, _open_sessions(db, student), _next_meeting(db, student, current_only=True))


@router.get("/me/attendance")
def get_my_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """This student's full attendance history, most recent first."""
    sync_class_sessions()
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = (
        db.query(AttendanceRecord, ClassSession, Course)
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(AttendanceRecord.student_id == student.id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )
    return [
        {
            "session_id": s.id,
            "course_id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "class_group": s.class_group,
            "status": ar.status,
            "marked_at": iso_utc(ar.marked_at),
            "network_verified": ar.network_verified,
            "liveness_passed": ar.liveness_passed,
            # A manual present/MC is attendance credit, not biometric evidence.
            "face_verified": (
                ar.status == "present" and ar.method == "face+wifi"
                and ar.liveness_passed is True and ar.confidence_score is not None
                and ar.liveness_challenge_ms is not None
            ),
            "verify_detail": ar.verify_detail,
        }
        for ar, s, c in rows
    ]

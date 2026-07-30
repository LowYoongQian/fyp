"""Student-facing API endpoints (web dashboard).

These endpoints return data scoped to the currently authenticated student,
so the React StudentDashboard doesn't need to call admin-only routes.

Note: /students/me/courses, /students/me/active-sessions, and
/students/me/attendance already exist in routers/students.py.
This router only adds the additional /profile and /enrolments endpoints
needed by the web dashboard.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from domain.scheduler import lecture_meetings
from domain.announcements import announcement_dict, visible_announcements
from db.database import get_db
from datetime import datetime
from domain.session_sync import sync_class_sessions
from db.models import (
    User, Student, Course, Enrolment, ClassSession,
    AttendanceRecord, Announcement, ClassMeeting
)
from utils.security import require_student
from utils.db_helpers import require_own_profile
from domain.attendance import session_hours, attendance_rate_percent
from utils.timeutil import utcnow

router = APIRouter(prefix="/students/me", tags=["Student Self-Service"])


@router.get("/profile", response_model=dict)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    """Return the authenticated student's own profile."""
    student = (
        db.query(Student)
        .options(joinedload(Student.programme))
        .filter(Student.user_id == current_user.id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return {
        "id": student.id,
        "user_id": student.user_id,
        "name": student.name,
        "student_code": student.student_code,
        "is_face_registered": student.is_face_registered,
        "email": current_user.email,
        "programme_id": student.programme_id,
        "programme_name": student.programme.name if student.programme else None,
    }


@router.get("/enrolments", response_model=List[dict])
def get_my_enrolments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    """Return the authenticated student's course enrolments with dynamic attendance rate."""
    sync_class_sessions()
    student = require_own_profile(db, Student, current_user.id, "Student")

    enrolments = (
        db.query(Enrolment)
        .options(joinedload(Enrolment.course))
        .filter(Enrolment.student_id == student.id)
        .all()
    )

    # Lecture times come from class_meetings (source of truth), not Course.schedule_*.
    course_ids = [e.course_id for e in enrolments]
    lecture_by_course = lecture_meetings(db, course_ids)

    # Attendance rate: the SAME hours-weighted, present+leave, closed-only computation
    # the risk model uses (domain/attendance.py), so the student's number always matches
    # the lecturer's dashboard. Both lookups are built once, not once per enrolment.
    sessions_by_course = {}
    for sid, cid, group, opened, closed_at in db.query(
        ClassSession.id, ClassSession.course_id, ClassSession.class_group,
        ClassSession.opened_at, ClassSession.closed_at
    ).filter(
        ClassSession.course_id.in_(course_ids),
        ClassSession.is_open == False,  # noqa: E712
    ).order_by(ClassSession.opened_at.asc().nullslast(), ClassSession.id.asc()).all():
        sessions_by_course.setdefault(cid, []).append(
            (sid, group, session_hours(opened, closed_at)))

    attended = {
        (student.id, sid) for (sid,) in db.query(AttendanceRecord.session_id).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.status.in_(["present", "leave"]),
        ).all()
    }

    result = []
    for e in enrolments:
        m = lecture_by_course.get(e.course_id)
        course_sessions = sessions_by_course.get(e.course_id, [])
        attendance_rate = attendance_rate_percent(
            course_sessions, attended, student.id, e.class_group)

        result.append({
            "id": e.id,
            "student_id": e.student_id,
            "course_id": e.course_id,
            "course_code": e.course.course_code if e.course else "Unknown",
            "course_name": e.course.course_name if e.course else "Unknown",
            "credit_hours": e.course.credit_hours if e.course else 3.0,
            "semester": e.semester,
            "class_group": e.class_group,
            "schedule_day": m.day if m else None,
            "schedule_start": m.start if m else None,
            "schedule_end": m.end if m else None,
            "schedule_room": m.room if m else None,
            "attendance_rate": attendance_rate,
        })

    return result


@router.get("/announcements", response_model=List[dict])
def get_my_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    """Return published and targeted announcements for the authenticated student,
    ordered by priority (High -> Medium -> Low) and date.
    """
    student = (
        db.query(Student)
        .options(joinedload(Student.programme))
        .filter(Student.user_id == current_user.id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    my_course_codes = {
        code for (code,) in (
            db.query(Course.course_code)
            .join(Enrolment, Enrolment.course_id == Course.id)
            .filter(Enrolment.student_id == student.id)
            .all()
        ) if code
    }
    my_prog_codes = {student.programme.code} if student.programme else set()

    return [
        announcement_dict(a) for a in
        visible_announcements(db, "students", my_prog_codes, my_course_codes)
    ]

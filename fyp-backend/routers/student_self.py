"""Student-facing API endpoints (web dashboard).

These endpoints return data scoped to the currently authenticated student,
so the React StudentDashboard doesn't need to call admin-only routes.

Note: /students/me/courses, /students/me/active-sessions, and
/students/me/attendance already exist in routers/students.py.
This router only adds the additional /profile and /enrolments endpoints
needed by the web dashboard.
"""
from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from domain import timetable_access
from domain.scheduler import lecture_meetings
from domain.announcements import announcement_dict, visible_announcements
from integrations.announcement_files import attachment_response
from db.database import get_db
from datetime import datetime
from domain.session_sync import sync_class_sessions
from db.models import (
    User, Student, Course, Enrolment, ClassSession,
    AttendanceRecord, Announcement, ClassMeeting
)
from utils.security import require_student
from utils.db_helpers import require_own_profile
from domain.attendance import session_hours, attendance_rate_percent, completed_class_count
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
    scope: Literal["all", "current"] = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    """Return the authenticated student's course enrolments with dynamic attendance rate.

    scope=all (the default) is every retained enrolment, as history and forms need it. scope=current is the dashboard's view: only courses of a
    semester running today, with the rate made from classes held inside that semester. Nothing is deleted either way."""
    sync_class_sessions()
    student = require_own_profile(db, Student, current_user.id, "Student")

    enrolments = (
        db.query(Enrolment)
        .options(joinedload(Enrolment.course).joinedload(Course.semester))
        .filter(Enrolment.student_id == student.id)
        .all()
    )
    semester_of = {e.course_id: timetable_access.current_semester(e.course) for e in enrolments}
    if scope == "current":
        enrolments = [e for e in enrolments if semester_of[e.course_id] is not None]

    # Lecture times come from class_meetings (source of truth), not Course.schedule_*.
    course_ids = [e.course_id for e in enrolments]
    lecture_by_course = lecture_meetings(db, course_ids)

    # Attendance rate: the SAME hours-weighted, present+leave, closed-only computation
    # the risk model uses (domain/attendance.py), so the student's number always matches
    # the lecturer's dashboard. Both lookups are built once, not once per enrolment.
    sessions_by_course = {}
    for sid, cid, group, opened, closed_at, scheduled_start, scheduled_end in db.query(
        ClassSession.id, ClassSession.course_id, ClassSession.class_group,
        ClassSession.opened_at, ClassSession.closed_at,
        ClassSession.scheduled_start, ClassSession.scheduled_end,
    ).filter(
        ClassSession.course_id.in_(course_ids),
        ClassSession.status == "completed",
    ).order_by(ClassSession.scheduled_start.asc().nullslast(), ClassSession.id.asc()).all():
        if scope == "current" and not timetable_access.held_in_semester(semester_of[cid], scheduled_start or opened):
            continue
        sessions_by_course.setdefault(cid, []).append(
            (sid, group, session_hours(opened, closed_at,
                                       scheduled_start=scheduled_start, scheduled_end=scheduled_end)))

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
            **timetable_access.lecture_slot(e.course, m),
            "attendance_rate": attendance_rate,
            "completed_classes": completed_class_count(course_sessions, attended, student.id, e.class_group),
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
        
    enrolled_courses = (
            db.query(Course.course_code, Enrolment.class_group)
            .join(Enrolment, Enrolment.course_id == Course.id)
            .filter(Enrolment.student_id == student.id)
            .all()
    )
    my_course_codes = {code for code, _group in enrolled_courses if code}
    course_groups: dict[str, set[str]] = {}
    for code, group in enrolled_courses:
        if code and group:
            course_groups.setdefault(code.upper(), set()).add(group)
    my_prog_codes = {student.programme.code} if student.programme else set()

    return [
        announcement_dict(a) for a in
        visible_announcements(db, "students", my_prog_codes, my_course_codes, course_groups, current_user.id)
    ]


@router.get("/announcements/{announcement_id}/attachment")
def get_announcement_attachment(announcement_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    student = require_own_profile(db, Student, current_user.id, "Student")
    enrolments = db.query(Course.course_code, Enrolment.class_group).join(
        Enrolment, Enrolment.course_id == Course.id).filter(Enrolment.student_id == student.id).all()
    courses = {code for code, _group in enrolments if code}
    groups: dict[str, set[str]] = {}
    for code, group in enrolments:
        if code and group:
            groups.setdefault(code.upper(), set()).add(group)
    programmes = {student.programme.code} if student.programme else set()
    visible = {str(row.id): row for row in visible_announcements(db, "students", programmes, courses, groups, current_user.id)}
    row = visible.get(str(announcement_id))
    if not row:
        raise HTTPException(404, "Attachment not found")
    return attachment_response(row)

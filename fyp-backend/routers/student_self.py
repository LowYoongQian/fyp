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

from utils.database import get_db
from utils.models import (
    User, Student, Course, Enrolment, ClassSession,
    AttendanceRecord, Programme, Announcement, ClassMeeting
)
from utils.security import require_student
from utils.attendance import session_hours, attendance_rate_percent
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
    from utils.session_sync import sync_class_sessions
    sync_class_sessions(db)
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    enrolments = (
        db.query(Enrolment)
        .options(joinedload(Enrolment.course))
        .filter(Enrolment.student_id == student.id)
        .all()
    )

    # Lecture times come from class_meetings (source of truth), not Course.schedule_*.
    course_ids = [e.course_id for e in enrolments]
    lecture_by_course = {
        m.course_id: m for m in db.query(ClassMeeting)
        .filter(ClassMeeting.role == "Lecture", ClassMeeting.course_id.in_(course_ids)).all()
    }

    result = []
    for e in enrolments:
        m = lecture_by_course.get(e.course_id)
        # Attendance rate: use the SAME hours-weighted, present+leave, closed-only
        # computation as the risk model (utils/attendance) so the student's number
        # always matches the lecturer's dashboard. See utils/attendance.py.
        closed = db.query(
            ClassSession.id, ClassSession.class_group,
            ClassSession.opened_at, ClassSession.closed_at
        ).filter(
            ClassSession.course_id == e.course_id,
            ClassSession.is_open == False,
        ).order_by(ClassSession.opened_at.asc().nullslast(), ClassSession.id.asc()).all()

        course_sessions = [
            (sid, group, session_hours(opened, cl))
            for sid, group, opened, cl in closed
        ]
        session_ids = [row[0] for row in course_sessions]
        present_set = set()
        if session_ids:
            present_rows = db.query(AttendanceRecord.session_id).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.status.in_(["present", "leave"]),
            ).all()
            present_set = {(student.id, sid) for (sid,) in present_rows}

        attendance_rate = attendance_rate_percent(
            course_sessions, present_set, student.id, e.class_group)

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
    from datetime import datetime
    student = (
        db.query(Student)
        .options(joinedload(Student.programme))
        .filter(Student.user_id == current_user.id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    now = utcnow()

    # Course codes this student is enrolled in (for scope='course' matching).
    my_course_codes = {
        code.upper() for (code,) in (
            db.query(Course.course_code)
            .join(Enrolment, Enrolment.course_id == Course.id)
            .filter(Enrolment.student_id == student.id)
            .all()
        ) if code
    }
    my_prog_code = student.programme.code.upper() if student.programme else None

    # Query all published announcements (not drafts)
    query = db.query(Announcement).filter(Announcement.is_draft == False)
    announcements = query.all()

    filtered = []
    for a in announcements:
        # Window checks
        if a.publish_start and now < a.publish_start:
            continue
        if a.publish_end and now >= a.publish_end:
            continue

        # Role gate: students only see 'all' or 'students'-targeted announcements.
        if (a.target_role or "all") == "staff":
            continue

        # Scope gate
        scope = a.target_scope or "all"
        if scope == "all":
            filtered.append(a)
        elif scope == "programme":
            if a.target_programme_code and my_prog_code and \
               a.target_programme_code.upper() == my_prog_code:
                filtered.append(a)
        elif scope == "course":
            if a.target_course_code and a.target_course_code.upper() in my_course_codes:
                filtered.append(a)

    # Sort by priority and created_at descending
    priority_weight = {'High': 3, 'Medium': 2, 'Low': 1}
    filtered_sorted = sorted(
        filtered,
        key=lambda x: (priority_weight.get(x.priority, 2), x.created_at or datetime.min),
        reverse=True
    )
    
    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "faculty": a.faculty,
            "department": a.department,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "priority": a.priority,
            "image_base64": a.image_base64,
            "publish_start": a.publish_start.isoformat() if a.publish_start else None,
            "publish_end": a.publish_end.isoformat() if a.publish_end else None,
            "target_scope": a.target_scope,
            "target_role": a.target_role,
            "target_programme_code": a.target_programme_code,
            "target_course_code": a.target_course_code,
        }
        for a in filtered_sorted
    ]

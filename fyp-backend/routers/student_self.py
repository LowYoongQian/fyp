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
    AttendanceRecord, Programme, Announcement
)
from utils.security import require_student

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

    from datetime import datetime
    now = datetime.utcnow()

    result = []
    for e in enrolments:
        # Calculate attendance rate based on completed sessions
        sessions = db.query(ClassSession).filter(
            ClassSession.course_id == e.course_id,
            (ClassSession.class_group == "All") | (ClassSession.class_group == e.class_group)
        ).all()
        
        completed_sessions = []
        for s in sessions:
            opened_at_day_end = datetime(s.opened_at.year, s.opened_at.month, s.opened_at.day, 23, 59, 59)
            if (not s.is_open) or (now > opened_at_day_end):
                completed_sessions.append(s)
                
        if completed_sessions:
            session_ids = [s.id for s in completed_sessions]
            present_count = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.status == "present"
            ).count()
            attendance_rate = round((present_count / len(completed_sessions)) * 100.0, 1)
        else:
            attendance_rate = 100.0

        result.append({
            "id": e.id,
            "student_id": e.student_id,
            "course_id": e.course_id,
            "course_code": e.course.course_code if e.course else "Unknown",
            "course_name": e.course.course_name if e.course else "Unknown",
            "credit_hours": e.course.credit_hours if e.course else 3.0,
            "semester": e.semester,
            "class_group": e.class_group,
            "schedule_day": e.course.schedule_day if e.course else None,
            "schedule_start": e.course.schedule_start if e.course else None,
            "schedule_end": e.course.schedule_end if e.course else None,
            "schedule_room": e.course.schedule_room if e.course else None,
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
        
    now = datetime.utcnow()
    
    # Query all published announcements (not drafts)
    query = db.query(Announcement).filter(Announcement.is_draft == False)
    announcements = query.all()
    
    filtered = []
    for a in announcements:
        # Check start date
        if a.publish_start and now < a.publish_start:
            continue
        # Check end date
        if a.publish_end and now >= a.publish_end:
            continue
            
        # Check target audience
        # 'all', 'students_all', 'students_specific', 'staff_all', 'staff_specific'
        if a.target_audience == 'all':
            filtered.append(a)
        elif a.target_audience == 'students_all':
            filtered.append(a)
        elif a.target_audience == 'students_specific':
            # Match by student's programme code if specified
            if student.programme and a.target_programme_code:
                if student.programme.code.upper() == a.target_programme_code.upper():
                    filtered.append(a)
            else:
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
            "target_audience": a.target_audience,
            "target_programme_code": a.target_programme_code
        }
        for a in filtered_sorted
    ]

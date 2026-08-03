from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from utils.timeutil import iso_utc, utcnow
from typing import List

from domain.announcements import announcement_dict, visible_announcements
from db.database import get_db
from domain.scheduler import calculate_schedule, lecture_meetings, meeting_key_for, slots_for_assignment
from db.models import (
    User, Lecturer, Course, CourseStaffAssignment, Enrolment, Alert, Student, Announcement, ClassMeeting
)
from utils.security import require_lecturer
from utils.db_helpers import get_or_404, my_course_ids, require_own_profile

router = APIRouter(prefix="/lecturers", tags=["Lecturers"])

class AlertCreate(BaseModel):
    student_id: str
    course_id: str

@router.get("/me/courses")
def get_lecturer_courses(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    # Get courses assigned directly or via assignments
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    course_ids = [c.id for c in courses]
    enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    # Lecture times come from class_meetings (source of truth).
    lecture_by_course = lecture_meetings(db, course_ids)

    result = []
    for c in courses:
        m = lecture_by_course.get(c.id)
        result.append({
            "id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "credit_hours": c.credit_hours,
            "schedule_day": m.day if m else None,
            "schedule_start": m.start if m else None,
            "schedule_end": m.end if m else None,
            "schedule_room": m.room if m else None,
            "enrolled_students_count": enrol_counts.get(c.id, 0),
            "lecturer_id": c.lecturer_id,
            "lecturer_name": lecturer.name
        })
    return result

@router.get("/me/alerts")
def get_lecturer_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()
    course_ids = [c.id for c in courses]
    
    alerts = db.query(Alert).filter(Alert.course_id.in_(course_ids)).order_by(Alert.triggered_at.desc()).all()

    # Pre-load all referenced students and courses in two queries instead of 2×N
    alert_student_ids = list({a.student_id for a in alerts})
    alert_course_ids  = list({a.course_id  for a in alerts})
    students_map = {s.id: s for s in db.query(Student).filter(Student.id.in_(alert_student_ids)).all()}
    courses_map  = {c.id: c for c in db.query(Course).filter(Course.id.in_(alert_course_ids)).all()}

    result = []
    for a in alerts:
        student = students_map.get(a.student_id)
        course  = courses_map.get(a.course_id)
        result.append({
            "id": a.id,
            "student_id": a.student_id,
            "student_name": student.name if student else "Unknown Student",
            "student_code": student.student_code if student else "N/A",
            "course_id": a.course_id,
            "course_code": course.course_code if course else "N/A",
            "course_name": course.course_name if course else "N/A",
            "alert_type": a.alert_type,
            "email_body": a.email_body,
            "triggered_by": a.triggered_by,
            "triggered_at": iso_utc(a.triggered_at),
            "sent_at": iso_utc(a.sent_at),
        })
    return result

@router.post("/me/alerts")
def trigger_manual_alert(body: AlertCreate, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    student = get_or_404(db, Student, body.student_id, "Student")
    course = get_or_404(db, Course, body.course_id, "Course")
        
    email_body = (
        f"DEAR {student.name.upper()},\n\n"
        f"This is an automated warning regarding your low attendance in {course.course_name} ({course.course_code}). "
        f"Your current attendance rate is below the 80% threshold. Please meet with your academic counselor immediately.\n\n"
        f"Regards,\nLecturer / Academic Office"
    )
    
    new_alert = Alert(
        student_id=body.student_id,
        course_id=body.course_id,
        alert_type="manual_warning",
        email_body=email_body,
        triggered_by="lecturer",
        triggered_at=utcnow(),
        sent_at=utcnow()
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return {"status": "success", "alert_id": new_alert.id}


@router.get("/me/timetable")
def get_lecturer_timetable(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    # Get all courses where this lecturer is primary OR has staff assignments
    assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    timetable_course_ids = [c.id for c in courses]
    timetable_enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(timetable_course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    # Calculate deterministic clash-free schedules
    schedule_map = calculate_schedule(db)
    
    result = []
    for c in courses:
        enrolled_count = timetable_enrol_counts.get(c.id, 0)
        
        # 1. Lecture Slot
        is_primary = (c.lecturer_id == lecturer.id)
        assigned_as_lecturer = any(a.course_id == c.id and a.role == 'Lecturer' for a in assigned_assignments)
        
        if is_primary or assigned_as_lecturer:
            lect_slot = schedule_map.get(f"Lecture-{c.id}")
            if lect_slot:
                # "id" is the meeting_key, matching schedule_map. See the same
                # note in routers/students.py — course ids are UUID strings, so
                # arithmetic on them is either a TypeError or a junk string.
                result.append({
                    "id": f"Lecture-{c.id}",
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "schedule_day": lect_slot["day"],
                    "schedule_start": lect_slot["start"],
                    "schedule_end": lect_slot["end"],
                    "schedule_room": lect_slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": "Lecture"
                })
            
        # 2 & 3. Tutor / Practical assignments — one row PER GROUP. Each group meets at
        # its own time, so a staff member teaching two groups has two entries here.
        for role in ("Tutor", "Practical"):
            assign = next((a for a in assigned_assignments
                           if a.course_id == c.id and a.role == role), None)
            if not assign:
                continue
            for slot in slots_for_assignment(schedule_map, assign.id):
                result.append({
                    "id": meeting_key_for(role, c.id, assign.id, slot["class_group"]),
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "class_group": slot["class_group"],
                    "schedule_day": slot["day"],
                    "schedule_start": slot["start"],
                    "schedule_end": slot["end"],
                    "schedule_room": slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": role
                })


    return result


@router.get("/me/announcements", response_model=List[dict])
def get_my_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Return published and targeted announcements for the authenticated staff member,
    ordered by priority (High -> Medium -> Low) and date.
    """
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    now = utcnow()

    my_courses = db.query(Course).filter(
        Course.id.in_(my_course_ids(db, lecturer.id))
    ).all()

    return [
        announcement_dict(a) for a in visible_announcements(
            db, "staff",
            {c.programme.code for c in my_courses
             if getattr(c, "programme", None) and c.programme.code},
            {c.course_code for c in my_courses if c.course_code},
        )
    ]

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List

from utils.database import get_db
from utils.models import (
    User, Lecturer, Course, CourseStaffAssignment, Enrolment, Alert, Student, Announcement
)
from utils.security import require_lecturer

router = APIRouter(prefix="/lecturers", tags=["Lecturers"])

class AlertCreate(BaseModel):
    student_id: int
    course_id: int

@router.get("/me/courses")
def get_lecturer_courses(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    # Get courses assigned directly or via assignments
    assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
    assigned_course_ids = [a.course_id for a in assigned_assignments]
    
    courses = db.query(Course).filter(
        (Course.lecturer_id == lecturer.id) | (Course.id.in_(assigned_course_ids))
    ).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    course_ids = [c.id for c in courses]
    enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    result = []
    for c in courses:
        result.append({
            "id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "credit_hours": c.credit_hours,
            "schedule_day": c.schedule_day,
            "schedule_start": c.schedule_start,
            "schedule_end": c.schedule_end,
            "schedule_room": c.schedule_room,
            "enrolled_students_count": enrol_counts.get(c.id, 0),
            "lecturer_id": c.lecturer_id,
            "lecturer_name": lecturer.name
        })
    return result

@router.get("/me/alerts")
def get_lecturer_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
    assigned_course_ids = [a.course_id for a in assigned_assignments]
    
    courses = db.query(Course).filter(
        (Course.lecturer_id == lecturer.id) | (Course.id.in_(assigned_course_ids))
    ).all()
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
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "sent_at": a.sent_at.isoformat() if a.sent_at else None,
        })
    return result

@router.post("/me/alerts")
def trigger_manual_alert(body: AlertCreate, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    student = db.query(Student).filter(Student.id == body.student_id).first()
    course = db.query(Course).filter(Course.id == body.course_id).first()
    
    if not student or not course:
        raise HTTPException(status_code=404, detail="Student or Course not found")
        
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
        triggered_at=datetime.utcnow(),
        sent_at=datetime.utcnow()
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return {"status": "success", "alert_id": new_alert.id}


@router.get("/me/timetable")
def get_lecturer_timetable(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    # Get all courses where this lecturer is primary OR has staff assignments
    assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
    assigned_course_ids = [a.course_id for a in assigned_assignments]
    
    courses = db.query(Course).filter(
        (Course.lecturer_id == lecturer.id) | (Course.id.in_(assigned_course_ids))
    ).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    timetable_course_ids = [c.id for c in courses]
    timetable_enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(timetable_course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    # Calculate deterministic clash-free schedules
    from utils.scheduler import calculate_schedule
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
                result.append({
                    "id": c.id * 10,
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
            
        # 2. Check if assigned as Tutor for this course
        tutor_assign = next((a for a in assigned_assignments if a.course_id == c.id and a.role == 'Tutor'), None)
        if tutor_assign:
            tutor_slot = schedule_map.get(f"Tutor-{tutor_assign.id}")
            if tutor_slot:
                result.append({
                    "id": c.id * 10 + 1,
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "schedule_day": tutor_slot["day"],
                    "schedule_start": tutor_slot["start"],
                    "schedule_end": tutor_slot["end"],
                    "schedule_room": tutor_slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": "Tutor"
                })
            
        # 3. Check if assigned as Practical for this course
        practical_assign = next((a for a in assigned_assignments if a.course_id == c.id and a.role == 'Practical'), None)
        if practical_assign:
            prac_slot = schedule_map.get(f"Practical-{practical_assign.id}")
            if prac_slot:
                result.append({
                    "id": c.id * 10 + 2,
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "schedule_day": prac_slot["day"],
                    "schedule_start": prac_slot["start"],
                    "schedule_end": prac_slot["end"],
                    "schedule_room": prac_slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": "Practical"
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
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
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
        elif a.target_audience == 'staff_all':
            filtered.append(a)
        elif a.target_audience == 'staff_specific':
            # Match by staff member's department/faculty if specified
            if a.department == 'All Departments' or a.department.upper() == lecturer.role.upper():
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

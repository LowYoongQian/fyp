from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from typing import List

from utils.database import get_db
from utils.models import User, Student, Lecturer, Course, Enrolment, ClassSession, AttendanceRecord, CourseStaffAssignment
from utils.security import require_admin
from utils.schemas import (
    MessageResponse, AdminAttendanceUpdate
)

router = APIRouter(prefix="/admin", tags=["Admin Attendance"])

# =====================================================================
# ATTENDANCE MONITORING & OVERRIDES
# =====================================================================

@router.get("/sessions", response_model=List[dict])
def get_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    sessions = db.query(ClassSession).options(
        joinedload(ClassSession.course).joinedload(Course.lecturer)
    ).order_by(ClassSession.opened_at.desc()).all()
    
    from utils.scheduler import calculate_schedule
    schedule_map = calculate_schedule(db)
    
    result = []
    has_changes = False
    
    for s in sessions:
        course = s.course
        lecturer = course.lecturer if course else None
        
        now_utc = datetime.utcnow()
        # Calculate local timezone offset dynamically
        local_now = datetime.now()
        utc_now = datetime.utcnow()
        tz_offset = local_now - utc_now
        
        is_open = s.is_open
        closed_at = s.closed_at
        
        if is_open:
            slots = []
            if s.class_group == "All":
                slot = schedule_map.get(f"Lecture-{s.course_id}")
                if slot:
                    slots.append(slot)
            else:
                assignments = db.query(CourseStaffAssignment).filter(
                    CourseStaffAssignment.course_id == s.course_id,
                    CourseStaffAssignment.role.in_(["Tutor", "Practical"])
                ).all()
                for a in assignments:
                    slot = schedule_map.get(f"{a.role}-{a.id}")
                    if slot:
                        slots.append(slot)
                        
            if slots:
                slot = slots[0]
                opened_at_local = s.opened_at + tz_offset
                opened_date_local = opened_at_local.date()
                sched_start_time = datetime.strptime(slot["start"], "%H:%M").time()
                sched_end_time = datetime.strptime(slot["end"], "%H:%M").time()
                sched_start_dt_local = datetime.combine(opened_date_local, sched_start_time)
                sched_end_dt_local = datetime.combine(opened_date_local, sched_end_time)
                
                sched_start_dt_utc = sched_start_dt_local - tz_offset
                sched_end_dt_utc = sched_end_dt_local - tz_offset
                
                if now_utc > sched_end_dt_utc:
                    s.is_open = False
                    s.closed_at = sched_end_dt_utc
                    is_open = False
                    closed_at = sched_end_dt_utc
                    has_changes = True
                    status_str = "Closed"
                elif now_utc < sched_start_dt_utc:
                    status_str = "Active"
                else:
                    status_str = "On Going"
            else:
                # Default fallback: 2 hours
                default_end_dt = s.opened_at + timedelta(hours=2)
                if now_utc > default_end_dt:
                    s.is_open = False
                    s.closed_at = default_end_dt
                    is_open = False
                    closed_at = default_end_dt
                    has_changes = True
                    status_str = "Closed"
                elif now_utc < s.opened_at + timedelta(minutes=10):
                    status_str = "Active"
                else:
                    status_str = "On Going"
        else:
            status_str = "Closed"
            
        result.append({
            "id": s.id,
            "course_id": s.course_id,
            "course_code": course.course_code if course else "Unknown",
            "course_name": course.course_name if course else "Unknown",
            "lecturer_name": lecturer.name if lecturer else "Unknown",
            "lecturer_role": lecturer.role if lecturer else "Lecturer",
            "class_group": s.class_group,
            "opened_at": s.opened_at,
            "closed_at": closed_at,
            "is_open": is_open,
            "status": status_str
        })
        
    if has_changes:
        db.commit()
        
    return result

@router.get("/sessions/{session_id}/attendance", response_model=dict)
def get_admin_session_attendance(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    course = db.query(Course).filter(Course.id == session.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course associated with session not found")

    # Fetch all students enrolled in this course group
    query = db.query(Student).join(Enrolment).filter(Enrolment.course_id == session.course_id)
    if session.class_group != "All":
        query = query.filter(Enrolment.class_group == session.class_group)
    enrolled_students = query.all()

    # Fetch attendance records for this session
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    record_map = {r.student_id: r for r in records}

    # Build student attendance status list
    attendance_list = []
    for s in enrolled_students:
        rec = record_map.get(s.id)
        if rec:
            attendance_list.append({
                "student_id": s.id,
                "student_name": s.name,
                "student_code": s.student_code,
                "status": rec.status,
                "marked_at": rec.marked_at,
                "confidence_score": rec.confidence_score,
                "wifi_verified": rec.wifi_verified,
                "liveness_passed": rec.liveness_passed,
                "network_verified": rec.network_verified,
                "source_ip": rec.source_ip,
                "verify_detail": rec.verify_detail
            })
        else:
            attendance_list.append({
                "student_id": s.id,
                "student_name": s.name,
                "student_code": s.student_code,
                "status": "absent",
                "marked_at": None,
                "confidence_score": None,
                "wifi_verified": False,
                "liveness_passed": False
            })

    return {
        "session_id": session.id,
        "course_name": course.course_name,
        "course_code": course.course_code,
        "class_group": session.class_group,
        "is_open": session.is_open,
        "attendance_list": attendance_list
    }

@router.put("/attendance/{session_id}/{student_id}", response_model=MessageResponse)
def update_admin_attendance(
    session_id: int, 
    student_id: int, 
    body: AdminAttendanceUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    if body.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'present' or 'absent'.")
        
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.student_id == student_id
    ).first()

    if record:
        record.status = body.status
        record.wifi_verified = body.wifi_verified
        record.liveness_passed = body.liveness_passed
        record.marked_at = datetime.utcnow()
    else:
        record = AttendanceRecord(
            session_id=session_id,
            student_id=student_id,
            status=body.status,
            confidence_score=1.0,
            wifi_verified=body.wifi_verified,
            liveness_passed=body.liveness_passed,
            marked_at=datetime.utcnow()
        )
        db.add(record)

    db.commit()
    return {"message": "Attendance record updated successfully"}

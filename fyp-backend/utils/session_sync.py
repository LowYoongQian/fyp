from datetime import datetime, timedelta, time
from utils.timeutil import utcnow
from sqlalchemy import func
from sqlalchemy.orm import Session
from utils.models import Course, Enrolment, ClassSession, AttendanceRecord, Student, CourseStaffAssignment
import time as time_module
from utils.scheduler import calculate_schedule

_last_sync_time = 0.0
_is_syncing = False
_SYNC_THROTTLE_SECONDS = 60.0 # Only sync once per minute max to prevent query storms

def sync_class_sessions(db: Session):
    """Automatically opens and closes class sessions based on the timetable schedule,
    and runs batch processing to mark absent students at the end of the day.
    """
    global _last_sync_time, _is_syncing
    
    current_time = time_module.time()
    if _is_syncing or (current_time - _last_sync_time < _SYNC_THROTTLE_SECONDS):
        return # Skip to avoid query storms and database locks
        
    _is_syncing = True
    try:
        now_utc = utcnow()
        
        # Calculate local timezone offset dynamically
        local_now = datetime.now()
        utc_now = utcnow()
        tz_offset = local_now - utc_now
        
        now_local = now_utc + tz_offset
        schedule_map = calculate_schedule(db)
        
        # Query distinct enrolment combinations once
        enrolments_summary = db.query(Enrolment.course_id, Enrolment.class_group).distinct().all()
        
        # Fetch staff assignments for Tutor/Practical roles once
        assignments_list = db.query(CourseStaffAssignment).filter(
            CourseStaffAssignment.role.in_(["Tutor", "Practical"])
        ).all()
        assignments_by_course = {}
        for a in assignments_list:
            assignments_by_course.setdefault(a.course_id, []).append(a)
            
        # Fetch existing class sessions for the last 7 days to avoid query storms inside the loop
        min_date_utc = datetime.combine(now_local - timedelta(days=7), time(0, 0, 0)) - tz_offset
        sessions_list = db.query(ClassSession).filter(
            ClassSession.opened_at >= min_date_utc
        ).all()
        
        # Index sessions in memory for O(1) retrieval
        sessions_by_key = {}
        for s in sessions_list:
            s_date = (s.opened_at + tz_offset).date()
            sessions_by_key[(s.course_id, s.class_group, s_date)] = s
            
        # Check the last 7 days (including today) to sync past and present classes
        for i in range(7):
            date_check = (now_local - timedelta(days=i)).date()
            day_name = (now_local - timedelta(days=i)).strftime("%A") # Monday, Tuesday, etc.
            
            for course_id, class_group in enrolments_summary:
                # Determine scheduled slots for this course and group
                slots = []
                
                # 1. Primary Lecture Slot
                lect_slot = schedule_map.get(f"Lecture-{course_id}")
                if lect_slot and lect_slot["day"] == day_name:
                    slots.append((lect_slot, "All"))
                
                # 2. Tutor/Practical Slots matching this group
                assignments = assignments_by_course.get(course_id, [])
                for a in assignments:
                    slot = schedule_map.get(f"{a.role}-{a.id}")
                    if slot and slot["day"] == day_name:
                        slots.append((slot, class_group))
                
                for slot, group_name in slots:
                    start_time = datetime.strptime(slot["start"], "%H:%M").time()
                    end_time = datetime.strptime(slot["end"], "%H:%M").time()
                    
                    start_dt = datetime.combine(date_check, start_time)
                    end_dt = datetime.combine(date_check, end_time)
                    
                    start_dt_utc = start_dt - tz_offset
                    end_dt_utc = end_dt - tz_offset
                    
                    # Only process if the class scheduled start time has arrived or passed
                    if now_utc < start_dt_utc:
                        continue
                        
                    session = sessions_by_key.get((course_id, group_name, date_check))
                    
                    if not session:
                        # Auto-open session on time
                        is_open = (now_utc < end_dt_utc)
                        session = ClassSession(
                            course_id=course_id,
                            class_group=group_name,
                            opened_at=start_dt_utc,
                            is_open=is_open,
                            closed_at=end_dt_utc if not is_open else None
                        )
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        # Add to our local index map
                        sessions_by_key[(course_id, group_name, date_check)] = session
                    else:
                        # Auto-close session on time if it reaches the end of class time
                        if session.is_open and now_utc >= end_dt_utc:
                            session.is_open = False
                            session.closed_at = end_dt_utc
                            db.commit()
                            db.refresh(session)
                            
                    # Auto-mark absent at the end of the day (after 11:59 PM local time)
                    absent_threshold_utc = datetime.combine(date_check, time(23, 59, 0)) - tz_offset
                    if now_utc >= absent_threshold_utc:
                        # Find all students enrolled in this course and group
                        enrolled_students = db.query(Student).join(
                            Enrolment, Enrolment.student_id == Student.id
                        ).filter(
                            Enrolment.course_id == course_id,
                            Enrolment.class_group == class_group
                        ).all()
                        
                        if enrolled_students:
                            # Fetch all existing attendance records for this session in one query
                            existing_records = db.query(AttendanceRecord).filter(
                                AttendanceRecord.session_id == session.id
                            ).all()
                            recorded_student_ids = {r.student_id for r in existing_records}
                            
                            needs_commit = False
                            for student in enrolled_students:
                                if student.id not in recorded_student_ids:
                                    marked_time_local = datetime.combine(date_check, time(23, 0, 0))
                                    marked_time_utc = marked_time_local - tz_offset
                                    record = AttendanceRecord(
                                        student_id=student.id,
                                        session_id=session.id,
                                        status="absent",
                                        wifi_verified=False,
                                        liveness_passed=False,
                                        marked_at=marked_time_utc,
                                        verify_detail=marked_time_local.strftime("System on %a %d/%m/%y %I:%M%p")
                                    )
                                    db.add(record)
                                    needs_commit = True
                            
                            if needs_commit:
                                db.commit()
                                
        _last_sync_time = time_module.time()
    except Exception as e:
        db.rollback()
        print(f"Error during class session sync: {e}")
    finally:
        _is_syncing = False


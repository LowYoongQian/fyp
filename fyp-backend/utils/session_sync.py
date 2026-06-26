from datetime import datetime, timedelta, time
from sqlalchemy import func
from sqlalchemy.orm import Session
from utils.models import Course, Enrolment, ClassSession, AttendanceRecord, Student, CourseStaffAssignment
from utils.scheduler import calculate_schedule

def sync_class_sessions(db: Session):
    """Automatically opens and closes class sessions based on the timetable schedule,
    and runs batch processing to mark absent students at the end of the day.
    """
    try:
        now_utc = datetime.utcnow()
        
        # Calculate local timezone offset dynamically
        local_now = datetime.now()
        utc_now = datetime.utcnow()
        tz_offset = local_now - utc_now
        
        now_local = now_utc + tz_offset
        schedule_map = calculate_schedule(db)
        
        # Check the last 7 days (including today) to sync past and present classes
        for i in range(7):
            date_check = (now_local - timedelta(days=i)).date()
            day_name = (now_local - timedelta(days=i)).strftime("%A") # Monday, Tuesday, etc.
            
            # Find all distinct enrolments to know which courses and groups exist
            enrolments_summary = db.query(Enrolment.course_id, Enrolment.class_group).distinct().all()
            
            for course_id, class_group in enrolments_summary:
                # Determine scheduled slots for this course and group
                slots = []
                
                # 1. Primary Lecture Slot
                lect_slot = schedule_map.get(f"Lecture-{course_id}")
                if lect_slot and lect_slot["day"] == day_name:
                    slots.append((lect_slot, "All"))
                
                # 2. Tutor/Practical Slots matching this group
                assignments = db.query(CourseStaffAssignment).filter(
                    CourseStaffAssignment.course_id == course_id,
                    CourseStaffAssignment.role.in_(["Tutor", "Practical"])
                ).all()
                for a in assignments:
                    slot = schedule_map.get(f"{a.role}-{a.id}")
                    if slot and slot["day"] == day_name:
                        # Tutor/Practical slots apply to their assigned group
                        role_group = "All" if a.role == "Lecture" else class_group
                        slots.append((slot, role_group))
                
                for slot, group_name in slots:
                    start_time = datetime.strptime(slot["start"], "%H:%M").time()
                    end_time = datetime.strptime(slot["end"], "%H:%M").time()
                    
                    start_dt = datetime.combine(date_check, start_time)
                    end_dt = datetime.combine(date_check, end_time)
                    
                    # Convert to UTC for comparing and storing in database
                    start_dt_utc = start_dt - tz_offset
                    end_dt_utc = end_dt - tz_offset
                    
                    # Only process if the class scheduled start time has arrived or passed
                    if now_utc < start_dt_utc:
                        continue
                        
                    # Check if session already exists for this slot on this day
                    # Use a range query to be robust and timezone-proof
                    day_start_utc = datetime.combine(date_check, time(0, 0, 0)) - tz_offset
                    day_end_utc = datetime.combine(date_check, time(23, 59, 59)) - tz_offset
                    
                    session = db.query(ClassSession).filter(
                        ClassSession.course_id == course_id,
                        ClassSession.class_group == group_name,
                        ClassSession.opened_at >= day_start_utc,
                        ClassSession.opened_at <= day_end_utc
                    ).first()
                    
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
                        
                        for student in enrolled_students:
                            # Check if attendance record exists
                            record = db.query(AttendanceRecord).filter(
                                AttendanceRecord.session_id == session.id,
                                AttendanceRecord.student_id == student.id
                            ).first()
                            
                            if not record:
                                # Create absent record
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
                        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error during class session sync: {e}")


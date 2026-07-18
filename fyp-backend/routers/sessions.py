from datetime import datetime, timedelta
from utils.timeutil import utcnow
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from utils.database import get_db
from utils.scheduler import calculate_schedule
from utils.session_sync import sync_class_sessions
from utils.models import (
    User, Student, Lecturer, Course, Enrolment, ClassSession,
    AttendanceRecord, CampusNetwork, SecuritySetting, FaceEmbedding,
    CourseStaffAssignment, ClassMeeting
)
from utils.security import require_lecturer, require_student
from utils.db_helpers import require_own_profile, get_or_404
from utils.network_verify import get_client_ip, verify_network
from utils.schemas import (
    SessionCreate, SessionResponse, AttendanceSubmit,
    AttendanceResponse, SessionAttendanceResponse, StudentAttendanceStatus
)
from routers.students import (
    _extract_face_embedding, _embedding_to_floats,
    _cosine_distance, _FACE_MATCH_THRESHOLD,
)

router = APIRouter(prefix="/sessions", tags=["Attendance"])


def _get_settings(db: Session) -> dict:
    """Load security settings as a plain dict with safe defaults."""
    rows = db.query(SecuritySetting).all()
    cfg = {r.key: (r.value or "") for r in rows}
    cfg.setdefault("network_check_enabled", "true")
    cfg.setdefault("fail_closed", "true")
    cfg.setdefault("trust_proxy_header", "false")
    cfg.setdefault("demo_simulate_network", "false")
    cfg.setdefault("demo_simulated_ip", "")
    return cfg


def _truthy(v: str) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "on")

def get_course_group_slots(db: Session, course_id: int, class_group: str) -> list:
    schedule_map = calculate_schedule(db)
    
    slots = []
    if class_group == "All":
        # Lecture slot
        slot = schedule_map.get(f"Lecture-{course_id}")
        if slot:
            slots.append(slot)
    else:
        # Tutor / Practical slots for this course
        assignments = db.query(CourseStaffAssignment).filter(
            CourseStaffAssignment.course_id == course_id,
            CourseStaffAssignment.role.in_(["Tutor", "Practical"])
        ).all()
        for a in assignments:
            slot = schedule_map.get(f"{a.role}-{a.id}")
            if slot:
                slots.append(slot)
                
    return slots


def validate_session_opening(db: Session, course_id: int, class_group: str, now: datetime):
    slots = get_course_group_slots(db, course_id, class_group)
    if not slots:
        return
        
    valid = False
    slot_descriptions = []
    current_day = now.strftime("%A")
    
    for slot in slots:
        day = slot["day"]
        start_s = slot["start"]
        end_s = slot["end"]
        room = slot["room"]
        slot_descriptions.append(f"{day} {start_s}-{end_s} in {room}")
        
        if day.lower() == current_day.lower():
            try:
                sh, sm = map(int, start_s.split(":"))
                eh, em = map(int, end_s.split(":"))
                
                start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
                end_dt = now.replace(hour=eh, minute=em, second=0, microsecond=0)
                
                open_start = start_dt - timedelta(hours=1)
                
                if open_start <= now <= end_dt:
                    valid = True
                    break
            except Exception:
                valid = True
                break
                
    if not valid:
        slots_str = " or ".join(slot_descriptions)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot open session. Class is scheduled for {slots_str}. You can only open the session starting 1 hour before class."
        )


def validate_student_checkin(db: Session, course_id: int, class_group: str, now: datetime):
    slots = get_course_group_slots(db, course_id, class_group)
    if not slots:
        return
        
    valid = False
    is_early = False
    slot_descriptions = []
    current_day = now.strftime("%A")
    
    for slot in slots:
        day = slot["day"]
        start_s = slot["start"]
        end_s = slot["end"]
        room = slot["room"]
        slot_descriptions.append(f"{day} {start_s}-{end_s}")
        
        if day.lower() == current_day.lower():
            try:
                sh, sm = map(int, start_s.split(":"))
                eh, em = map(int, end_s.split(":"))
                
                start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
                end_dt = now.replace(hour=eh, minute=em, second=0, microsecond=0)
                
                if start_dt <= now <= end_dt:
                    valid = True
                    break
                elif now < start_dt:
                    if start_dt - timedelta(hours=1) <= now:
                        is_early = True
            except Exception:
                valid = True
                break
                
    if not valid:
        if is_early:
            raise HTTPException(
                status_code=403,
                detail="Class has not started yet. Please wait until the scheduled time to check in."
            )
        else:
            slots_str = " or ".join(slot_descriptions)
            raise HTTPException(
                status_code=403,
                detail=f"Attendance check-in is outside of the scheduled class time ({slots_str})."
            )


# 1. Open Session (Lecturer/Admin only)
@router.post("/open", response_model=SessionResponse, status_code=201)
def open_session(body: SessionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Verify course exists
    course = get_or_404(db, Course, body.course_id, "Course")

    # Enforce session open window
    validate_session_opening(db, body.course_id, body.class_group, datetime.now())

    # Check if there is already an active session for this course and group
    active_session = db.query(ClassSession).filter(
        ClassSession.course_id == body.course_id,
        ClassSession.class_group == body.class_group,
        ClassSession.is_open == True
    ).first()
    if active_session:
        raise HTTPException(
            status_code=400,
            detail=f"An active session already exists for this course under group '{body.class_group}'"
        )

    # Open a session for the requested group ONLY. Opening one group must not
    # cascade to other groups — a G1 opening must not let G2/G3 students check
    # in. ("All" is a course-wide lecture that every enrolled student attends.)
    # The active-session guard above already ensured this group is not open, so
    # a fresh session is always created and returned (no None fallback -> no 500).
    sess = ClassSession(
        course_id=body.course_id,
        opened_at=utcnow(),
        is_open=True,
        class_group=body.class_group,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess

# 2. Close Session (Lecturer/Admin only)
@router.post("/{id}/close", response_model=SessionResponse)
def close_session(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    session = get_or_404(db, ClassSession, id, "Session")
    
    if not session.is_open:
        raise HTTPException(status_code=400, detail="Session is already closed")

    session.is_open = False
    session.closed_at = utcnow()
    db.commit()
    db.refresh(session)
    return session

# 3. List active sessions matching student enrolments (Student only)
@router.get("/open", response_model=List[SessionResponse])
def get_active_student_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    sync_class_sessions(db)
    # Get student profile
    student = require_own_profile(db, Student, current_user.id, "Student")

    # Join ClassSession with Enrolments to filter active sessions student is enrolled in
    sessions = db.query(ClassSession).join(
        Enrolment, Enrolment.course_id == ClassSession.course_id
    ).filter(
        Enrolment.student_id == student.id,
        ClassSession.is_open == True,
        (ClassSession.class_group == "All") | (ClassSession.class_group == Enrolment.class_group)
    ).all()

    schedule_map = calculate_schedule(db)
    now_utc = utcnow()
    # Calculate local timezone offset dynamically
    local_now = datetime.now()
    utc_now = utcnow()
    tz_offset = local_now - utc_now
    active_sessions = []

    # Read-only: decide in-memory which sessions are still within their window.
    # A session past its end is simply excluded from the response; persisting the
    # closed state is left to sync_class_sessions (and the check-in guard), so
    # this GET stays idempotent.
    for s in sessions:
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
            sched_end_time = datetime.strptime(slot["end"], "%H:%M").time()
            sched_end_dt_local = datetime.combine(opened_date_local, sched_end_time)
            sched_end_dt_utc = sched_end_dt_local - tz_offset
            if now_utc <= sched_end_dt_utc:
                active_sessions.append(s)
        else:
            default_end_dt = s.opened_at + timedelta(hours=2)
            if now_utc <= default_end_dt:
                active_sessions.append(s)

    return active_sessions

# 4. Student Check-in (Student only — face liveness + network location verification)
@router.post("/{id}/attend", response_model=AttendanceResponse)
def student_check_in(id: int, body: AttendanceSubmit, request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    # Check if session exists and is active
    session = get_or_404(db, ClassSession, id, "Session")
        
    if session.is_open:
        schedule_map = calculate_schedule(db)
        now_utc = utcnow()
        
        # Calculate local timezone offset dynamically
        local_now = datetime.now()
        utc_now = utcnow()
        tz_offset = local_now - utc_now
        
        slots = []
        if session.class_group == "All":
            slot = schedule_map.get(f"Lecture-{session.course_id}")
            if slot:
                slots.append(slot)
        else:
            assignments = db.query(CourseStaffAssignment).filter(
                CourseStaffAssignment.course_id == session.course_id,
                CourseStaffAssignment.role.in_(["Tutor", "Practical"])
            ).all()
            for a in assignments:
                slot = schedule_map.get(f"{a.role}-{a.id}")
                if slot:
                    slots.append(slot)
                    
        is_stale = False
        if slots:
            slot = slots[0]
            opened_at_local = session.opened_at + tz_offset
            opened_date_local = opened_at_local.date()
            sched_end_time = datetime.strptime(slot["end"], "%H:%M").time()
            sched_end_dt_local = datetime.combine(opened_date_local, sched_end_time)
            sched_end_dt_utc = sched_end_dt_local - tz_offset
            if now_utc > sched_end_dt_utc:
                session.is_open = False
                session.closed_at = sched_end_dt_utc
                is_stale = True
        else:
            default_end_dt = session.opened_at + timedelta(hours=2)
            if now_utc > default_end_dt:
                session.is_open = False
                session.closed_at = default_end_dt
                is_stale = True
                
        if is_stale:
            db.commit()
            
    if not session.is_open:
        raise HTTPException(status_code=400, detail="Attendance check-in has closed for this session")

    # Get student profile
    student = require_own_profile(db, Student, current_user.id, "Student")

    # Check if student is enrolled in this session's course
    enrolment = db.query(Enrolment).filter(
        Enrolment.student_id == student.id,
        Enrolment.course_id == session.course_id
    ).first()
    if not enrolment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    # Check the student's class group matches the session group (unless "All")
    if session.class_group != "All" and session.class_group != enrolment.class_group:
        raise HTTPException(
            status_code=403,
            detail=f"This session is for group '{session.class_group}', "
                   f"but you are in group '{enrolment.class_group}'"
        )

    # Check if student already checked in for this session
    existing_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.session_id == id
    ).first()
    if existing_record:
        raise HTTPException(status_code=400, detail="You have already registered attendance for this session")

    cfg = _get_settings(db)
    # Enforce student check-in start time limit
    validate_student_checkin(db, session.course_id, session.class_group, datetime.now())

    # 1. Liveness & Face Verification
    liveness_passed = body.liveness_passed
    if not liveness_passed:
        raise HTTPException(status_code=400, detail="Face liveness check failed. Please perform the gesture challenge correctly.")
    # Require an actual captured image (no mock/placeholder accepted).
    if not (body.image_base64 or "").strip():
        raise HTTPException(status_code=400, detail="A captured face image is required to check in.")

    # 1b. Identity verification via face embedding cosine distance.
    # ArcFace identity matching is MANDATORY — it is the core anti-proxy mechanism
    # (report §2.2.2). If deepface is unavailable, _extract_face_embedding raises 503;
    # there is no mock/dev fallback that would let an unverified check-in through.
    stored_emb = db.query(FaceEmbedding).filter(
        FaceEmbedding.student_id == student.id,
        FaceEmbedding.is_active == True,
    ).first()
    if not stored_emb:
        raise HTTPException(
            status_code=400,
            detail="No registered face found. Please register your face before checking in."
        )
    try:
        live_bytes  = _extract_face_embedding(body.image_base64, enforce_detection=False)
        live_vec    = _embedding_to_floats(live_bytes)
        stored_vec  = _embedding_to_floats(stored_emb.embedding)
        distance    = _cosine_distance(live_vec, stored_vec)
        confidence_score = round(1.0 - distance, 4)
        if distance > _FACE_MATCH_THRESHOLD:
            raise HTTPException(
                status_code=403,
                detail=f"Face identity could not be verified (distance {distance:.3f} > threshold {_FACE_MATCH_THRESHOLD}). "
                       "Ensure good lighting and look directly at the camera."
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Face matching error: {exc}")

    # Behavioral biometrics: flag abnormally fast completions as suspicious.
    # Legitimate users need at least ~800 ms per challenge (2 challenges → ~1600 ms minimum).
    # Values below 800 ms indicate automation, replay, or a spoofed gesture event.
    challenge_ms = body.liveness_challenge_ms
    liveness_suspicious = bool(challenge_ms is not None and challenge_ms < 800)

    # 2. Network-based location verification
    source_ip = get_client_ip(request, trust_proxy_header=_truthy(cfg["trust_proxy_header"]))

    # Demo mode: override the observed IP with a simulated campus IP so the
    # full flow can be exercised on localhost. Documented as demo-only.
    if _truthy(cfg["demo_simulate_network"]) and cfg["demo_simulated_ip"]:
        source_ip = cfg["demo_simulated_ip"].strip()

    network_verified = False
    verify_detail = "network check disabled"

    if _truthy(cfg["network_check_enabled"]):
        active_networks = db.query(CampusNetwork).filter(CampusNetwork.is_active == True).all()
        network_verified, verify_detail = verify_network(
            source_ip=source_ip,
            reported_gateway_ip=body.gateway_ip,
            reported_local_ip=body.local_ip,
            reported_ssid=body.wifi_ssid,
            reported_bssid=body.bssid,
            networks=active_networks,
        )

        # Fail-closed: reject the check-in if the network can't be verified
        if not network_verified and _truthy(cfg["fail_closed"]):
            raise HTTPException(
                status_code=403,
                detail="You must be connected to the campus network to check in. "
                       "Verification failed for your current connection."
            )
    else:
        network_verified = True  # check disabled -> don't block

    # wifi_verified mirrors the network verdict (kept for backward compatibility)
    wifi_verified = network_verified

    # Register attendance record
    record = AttendanceRecord(
        student_id=student.id,
        session_id=id,
        status="present",
        confidence_score=confidence_score,
        wifi_verified=wifi_verified,
        liveness_passed=liveness_passed,
        marked_at=utcnow(),
        source_ip=source_ip,
        reported_ssid=body.wifi_ssid,
        reported_bssid=body.bssid,
        reported_gateway_ip=body.gateway_ip,
        network_verified=network_verified,
        verify_detail=verify_detail,
        liveness_challenge_ms=challenge_ms,
        liveness_suspicious=liveness_suspicious,
        device_id=body.device_id,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent double-submit (e.g. a double-tap or retry) raced past the
        # "already checked in" guard above. The DB unique constraint on
        # (student_id, session_id) is the authoritative backstop — one record
        # per student per session. Roll back and report it as an idempotent 400.
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already registered attendance for this session")
    db.refresh(record)
    return record

# 5. Live Lecturer Attendance List (Lecturer/Admin only)
@router.get("/{id}/attendance", response_model=SessionAttendanceResponse)
def get_session_attendance(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    session = get_or_404(db, ClassSession, id, "Session")

    course = get_or_404(db, Course, session.course_id, detail="Course associated with session not found")

    # A lecturer may only view the roster for a course they own or are assigned
    # to; admins may view any. Otherwise any lecturer could read another class's
    # attendance. (Same authorization rule as the attendance-override endpoint.)
    if current_user.role != "admin":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        assigned_course_ids = [
            a.course_id for a in db.query(CourseStaffAssignment)
            .filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
        ]
        if course.lecturer_id != lecturer.id and course.id not in assigned_course_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view attendance for this course")

    # Fetch all students enrolled in this course group
    query = db.query(Student).join(Enrolment).filter(Enrolment.course_id == session.course_id)
    if session.class_group != "All":
        query = query.filter(Enrolment.class_group == session.class_group)
    enrolled_students = query.all()

    # Fetch attendance records for this session
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == id).all()
    record_map = {r.student_id: r for r in records}

    # Build student attendance status list
    attendance_list = []
    for s in enrolled_students:
        rec = record_map.get(s.id)
        if rec:
            status = StudentAttendanceStatus(
                student_id=s.id,
                student_name=s.name,
                student_code=s.student_code,
                status=rec.status,
                marked_at=rec.marked_at,
                confidence_score=rec.confidence_score,
                network_verified=rec.network_verified,
                source_ip=rec.source_ip,
                verify_detail=rec.verify_detail
            )
        else:
            status = StudentAttendanceStatus(
                student_id=s.id,
                student_name=s.name,
                student_code=s.student_code,
                status="absent",
                marked_at=None,
                confidence_score=None
            )
        attendance_list.append(status)

    return SessionAttendanceResponse(
        session_id=session.id,
        course_name=course.course_name,
        course_code=course.course_code,
        class_group=session.class_group,
        is_open=session.is_open,
        attendance_list=attendance_list
    )


# 6. List active sessions created by/for the lecturer (Lecturer/Admin only)
@router.get("/active", response_model=List[SessionResponse])
def get_active_lecturer_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    sync_class_sessions(db)
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        if current_user.role == "admin":
            sessions = db.query(ClassSession).filter(ClassSession.is_open == True).all()
        else:
            raise HTTPException(status_code=404, detail="Lecturer profile not found")
    else:
        # Get active sessions for courses taught by this lecturer
        sessions = db.query(ClassSession).join(
            Course, Course.id == ClassSession.course_id
        ).filter(
            Course.lecturer_id == lecturer.id,
            ClassSession.is_open == True
        ).all()

    schedule_map = calculate_schedule(db)
    now_utc = utcnow()
    # Calculate local timezone offset dynamically
    local_now = datetime.now()
    utc_now = utcnow()
    tz_offset = local_now - utc_now
    active_sessions = []

    # Read-only: decide in-memory which sessions are still within their window.
    # A session past its end is simply excluded from the response; persisting the
    # closed state is left to sync_class_sessions (and the check-in guard), so
    # this GET stays idempotent.
    for s in sessions:
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
            sched_end_time = datetime.strptime(slot["end"], "%H:%M").time()
            sched_end_dt_local = datetime.combine(opened_date_local, sched_end_time)
            sched_end_dt_utc = sched_end_dt_local - tz_offset
            if now_utc <= sched_end_dt_utc:
                active_sessions.append(s)
        else:
            default_end_dt = s.opened_at + timedelta(hours=2)
            if now_utc <= default_end_dt:
                active_sessions.append(s)

    return active_sessions


# 7. List courses taught by the lecturer (Lecturer/Admin only)
# Lets the mobile staff dashboard load its course list via API instead of a
# direct DB query. Admins get every course.
@router.get("/my-courses", response_model=List[dict])
def get_my_taught_courses(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    if current_user.role == "admin":
        courses = db.query(Course).all()
    else:
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()

    # Lecture times come from class_meetings (source of truth), not Course.schedule_*.
    course_ids = [c.id for c in courses]
    lecture_by_course = {
        m.course_id: m for m in db.query(ClassMeeting)
        .filter(ClassMeeting.role == "Lecture", ClassMeeting.course_id.in_(course_ids)).all()
    }
    result = []
    for c in courses:
        m = lecture_by_course.get(c.id)
        result.append({
            "id": c.id,
            "course_name": c.course_name,
            "course_code": c.course_code,
            "schedule_day": m.day if m else None,
            "schedule_start": m.start if m else None,
            "schedule_end": m.end if m else None,
            "schedule_room": m.room if m else None,
        })
    return result


class LecturerAttendanceUpdate(BaseModel):
    status: str


# 8. List all sessions for a specific course (Lecturer/Admin only)
@router.get("/course/{course_id}/sessions", response_model=List[SessionResponse])
def get_course_sessions(course_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    if current_user.role != "admin":
        # Check authorization
        assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
        assigned_course_ids = [a.course_id for a in assigned_assignments]
        
        course = get_or_404(db, Course, course_id, "Course")
            
        if course.lecturer_id != lecturer.id and course.id not in assigned_course_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view sessions for this course")
            
    # Fetch all sessions for this course, ordered by opened_at desc
    sessions = db.query(ClassSession).filter(ClassSession.course_id == course_id).order_by(ClassSession.opened_at.desc()).all()
    return sessions


# 9. Override/Update student attendance record (Lecturer/Admin only)
@router.put("/attendance/{session_id}/{student_id}")
def update_lecturer_attendance(
    session_id: int,
    student_id: int,
    body: LecturerAttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Lecturer profile not found")
        
    session = get_or_404(db, ClassSession, session_id, "Session")
        
    if current_user.role != "admin":
        course = get_or_404(db, Course, session.course_id, detail="Course associated with session not found")
            
        assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
        assigned_course_ids = [a.course_id for a in assigned_assignments]
        
        if course.lecturer_id != lecturer.id and course.id not in assigned_course_ids:
            raise HTTPException(status_code=403, detail="Not authorized to edit attendance for this course")
            
    if body.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'present' or 'absent'")

    # The target student must actually belong to this session: enrolled in the
    # course, and (for a group-specific session) in the matching group. Without
    # this, a mistyped student_id would fabricate an orphan record for a student
    # who never took the class.
    enrolment = db.query(Enrolment).filter(
        Enrolment.student_id == student_id,
        Enrolment.course_id == session.course_id
    ).first()
    if not enrolment:
        raise HTTPException(status_code=400, detail="That student is not enrolled in this course")
    if session.class_group != "All" and session.class_group != enrolment.class_group:
        raise HTTPException(
            status_code=400,
            detail=f"That student is in group '{enrolment.class_group}', "
                   f"not this session's group '{session.class_group}'"
        )

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.student_id == student_id
    ).first()
    
    if record:
        record.status = body.status
        record.marked_at = utcnow()
        if body.status == "present":
            record.confidence_score = 1.0
            record.source_ip = "Staff Override"
        else:
            record.confidence_score = None
            record.source_ip = None
    else:
        record = AttendanceRecord(
            session_id=session_id,
            student_id=student_id,
            status=body.status,
            confidence_score=1.0 if body.status == "present" else None,
            wifi_verified=True if body.status == "present" else False,
            liveness_passed=True if body.status == "present" else False,
            marked_at=utcnow(),
            source_ip="Staff Override" if body.status == "present" else None
        )
        db.add(record)
        
    db.commit()
    return {"status": "success", "message": "Attendance record updated successfully"}


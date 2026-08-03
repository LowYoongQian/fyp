from datetime import datetime, timedelta
from utils.timeutil import campus_now, utcnow
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from domain.security_settings import get_settings, truthy
from db.database import get_db
from domain.scheduler import get_course_group_slots, lecture_meetings, session_end_utc
from domain.session_sync import sync_class_sessions
from db.models import (
    User, Student, Lecturer, Course, Enrolment, ClassSession,
    AttendanceRecord, CampusNetwork, SecuritySetting, FaceEmbedding,
    CourseStaffAssignment, ClassMeeting
)
from utils.security import require_lecturer, require_student
from domain.attendance import require_session_enrolment
from utils.db_helpers import get_or_404, my_course_ids, require_own_profile
from integrations.network_verify import get_client_ip, verify_network
from schemas import (
    SessionCreate, SessionResponse, AttendanceSubmit,
    AttendanceResponse, SessionAttendanceResponse, StudentAttendanceStatus
)
from integrations.face import (
    _extract_face_embedding, _embedding_to_floats,
    _cosine_distance, _FACE_MATCH_THRESHOLD,
)

router = APIRouter(prefix="/sessions", tags=["Attendance"])


def require_course_access(db: Session, current_user: User, course_id: str, action: str) -> Course:
    """Return the course, or 403 unless the caller owns/is assigned to it.

    Admins pass through. Every lecturer-facing endpoint that touches one course
    routes through here so the rule is stated once — open, close, roster read
    and attendance override all enforce the SAME ownership check. Without it any
    authenticated lecturer could open, close, or edit any other lecturer's class.
    """
    course = get_or_404(db, Course, course_id, "Course")
    if current_user.role == "admin":
        return course
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    if course.id not in my_course_ids(db, lecturer.id):
        raise HTTPException(status_code=403, detail=f"Not authorized to {action} for this course")
    return course


def validate_session_opening(db: Session, course_id: str, class_group: str, now: datetime):
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


def validate_student_checkin(db: Session, course_id: str, class_group: str, now: datetime):
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
    # Verify the course exists AND that this lecturer teaches it
    course = require_course_access(db, current_user, body.course_id, "open a session")

    # Enforce session open window. Campus local time, not datetime.now(): the validator
    # compares against timetable strings ("14:00") that are campus local, and the host
    # clock is UTC on Railway — so this rejected every on-time open by 8 hours.
    validate_session_opening(db, body.course_id, body.class_group, campus_now())

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
def close_session(id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    session = get_or_404(db, ClassSession, id, "Session")
    require_course_access(db, current_user, session.course_id, "close a session")

    if not session.is_open:
        raise HTTPException(status_code=400, detail="Session is already closed")

    session.is_open = False
    session.closed_at = utcnow()
    db.commit()
    db.refresh(session)
    return session

# A GET /sessions/open used to sit here answering "which of my classes can I check into
# right now?" — the same question /students/me/active-sessions answers, in a different
# response shape. Both clients call that one; this had no callers. One endpoint per
# question, so the two shapes cannot drift apart.

# 4. Student Check-in (Student only — face liveness + network location verification)
@router.post("/{id}/attend", response_model=AttendanceResponse)
def student_check_in(id: str, body: AttendanceSubmit, request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    # Check if session exists and is active
    session = get_or_404(db, ClassSession, id, "Session")
        
    if session.is_open:
        now_utc = utcnow()
        slots = get_course_group_slots(db, session.course_id, session.class_group)
        scheduled_end = session_end_utc(session, slots)

        if now_utc > scheduled_end:
            session.is_open = False
            session.closed_at = scheduled_end
            db.commit()
            
    if not session.is_open:
        raise HTTPException(status_code=400, detail="Attendance check-in has closed for this session")

    # Get student profile
    student = require_own_profile(db, Student, current_user.id, "Student")

    # Enrolled on this course, and in this session's group unless it is for everyone.
    enrolment = require_session_enrolment(db, session, student.id, status_code=403)

    # Check if student already checked in for this session
    existing_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.session_id == id
    ).first()
    if existing_record:
        raise HTTPException(status_code=400, detail="You have already registered attendance for this session")

    cfg = get_settings(db)
    # Enforce student check-in start time limit — campus local, same reason as /open.
    validate_student_checkin(db, session.course_id, session.class_group, campus_now())

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
    source_ip = get_client_ip(request, trust_proxy_header=truthy(cfg["trust_proxy_header"]))

    # Demo mode: override the observed IP with a simulated campus IP so the
    # full flow can be exercised on localhost. Documented as demo-only.
    if truthy(cfg["demo_simulate_network"]) and cfg["demo_simulated_ip"]:
        source_ip = cfg["demo_simulated_ip"].strip()

    network_verified = False
    verify_detail = "network check disabled"

    if truthy(cfg["network_check_enabled"]):
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
        if not network_verified and truthy(cfg["fail_closed"]):
            raise HTTPException(
                status_code=403,
                detail="You must be connected to the campus network to check in. "
                       "Verification failed for your current connection."
            )
    else:
        network_verified = True  # check disabled -> don't block

    # Register attendance record. liveness_passed (what the client reported) and
    # liveness_suspicious (gesture faster than the floor) are separate columns —
    # they used to be two names for one, so whichever was assigned last won and the
    # reported result was thrown away.
    record = AttendanceRecord(
        student_id=student.id,
        session_id=id,
        status="present",
        confidence_score=confidence_score,
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
def get_session_attendance(id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    session = get_or_404(db, ClassSession, id, "Session")

    # A lecturer may only view the roster for a course they own or are assigned
    # to; admins may view any. Otherwise any lecturer could read another class's
    # attendance.
    course = require_course_access(db, current_user, session.course_id, "view attendance")

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
    sync_class_sessions()
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        if current_user.role == "admin":
            sessions = db.query(ClassSession).filter(ClassSession.is_open == True).all()
        else:
            raise HTTPException(status_code=404, detail="Lecturer profile not found")
    else:
        sessions = db.query(ClassSession).filter(
            ClassSession.course_id.in_(my_course_ids(db, lecturer.id)),
            ClassSession.is_open == True
        ).all()

    now_utc = utcnow()

    # Read-only: decide in-memory which sessions are still within their window.
    # A session past its end is simply excluded from the response; persisting the
    # closed state is left to sync_class_sessions (and the check-in guard), so
    # this GET stays idempotent.
    return [
        s for s in sessions
        if now_utc <= session_end_utc(s, get_course_group_slots(db, s.course_id, s.class_group))
    ]


# 7. List courses taught by the lecturer (Lecturer/Admin only)
# Lets the mobile staff dashboard load its course list via API instead of a
# direct DB query. Admins get every course.
@router.get("/my-courses", response_model=List[dict])
def get_my_taught_courses(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    if current_user.role == "admin":
        courses = db.query(Course).all()
    else:
        # Owned OR assigned — the same rule every other lecturer screen uses. This one
        # checked ownership only, so a tutor saw an empty list here and their classes
        # everywhere else.
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        courses = db.query(Course).filter(
            Course.id.in_(my_course_ids(db, lecturer.id))
        ).all()

    # Lecture times come from class_meetings (source of truth), not Course.schedule_*.
    lecture_by_course = lecture_meetings(db, [c.id for c in courses])
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
def get_course_sessions(course_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    require_course_access(db, current_user, course_id, "view sessions")

    # Fetch all sessions for this course, ordered by opened_at desc
    sessions = db.query(ClassSession).filter(ClassSession.course_id == course_id).order_by(ClassSession.opened_at.desc()).all()
    return sessions


# 9. Override/Update student attendance record (Lecturer/Admin only)
@router.put("/attendance/{session_id}/{student_id}")
def update_lecturer_attendance(
    session_id: str,
    student_id: str,
    body: LecturerAttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    session = get_or_404(db, ClassSession, session_id, "Session")
    require_course_access(db, current_user, session.course_id, "edit attendance")

    if body.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'present' or 'absent'")

    require_session_enrolment(db, session, student_id)

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
            network_verified=True if body.status == "present" else False,
            liveness_passed=True if body.status == "present" else False,
            marked_at=utcnow(),
            source_ip="Staff Override" if body.status == "present" else None
        )
        db.add(record)
        
    db.commit()
    return {"status": "success", "message": "Attendance record updated successfully"}


# ASSUMPTION: Server and student client devices share the same local network subnet without NAT in between,
# unless reverse proxy headers (X-Forwarded-For) are explicitly trusted via the Security Settings policy.

@router.post("/verify-network")
def verify_attendance_network(
    request: Request,
    body: Optional[dict] = None,
    db: Session = Depends(get_db)
):
    """
    Standalone API endpoint to verify real incoming request IP network location
    against active whitelisted campus subnets stored in database.
    """
    cfg = get_settings(db)
    source_ip = get_client_ip(request, trust_proxy_header=truthy(cfg["trust_proxy_header"]))

    if truthy(cfg["demo_simulate_network"]) and cfg["demo_simulated_ip"]:
        source_ip = cfg["demo_simulated_ip"].strip()

    active_networks = db.query(CampusNetwork).filter(CampusNetwork.is_active == True).all()

    reported_ssid = (body or {}).get("wifi_ssid")
    reported_bssid = (body or {}).get("bssid")
    reported_gateway = (body or {}).get("gateway_ip")
    reported_local = (body or {}).get("local_ip")

    network_verified, verify_detail = verify_network(
        source_ip=source_ip,
        reported_gateway_ip=reported_gateway,
        reported_local_ip=reported_local,
        reported_ssid=reported_ssid,
        reported_bssid=reported_bssid,
        networks=active_networks,
    )

    reason = "passed" if network_verified else ("not_whitelisted" if not active_networks else "subnet_mismatch")

    return {
        "verified": network_verified,
        "source_ip": source_ip,
        "reason": reason,
        "detail": verify_detail,
        "whitelisted_networks_count": len(active_networks)
    }


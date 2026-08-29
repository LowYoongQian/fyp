from datetime import datetime, timedelta
from utils.timeutil import campus_now, iso_utc, local_offset, utcnow
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from domain.security_settings import get_settings, truthy
from db.database import get_db
from domain.scheduler import (
    get_course_group_slots, lecture_meetings, session_checkin_state, session_end_utc,
)
from domain.session_sync import source_meeting_id, sync_class_sessions
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
    SessionCreate, SessionResponse, ClassCancellation, ReplacementClassCreate, AttendanceSubmit,
    AttendanceResponse, SessionAttendanceResponse, StudentAttendanceStatus
)
from integrations.face import (
    _extract_face_embedding, _embedding_to_floats,
    _cosine_distance, _FACE_MATCH_THRESHOLD,
)
from domain.audit import log_audit_event
from domain.class_lifecycle import (
    barred_list_readiness, class_can_open, has_active_replacement,
    mark_class_held, needs_admin_escalation,
)
from routers.attendance_features import add_notification

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


def validate_session_opening(db: Session, course_id: str, class_group: str, now: datetime,
                             meeting_id: str | None = None):
    slots = get_course_group_slots(db, course_id, class_group)
    if meeting_id:
        slots = [slot for slot in slots if str(slot.get("meeting_id")) == str(meeting_id)]
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
                    return slot
            except Exception:
                valid = True
                return slot
                
    if not valid:
        slots_str = " or ".join(slot_descriptions)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot open session. Class is scheduled for {slots_str}. You can only open the session starting 1 hour before class."
        )
    return None


def _scheduled_bounds(slot: dict, local_date) -> tuple[datetime, datetime]:
    offset = local_offset()
    parse = lambda value: datetime.combine(local_date, datetime.strptime(value, "%H:%M").time()) - offset
    return parse(slot["start"]), parse(slot["end"])


def _class_group(meeting: ClassMeeting) -> str:
    return "All" if meeting.role == "Lecture" else meeting.class_group


def _semester_for(db: Session, course_id: str) -> str | None:
    row = db.query(Enrolment.semester).filter(Enrolment.course_id == course_id).first()
    return row[0] if row else None


def _notify_course_people(db: Session, lesson: ClassSession, kind: str, title: str, body: str) -> None:
    students = db.query(Student).join(Enrolment).filter(Enrolment.course_id == lesson.course_id)
    if lesson.class_group != "All":
        students = students.filter(Enrolment.class_group == lesson.class_group)
    user_ids = {student.user_id for student in students.all() if student.user_id}
    user_ids.update(user_id for (user_id,) in db.query(User.id).filter(User.role == "admin").all())
    for user_id in user_ids:
        add_notification(
            db, user_id, kind, title, body,
            f"{kind}:{lesson.id}:{user_id}",
            {"class_id": str(lesson.id), "course_id": str(lesson.course_id)},
        )


def _audit_class_action(db: Session, user: User, action: str, lesson: ClassSession, details: str) -> None:
    log_audit_event(
        db, user_id=str(user.id), user_name=user.profile_name or user.email,
        user_role=user.role, category="staff" if user.role != "admin" else "admin",
        action=action, details=f"class={lesson.id}; course={lesson.course_id}; {details}",
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
    now_local = campus_now()
    slot = validate_session_opening(db, body.course_id, body.class_group, now_local, body.meeting_id)
    if not slot:
        raise HTTPException(status_code=400, detail="No matching class is scheduled today")
    scheduled_start, scheduled_end = _scheduled_bounds(slot, now_local.date())

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
    sess = db.query(ClassSession).filter(
        ClassSession.meeting_id == slot["meeting_id"],
        ClassSession.scheduled_start == scheduled_start,
    ).first()
    if sess and sess.status == "cancelled":
        raise HTTPException(status_code=400, detail="This class was cancelled and cannot be opened")
    if sess and sess.status == "open":
        raise HTTPException(status_code=400, detail="This class is already open")
    if sess and sess.status == "completed":
        raise HTTPException(status_code=400, detail="This class has already finished")
    if not sess:
        sess = ClassSession(course_id=body.course_id, meeting_id=slot["meeting_id"],
                            scheduled_start=scheduled_start, scheduled_end=scheduled_end,
                            class_group=body.class_group, room=slot.get("room"),
                            semester=_semester_for(db, body.course_id))
        db.add(sess)
    sess.opened_at = utcnow()
    sess.opened_by_user_id = current_user.id
    sess.status = "open"
    sess.is_open = True
    db.commit()
    db.refresh(sess)
    return sess


@router.get("/today")
def get_todays_classes(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    """Return today's owned timetable rows, materialized without opening attendance."""
    today = campus_now().date()
    day = today.strftime("%A")
    if current_user.role == "admin":
        meetings = db.query(ClassMeeting).filter(ClassMeeting.day == day).all()
    else:
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        meetings = db.query(ClassMeeting).filter(
            ClassMeeting.day == day, ClassMeeting.lecturer_id == lecturer.id
        ).all()
    result = []
    for meeting in meetings:
        start, end = _scheduled_bounds({"start": meeting.start, "end": meeting.end}, today)
        lesson = db.query(ClassSession).filter(
            ClassSession.meeting_id == meeting.id, ClassSession.scheduled_start == start
        ).first()
        if not lesson:
            lesson = ClassSession(
                course_id=meeting.course_id, meeting_id=meeting.id,
                scheduled_start=start, scheduled_end=end, status="scheduled", is_open=False,
                class_group=_class_group(meeting), room=meeting.room,
                semester=_semester_for(db, meeting.course_id), opened_at=None,
            )
            db.add(lesson)
            db.flush()
        course = db.query(Course).filter(Course.id == meeting.course_id).first()
        result.append({
            "id": lesson.id, "course_id": lesson.course_id,
            "course_code": course.course_code if course else "", "course_name": course.course_name if course else "",
            "class_group": lesson.class_group, "role": meeting.role, "room": lesson.room,
            "scheduled_start": iso_utc(lesson.scheduled_start), "scheduled_end": iso_utc(lesson.scheduled_end),
            "status": lesson.status, "cancel_reason": lesson.cancel_reason,
            "replacement_for_session_id": lesson.replacement_for_session_id,
        })

    day_start, day_end = _scheduled_bounds({"start": "00:00", "end": "23:59"}, today)
    replacements = db.query(ClassSession).filter(
        ClassSession.replacement_for_session_id.isnot(None),
        ClassSession.scheduled_start >= day_start,
        ClassSession.scheduled_start <= day_end,
    )
    if current_user.role != "admin":
        replacements = replacements.filter(ClassSession.course_id.in_(my_course_ids(db, lecturer.id)))
    existing_ids = {str(item["id"]) for item in result}
    for lesson in replacements.all():
        if str(lesson.id) in existing_ids:
            continue
        course = db.query(Course).filter(Course.id == lesson.course_id).first()
        result.append({
            "id": lesson.id, "course_id": lesson.course_id,
            "course_code": course.course_code if course else "", "course_name": course.course_name if course else "",
            "class_group": lesson.class_group, "role": "Replacement", "room": lesson.room,
            "scheduled_start": iso_utc(lesson.scheduled_start), "scheduled_end": iso_utc(lesson.scheduled_end),
            "status": lesson.status, "cancel_reason": lesson.cancel_reason,
            "replacement_for_session_id": lesson.replacement_for_session_id,
        })
    result.sort(key=lambda item: item["scheduled_start"] or "")
    db.commit()
    return result


@router.get("/needs-attention")
def get_classes_needing_attention(db: Session = Depends(get_db),
                                  current_user: User = Depends(require_lecturer)):
    """Return every unresolved class the lecturer can act on, not only today's."""
    query = db.query(ClassSession).filter(ClassSession.status == "needs_attention")
    if current_user.role != "admin":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        query = query.filter(ClassSession.course_id.in_(my_course_ids(db, lecturer.id)))

    result = []
    now = utcnow()
    for lesson in query.order_by(ClassSession.scheduled_start.desc()).all():
        course = db.query(Course).filter(Course.id == lesson.course_id).first()
        meeting_id = source_meeting_id(db, lesson)
        meeting = db.query(ClassMeeting).filter(ClassMeeting.id == meeting_id).first() if meeting_id else None
        result.append({
            "id": lesson.id, "course_id": lesson.course_id,
            "course_code": course.course_code if course else "",
            "course_name": course.course_name if course else "",
            "class_group": lesson.class_group,
            "role": meeting.role if meeting else "Replacement",
            "room": lesson.room,
            "scheduled_start": iso_utc(lesson.scheduled_start),
            "scheduled_end": iso_utc(lesson.scheduled_end),
            "status": lesson.status,
            "cancel_reason": lesson.cancel_reason,
            "replacement_for_session_id": lesson.replacement_for_session_id,
            "escalated": needs_admin_escalation(lesson, now),
        })
    return result


@router.post("/{id}/open", response_model=SessionResponse)
def open_scheduled_class(id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lesson = get_or_404(db, ClassSession, id, "Class")
    require_course_access(db, current_user, lesson.course_id, "open this class")
    now = utcnow()
    if lesson.status not in ("scheduled", "needs_attention"):
        raise HTTPException(status_code=400, detail=f"A {lesson.status} class cannot be opened")
    if not lesson.scheduled_start or not lesson.scheduled_end:
        raise HTTPException(status_code=400, detail="This class has no scheduled time")
    if not class_can_open(lesson, now):
        raise HTTPException(status_code=400, detail="Class can only be opened from one hour before start until it ends")
    lesson.opened_at = now
    lesson.opened_by_user_id = current_user.id
    lesson.status = "open"
    lesson.is_open = True
    db.commit()
    db.refresh(lesson)
    return lesson


@router.post("/{id}/held", response_model=SessionResponse)
def mark_missed_class_as_held(id: str, db: Session = Depends(get_db),
                              current_user: User = Depends(require_lecturer)):
    lesson = get_or_404(db, ClassSession, id, "Class")
    require_course_access(db, current_user, lesson.course_id, "resolve this class")
    try:
        mark_class_held(lesson, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    db.refresh(lesson)
    _audit_class_action(
        db, current_user, "Confirm class held", lesson,
        "Attendance was not opened; class confirmed after review",
    )
    return lesson


@router.post("/{id}/cancel", response_model=SessionResponse)
def cancel_class(id: str, body: ClassCancellation, db: Session = Depends(get_db),
                 current_user: User = Depends(require_lecturer)):
    lesson = get_or_404(db, ClassSession, id, "Class")
    course = require_course_access(db, current_user, lesson.course_id, "cancel this class")
    if lesson.status not in ("scheduled", "needs_attention"):
        raise HTTPException(status_code=400, detail=f"A {lesson.status} class cannot be cancelled")
    lesson.status = "cancelled"
    lesson.is_open = False
    lesson.cancel_reason = body.reason
    lesson.cancelled_at = utcnow()
    lesson.cancelled_by_user_id = current_user.id
    _notify_course_people(db, lesson, "class_cancelled", f"{course.course_code} class cancelled",
                          f"The class was cancelled. Reason: {body.reason}")
    db.commit()
    db.refresh(lesson)
    _audit_class_action(db, current_user, "Cancel class", lesson, f"reason={body.reason}")
    return lesson


@router.post("/{id}/replacement", response_model=SessionResponse, status_code=201)
def arrange_replacement_class(id: str, body: ReplacementClassCreate,
                              db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    cancelled = get_or_404(db, ClassSession, id, "Cancelled class")
    course = require_course_access(db, current_user, cancelled.course_id, "arrange a replacement class")
    if cancelled.status != "cancelled":
        raise HTTPException(status_code=400, detail="A replacement can only be arranged for a cancelled class")
    existing_replacements = db.query(ClassSession).filter(
        ClassSession.replacement_for_session_id == cancelled.id
    ).all()
    if has_active_replacement(existing_replacements):
        raise HTTPException(status_code=400, detail="A replacement class has already been arranged")
    replacement = ClassSession(
        course_id=cancelled.course_id, class_group=cancelled.class_group,
        scheduled_start=body.scheduled_start, scheduled_end=body.scheduled_end,
        status="scheduled", is_open=False, opened_at=None, room=body.room,
        semester=cancelled.semester, replacement_for_session_id=cancelled.id,
    )
    db.add(replacement)
    db.flush()
    _notify_course_people(db, replacement, "replacement_class", f"{course.course_code} replacement class",
                          f"Replacement class arranged in {body.room} from {body.scheduled_start} to {body.scheduled_end}.")
    db.commit()
    db.refresh(replacement)
    _audit_class_action(db, current_user, "Arrange replacement class", replacement,
                        f"replaces={cancelled.id}; room={body.room}")
    return replacement


@router.get("/barred-list-readiness")
def get_barred_list_readiness(course_id: str | None = None, db: Session = Depends(get_db),
                              current_user: User = Depends(require_lecturer)):
    query = db.query(ClassSession).filter(ClassSession.status == "needs_attention")
    if course_id:
        require_course_access(db, current_user, course_id, "check barred-list readiness")
        query = query.filter(ClassSession.course_id == course_id)
    elif current_user.role != "admin":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        query = query.filter(ClassSession.course_id.in_(my_course_ids(db, lecturer.id)))
    return barred_list_readiness(query.all())

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
        checkin_state = session_checkin_state(session, slots, now_utc)

        if checkin_state == "ended":
            scheduled_end = session_end_utc(session, slots)
            session.is_open = False
            session.closed_at = scheduled_end
            session.status = "completed"
            db.commit()
        elif checkin_state == "before":
            raise HTTPException(
                status_code=403,
                detail="Class has not started yet. Please wait until the scheduled time to check in.",
            )
            
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
    # Legacy rows have no stored bounds, so retain their weekly timetable validator.
    if session.scheduled_start is None or session.scheduled_end is None:
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
        local_ip=body.local_ip,
        gateway_ip=body.gateway_ip,
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
    sessions = db.query(ClassSession).filter(
        ClassSession.course_id == course_id,
        ClassSession.status.in_(["open", "completed"]),
    ).order_by(ClassSession.scheduled_start.desc().nullslast()).all()
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
        record.method = f"staff_override:{current_user.id}"
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
            method=f"staff_override:{current_user.id}",
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


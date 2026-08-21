import json
import logging
import threading
from datetime import datetime, timedelta, time

from sqlalchemy.exc import IntegrityError
from utils.timeutil import local_offset, utcnow
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import (
    Enrolment, ClassSession, AttendanceRecord, Student, ClassMeeting,
    Lecturer, User, UserNotification,
)
import time as time_module
from domain.scheduler import calculate_schedule
from domain.class_lifecycle import close_class_if_due

logger = logging.getLogger(__name__)

# Throttle state is per PROCESS, so it only holds with a single worker — which is how
# this app is deployed (one uvicorn process). Under multiple workers each would keep its
# own clock and they would sync concurrently; the unique constraint on attendance still
# prevents duplicate rows, so the failure mode is wasted queries, not bad data. If the
# deployment ever scales out, move this to an advisory lock or a row in the database.
_last_sync_time = 0.0
_is_syncing = False
_force_pending = False
_state_lock = threading.Lock()
_SYNC_THROTTLE_SECONDS = 60.0 # Only sync once per minute max to prevent query storms


def sync_class_sessions(*, force: bool = False):
    """Kick off session closing and absence processing in the background.

    This used to run inline, so once a minute some unlucky request paid its ~18
    queries (~2s against a remote database) before its own response was built --
    which is what made page loads randomly slow. No caller needs the result, so
    the request no longer waits for it. Sessions are created only when a lecturer
    opens one; this worker closes those sessions and marks end-of-day absences.
    """
    global _last_sync_time, _is_syncing, _force_pending

    with _state_lock:
        if _is_syncing:
            # An admin edit must not disappear just because a routine sync was
            # already in flight with the previous timetable snapshot.
            if force:
                _force_pending = True
            return
        if not force and time_module.time() - _last_sync_time < _SYNC_THROTTLE_SECONDS:
            return # Skip to avoid query storms and database locks
        _is_syncing = True
    threading.Thread(target=_sync_worker, daemon=True).start()


def _sync_worker():
    """Run one sync on its own DB session.

    A Session is not thread-safe, so this cannot borrow the request's session --
    it opens and closes its own.
    """
    global _last_sync_time, _is_syncing, _force_pending
    db = None
    try:
        db = SessionLocal()
        _sync_class_sessions_now(db)
    except Exception as exc:
        # Nothing above this frame can catch it -- an escaped exception here would print a
        # bare thread traceback and, worse, skip the flag reset below, wedging _is_syncing
        # True so no sync ever ran again.
        logger.exception("Class session sync worker failed: %s", exc)
    finally:
        if db is not None:
            db.close()
        with _state_lock:
            _last_sync_time = time_module.time()
            _is_syncing = False
            run_again = _force_pending
            _force_pending = False
        if run_again:
            sync_class_sessions(force=True)


def _sync_class_sessions_now(db: Session):
    """Advance classes from the timetable without ever inventing attendance.

    Open classes complete at their scheduled end. A timetable class that was
    neither opened nor cancelled becomes needs_attention, which counts for
    neither attendance nor absence and blocks final barred-list publication.
    """
    try:
        now_utc = utcnow()

        # Campus offset from the named zone, NOT `datetime.now() - utcnow()`. The host
        # clock is whatever the container says: Railway sets no TZ, so that subtraction
        # yielded zero and every timetable time was treated as UTC — sessions opened and
        # auto-closed 8 hours off, and end-of-day absences fired at 07:59 local.
        tz_offset = local_offset()

        now_local = now_utc + tz_offset
        schedule_map = calculate_schedule(db)
        
        # Fetch existing dated classes once; scheduled_start is authoritative for
        # new rows, while opened_at keeps legacy rows visible during migration.
        min_date_utc = datetime.combine(now_local - timedelta(days=7), time(0, 0, 0)) - tz_offset
        sessions_list = db.query(ClassSession).filter(
            (ClassSession.scheduled_start >= min_date_utc) | (ClassSession.opened_at >= min_date_utc)
        ).all()

        sessions_by_key = {
            (str(s.meeting_id), s.scheduled_start): s
            for s in sessions_list if s.meeting_id and s.scheduled_start
        }

        new_attention = []
        for i in range(7):
            date_check = (now_local - timedelta(days=i)).date()
            day_name = date_check.strftime("%A")
            for slot in schedule_map.values():
                if slot["day"] != day_name or not slot.get("meeting_id"):
                    continue
                start_utc = datetime.combine(date_check, datetime.strptime(slot["start"], "%H:%M").time()) - tz_offset
                end_utc = datetime.combine(date_check, datetime.strptime(slot["end"], "%H:%M").time()) - tz_offset
                if now_utc < end_utc:
                    continue
                key = (str(slot["meeting_id"]), start_utc)
                session = sessions_by_key.get(key)
                if not session:
                    session = ClassSession(
                        course_id=slot["course_id"], meeting_id=slot["meeting_id"],
                        scheduled_start=start_utc, scheduled_end=end_utc,
                        status="needs_attention", is_open=False, opened_at=None,
                        class_group="All" if slot["role"] == "Lecture" else slot["class_group"],
                        room=slot["room"],
                    )
                    db.add(session)
                    sessions_list.append(session)
                    sessions_by_key[key] = session
                    new_attention.append((session, slot["meeting_id"]))
                elif session.status == "scheduled":
                    session.status = "needs_attention"
                    session.is_open = False
                    new_attention.append((session, slot["meeting_id"]))
                else:
                    close_class_if_due(session, now_utc)

        # Replacement classes do not have a weekly meeting_id, so advance the
        # materialized rows directly.
        for session in sessions_list:
            if session.replacement_for_session_id and session.scheduled_end and now_utc >= session.scheduled_end:
                if session.status == "scheduled":
                    session.status = "needs_attention"
                    new_attention.append((session, None))
                else:
                    close_class_if_due(session, now_utc)

        db.flush()
        for session, meeting_id in new_attention:
            _notify_needs_attention(db, session, meeting_id)

        # Only completed classes create absences. Cancelled, scheduled and
        # needs_attention rows are deliberately excluded.
        for session in sessions_list:
            if session.status != "completed" or not session.scheduled_end:
                continue
            class_date = (session.scheduled_end + tz_offset).date()
            absent_threshold_utc = datetime.combine(class_date, time(23, 59)) - tz_offset
            if now_utc < absent_threshold_utc:
                continue
            students = db.query(Student).join(Enrolment, Enrolment.student_id == Student.id).filter(
                Enrolment.course_id == session.course_id
            )
            if session.class_group != "All":
                students = students.filter(Enrolment.class_group == session.class_group)
            existing = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
            recorded_ids = {record.student_id for record in existing}
            for student in students.all():
                if student.id not in recorded_ids:
                    db.add(AttendanceRecord(
                        student_id=student.id, session_id=session.id, status="absent",
                        network_verified=False, marked_at=absent_threshold_utc,
                        verify_detail="System marked after completed class",
                    ))
        db.commit()
                                
    except IntegrityError:
        # Another request already wrote the row this one was about to insert — the unique
        # constraint on (student_id, session_id) doing its job. Expected under
        # concurrency, not a failure worth alarming about.
        db.rollback()
    except Exception as e:
        # Everything else is a real fault: sessions did not open, or students were not
        # marked absent. Nobody is waiting on this thread, so the traceback in the log is
        # the ONLY sign it failed -- which is why it is logged rather than swallowed.
        db.rollback()
        logger.exception("Class session sync failed: %s", e)


def source_meeting_id(db: Session, session: ClassSession):
    """Find the timetable row behind an original or replacement class."""
    current = session
    seen = set()
    while current:
        if current.meeting_id:
            return current.meeting_id
        parent_id = current.replacement_for_session_id
        if not parent_id or str(parent_id) in seen:
            return None
        seen.add(str(parent_id))
        current = db.get(ClassSession, parent_id)
    return None


def _notify_needs_attention(db: Session, session: ClassSession, meeting_id) -> None:
    user_ids = {user_id for (user_id,) in db.query(User.id).filter(User.role == "admin").all()}
    meeting_id = meeting_id or source_meeting_id(db, session)
    if meeting_id:
        meeting = db.query(ClassMeeting).filter(ClassMeeting.id == meeting_id).first()
        if meeting and meeting.lecturer_id:
            lecturer = db.query(Lecturer).filter(Lecturer.id == meeting.lecturer_id).first()
            if lecturer and lecturer.user_id:
                user_ids.add(lecturer.user_id)
    for user_id in user_ids:
        dedupe = f"class_needs_attention:{session.id}:{user_id}"
        exists = db.query(UserNotification.id).filter(
            UserNotification.user_id == user_id, UserNotification.dedupe_key == dedupe
        ).first()
        if not exists:
            db.add(UserNotification(
                user_id=user_id, kind="class_needs_attention",
                title="Class needs attention",
                body="This class ended without being opened or cancelled. Resolve it before finalising the barred list.",
                payload=json.dumps({"class_id": str(session.id), "course_id": str(session.course_id)}),
                dedupe_key=dedupe,
            ))


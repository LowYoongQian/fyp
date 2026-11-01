from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import timedelta
from utils.timeutil import iso_utc, utcnow
from typing import List

from db.database import get_db
from domain import timetable_access
from domain.class_lifecycle import class_listed
from domain.session_sync import materialize_upcoming, source_meeting_id, sync_class_sessions
from domain.scheduler import calculate_schedule, get_course_group_slots, session_window_utc
from utils.timeutil import local_offset
from db.models import User, Student, Course, Enrolment, ClassMeeting, ClassSession, AttendanceRecord, Lecturer
from utils.security import require_admin
from domain.attendance import require_session_enrolment
from domain.attendance_audit import attendance_snapshot, audit_attendance_edit
from utils.db_helpers import get_or_404
from schemas import (
    AdminAttendanceUpdateResponse, AdminAttendanceUpdate
)

router = APIRouter(prefix="/admin", tags=["Admin Attendance"])

# =====================================================================
# ATTENDANCE MONITORING & OVERRIDES
# =====================================================================

def _scoped_course(db: Session, user: User, programme_id: UUID, course_id: UUID) -> Course:
    """The course the admin chose, after checking it belongs to the chosen programme (404 otherwise): no read or edit here is ever unscoped."""
    return timetable_access.scope_course(db, user, programme_id, course_id)


def _session_of(db: Session, course: Course, session_id: str) -> ClassSession:
    """A session of THIS course only, so a stale selection from another course can never be read or edited through the current scope."""
    session = get_or_404(db, ClassSession, session_id, "Session")
    if str(session.course_id) != str(course.id):
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions", response_model=List[dict])
def get_sessions(programme_id: UUID = Query(...), course_id: UUID = Query(...), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """The chosen course's class sessions. Programme and course are both required and checked; there is no all-courses read."""
    course = _scoped_course(db, current_user, programme_id, course_id)
    # Persisting auto-open/close is owned by sync_class_sessions (throttled).
    # This handler then only READS and derives display status in-memory.
    sync_class_sessions()
    # The background sync runs after this answer, so this course's classes due within the hour are added here and now.
    if materialize_upcoming(db, utcnow(), local_offset(), calculate_schedule(db), course_id=course.id):
        db.commit()

    sessions = db.query(ClassSession).options(
        joinedload(ClassSession.course)
    ).filter(ClassSession.course_id == course.id).order_by(func.coalesce(ClassSession.scheduled_start, ClassSession.opened_at).desc(), ClassSession.id).all()

    # One clock for the whole response. Reading it per session let rows in the same
    # list be judged against different instants, so a list crossing a slot boundary
    # could contradict itself.
    now_utc = utcnow()
    result = []
    teachers = {}

    def teaching(s):
        """Who taught this class, and in which role: its own meeting's assignment, never whoever holds the course. A class someone
        actually opened keeps its opener, so a later reassignment does not rewrite history. Nobody assigned reads as Unassigned."""
        meeting_id = source_meeting_id(db, s)
        meeting = db.get(ClassMeeting, meeting_id) if meeting_id else None
        teacher = None
        if s.opened_by_user_id:
            key = ("user", s.opened_by_user_id)
            if key not in teachers:
                teachers[key] = db.query(Lecturer).filter(Lecturer.user_id == s.opened_by_user_id).first()
            teacher = teachers[key]
        if not teacher and meeting and meeting.lecturer_id:
            teacher = db.get(Lecturer, meeting.lecturer_id)
        return teacher, meeting.role if meeting else None

    for s in sessions:
        if not class_listed(s, now_utc):
            continue   # an upcoming class shows from one hour before it starts; showing it never opens check-in
        course = s.course
        teacher, class_role = teaching(s)

        is_open = s.is_open
        closed_at = s.closed_at

        if is_open:
            slots = get_course_group_slots(db, s.course_id, s.class_group)
            sched_start, sched_end = session_window_utc(s, slots)
            # An unscheduled session has no start time, so "not started yet" falls back
            # to a 10 minute grace window after it was opened.
            not_started_before = sched_start or (s.opened_at + timedelta(minutes=10))

            if now_utc > sched_end:
                is_open = False
                status_str = "Closed"
            elif now_utc < not_started_before:
                status_str = "Active"
            else:
                status_str = "On Going"
        else:
            status_str = {"scheduled": "Scheduled", "needs_attention": "Needs Review", "cancelled": "Cancelled"}.get(s.status, "Closed")
            
        result.append({
            "id": s.id,
            "course_id": s.course_id,
            "course_code": course.course_code if course else "Unknown",
            "course_name": course.course_name if course else "Unknown",
            "lecturer_name": teacher.name if teacher else "Unassigned",
            "lecturer_role": class_role,
            "class_group": s.class_group,
            "scheduled_start": iso_utc(s.scheduled_start),
            "scheduled_end": iso_utc(s.scheduled_end),
            "opened_at": iso_utc(s.opened_at),
            "closed_at": iso_utc(closed_at),
            "class_status": s.status,
            "is_open": is_open,
            "status": status_str
        })

    return result

@router.get("/sessions/{session_id}/scope")
def get_session_scope(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Which programme and course a class belongs to, so a notice can restore the admin's choice before opening it."""
    session = get_or_404(db, ClassSession, session_id, "Session")
    course = get_or_404(db, Course, session.course_id, detail="Course associated with session not found")
    if not course.programme_id:
        raise HTTPException(status_code=404, detail="This class has no programme.")
    return {"programme_id": str(course.programme_id), "course_id": str(course.id), "course_code": course.course_code, "course_name": course.course_name}

@router.get("/sessions/{session_id}/attendance", response_model=dict)
def get_admin_session_attendance(session_id: str, programme_id: UUID = Query(...), course_id: UUID = Query(...), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = _scoped_course(db, current_user, programme_id, course_id)
    session = _session_of(db, course, session_id)

    # Fetch all students enrolled in this course group
    query = db.query(Student).join(Enrolment).filter(Enrolment.course_id == session.course_id)
    if session.class_group != "All":
        query = query.filter(Enrolment.class_group == session.class_group)
    enrolled_students = query.all()

    # Fetch attendance records for this session
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == str(session_id)).all()
    record_map = {r.student_id: r for r in records}
    # A later allocation/group change must not hide the student's saved history
    # for this exact dated class; current group members still appear unrecorded.
    current_ids = {student.id for student in enrolled_students}
    historical_ids = set(record_map) - current_ids
    if historical_ids:
        enrolled_students.extend(db.query(Student).filter(Student.id.in_(historical_ids)).all())

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
                "marked_at": iso_utc(rec.marked_at),
                "method": rec.method,
                "confidence_score": rec.confidence_score,
                # Outward names kept for the clients: the column is network_verified,
                # and liveness_passed is NULL on rows where no check was attempted
                # (system-marked absences) while the web table types it as a boolean.
                "wifi_verified": bool(rec.network_verified),
                "liveness_passed": bool(rec.liveness_passed),
                "network_verified": getattr(rec, 'network_verified', False),
                "source_ip": getattr(rec, 'source_ip', None),
                "verify_detail": getattr(rec, 'verify_detail', None)
            })
        else:
            attendance_list.append({
                "student_id": s.id,
                "student_name": s.name,
                "student_code": s.student_code,
                "status": "unmarked",
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
        "class_status": session.status,
        "scheduled_start": iso_utc(session.scheduled_start),
        "scheduled_end": iso_utc(session.scheduled_end),
        "opened_at": iso_utc(session.opened_at),
        "closed_at": iso_utc(session.closed_at),
        "attendance_list": attendance_list
    }

@router.put("/attendance/{session_id}/{student_id}", response_model=AdminAttendanceUpdateResponse)
def update_admin_attendance(
    session_id: str,
    student_id: str,
    body: AdminAttendanceUpdate,
    programme_id: UUID = Query(...),
    course_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if body.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'present' or 'absent'.")

    session = _session_of(db, _scoped_course(db, current_user, programme_id, course_id), session_id)
    get_or_404(db, Student, student_id, "Student")
    # Same rule the lecturer override enforces. Being an admin is authority over WHOSE
    # register you may edit, not licence to invent a record for a student who never
    # took the course — that record would still land in attendance rates and the risk model.
    require_session_enrolment(db, session, student_id)

    # Serialise edits, including the first attendance row, so before/after timestamps
    # reflect each committed change rather than two admins racing the same student.
    student = db.query(Student).filter(Student.id == student_id).with_for_update().one()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.student_id == student_id
    ).first()

    before = attendance_snapshot(record)
    recorded_at = utcnow()
    if record:
        record.status = body.status
        record.method = f"admin_override:{current_user.id}"
        record.network_verified = body.wifi_verified
        record.liveness_passed = body.liveness_passed
        record.marked_at = recorded_at
    else:
        record = AttendanceRecord(
            session_id=str(session_id),
            student_id=str(student_id),
            status=body.status,
            method=f"admin_override:{current_user.id}",
            confidence_score=1.0,
            network_verified=body.wifi_verified,
            liveness_passed=body.liveness_passed,
            marked_at=recorded_at
        )
        db.add(record)

    audit_attendance_edit(db, current_user, session, student, before, record)
    db.commit()
    return {"message": "Attendance record updated successfully", "marked_at": iso_utc(recorded_at), "method": record.method}

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from utils.timeutil import utcnow
from db.models import (
    User, Student, FaceEmbedding, Enrolment, Course,
    ClassSession, AttendanceRecord, CourseStaffAssignment,
)
from utils.security import require_student
from utils.db_helpers import require_own_profile
from domain.attendance import session_hours, attendance_rate_percent
from integrations.face import (
    _extract_face_embedding, _embedding_to_floats,
    _cosine_distance, _FACE_MATCH_THRESHOLD,
)
from domain.scheduler import calculate_schedule, get_course_group_slots, meeting_key_for, session_end_utc
from domain.session_sync import sync_class_sessions

router = APIRouter(prefix="/students", tags=["Students"])


class FaceRegisterSubmit(BaseModel):
    image_base64: str


@router.post("/me/face", status_code=200)
def register_face(body: FaceRegisterSubmit, db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    # Get student profile
    student = require_own_profile(db, Student, current_user.id, "Student")

    # Validate image payload is not empty
    if not body.image_base64.strip():
        raise HTTPException(status_code=400, detail="Invalid face image payload")

    # Extract the ArcFace identity embedding. enforce_detection=True: a face must
    # be present, so we never store a garbage vector as this student's identity.
    embedding_bytes = _extract_face_embedding(body.image_base64, enforce_detection=True)

    # Check if embedding already exists
    existing_embedding = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student.id).first()

    if existing_embedding:
        existing_embedding.embedding = embedding_bytes
        existing_embedding.is_active = True
    else:
        new_embedding = FaceEmbedding(
            student_id=student.id,
            embedding=embedding_bytes,
            is_active=True
        )
        db.add(new_embedding)

    # Update student profile registered flag
    student.is_face_registered = True
    
    db.commit()
    
    return {
        "status": "success",
        "message": "Face registration completed. Biometric signature stored."
    }


@router.get("/me/courses")
def get_my_courses(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Courses this student is enrolled in, with timetable info for the app."""
    sync_class_sessions(db)
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = (
        db.query(Course, Enrolment.class_group)
        .join(Enrolment, Enrolment.course_id == Course.id)
        .filter(Enrolment.student_id == student.id)
        .all()
    )
    
    # Calculate deterministic clash-free schedules
    schedule_map = calculate_schedule(db)

    # Everything the loop needs, fetched once per query instead of once per course.
    course_ids = [c.id for c, _ in rows]
    assignments_by_course = {}
    for a in db.query(CourseStaffAssignment).filter(
        CourseStaffAssignment.course_id.in_(course_ids)
    ).all():
        assignments_by_course.setdefault(a.course_id, []).append(a)

    # Attendance rate: closed-only, present+leave, HOURS-weighted — the one policy in
    # domain/attendance.py, shared with /students/me/enrolments and the risk model. This
    # endpoint once counted present-only over a flat session count and treated "open but
    # past today" as held, so the app and the web dashboard disagreed for one student.
    sessions_by_course = {}
    for sid, cid, sgroup, opened, closed_at in db.query(
        ClassSession.id, ClassSession.course_id, ClassSession.class_group,
        ClassSession.opened_at, ClassSession.closed_at
    ).filter(
        ClassSession.course_id.in_(course_ids),
        ClassSession.is_open == False,  # noqa: E712
    ).order_by(ClassSession.opened_at.asc().nullslast(), ClassSession.id.asc()).all():
        sessions_by_course.setdefault(cid, []).append(
            (sid, sgroup, session_hours(opened, closed_at)))

    attended = {
        (student.id, sid) for (sid,) in db.query(AttendanceRecord.session_id).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.status.in_(["present", "leave"]),
        ).all()
    }

    result = []
    for c, group in rows:
        assignments = assignments_by_course.get(c.id, [])
        course_sessions = sessions_by_course.get(c.id, [])
        attendance_rate = attendance_rate_percent(
            course_sessions, attended, student.id, group)

        # 1. Primary Lecture Slot
        # "id" is the meeting_key ("Lecture-<uuid>") — the same key that indexes
        # schedule_map. It is stable and unique per timetable row. Do NOT derive
        # it arithmetically from c.id: those are UUID strings, so c.id * 10 + 1
        # raises TypeError and c.id * 10 silently returns 360 junk characters.
        lect_slot = schedule_map.get(f"Lecture-{c.id}")
        if lect_slot:
            lecturer_assign = next((a for a in assignments if a.role == 'Lecturer'), None)
            lecturer_name = lecturer_assign.lecturer.name if (lecturer_assign and lecturer_assign.lecturer) else (c.lecturer.name if c.lecturer else "TBA")

            result.append({
                "id": f"Lecture-{c.id}",
                "course_id": c.id,
                "course_code": c.course_code,
                "course_name": c.course_name,
                "class_group": group,
                "schedule_day": lect_slot["day"],
                "schedule_start": lect_slot["start"],
                "schedule_end": lect_slot["end"],
                "schedule_room": lect_slot["room"],
                "lecturer_name": lecturer_name,
                "role": "Lecture",
                "attendance_rate": attendance_rate,
            })
        
        # 2. Tutor Slot (if assigned) — this student's group only.
        tutor_assign = next((a for a in assignments if a.role == 'Tutor'), None)
        if tutor_assign:
            tutor_slot = schedule_map.get(
                meeting_key_for("Tutor", c.id, tutor_assign.id, group))
            if tutor_slot:
                tutor_name = tutor_assign.lecturer.name if tutor_assign.lecturer else "TBA"
                result.append({
                    "id": meeting_key_for("Tutor", c.id, tutor_assign.id, group),
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "class_group": group,
                    "schedule_day": tutor_slot["day"],
                    "schedule_start": tutor_slot["start"],
                    "schedule_end": tutor_slot["end"],
                    "schedule_room": tutor_slot["room"],
                    "lecturer_name": tutor_name,
                    "role": "Tutor",
                    "attendance_rate": attendance_rate,
                })
            
        # 3. Practical Slot (if assigned)
        practical_assign = next((a for a in assignments if a.role == 'Practical'), None)
        if practical_assign:
            prac_slot = schedule_map.get(
                meeting_key_for("Practical", c.id, practical_assign.id, group))
            if prac_slot:
                practical_name = practical_assign.lecturer.name if practical_assign.lecturer else "TBA"
                result.append({
                    "id": meeting_key_for("Practical", c.id, practical_assign.id, group),
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "class_group": group,
                    "schedule_day": prac_slot["day"],
                    "schedule_start": prac_slot["start"],
                    "schedule_end": prac_slot["end"],
                    "schedule_room": prac_slot["room"],
                    "lecturer_name": practical_name,
                    "role": "Practical",
                    "attendance_rate": attendance_rate,
                })
    return result


@router.get("/me/active-sessions")
def get_my_active_sessions(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Open sessions matching this student's enrolments (course + group)."""
    sync_class_sessions(db)
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = (
        db.query(ClassSession, Course, Enrolment.class_group)
        .join(Enrolment, Enrolment.course_id == ClassSession.course_id)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(
            Enrolment.student_id == student.id,
            ClassSession.is_open == True,
            (ClassSession.class_group == "All") | (ClassSession.class_group == Enrolment.class_group),
        )
        .all()
    )

    # Read-only: exclude sessions already past their scheduled end in-memory.
    # Persisting the close is owned by sync_class_sessions (called above) and the
    # check-in guard, so this GET stays idempotent (see J in the review doc).
    now_utc = utcnow()
    rows = [
        (s, c, cg) for s, c, cg in rows
        if now_utc <= session_end_utc(s, get_course_group_slots(db, s.course_id, s.class_group))
    ]

    # Which of these sessions the student has already checked into.
    session_ids = [s.id for s, _, _ in rows]
    checked_in = set()
    if session_ids:
        recs = (
            db.query(AttendanceRecord.session_id)
            .filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
            )
            .all()
        )
        checked_in = {r[0] for r in recs}

    return [
        {
            "id": s.id,
            "course_id": s.course_id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "class_group": s.class_group,
            "is_open": s.is_open,
            "already_checked_in": s.id in checked_in,
        }
        for s, c, _ in rows
    ]


@router.get("/me/attendance")
def get_my_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """This student's full attendance history, most recent first."""
    sync_class_sessions(db)
    student = require_own_profile(db, Student, current_user.id, "Student")
    rows = (
        db.query(AttendanceRecord, ClassSession, Course)
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(AttendanceRecord.student_id == student.id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )
    return [
        {
            "course_code": c.course_code,
            "course_name": c.course_name,
            "class_group": s.class_group,
            "status": ar.status,
            "marked_at": ar.marked_at.isoformat() if ar.marked_at else None,
            "network_verified": ar.network_verified,
            "liveness_passed": ar.liveness_passed,
            "verify_detail": ar.verify_detail,
        }
        for ar, s, c in rows
    ]

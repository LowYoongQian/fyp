import base64
import struct
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from utils.database import get_db
from utils.timeutil import utcnow
from utils.models import (
    User, Student, FaceEmbedding, Enrolment, Course,
    ClassSession, AttendanceRecord, CourseStaffAssignment,
)
from utils.security import require_student
from utils.db_helpers import require_own_profile
import math
from datetime import datetime, timedelta
from utils.scheduler import calculate_schedule
from utils.session_sync import sync_class_sessions

router = APIRouter(prefix="/students", tags=["Students"])

# Try to import deepface; fall back gracefully so the app runs without it.
try:
    from deepface import DeepFace  # type: ignore
    _DEEPFACE_AVAILABLE = True
except ImportError:
    _DEEPFACE_AVAILABLE = False

class FaceRegisterSubmit(BaseModel):
    image_base64: str


def _extract_face_embedding(image_base64: str, enforce_detection: bool = True) -> bytes:
    """Extract a 512-d ArcFace embedding from a base64-encoded JPEG/PNG.

    Uses DeepFace with the ArcFace model (report §2.2.2). The returned bytes are
    512 little-endian C floats (2048 bytes total), matching the
    FaceEmbedding.embedding column schema.

    enforce_detection=True (registration): reject images with no detectable face,
    so a garbage vector can never be stored as someone's identity. check-in
    passes False for tolerance — a wrong face is caught by the cosine threshold.
    """
    if not _DEEPFACE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Face recognition is unavailable: the ArcFace model (deepface) is not installed."
        )
    try:
        img_bytes = base64.b64decode(image_base64)
        img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("could not decode image bytes")
        result = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            enforce_detection=enforce_detection,
        )
        embedding = result[0]["embedding"]  # list of 512 floats
        return struct.pack("f" * len(embedding), *embedding)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Face embedding extraction failed: {e}. Ensure a clear face is visible in the image."
        )


def _embedding_to_floats(b: bytes) -> list[float]:
    n = len(b) // 4
    return list(struct.unpack("f" * n, b))


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """Return cosine distance in [0, 2]; 0 = identical, 2 = opposite."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 1.0
    return 1.0 - dot / (na * nb)


# Threshold below which two embeddings are considered the same person.
# ArcFace cosine distance: < 0.40 is a common match threshold.
_FACE_MATCH_THRESHOLD = 0.40


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


def _require_student_profile(db: Session, current_user: User) -> Student:
    student = require_own_profile(db, Student, current_user.id, "Student")
    return student


@router.get("/me/courses")
def get_my_courses(db: Session = Depends(get_db), current_user: User = Depends(require_student)):
    """Courses this student is enrolled in, with timetable info for the app."""
    sync_class_sessions(db)
    student = _require_student_profile(db, current_user)
    rows = (
        db.query(Course, Enrolment.class_group)
        .join(Enrolment, Enrolment.course_id == Course.id)
        .filter(Enrolment.student_id == student.id)
        .all()
    )
    
    # Calculate deterministic clash-free schedules
    schedule_map = calculate_schedule(db)
    
    result = []
    for c, group in rows:
        assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == c.id).all()
        
        # Calculate attendance rate based on completed sessions
        sessions = db.query(ClassSession).filter(
            ClassSession.course_id == c.id,
            (ClassSession.class_group == "All") | (ClassSession.class_group == group)
        ).all()
        
        now = utcnow()
        completed_sessions = []
        for s in sessions:
            opened_at_day_end = datetime(s.opened_at.year, s.opened_at.month, s.opened_at.day, 23, 59, 59)
            if (not s.is_open) or (now > opened_at_day_end):
                completed_sessions.append(s)
                
        if completed_sessions:
            session_ids = [s.id for s in completed_sessions]
            present_count = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.status == "present"
            ).count()
            attendance_rate = round((present_count / len(completed_sessions)) * 100.0, 1)
        else:
            attendance_rate = 100.0

        # 1. Primary Lecture Slot
        lect_slot = schedule_map.get(f"Lecture-{c.id}")
        if lect_slot:
            lecturer_assign = next((a for a in assignments if a.role == 'Lecturer'), None)
            lecturer_name = lecturer_assign.lecturer.name if (lecturer_assign and lecturer_assign.lecturer) else (c.lecturer.name if c.lecturer else "TBA")
            
            result.append({
                "id": c.id * 10,
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
        
        # 2. Tutor Slot (if assigned)
        tutor_assign = next((a for a in assignments if a.role == 'Tutor'), None)
        if tutor_assign:
            tutor_slot = schedule_map.get(f"Tutor-{tutor_assign.id}")
            if tutor_slot:
                tutor_name = tutor_assign.lecturer.name if tutor_assign.lecturer else "TBA"
                result.append({
                    "id": c.id * 10 + 1,
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
            prac_slot = schedule_map.get(f"Practical-{practical_assign.id}")
            if prac_slot:
                practical_name = practical_assign.lecturer.name if practical_assign.lecturer else "TBA"
                result.append({
                    "id": c.id * 10 + 2,
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
    student = _require_student_profile(db, current_user)
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
    schedule_map = calculate_schedule(db)
    now_utc = utcnow()

    # Calculate local timezone offset dynamically
    local_now = datetime.now()
    utc_now = utcnow()
    tz_offset = local_now - utc_now

    valid_rows = []
    for s, c, cg in rows:
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
                valid_rows.append((s, c, cg))
        else:
            default_end_dt = s.opened_at + timedelta(hours=2)
            if now_utc <= default_end_dt:
                valid_rows.append((s, c, cg))

    rows = valid_rows

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
    student = _require_student_profile(db, current_user)
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

"""
Analytics router — computes and serves attendance risk scores.

Risk is calculated per (student, course) pair:
  - attendance_rate  = sessions_attended / sessions_held (for the student's group)
  - risk_score       = 1.0 - attendance_rate  (0 = perfect, 1 = never attended)
  - risk_label       = "low" | "medium" | "high"

Thresholds (configurable via constants below):
  >= 0.20 → "low"   (attended ≥ 80 % of classes)
  >= 0.40 → "medium" (attended ≥ 60 %)
  >  0.40 → "high"  (attended < 60 %)

The POST /analytics/recompute endpoint refreshes all RiskScore rows. It can
be called by any lecturer or admin — typically after closing a session.

GET /analytics/risk-scores returns the latest snapshot, optionally filtered by
course or student.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime

from utils.database import get_db
from utils.models import (
    Student, Course, Enrolment, ClassSession,
    AttendanceRecord, RiskScore, User, Lecturer, CourseStaffAssignment,
)
from utils.security import require_lecturer

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_LOW_THRESHOLD    = 0.20   # risk_score < this → "low"
_MEDIUM_THRESHOLD = 0.40   # risk_score < this → "medium", else → "high"


def _risk_label(score: float) -> str:
    if score < _LOW_THRESHOLD:
        return "low"
    if score < _MEDIUM_THRESHOLD:
        return "medium"
    return "high"


@router.post("/recompute", status_code=200)
def recompute_risk_scores(
    db: Session = Depends(get_db),
    _: object = Depends(require_lecturer),
):
    """Recompute risk scores for all enrolled (student, course) pairs."""
    enrolments = db.query(Enrolment).all()
    if not enrolments:
        return {"recomputed": 0}

    all_course_ids  = list({e.course_id  for e in enrolments})
    all_student_ids = list({e.student_id for e in enrolments})

    # Batch: total closed sessions per (course_id, class_group)
    session_counts_raw = (
        db.query(ClassSession.course_id, ClassSession.class_group, func.count(ClassSession.id))
        .filter(ClassSession.is_open == False, ClassSession.course_id.in_(all_course_ids))
        .group_by(ClassSession.course_id, ClassSession.class_group)
        .all()
    )
    # sessions_map[(course_id, group)] = count
    sessions_map: dict = {}
    for course_id, group, cnt in session_counts_raw:
        sessions_map[(course_id, group)] = cnt

    # Batch: attended records per (student_id, course_id)
    attended_raw = (
        db.query(AttendanceRecord.student_id, ClassSession.course_id, func.count(AttendanceRecord.id))
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .filter(
            AttendanceRecord.status == "present",
            AttendanceRecord.student_id.in_(all_student_ids),
            ClassSession.course_id.in_(all_course_ids),
        )
        .group_by(AttendanceRecord.student_id, ClassSession.course_id)
        .all()
    )
    attended_map: dict = {(sid, cid): cnt for sid, cid, cnt in attended_raw}

    # Batch: existing RiskScore rows keyed by (student_id, course_id)
    existing_scores = {
        (rs.student_id, rs.course_id): rs
        for rs in db.query(RiskScore)
        .filter(RiskScore.student_id.in_(all_student_ids), RiskScore.course_id.in_(all_course_ids))
        .all()
    }

    updated = 0
    now = datetime.utcnow()

    for enr in enrolments:
        # Sum sessions: "All" group sessions + group-specific sessions for this enrolment
        total_sessions = sessions_map.get((enr.course_id, "All"), 0)
        if enr.class_group and enr.class_group != "All":
            total_sessions += sessions_map.get((enr.course_id, enr.class_group), 0)

        if total_sessions == 0:
            continue

        attended   = attended_map.get((enr.student_id, enr.course_id), 0)
        rate       = attended / total_sessions
        score      = round(1.0 - rate, 4)
        label      = _risk_label(score)
        key        = (enr.student_id, enr.course_id)

        existing = existing_scores.get(key)
        if existing:
            existing.risk_score      = score
            existing.risk_label      = label
            existing.attendance_rate = round(rate, 4)
            existing.updated_at      = now
        else:
            new_rs = RiskScore(
                student_id=enr.student_id,
                course_id=enr.course_id,
                risk_score=score,
                risk_label=label,
                attendance_rate=round(rate, 4),
            )
            db.add(new_rs)
            existing_scores[key] = new_rs
        updated += 1

    db.commit()
    return {"recomputed": updated}


@router.get("/risk-scores")
def get_risk_scores(
    course_id: int | None = None,
    student_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Return latest risk scores, optionally filtered."""
    allowed_course_ids = None
    if current_user.role == "lecturer":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Lecturer profile not found")
        assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
        assigned_course_ids = [a.course_id for a in assigned_assignments]
        courses = db.query(Course).filter(
            (Course.lecturer_id == lecturer.id) | (Course.id.in_(assigned_course_ids))
        ).all()
        allowed_course_ids = [c.id for c in courses]

    q = (
        db.query(RiskScore, Student, Course)
        .join(Student, Student.id == RiskScore.student_id)
        .join(Course, Course.id == RiskScore.course_id)
    )
    
    if allowed_course_ids is not None:
        q = q.filter(RiskScore.course_id.in_(allowed_course_ids))
        
    if course_id:
        if allowed_course_ids is not None and course_id not in allowed_course_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view risk scores for this course")
        q = q.filter(RiskScore.course_id == course_id)
    if student_id:
        q = q.filter(RiskScore.student_id == student_id)

    rows = q.order_by(RiskScore.risk_score.desc()).all()
    return [
        {
            "student_id":      rs.student_id,
            "student_name":    s.name,
            "student_code":    s.student_code,
            "course_id":       rs.course_id,
            "course_code":     c.course_code,
            "course_name":     c.course_name,
            "attendance_rate": rs.attendance_rate,
            "risk_score":      rs.risk_score,
            "risk_label":      rs.risk_label,
            "updated_at":      rs.updated_at.isoformat() if rs.updated_at else None,
        }
        for rs, s, c in rows
    ]

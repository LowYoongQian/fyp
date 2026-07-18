"""
Analytics router — computes and serves attendance risk scores.

Risk is predicted per (student, course) pair by a trained Random Forest model
(ml/risk_model.pkl). For each enrolment we build the student's attendance
sequence in chronological order and derive 3 features:
  - attendance_rate    : fraction of sessions attended
  - consecutive_absent : longest run of absences in a row
  - trend              : 2nd-half rate minus 1st-half rate (negative = declining)

Attendance is credited by HOURS (a 2h lecture missed hurts more than a 1h
tutorial), matching the rule attended_hours / total_hours >= 80%.

Each (student, course) goes through a funnel of symmetric certainty gates with
ML in the middle:
  Layer 0  — cold start: < 30% of the semester elapsed => "observing", no verdict
  Layer 1  — certainty (bad): if even attending every remaining hour cannot reach
             80% (needs course.planned_total_hours), the bar is unavoidable => HIGH
  Layer 1b — certainty (good): if the student has already secured >=80% of total
             hours, the bar is impossible even skipping all remaining => LOW
  Layer 2  — ML: otherwise the classifier predicts the probability of ending
             barred, from attendance_rate + consecutive_absent + trend.

risk_label is derived from risk_score:
  < 0.35 → "low" | < 0.60 → "medium" | else → "high"
risk_factors carries a human-readable explanation for the dashboard.

POST /analytics/recompute refreshes all RiskScore rows (lecturer/admin).
GET  /analytics/risk-scores returns the latest snapshot, optionally filtered.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime
from utils.timeutil import utcnow

from utils.database import get_db
from utils.models import (
    Student, Course, Enrolment, ClassSession,
    AttendanceRecord, RiskScore, User, Lecturer, CourseStaffAssignment,
)
from utils.security import require_lecturer
from utils.attendance import session_hours, build_attendance_sequence

# --- At-risk decision policy ----------------------------------------------
BAR_THRESHOLD = 0.80     # university rule: < 80% attendance => barred
COLD_START_FRACTION = 0.30   # need >=30% of the semester elapsed to predict

# --- ML risk model loading -------------------------------------------------
# The trained Random Forest is loaded once at import. If the .pkl is missing
# (e.g. model never trained), we fall back to the legacy formula so the
# endpoint still works — no crash, no frontend change.
import os
_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "risk_model.pkl")
try:
    import joblib
    from ml.features import compute_features, features_to_row
    _RISK_MODEL = joblib.load(_MODEL_PATH)
except Exception as _e:  # missing model or deps -> formula fallback
    _RISK_MODEL = None
    print(f"[analytics] ML risk model not loaded ({_e}); using formula fallback.")

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_LOW_THRESHOLD    = 0.35   # risk_score < this → "low"
_MEDIUM_THRESHOLD = 0.60   # risk_score < this → "medium", else → "high"


def _risk_label(score: float) -> str:
    if score < _LOW_THRESHOLD:
        return "low"
    if score < _MEDIUM_THRESHOLD:
        return "medium"
    return "high"


def _ml_probability(feats: dict) -> float:
    """Probability of ending barred, from the trained classifier. Falls back to
    the formula (1 - rate) if no model is loaded. Takes pre-computed features so
    the caller (_assess) doesn't pay for compute_features twice."""
    if _RISK_MODEL is not None:
        import pandas as pd
        from ml.features import FEATURE_ORDER
        row_df = pd.DataFrame([features_to_row(feats)], columns=FEATURE_ORDER)
        return round(float(_RISK_MODEL.predict_proba(row_df)[0][1]), 4)
    return round(1.0 - feats["attendance_rate"], 4)


def _reasons(feats: dict, rate: float, label: str) -> str:
    """Human-readable risk factors for the dashboard. Guarantees a flagged
    student (medium/high) always carries at least one explanatory factor, so the
    verdict never looks self-contradictory (e.g. '89% ok' but HIGH)."""
    parts = []
    # The attendance % already has its own column, so the reason states the
    # concern, not the number.
    if rate < BAR_THRESHOLD:
        parts.append("Below 80% requirement")
    if feats["consecutive_absent"] >= 3:
        parts.append(f"Missed {feats['consecutive_absent']} classes in a row")
    if feats["trend"] <= -0.10:
        parts.append("Attendance dropping in recent weeks")

    if label == "low":
        # Reassure: a low-risk student needs no alarming factors.
        return "; ".join(parts) if parts else "Consistent attendance"
    if not parts:
        # ML flagged risk but no single hard factor fired — be honest about why.
        parts.append("At-risk attendance pattern")
    return "; ".join(parts)


def _assess(sequence: list[int], hours: list[float],
            held_hours: float, total_hours: float | None) -> dict:
    """Run the 3-layer funnel. Returns dict(score, label, rate, factors)."""
    feats = compute_features(sequence, hours)
    rate = feats["attendance_rate"]

    # Layer 0 — cold start: too early in the semester to predict.
    if total_hours and total_hours > 0 and held_hours < COLD_START_FRACTION * total_hours:
        return {"score": 0.0, "label": "observing",
                "rate": rate, "factors": "Too early to assess"}

    # Layers 1 & 1b are two symmetric certainty gates: once the outcome is
    # arithmetically fixed, there is nothing left to *predict*, so ML steps aside.
    if total_hours and total_hours > 0:
        import math
        attended_hours = rate * held_hours
        remaining_hours = max(0.0, total_hours - held_hours)

        # Layer 1 — cannot reach 80% even by attending every remaining hour.
        best_case = (attended_hours + remaining_hours) / total_hours
        if best_case < BAR_THRESHOLD:
            # Floor, not round: 79.9% must not display as "80%" (self-contradictory).
            return {"score": 1.0, "label": "high", "rate": rate,
                    "factors": f"Cannot reach 80% (best case {math.floor(best_case*100)}%)"}

        # Layer 1b — already secured 80% of total hours; cannot drop below it
        # even by skipping every remaining class. Guaranteed safe.
        worst_case = attended_hours / total_hours
        if worst_case >= BAR_THRESHOLD:
            return {"score": 0.0, "label": "low", "rate": rate,
                    "factors": "Requirement already secured"}

    # Layer 2 — ML: still recoverable, let the classifier decide.
    score = _ml_probability(feats)
    label = _risk_label(score)
    return {"score": score, "label": label,
            "rate": rate, "factors": _reasons(feats, rate, label)}


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

    # Planned total contact hours per course (denominator of the 80% rule).
    total_hours_by_course = {
        cid: tot for cid, tot in
        db.query(Course.id, Course.planned_total_hours)
        .filter(Course.id.in_(all_course_ids)).all()
    }

    # Batch: all closed sessions per course, ordered by time (oldest first).
    # Each entry carries its contact hours = (closed_at - opened_at), default 2h.
    closed_sessions = (
        db.query(ClassSession.id, ClassSession.course_id, ClassSession.class_group,
                 ClassSession.opened_at, ClassSession.closed_at)
        .filter(ClassSession.is_open == False, ClassSession.course_id.in_(all_course_ids))
        .order_by(ClassSession.course_id, ClassSession.opened_at.asc().nullslast(), ClassSession.id.asc())
        .all()
    )
    sessions_by_course: dict = {}
    for sid, cid, group, opened, closed in closed_sessions:
        hrs = session_hours(opened, closed)
        sessions_by_course.setdefault(cid, []).append((sid, group, hrs))

    # Batch: set of (student_id, session_id) counted as attended.
    # Policy: "present" (face check-in) AND "leave" (approved medical leave)
    # both count as attended. Only "absent" counts against the student.
    present_raw = (
        db.query(AttendanceRecord.student_id, AttendanceRecord.session_id)
        .filter(
            AttendanceRecord.status.in_(["present", "leave"]),
            AttendanceRecord.student_id.in_(all_student_ids),
        )
        .all()
    )
    present_set = {(sid, sess_id) for sid, sess_id in present_raw}

    # Batch: existing RiskScore rows keyed by (student_id, course_id)
    existing_scores = {
        (rs.student_id, rs.course_id): rs
        for rs in db.query(RiskScore)
        .filter(RiskScore.student_id.in_(all_student_ids), RiskScore.course_id.in_(all_course_ids))
        .all()
    }

    updated = 0
    now = utcnow()

    for enr in enrolments:
        # Build this enrolment's attendance sequence + hours in chronological
        # order. A session counts if it's "All" group or the student's group.
        course_sessions = sessions_by_course.get(enr.course_id, [])
        sequence, hours = build_attendance_sequence(
            course_sessions, present_set, enr.student_id, enr.class_group)

        if not sequence:
            continue

        held_hours  = sum(hours)
        total_hours = total_hours_by_course.get(enr.course_id)
        result = _assess(sequence, hours, held_hours, total_hours)
        key    = (enr.student_id, enr.course_id)

        existing = existing_scores.get(key)
        if existing:
            existing.risk_score      = result["score"]
            existing.risk_label      = result["label"]
            existing.attendance_rate = round(result["rate"], 4)
            existing.risk_factors    = result["factors"]
            existing.updated_at      = now
        else:
            new_rs = RiskScore(
                student_id=enr.student_id,
                course_id=enr.course_id,
                risk_score=result["score"],
                risk_label=result["label"],
                attendance_rate=round(result["rate"], 4),
                risk_factors=result["factors"],
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
            "risk_factors":    rs.risk_factors,
            "updated_at":      rs.updated_at.isoformat() if rs.updated_at else None,
        }
        for rs, s, c in rows
    ]

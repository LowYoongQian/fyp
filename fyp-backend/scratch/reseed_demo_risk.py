"""
DEV/DEMO seed (scratch, not a deliverable).
Re-seeds ONLY course BMCS3413 (id=8) as week 9 of a 14-week semester:
  - planned_total_hours = 70  (5h/week * 14 weeks)
  - 9 weeks held so far = 27 sessions: [2h lecture, 2h practical, 1h tutorial]/wk
  - 50 students given a spread of attendance profiles (stable / declining /
    doomed) via the SAME behavioural-momentum simulation used for training,
    so the dashboard shows a realistic mix of low/medium/high + reasons.

Never touches course 7 (BMCS2073). Idempotent: wipes & rebuilds course-8
sessions + attendance each run.
"""
import os
import random
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.database import SessionLocal              # noqa: E402
from utils.models import (Course, Enrolment, ClassSession,      # noqa: E402
                          AttendanceRecord, RiskScore)

COURSE_ID = 8
WEEKS_HELD = 9
TOTAL_WEEKS = 14
WEEKLY = [("lecture", 2.0), ("practical", 2.0), ("tutorial", 1.0)]  # 5h/week
PLANNED_TOTAL_HOURS = 5.0 * TOTAL_WEEKS   # 70
rng = random.Random(2024)


N_SESSIONS = WEEKS_HELD * len(WEEKLY)   # 27


def seq_from_pattern(early_p, late_p, split=18):
    """Deterministic-ish sequence: attend at rate early_p for the first `split`
    sessions, then late_p after. A declining student has late_p << early_p.
    Uses the seeded RNG so results are reproducible but look natural."""
    seq = []
    for i in range(N_SESSIONS):
        p = early_p if i < split else late_p
        seq.append(1 if rng.random() < p else 0)
    return seq


# Designed demo cohort. Each archetype produces a target tier. The "declining"
# and "borderline" groups are the teachable cases: still >=80% (or near it) yet
# flagged, because attendance is sliding — which a naive current-rate formula
# would miss. (early_rate, late_rate, count)
ARCHETYPES = [
    # label                 early  late  count   expected tier
    ("safe_high",           0.99, 0.99, 12),   # LOW
    ("safe_mild",           0.93, 0.90,  8),   # LOW
    ("declining_above80",   1.00, 0.60, 10),   # MED/HIGH (>=80% but sliding hard)
    ("borderline_flat",     0.85, 0.83,  8),   # MED (hovering just above bar)
    ("failing_recoverable", 0.78, 0.62,  7),   # HIGH (ML)
    ("doomed",              0.55, 0.40,  5),   # HIGH (certainty: cannot recover)
]


def simulate_student(early_p, late_p):
    return seq_from_pattern(early_p, late_p)


def main():
    db = SessionLocal()
    course = db.query(Course).get(COURSE_ID)
    assert course and course.course_code == "BMCS3413", "guard: wrong course!"
    course.planned_total_hours = PLANNED_TOTAL_HOURS

    # Wipe existing course-8 sessions + their attendance (and stale risk rows).
    old_sess = db.query(ClassSession).filter(ClassSession.course_id == COURSE_ID).all()
    old_ids = [s.id for s in old_sess]
    if old_ids:
        db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(old_ids)).delete(synchronize_session=False)
    db.query(ClassSession).filter(ClassSession.course_id == COURSE_ID).delete(synchronize_session=False)
    db.query(RiskScore).filter(RiskScore.course_id == COURSE_ID).delete(synchronize_session=False)
    db.commit()

    # Build 27 closed sessions (9 weeks), Mon 09:00 lecture etc., realistic hours.
    start = datetime(2026, 1, 12, 9, 0)   # semester start, a Monday
    sessions = []
    for w in range(WEEKS_HELD):
        for i, (kind, hrs) in enumerate(WEEKLY):
            opened = start + timedelta(weeks=w, days=i, hours=0)
            closed = opened + timedelta(hours=hrs)
            s = ClassSession(course_id=COURSE_ID, opened_at=opened, closed_at=closed,
                             is_open=False, class_group="All")
            db.add(s); sessions.append(s)
    db.commit()
    sess_ids = [s.id for s in sessions]

    # Assign each enrolled student a designed archetype (fill to cohort size).
    # order_by is required for reproducibility: without it Postgres may return
    # rows in physical order, which can shift after UPDATE/VACUUM and reshuffle
    # which student gets which archetype between demo runs.
    enr = (db.query(Enrolment)
             .filter(Enrolment.course_id == COURSE_ID)
             .order_by(Enrolment.id)
             .all())
    plan = []
    for _lbl, early, late, count in ARCHETYPES:
        plan += [(early, late)] * count
    while len(plan) < len(enr):          # pad if more students than planned
        plan.append((0.93, 0.90))
    rng.shuffle(plan)

    now = datetime.utcnow()
    for e, (early, late) in zip(enr, plan):
        seq = simulate_student(early, late)
        for sid, att in zip(sess_ids, seq):
            db.add(AttendanceRecord(
                student_id=e.student_id, session_id=sid,
                status="present" if att else "absent",
                confidence_score=1.0 if att else None,
                wifi_verified=bool(att), liveness_passed=bool(att),
                marked_at=now))
    db.commit()
    print(f"Re-seeded BMCS3413: {len(sess_ids)} sessions, {len(enr)} students, "
          f"planned_total_hours={PLANNED_TOTAL_HOURS}")
    db.close()


if __name__ == "__main__":
    main()

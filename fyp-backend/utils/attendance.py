"""Single source of truth for attendance-rate computation.

Both the student's "my attendance" view (routers/student_self.py) and the
lecturer/admin risk model (routers/analytics.py) MUST report the same number
for the same (student, course). To guarantee that, they share the two pure
helpers below instead of each rolling their own loop.

Policy (must stay in sync across both consumers):
  - Only CLOSED sessions count (is_open == False) — a session still open today
    is not yet "held".
  - A session counts toward the student if it is the whole-class "All" group or
    the student's own class_group.
  - "present" (face check-in) AND "leave" (approved medical leave) both count as
    attended. Only "absent" (or no record) counts against the student.
  - The rate is HOURS-WEIGHTED: each session's weight is its contact hours
    (closed_at - opened_at, clamped), not a flat 1 per session.
"""
from ml.features import compute_features


def session_hours(opened_at, closed_at) -> float:
    """Contact hours for one closed session, clamped to a sane range.
    Falls back to 2.0h when either timestamp is missing."""
    if opened_at and closed_at:
        return max(0.5, min(6.0, (closed_at - opened_at).total_seconds() / 3600.0))
    return 2.0


def build_attendance_sequence(course_sessions, present_set, student_id, class_group):
    """Turn a course's closed sessions into a chronological (sequence, hours)
    pair for one student.

    course_sessions: list of (session_id, group, hours) ordered oldest-first.
    present_set:     set of (student_id, session_id) counted as attended.
    Returns (sequence, hours) where sequence[i] is 1 (attended) or 0 (absent).
    """
    sequence, hours = [], []
    for sess_id, group, hrs in course_sessions:
        if group == "All" or group == class_group:
            sequence.append(1 if (student_id, sess_id) in present_set else 0)
            hours.append(hrs)
    return sequence, hours


def attendance_rate_percent(course_sessions, present_set, student_id, class_group) -> float:
    """Hours-weighted attendance rate as a 0-100 percentage, using the exact
    same code path as the risk model. Returns 100.0 when nothing is held yet."""
    sequence, hours = build_attendance_sequence(course_sessions, present_set, student_id, class_group)
    if not sequence:
        return 100.0
    return round(compute_features(sequence, hours)["attendance_rate"] * 100.0, 1)

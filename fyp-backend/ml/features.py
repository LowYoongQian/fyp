"""
Feature extraction for the at-risk prediction model.

Single source of truth: BOTH the training script and the live analytics
endpoint call compute_features() so the model always sees features computed
the exact same way.

Input:
  sequence : list of 1 (attended: present/leave) / 0 (absent), in chronological
             order (oldest session first).
  hours    : optional per-session contact hours, same length/order as sequence.
             Attendance is credited by HOURS, not by class count (a 2h lecture
             missed hurts more than a 1h tutorial). If omitted, every session
             counts as 1 hour (i.e. plain count-based, backward compatible).

Output: the 3 features described in Chapter 2 of the report:
  - attendance_rate    : HOURS attended / HOURS held so far (0.0 - 1.0)
  - consecutive_absent : longest run of missed classes in a row (by count)
  - trend              : 2nd-half hours-rate minus 1st-half hours-rate
                         (negative = attendance is declining = riskier)
"""
from __future__ import annotations


def _rate(seq: list[int], wts: list[float]) -> float:
    total = sum(wts)
    if total <= 0:
        return 0.0
    return sum(v * w for v, w in zip(seq, wts)) / total


def compute_features(sequence: list[int], hours: list[float] | None = None) -> dict:
    n = len(sequence)
    if n == 0:
        return {"attendance_rate": 0.0, "consecutive_absent": 0, "trend": 0.0}

    if hours is None:
        hours = [1.0] * n

    # 1. attendance rate — hours-weighted
    attendance_rate = _rate(sequence, hours)

    # 2. longest consecutive absence streak — by class count (behavioural signal)
    longest = 0
    current = 0
    for v in sequence:
        if v == 0:
            current += 1
            longest = max(longest, current)
        else:
            current = 0

    # 3. trend — hours-weighted 2nd-half rate minus 1st-half rate
    mid = n // 2
    first_rate = _rate(sequence[:mid], hours[:mid])
    second_rate = _rate(sequence[mid:], hours[mid:])
    trend = second_rate - first_rate

    return {
        "attendance_rate": round(attendance_rate, 4),
        "consecutive_absent": longest,
        "trend": round(trend, 4),
    }


# Fixed feature order — the model expects columns in exactly this sequence.
FEATURE_ORDER = ["attendance_rate", "consecutive_absent", "trend"]


def features_to_row(feats: dict) -> list[float]:
    """Convert a feature dict into an ordered list for model input."""
    return [feats[name] for name in FEATURE_ORDER]

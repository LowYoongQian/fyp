from datetime import date
from types import SimpleNamespace

from domain.attendance import effective_planned_hours
from domain.planned_hours import TeachingRule, next_teaching_week, planned_minutes, teaching_obligations


def test_read_only_legacy_comparison_and_inclusive_group_plans():
    start, end = date(2026, 11, 2), date(2026, 11, 29)
    rules = [
        TeachingRule("lecture", "Lecture", None, "Monday", "09:00", "11:00", start),
        TeachingRule("g1", "Tutor", "G1", "Tuesday", "09:00", "10:00", start),
        TeachingRule("g2", "Practical", "G2", "Wednesday", "09:00", "10:30", start),
    ]
    rows = teaching_obligations(start, end, rules)
    assert (planned_minutes(rows, "G1"), planned_minutes(rows, "G2")) == (720, 840)
    assert sum(row.minutes for row in rows if row.day == date(2026, 11, 11)) == 90
    partial = teaching_obligations(date(2026, 11, 4), date(2026, 11, 9), rules)
    assert (planned_minutes(partial, "G1"), planned_minutes(partial, "G2")) == (120, 210)
    original = SimpleNamespace(status="cancelled", scheduled_start=None, scheduled_end=None,
                               opened_at=None, closed_at=None, replacement_for_session_id=None)
    assert effective_planned_hours(12, [original]) == 10
    assert (planned_minutes(rows, "G1"), planned_minutes(rows, "G2")) == (720, 840)


def test_revision_preserves_unmaterialized_obligations_before_next_monday():
    start, end = date(2026, 11, 2), date(2026, 11, 29)
    cutover = next_teaching_week(date(2026, 11, 11))
    assert cutover == date(2026, 11, 16)
    lecture = TeachingRule("lecture", "Lecture", None, "Monday", "09:00", "11:00", start)
    old = TeachingRule("g1", "Tutor", "G1", "Tuesday", "09:00", "10:00", start, cutover)
    new = TeachingRule("g1", "Tutor", "G1", "Wednesday", "09:00", "11:00", cutover)
    rows = teaching_obligations(start, end, [lecture, old, new])
    assert planned_minutes(rows, "G1") == 840
    assert [row.day.day for row in rows if row.meeting_id == "g1"] == [3, 10, 18, 25]


def test_explicit_weekend_rule_counts_on_the_inclusive_last_day():
    start, end = date(2026, 11, 28), date(2026, 11, 29)
    rule = TeachingRule("lecture", "Lecture", None, "Sunday", "09:00", "10:45", start)
    assert planned_minutes(teaching_obligations(start, end, [rule]), "G1") == 105

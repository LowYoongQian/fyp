"""Expand dated timetable rules into teaching obligations in campus time."""

from dataclasses import dataclass
from datetime import date, timedelta

from domain.scheduler import WEEKDAYS, slot_bounds_local


@dataclass(frozen=True)
class TeachingRule:
    meeting_id: str
    role: str
    class_group: str | None
    day: str
    start: str
    end: str
    effective_date: date
    until_date: date | None = None


@dataclass(frozen=True)
class Obligation:
    meeting_id: str
    day: date
    class_group: str
    start: str
    end: str
    minutes: int
    rule_effective_date: date


def teaching_obligations(start: date, end: date, rules: list[TeachingRule]) -> list[Obligation]:
    """Expand inclusive term dates and half-open rule windows, including holidays."""
    if end < start:
        raise ValueError("Semester end precedes its start")
    obligations = {}
    for rule in rules:
        if rule.day not in WEEKDAYS or rule.role not in {"Lecture", "Tutor", "Practical"}:
            raise ValueError("Unrecognized timetable rule")
        if rule.role == "Lecture" and rule.class_group not in (None, "All"):
            raise ValueError("Lecture must cover all course groups")
        group = "All" if rule.role == "Lecture" else rule.class_group
        if not group or (rule.role != "Lecture" and group == "All"):
            raise ValueError("Group-specific rule has no class group")
        day = max(start, rule.effective_date)
        first, last = slot_bounds_local({"start": rule.start, "end": rule.end}, day)
        minutes = (last - first) // timedelta(minutes=1)
        day += timedelta(days=(WEEKDAYS.index(rule.day) - day.weekday()) % 7)
        while day <= end and (rule.until_date is None or day < rule.until_date):
            key = (rule.meeting_id, day)
            if key in obligations:
                raise ValueError("Timetable rule versions overlap")
            obligations[key] = Obligation(
                rule.meeting_id, day, group, rule.start, rule.end, minutes, rule.effective_date,
            )
            day += timedelta(days=7)
    ordered = sorted(obligations.values(), key=lambda row: (row.day, row.start, row.meeting_id))
    ends = {}
    for row in ordered:
        end_by_group = ends.setdefault(row.day, {})
        if any(row.start < end for group, end in end_by_group.items()
               if "All" in (group, row.class_group) or group == row.class_group):
            raise ValueError("Planned obligations overlap within a class group")
        end_by_group[row.class_group] = row.end
    return ordered


def planned_minutes(obligations: list[Obligation], class_group: str) -> int:
    return sum(row.minutes for row in obligations if row.class_group in ("All", class_group))


def next_teaching_week(day: date) -> date:
    return day + timedelta(days=7 - day.weekday())

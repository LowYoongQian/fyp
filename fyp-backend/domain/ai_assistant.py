"""Validated plans and authoritative database tools for the AI assistant."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_

from db.models import AttendanceRecord, ClassSession, Course, Enrolment, Student
from domain.attendance import CREDITED_STATUSES, attendance_rate_percent, session_hours


Intent = Literal[
    "student_attendance_rate", "student_attendance_history", "student_courses",
    "student_sessions", "student_status", "student_risk", "risk_list",
    "course_average", "course_attendance", "course_students", "enrolment_list",
    "present_count", "absent_count", "session_list", "session_attendance",
    "group_attendance", "timetable", "memory", "system_help", "my_courses",
    # The planner's way to say "this is not a request to read attendance data": answered with the scope reply, never with data.
    "unsupported",
]
# Only windows the server can compute in campus time; anything else the planner says is dropped rather than guessed.
DATE_SCOPES = ("today", "yesterday", "tomorrow", "this week", "last week", "next week")
_DATE = re.compile(r"\b(today|yesterday|tomorrow|this\s+week|last\s+week|next\s+week)\b", re.I)


class AIPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Intent
    student_hint: str | None = Field(default=None, max_length=100)
    student_id: str | None = None
    course_hint: str | None = Field(default=None, max_length=100)
    course_code: str | None = Field(default=None, max_length=30)
    group: str | None = Field(default=None, max_length=30)
    threshold: float = Field(default=80, ge=0, le=100)
    date_scope: str | None = Field(default=None, max_length=40)
    session_hint: str | None = Field(default=None, max_length=100)
    scope: Literal["assigned", "course", "student"] = "assigned"
    needs_context: bool = False

    @field_validator("date_scope", mode="before")
    @classmethod
    def _known_date_scope(cls, value):
        text = " ".join(str(value or "").casefold().split())
        return text if text in DATE_SCOPES else None


def date_scope_of(question: str) -> str | None:
    match = _DATE.search(question)
    return " ".join(match.group(1).casefold().split()) if match else None


@dataclass(frozen=True)
class StudentResolution:
    student: Student | None
    matches: tuple[Student, ...] = ()


_CODE = re.compile(r"\bST\d{7}\b", re.I)
_GENERIC_STUDENT = {
    "student", "students", "all student", "all students", "every student",
    "every students", "her", "his", "him", "that student", "the student",
    "previous student", "the previous student", "this course", "that course",
    "today", "yesterday",
}


_NOT_NAME = re.compile(
    r"\b(how|many|who|which|what|when|where|why|does|do|is|are|was|were|the|and|or"
    r"|in|on|at|of|all|every|present|absent|group|lecturer|total|count|number"
    r"|below|above|average|my|i|me|we|our|you|your|overall|current|latest|recent|class|classes|course"
    r"|today|yesterday|tomorrow|this|that|last|next|weekly|daily|monthly)\b",
    re.I,
)


def _clean_name(value: str) -> str:
    value = re.sub(r"^(?:give me|show me|show|list|what is|what's|how often does|why is|is|what about)\s+", "", value, flags=re.I)
    value = re.sub(r"^student\s+", "", value, flags=re.I)
    value = re.sub(r"['’]s$", "", value.strip(), flags=re.I)
    return " ".join(value.strip(" ?.!,").split())


def extract_student_hint(question: str) -> str | None:
    code = _CODE.search(question)
    if code:
        return code.group(0).upper()
    patterns = (
        r"\battendance(?: rate| percentage)?\s+(?:for|of)\s+([A-Za-z][A-Za-z .'-]{1,80}?)(?:\s+(?:in|for)\s+|[?.!,]|$)",
        r"\bhow often does\s+([A-Za-z][A-Za-z .'-]{1,80}?)\s+attend\b",
        r"\b(?:is|why is|what about)\s+([A-Za-z][A-Za-z .'-]{1,80}?)\s+(?:below|above|at risk|attendance|sessions?|courses?)\b",
        r"^(.+?)\s+(?:attendance(?: rate| percentage)?|sessions?|courses?|status|risk)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, question.strip(), re.I)
        if match:
            candidate = _clean_name(match.group(1))
            if (
                candidate.casefold() not in _GENERIC_STUDENT
                and not _NOT_NAME.search(candidate)
                and len(candidate.split()) <= 4
            ):
                return candidate
    return None


_ABSENT = re.compile(r"\b(absent|absentees?|absences?|missed|skipped|did(?:n't| not) (?:attend|come|show up))\b", re.I)
_PRESENT = re.compile(r"\b(present|attended|showed up|checked in)\b", re.I)
_MY_COURSES = re.compile(r"\b(?:my|i)\b.*\b(?:courses?|subjects?)\b|\b(?:courses?|subjects?)\b.*\b(?:i|me)\b", re.I)


def deterministic_plan(question: str) -> AIPlan | None:
    """Classify unambiguous requests without an external model call."""
    group_match = re.search(r"\b(g\d+)\b", question, re.I)
    group = group_match.group(1).upper() if group_match else None
    student_hint = extract_student_hint(question)
    course_code = (re.search(r"\b[A-Z]{2,6}\d{3,5}\b", question, re.I) or [None])[0]
    date_scope = date_scope_of(question)
    if re.search(r"\b(her|his|him|that student|the student)\b", question, re.I):
        if re.search(r"\bsessions?|classes\b", question, re.I):
            return AIPlan(intent="student_sessions", group=group, needs_context=True, scope="student")
        if re.search(r"\bcourses?|enrol", question, re.I):
            return AIPlan(intent="student_courses", group=group, needs_context=True, scope="student")
        if re.search(r"\battendance|rate|percentage\b", question, re.I):
            return AIPlan(intent="student_attendance_rate", group=group, needs_context=True, scope="student")
    if student_hint:
        intent = "student_attendance_rate"
        if re.search(r"\bhistory|records?\b", question, re.I):
            intent = "student_attendance_history"
        elif re.search(r"\bsessions?\b", question, re.I) or (
            re.search(r"\bclasses\b", question, re.I)
            and not re.search(r"\bhow often\b.*\battend\b", question, re.I)
        ):
            intent = "student_sessions"
        elif re.search(r"\bcourses?|enrol", question, re.I):
            intent = "student_courses"
        elif re.search(r"\bstatus\b", question, re.I):
            intent = "student_status"
        elif re.search(r"\brisk\b", question, re.I):
            intent = "student_risk"
        return AIPlan(intent=intent, student_hint=student_hint, course_code=course_code, group=group, scope="student", date_scope=date_scope)
    if re.search(r"\bstudents?\b", question, re.I) and re.search(r"\benroll?(?:ed|ment|ments)?\b", question, re.I):
        course_match = re.search(r"\b(?:in|for)\s+(.+?)(?:[?.!]|$)", question, re.I)
        return AIPlan(intent="enrolment_list", course_hint=course_match.group(1).strip() if course_match else None, course_code=course_code, group=group)
    if re.search(r"\b(high|at)[ -]?risk\b|\b(?:who|students?)\b.*\b(?:below|under)\s+\d+\s*%?", question, re.I):
        threshold = re.search(r"\bbelow\s+(\d+(?:\.\d+)?)", question, re.I)
        return AIPlan(intent="risk_list", threshold=float(threshold.group(1)) if threshold else 80, course_code=course_code, group=group)
    if re.search(r"\baverage\b.*\battendance\b|\battendance\b.*\baverage\b", question, re.I):
        return AIPlan(intent="course_average", course_code=course_code, group=group)
    if re.search(r"\battendance\b.*\b(all|every)\s+students?\b", question, re.I) or re.search(
        r"\b(all|every)\s+(?:students?\s+|student\s+)?attendance\b", question, re.I
    ):
        return AIPlan(intent="course_attendance", course_code=course_code, group=group)
    if re.search(r"\b(lowest|worst|poorest|weakest)\b", question, re.I) and re.search(r"\battend", question, re.I):
        return AIPlan(intent="course_attendance", course_code=course_code, group=group)  # listed lowest first
    if _ABSENT.search(question):
        return AIPlan(intent="absent_count", course_code=course_code, group=group, date_scope=date_scope)
    if _PRESENT.search(question) and re.search(r"\b(who|which|how many|list|show|students?)\b", question, re.I):
        return AIPlan(intent="present_count", course_code=course_code, group=group, date_scope=date_scope)
    if re.search(r"\b(recent|past|previous|latest|last|completed|finished)\s+(?:\w+\s+)?(classes|sessions|lessons)\b", question, re.I):
        return AIPlan(intent="session_list", course_code=course_code, group=group, date_scope=date_scope)
    if re.search(r"\b(timetable|schedule|upcoming|next class(?:es)?)\b", question, re.I) or (
        date_scope and re.search(r"\b(class(?:es)?|lessons?|lectures?|sessions?)\b", question, re.I)
    ):
        return AIPlan(intent="timetable", course_code=course_code, group=group, date_scope=date_scope)
    if _MY_COURSES.search(question):
        return AIPlan(intent="my_courses")
    return None


def apply_context(plan: AIPlan, question: str, context: dict | None) -> AIPlan:
    """Fill only omitted follow-up entities; explicit current text always wins."""
    state = context or {}
    update = {}
    if not plan.student_hint and not plan.student_id and re.search(r"\b(her|his|him|that student|the student)\b", question, re.I):
        update["student_id"] = state.get("student_id")
    if not plan.course_hint and not plan.course_code and re.search(r"\b(that course|the course|only g\d+|and g\d+)\b", question, re.I):
        update["course_code"] = state.get("course_code")
    if not plan.group and re.search(r"\b(only|and)\s+g\d+\b", question, re.I):
        match = re.search(r"\bg\d+\b", question, re.I)
        update["group"] = match.group(0).upper() if match else state.get("group")
    return plan.model_copy(update={key: value for key, value in update.items() if value})


def context_follow_up_plan(question: str, context: dict | None) -> AIPlan | None:
    """Resolve short entity-only follow-ups without invoking the planner."""
    state = context or {}
    previous = state.get("intent")
    if not previous or not re.match(r"^(?:and|only|what about|how about|show)\b", question.strip(), re.I):
        return None
    course = re.search(r"\b[A-Z]{2,6}\d{3,5}\b", question, re.I)
    group = re.search(r"\bG\d+\b", question, re.I)
    threshold = re.search(r"\b(\d+(?:\.\d+)?)\s*%?\b", question)
    date_scope = re.search(r"\b(today|yesterday)\b", question, re.I)
    named = re.match(r"^(?:only|what about|how about|show)\s+([A-Za-z][A-Za-z .'-]{1,80}?)[?.!]*$", question.strip(), re.I)
    student_hint = _clean_name(named.group(1)) if named and not course and not group and not threshold else None
    if student_hint and student_hint.casefold() in _GENERIC_STUDENT:
        student_hint = None
    intent = previous if previous in AIPlan.model_fields["intent"].annotation.__args__ else "system_help"
    if student_hint and not str(intent).startswith("student_"):
        intent = "student_attendance_rate"
    elif state.get("student_id"):
        if re.search(r"\battendance|rate|percentage\b", question, re.I):
            intent = "student_attendance_rate"
        elif re.search(r"\bsessions?|classes\b", question, re.I):
            intent = "student_sessions"
        elif re.search(r"\bcourses?|enrol", question, re.I):
            intent = "student_courses"
    student_id = None if student_hint else state.get("student_id")
    if str(intent).startswith("student_") and not (student_id or student_hint):
        return None
    return AIPlan(
        intent=intent,
        student_hint=student_hint,
        student_id=student_id,
        course_code=course.group(0).upper() if course else state.get("course_code"),
        group=group.group(0).upper() if group else state.get("group"),
        threshold=float(threshold.group(1)) if threshold else 80,
        date_scope=date_scope.group(1).lower() if date_scope else None,
        scope="student" if str(intent).startswith("student_") else "assigned",
    )


def resolve_student(db, course_ids: list[str], *, hint: str | None, student_id: str | None = None, enrolment_scope=None) -> StudentResolution:
    query = db.query(Student).join(Enrolment, Enrolment.student_id == Student.id).filter(Enrolment.course_id.in_(course_ids))
    if enrolment_scope is not None:
        query = query.filter(enrolment_scope)
    if student_id and _CODE.fullmatch(student_id):
        hint, student_id = student_id, None
    if student_id:
        student = query.filter(Student.id == student_id).first()
        return StudentResolution(student=student, matches=(student,) if student else ())
    needle = " ".join((hint or "").casefold().split())
    if not needle:
        return StudentResolution(student=None)
    exact_rows = query.filter(or_(
        func.lower(Student.student_code) == needle,
        func.lower(func.trim(Student.name)) == needle,
    )).order_by(Student.name).limit(4).all()
    exact_code = [row for row in exact_rows if row.student_code.casefold() == needle]
    if exact_code:
        return StudentResolution(student=exact_code[0], matches=(exact_code[0],))
    exact_name = [row for row in exact_rows if " ".join(row.name.casefold().split()) == needle]
    if len(exact_name) == 1:
        return StudentResolution(student=exact_name[0], matches=(exact_name[0],))
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    partial_rows = query.filter(Student.name.ilike(f"%{escaped}%", escape="\\")).order_by(Student.name).limit(9).all()
    partial = list({row.id: row for row in partial_rows if needle in " ".join(row.name.casefold().split())}.values())
    return StudentResolution(student=partial[0] if len(partial) == 1 else None, matches=tuple(partial))


def student_course_rates(db, student: Student, course_ids: list[str], course_id: str | None = None, enrolment_scope=None) -> list[tuple[Course, str, float]]:
    enrolment_query = db.query(Enrolment, Course).join(Course, Course.id == Enrolment.course_id).filter(
        Enrolment.student_id == student.id,
        Enrolment.course_id.in_([course_id] if course_id else course_ids),
    )
    if enrolment_scope is not None:
        enrolment_query = enrolment_query.filter(enrolment_scope)
    enrolments = enrolment_query.order_by(Course.course_code).all()
    selected_ids = [course.id for _, course in enrolments]
    sessions_by_course: dict[str, list[tuple]] = {}
    if selected_ids:
        for session in db.query(ClassSession).filter(ClassSession.course_id.in_(selected_ids), ClassSession.status == "completed").order_by(ClassSession.scheduled_start.asc().nullslast(), ClassSession.id.asc()).all():
            sessions_by_course.setdefault(session.course_id, []).append((
                session.id, session.class_group,
                session_hours(session.opened_at, session.closed_at, scheduled_start=session.scheduled_start, scheduled_end=session.scheduled_end),
            ))
    attended = {(student.id, session_id) for (session_id,) in db.query(AttendanceRecord.session_id).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.status.in_(CREDITED_STATUSES),
    ).all()}
    return [
        (course, enrolment.class_group, attendance_rate_percent(sessions_by_course.get(course.id, []), attended, student.id, enrolment.class_group))
        for enrolment, course in enrolments
    ]


def scoped_student_rates(db, course_ids: list[str], group: str | None = None, enrolment_scope=None) -> list[tuple[Student, Course, str, float]]:
    """Bulk dashboard-consistent rates without per-student database queries."""
    enrolment_query = db.query(Enrolment, Student, Course).join(Student, Student.id == Enrolment.student_id).join(Course, Course.id == Enrolment.course_id).filter(
        Enrolment.course_id.in_(course_ids)
    )
    if enrolment_scope is not None:
        enrolment_query = enrolment_query.filter(enrolment_scope)
    if group:
        enrolment_query = enrolment_query.filter(func.lower(Enrolment.class_group) == group.casefold())
    enrolments = enrolment_query.order_by(Student.name, Course.course_code).all()
    sessions_by_course: dict[str, list[tuple]] = {}
    for session in db.query(ClassSession).filter(
        ClassSession.course_id.in_(course_ids), ClassSession.status == "completed"
    ).order_by(ClassSession.scheduled_start.asc().nullslast(), ClassSession.id.asc()).all():
        sessions_by_course.setdefault(session.course_id, []).append((
            session.id, session.class_group,
            session_hours(session.opened_at, session.closed_at, scheduled_start=session.scheduled_start, scheduled_end=session.scheduled_end),
        ))
    student_ids = [student.id for _, student, _ in enrolments]
    attended = set()
    if student_ids:
        attended = {(student_id, session_id) for student_id, session_id in db.query(
            AttendanceRecord.student_id, AttendanceRecord.session_id
        ).filter(
            AttendanceRecord.student_id.in_(student_ids),
            AttendanceRecord.status.in_(CREDITED_STATUSES),
        ).all()}
    return [
        (student, course, enrolment.class_group, attendance_rate_percent(
            sessions_by_course.get(course.id, []), attended, student.id, enrolment.class_group
        ))
        for enrolment, student, course in enrolments
    ]

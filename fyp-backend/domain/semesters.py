"""Semester dates are campus calendar dates; academic credits are not contact hours."""
import random
import time
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import DBAPIError
from db.models import AcademicSemester, Course, Enrolment, Programme
from utils.timeutil import CAMPUS_TZ, campus_now


def campus_date(instant: datetime) -> date:
    return instant.replace(tzinfo=timezone.utc).astimezone(CAMPUS_TZ).date() if instant.tzinfo is None else instant.astimezone(CAMPUS_TZ).date()


def semester_dict(semester):
    if semester is None:
        return None
    today = campus_now().date()
    return {"id": semester.id, "programme_id": semester.programme_id, "name": semester.name,
            "start_date": semester.start_date.isoformat(), "end_date": semester.end_date.isoformat(),
            "max_student_credits": semester.max_student_credits,
            "status": "upcoming" if today < semester.start_date else "ended" if today > semester.end_date else "active"}


def course_semester(db, course_id):
    course = db.get(Course, course_id)
    return course.semester if course and course.semester_id else None


def within_semester(semester, day):
    if isinstance(semester, dict):
        return semester["start_date"] <= day <= semester["end_date"]
    return semester is None or semester.start_date <= day <= semester.end_date


def require_semester_date(db, course_id, day):
    semester = course_semester(db, course_id)
    if not within_semester(semester, day):
        raise HTTPException(400, f"{semester.name} runs from {semester.start_date} to {semester.end_date} (Malaysia time). Classes and check-ins are not allowed outside these dates.")


def validate_credit_loads(db, courses, limit, *, credit_override=None):
    """Distinct courses: duplicate legacy allocations must never multiply credits."""
    credits = {str(c.id): Decimal(str((credit_override or {}).get(str(c.id), c.credit_hours) or 0)) for c in courses}
    if any(not value.is_finite() or value <= 0 for value in credits.values()):
        raise HTTPException(409, "Every semester course needs positive academic credits; update its course settings first.")
    loads = {}
    for student_id, course_id in db.query(Enrolment.student_id, Enrolment.course_id).filter(
            Enrolment.course_id.in_([c.id for c in courses])).distinct():
        loads[student_id] = loads.get(student_id, Decimal(0)) + credits[str(course_id)]
    if any(load > Decimal(str(limit)) for load in loads.values()):
        raise HTTPException(409, f"Existing student allocations exceed the {limit:g}-credit limit; adjust allocations or increase the limit first.")


def require_enrolment_credit_limit(db, student_id, course):
    if not course.semester_id:
        return None
    semester = db.query(AcademicSemester).filter(AcademicSemester.id == course.semester_id).with_for_update().one()
    if campus_now().date() > semester.end_date:
        raise HTTPException(400, "This semester has ended; new course allocations are not allowed.")
    # A term lock serializes enrolment and cap/credit edits, including two admins.
    rows = db.query(Course.id, Course.credit_hours).join(Enrolment, Enrolment.course_id == Course.id).filter(
        Enrolment.student_id == student_id, Course.semester_id == semester.id).distinct().all()
    used = sum((Decimal(str(credit or 0)) for _, credit in rows), Decimal(0))
    added = Decimal(str(course.credit_hours or 0))
    if used + added > Decimal(str(semester.max_student_credits)):
        raise HTTPException(409, f"Credit limit exceeded: {used:g} + {added:g} credits would exceed {semester.max_student_credits:g} for {semester.name}.")
    return semester


def lock_programme(db, programme_id):
    if programme_id:
        db.query(Programme).filter(Programme.id == programme_id).with_for_update().one()


def lock_programmes(db, *programme_ids):
    """Lock programme rows in id order. Any writer that needs programme AND student rows takes the programmes first,
    the student second, the semester last (PostgreSQL ends a lock cycle by killing one transaction: docs 13.3.4)."""
    for programme_id in sorted({str(value) for value in programme_ids if value}):
        if not db.query(Programme).filter(Programme.id == programme_id).with_for_update().first():
            raise HTTPException(400, "Selected programme does not exist")


TRANSIENT_SQLSTATES = {"40P01", "40001"}   # deadlock detected, serialization failure: the same safe transaction may simply be run again


def run_transaction(db, work, attempts=3):
    """Run `work()` and commit as ONE transaction. Only a recognised transient failure re-runs the whole of it (nothing of the
    failed run survives the rollback, audit line included); any other error rolls back and propagates unchanged."""
    for attempt in range(attempts):
        try:
            result = work()
            db.commit()
            return result
        except DBAPIError as error:
            db.rollback()
            state = getattr(error.orig, "sqlstate", None) or getattr(error.orig, "pgcode", None)
            if state not in TRANSIENT_SQLSTATES:
                raise
            if attempt == attempts - 1:
                raise HTTPException(409, "Another change was in progress, so nothing was saved. Please try again.") from error
            time.sleep(0.05 * (attempt + 1) + random.random() * 0.05)
        except BaseException:
            db.rollback()
            raise

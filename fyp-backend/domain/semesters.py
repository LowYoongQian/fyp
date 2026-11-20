"""Semester dates are campus calendar dates."""
import random
import time
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import DBAPIError
from db.models import AcademicSemester, Course, Programme
from utils.timeutil import CAMPUS_TZ, campus_now


def campus_date(instant: datetime) -> date:
    return instant.replace(tzinfo=timezone.utc).astimezone(CAMPUS_TZ).date() if instant.tzinfo is None else instant.astimezone(CAMPUS_TZ).date()


def semester_dict(semester):
    if semester is None:
        return None
    today = campus_now().date()
    return {"id": semester.id, "programme_id": semester.programme_id, "name": semester.name,
            "start_date": semester.start_date.isoformat(), "end_date": semester.end_date.isoformat(),
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


def enrolment_semester(db, course):
    if not course.semester_id:
        return None
    semester = db.query(AcademicSemester).filter(AcademicSemester.id == course.semester_id).with_for_update().one()
    if campus_now().date() > semester.end_date:
        raise HTTPException(400, "This semester has ended; new course allocations are not allowed.")
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

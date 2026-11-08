"""Search-as-you-type lookups for the admin pickers (ACADEMIC-SEARCH-11).

Each answer is one small, stably ordered page (at most 50 rows) filtered in the database, so a picker works the same with ten records or
100,000; it never sends a whole table to the browser. `has_more` says whether another page exists. The older full-list endpoints are
unchanged for the pages that still use them.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AcademicSemester, ClassMeeting, Course, Enrolment, Lecturer, Programme, Student, User
from domain.semesters import semester_dict
from utils.security import require_admin
from utils.timeutil import campus_now

router = APIRouter(prefix="/admin/lookup", tags=["Admin Lookup"])

SEARCH = Query("", max_length=100)
SKIP = Query(0, ge=0, le=100000)
LIMIT = Query(20, ge=1, le=50)


def _pattern(text: str) -> str:
    """A LIKE pattern that matches the typed text literally (a typed % or _ is not a wildcard)."""
    return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _page(query, skip: int, limit: int):
    rows = query.offset(skip).limit(limit + 1).all()
    return rows[:limit], len(rows) > limit


def _current_enrolment(today):
    """True when the student is enrolled in a course whose semester is running today (Malaysia date, end date included)."""
    return (select(Enrolment.id)
            .join(Course, Course.id == Enrolment.course_id)
            .join(AcademicSemester, AcademicSemester.id == Course.semester_id)
            .where(Enrolment.student_id == Student.id, AcademicSemester.start_date <= today, AcademicSemester.end_date >= today)
            .exists())


@router.get("/students")
def lookup_students(search: str = SEARCH, skip: int = SKIP, limit: int = LIMIT,
                    db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Without a search: students still waiting for a current-semester course. With one: every match (name, code or email), marked."""
    current = _current_enrolment(campus_now().date())
    query = (db.query(Student, current.label("current"), Programme.code, User.email)
             .outerjoin(Programme, Programme.id == Student.programme_id)
             .outerjoin(User, User.id == Student.user_id))
    term = search.strip()
    if term:
        pattern = _pattern(term)
        query = query.filter(or_(Student.name.ilike(pattern, escape="\\"), Student.student_code.ilike(pattern, escape="\\"),
                                 User.email.ilike(pattern, escape="\\")))
    else:
        query = query.filter(~current)
    rows, more = _page(query.order_by(Student.name, Student.id), skip, limit)
    return {"items": [{"id": s.id, "name": s.name, "student_code": s.student_code, "email": email or "", "programme_id": s.programme_id,
                       "programme_code": code, "current_enrolled": bool(is_current)} for s, is_current, code, email in rows],
            "has_more": more}


@router.get("/staff")
def lookup_staff(search: str = SEARCH, skip: int = SKIP, limit: int = LIMIT,
                 db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    query = db.query(Lecturer, User.email).outerjoin(User, User.id == Lecturer.user_id)
    term = search.strip()
    if term:
        pattern = _pattern(term)
        query = query.filter(or_(Lecturer.name.ilike(pattern, escape="\\"), Lecturer.staff_id.ilike(pattern, escape="\\"),
                                 User.email.ilike(pattern, escape="\\")))
    rows, more = _page(query.order_by(Lecturer.name, Lecturer.id), skip, limit)
    return {"items": [{"id": l.id, "name": l.name, "staff_id": l.staff_id, "email": email or "", "role": l.role} for l, email in rows],
            "has_more": more}


@router.get("/programmes")
def lookup_programmes(search: str = SEARCH, skip: int = SKIP, limit: int = LIMIT,
                      db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    query = db.query(Programme)
    term = search.strip()
    if term:
        pattern = _pattern(term)
        query = query.filter(or_(Programme.code.ilike(pattern, escape="\\"), Programme.name.ilike(pattern, escape="\\")))
    rows, more = _page(query.order_by(Programme.code, Programme.id), skip, limit)
    return {"items": [{"id": p.id, "code": p.code, "name": p.name} for p in rows], "has_more": more}


@router.get("/courses")
def lookup_courses(search: str = SEARCH, skip: int = SKIP, limit: int = LIMIT, programme_id: Optional[UUID] = None,
                   student_id: Optional[UUID] = None, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Courses, optionally of one programme. For a student, the unsearched list leaves out courses they already take and finished
    semesters (the useful next choices); a search shows those too, marked, so nothing is hidden, and the server still refuses duplicates."""
    today = campus_now().date()
    query = db.query(Course, AcademicSemester).outerjoin(AcademicSemester, AcademicSemester.id == Course.semester_id)
    if programme_id:
        query = query.filter(Course.programme_id == str(programme_id))
    enrolled_ids = set()
    if student_id:
        enrolled_ids = {row[0] for row in db.query(Enrolment.course_id).filter(Enrolment.student_id == str(student_id))}
    term = search.strip()
    if term:
        pattern = _pattern(term)
        query = query.filter(or_(Course.course_code.ilike(pattern, escape="\\"), Course.course_name.ilike(pattern, escape="\\")))
    elif student_id:
        if enrolled_ids:
            query = query.filter(Course.id.notin_(enrolled_ids))
        query = query.filter(or_(Course.semester_id.is_(None), AcademicSemester.end_date >= today))
    rows, more = _page(query.order_by(Course.course_code, Course.id), skip, limit)
    return {"items": [{"id": c.id, "course_code": c.course_code, "course_name": c.course_name, "credit_hours": c.credit_hours,
                       "programme_id": c.programme_id, "semester_id": c.semester_id, "semester": semester_dict(term_row) if term_row else None,
                       "enrolled": c.id in enrolled_ids} for c, term_row in rows],
            "has_more": more}


@router.get("/allocation")
def allocation_check(course_id: UUID, student_id: Optional[UUID] = None, db: Session = Depends(get_db),
                     current_user: User = Depends(require_admin)):
    """What the allocation form needs once a course is picked: the course's groups with their real seat counts (25 seats each) and, for
    the chosen student, the credits already used in the course's semester. Read only; the save itself re-checks all of it."""
    course = db.get(Course, str(course_id))
    if not course:
        raise HTTPException(404, "Course not found")
    counts = dict(db.query(Enrolment.class_group, func.count(Enrolment.id)).filter(Enrolment.course_id == course.id).group_by(Enrolment.class_group))
    groups = sorted({*counts, *(g for (g,) in db.query(ClassMeeting.class_group).filter(ClassMeeting.course_id == course.id, ClassMeeting.class_group.isnot(None))), "G1"},
                    key=lambda g: (int(g[1:]) if g[1:].isdigit() else 999, g))
    term = db.get(AcademicSemester, course.semester_id) if course.semester_id else None
    used = None
    if term and student_id:
        used = sum(float(credit or 0) for (credit,) in db.query(Course.credit_hours).join(Enrolment, Enrolment.course_id == Course.id)
                   .filter(Enrolment.student_id == str(student_id), Course.semester_id == term.id).distinct())
    return {"groups": [{"group": g, "count": counts.get(g, 0), "full": counts.get(g, 0) >= 25} for g in groups],
            "semester": semester_dict(term) if term else None, "course_credits": course.credit_hours,
            "credits_used": used, "credits_limit": term.max_student_credits if term else None}

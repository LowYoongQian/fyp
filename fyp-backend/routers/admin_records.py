"""Paged record lists for the Academic Manager tabs (ACADEMIC-UX-12).

Each list is searched, ordered and cut into pages in the database (at most 50 rows a page), so a tab looks the same with ten records or
100,000. Each row carries what the admin needs to scan it (relationships, status and how many records a delete would affect). The answer
uses the shared record-page shape {items, total, page, per_page, stats}.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AcademicSemester, ClassSession, Course, CourseStaffAssignment, Enrolment, Lecturer, Programme, Student, User
from domain.semesters import semester_dict
from routers.admin_lookup import _pattern
from utils.security import require_admin

router = APIRouter(prefix="/admin/records", tags=["Admin Records"])

SEARCH = Query("", max_length=100)
PAGE = Query(1, ge=1, le=100000)
PER_PAGE = Query(10, ge=1, le=50)


def _page(query, page: int, per_page: int):
    total = query.order_by(None).count()
    last = max(1, -(-total // per_page))
    page = min(page, last)   # a page past the end (after a delete or a narrower search) shows the last real page
    return query.offset((page - 1) * per_page).limit(per_page).all(), total, page


def _match(*columns):
    return lambda term: or_(*(column.ilike(_pattern(term), escape="\\") for column in columns))


@router.get("/programmes")
def programme_records(search: str = SEARCH, page: int = PAGE, per_page: int = PER_PAGE,
                      db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    students = select(func.count(Student.id)).where(Student.programme_id == Programme.id).scalar_subquery()
    courses = select(func.count(Course.id)).where(Course.programme_id == Programme.id).scalar_subquery()
    query = db.query(Programme, students.label("students"), courses.label("courses"))
    if search.strip():
        query = query.filter(_match(Programme.code, Programme.name)(search.strip()))
    rows, total, page = _page(query.order_by(Programme.code, Programme.id), page, per_page)
    return {"items": [{"id": p.id, "code": p.code, "name": p.name, "student_count": s, "course_count": c} for p, s, c in rows],
            "total": total, "page": page, "per_page": per_page, "stats": {}}


@router.get("/courses")
def course_records(search: str = SEARCH, page: int = PAGE, per_page: int = PER_PAGE,
                   db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    enrolled = select(func.count(Enrolment.id)).where(Enrolment.course_id == Course.id).scalar_subquery()
    sessions = select(func.count(ClassSession.id)).where(ClassSession.course_id == Course.id).scalar_subquery()
    query = (db.query(Course, Programme.code, Programme.name, AcademicSemester, enrolled.label("enrolled"), sessions.label("sessions"))
             .outerjoin(Programme, Programme.id == Course.programme_id)
             .outerjoin(AcademicSemester, AcademicSemester.id == Course.semester_id))
    if search.strip():
        query = query.filter(_match(Course.course_code, Course.course_name, Programme.code, Programme.name)(search.strip()))
    rows, total, page = _page(query.order_by(Course.course_code, Course.id), page, per_page)
    # lecturer_id: the edit form sends it back unchanged (the course update replaces it, so leaving it out would clear it).
    return {"items": [{"id": c.id, "course_code": c.course_code, "course_name": c.course_name,
                       "lecturer_id": c.lecturer_id, "programme_id": c.programme_id, "programme_code": pcode, "programme_name": pname,
                       "semester": semester_dict(term) if term else None, "enrolment_count": e, "session_count": s}
                      for c, pcode, pname, term, e, s in rows],
            "total": total, "page": page, "per_page": per_page, "stats": {}}


@router.get("/assignments")
def assignment_records(search: str = SEARCH, page: int = PAGE, per_page: int = PER_PAGE,
                       db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Who teaches what, in which teaching role (the assignment's own role, never the staff account's generic role)."""
    assignment = CourseStaffAssignment
    columns = (assignment.lecturer_id, Lecturer.name, Lecturer.staff_id, assignment.course_id, Course.course_code, Course.course_name)
    query = (db.query(*columns).select_from(assignment)
             .join(Lecturer, Lecturer.id == assignment.lecturer_id)
             .join(Course, Course.id == assignment.course_id))
    if search.strip():
        query = query.filter(_match(Lecturer.name, Lecturer.staff_id, Course.course_code, Course.course_name, assignment.role)(search.strip()))
    rows, total, page = _page(query.group_by(*columns).order_by(Course.course_code, Lecturer.name, assignment.lecturer_id, assignment.course_id), page, per_page)
    groups = {(teacher, course): {"id": f"{teacher}:{course}", "lecturer_id": teacher, "lecturer_name": name, "staff_id": staff,
                                 "course_id": course, "course_code": code, "course_name": title, "roles": []}
              for teacher, name, staff, course, code, title in rows}
    if groups:
        roles = db.query(assignment).filter(tuple_(assignment.lecturer_id, assignment.course_id).in_(list(groups)))
        for role in roles.order_by(assignment.role):
            groups[role.lecturer_id, role.course_id]["roles"].append({"id": role.id, "role": role.role})
        # When the assignment applies (its course's semester and whether that is running), shown apart from what the person teaches.
        terms = dict(db.query(Course.id, AcademicSemester).join(AcademicSemester, AcademicSemester.id == Course.semester_id)
                     .filter(Course.id.in_({course for _, course in groups})))
        for (_, course), group in groups.items():
            group["semester"] = semester_dict(terms[course]) if course in terms else None
    return {"items": list(groups.values()),
            "total": total, "page": page, "per_page": per_page, "stats": {}}


@router.get("/students")
def student_records(search: str = SEARCH, page: int = PAGE, per_page: int = PER_PAGE,
                    db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Students with their programme and every course they are enrolled in, each marked by its semester's state, so a course kept from
    an ended semester is never shown as current."""
    query = db.query(Student, Programme.code, Programme.name).outerjoin(Programme, Programme.id == Student.programme_id)
    term = search.strip()
    if term:
        enrolled_match = (select(Enrolment.id).join(Course, Course.id == Enrolment.course_id)
                          .where(Enrolment.student_id == Student.id, _match(Course.course_code, Course.course_name)(term)).exists())
        query = query.outerjoin(User, User.id == Student.user_id).filter(
            or_(_match(Student.name, Student.student_code, User.email, Programme.code)(term), enrolled_match))
    rows, total, page = _page(query.order_by(Student.name, Student.id), page, per_page)
    ids = [s.id for s, _, _ in rows]
    courses = {}
    if ids:
        for e, code, cname, term_row in (db.query(Enrolment, Course.course_code, Course.course_name, AcademicSemester)
                                         .join(Course, Course.id == Enrolment.course_id)
                                         .outerjoin(AcademicSemester, AcademicSemester.id == Course.semester_id)
                                         .filter(Enrolment.student_id.in_(ids)).order_by(Course.course_code)):
            info = semester_dict(term_row) if term_row else None
            courses.setdefault(e.student_id, []).append({"id": e.id, "course_id": e.course_id, "course_code": code, "course_name": cname,
                                                         "class_group": e.class_group, "semester_name": info["name"] if info else e.semester,
                                                         "status": info["status"] if info else "undated"})
    return {"items": [{"id": s.id, "name": s.name, "student_code": s.student_code, "programme_id": s.programme_id, "programme_code": pcode,
                       "programme_name": pname, "enrolments": courses.get(s.id, [])} for s, pcode, pname in rows],
            "total": total, "page": page, "per_page": per_page, "stats": {}}

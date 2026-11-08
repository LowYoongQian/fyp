"""Admin calendar settings and role-scoped read-only timetable metadata."""
from datetime import date
from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, joinedload

from db.database import get_db
from db.models import AcademicSemester, ClassSession, Course, Enrolment, Lecturer, Programme, Student, User
from domain import semester_rollover, timetable_access
from domain.audit import log_audit_event
from domain.semesters import campus_date, lock_programme, semester_dict, validate_credit_loads
from utils.db_helpers import my_course_ids, require_own_profile
from utils.security import get_current_user, require_admin
from utils.timeutil import campus_now, iso_utc, utcnow

router = APIRouter(tags=["Academic Calendar"])


class SemesterWrite(BaseModel):
    programme_id: UUID
    name: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date
    max_student_credits: float = Field(gt=0, le=60, allow_inf_nan=False)
    course_ids: list[UUID] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def valid_dates(self):
        self.name = self.name.strip()
        if not self.name or self.end_date < self.start_date:
            raise ValueError("Provide a semester name and an end date on or after its start date")
        if (self.end_date - self.start_date).days > 730:
            raise ValueError("A semester cannot exceed two years")
        return self


@router.get("/academic-calendar")
def read_calendar(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Course)
    if current_user.role == "student":
        student = require_own_profile(db, Student, current_user.id, "Student")
        query = query.join(Enrolment).filter(Enrolment.student_id == student.id)
    elif current_user.role == "lecturer":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        query = query.filter(Course.id.in_(my_course_ids(db, lecturer.id)))
    elif current_user.role != "admin":
        raise HTTPException(403, "Not authorized to view academic calendar")
    return {"server_time": iso_utc(utcnow()), "timezone": "Asia/Kuala_Lumpur", "courses": [
        {"course_id": c.id, "course_code": c.course_code, "semester": semester_dict(c.semester) if c.semester_id else None,
         "programme": {"code": c.programme.code, "name": c.programme.name} if c.programme else None}
        for c in query.options(joinedload(Course.semester), joinedload(Course.programme)).all()]}


@router.get("/timetable/semesters")
def list_timetable_semesters(programme_id: Optional[UUID] = Query(None), course_id: Optional[UUID] = Query(None),
                             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The caller's own upcoming, current and previous semesters, each with whether its timetable may be opened and why not.

    An admin must choose a programme and one of its courses first and gets only that course's semester; students and staff send no filter."""
    return timetable_access.list_semesters(db, current_user, timetable_access.scope_course(db, current_user, programme_id, course_id))


@router.get("/timetable/semesters/{semester_id}")
def open_timetable_semester(semester_id: UUID, programme_id: Optional[UUID] = Query(None), course_id: Optional[UUID] = Query(None),
                            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Re-validates one semester: 404 outside the caller's scope (or, for an admin, not the chosen course's), 403 with the reason unless it is current."""
    course = timetable_access.scope_course(db, current_user, programme_id, course_id)
    semester = timetable_access.require_viewable_semester(db, current_user, str(semester_id), course)
    return timetable_access.semester_summary(db, current_user, semester, course)


@router.get("/timetable/meetings/{meeting_id}/semester")
def semester_of_meeting(meeting_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Which semester a class belongs to (for notices), only for classes in the caller's own scope; its state says whether it may be opened."""
    row = timetable_access.meeting_semester(db, current_user, str(meeting_id))
    if row is None:
        raise HTTPException(404, "That class is not available to you.")
    return row


class RolloverPreview(BaseModel):
    source_semester_id: UUID
    target_semester_id: UUID
    course_ids: Optional[list[UUID]] = Field(default=None, max_length=500)


@router.post("/admin/semesters/rollover-preview")
def preview_rollover(body: RolloverPreview, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Read-only: what carrying the source semester's courses into the target would retain, copy and leave out, and what is missing. Writes nothing."""
    return semester_rollover.build_preview(db, str(body.source_semester_id), str(body.target_semester_id),
                                           None if body.course_ids is None else [str(value) for value in body.course_ids])


@router.get("/admin/semesters")
def list_semesters(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    courses = db.query(Course.id, Course.semester_id).filter(Course.semester_id.isnot(None)).all()
    return [{**semester_dict(s), "course_ids": [cid for cid, sid in courses if sid == s.id]}
            for s in db.query(AcademicSemester).order_by(AcademicSemester.start_date.desc()).all()]


def save_semester(db, user, body, semester_id=None):
    programme = db.get(Programme, str(body.programme_id))
    if not programme:
        raise HTTPException(400, "Selected programme does not exist")
    lock_programme(db, programme.id)
    row = db.get(AcademicSemester, semester_id) if semester_id else AcademicSemester(programme_id=programme.id)
    if row is None:
        raise HTTPException(404, "Semester not found")
    if row.programme_id != programme.id:
        raise HTTPException(400, "A saved semester cannot be moved to another programme")
    # Scheduling is forward-looking: a newly chosen date may not be in the past (Malaysia time). A saved past date that
    # is left unchanged stays valid, so an unrelated edit of an active or past semester is never blocked.
    today = campus_now().date()
    for label, chosen, stored in (("start", body.start_date, row.start_date), ("end", body.end_date, row.end_date)):
        if chosen < today and chosen != stored:
            raise HTTPException(400, f"The semester {label} date cannot be before today ({today}, Malaysia time).")
    if db.query(AcademicSemester).filter(AcademicSemester.programme_id == programme.id,
            AcademicSemester.name == body.name, AcademicSemester.id != row.id).first():
        raise HTTPException(409, "This programme already has a semester with this name")
    if db.query(AcademicSemester.id).filter(AcademicSemester.programme_id == programme.id,
            AcademicSemester.id != row.id, AcademicSemester.start_date <= body.end_date,
            AcademicSemester.end_date >= body.start_date).first():
        raise HTTPException(409, "Semester dates cannot overlap another semester in this programme")
    ids = {str(value) for value in body.course_ids}
    courses = db.query(Course).filter(Course.id.in_(ids)).all()
    if len(courses) != len(ids) or any(c.programme_id != programme.id for c in courses):
        raise HTTPException(400, "Select existing courses from this programme only")
    if any(c.semester_id and c.semester_id != row.id for c in courses):
        raise HTTPException(409, "A course already belongs to another semester; keep its history and create a separate course offering instead")
    assigned = db.query(Course).filter(Course.semester_id == row.id).all() if row.id else []
    if any(c.id not in ids for c in assigned):
        raise HTTPException(409, "Previously assigned courses cannot be detached from their semester history")
    for lesson in db.query(ClassSession).filter(ClassSession.course_id.in_(ids), ClassSession.is_open.is_(True)).all():
        start, end = lesson.scheduled_start or lesson.opened_at, lesson.scheduled_end or lesson.opened_at
        if not start or not end or not (body.start_date <= campus_date(start) <= campus_date(end) <= body.end_date):
            raise HTTPException(409, "Close the open class before changing semester dates to exclude its attendance window")
    validate_credit_loads(db, courses, body.max_student_credits)
    before = semester_dict(row) if row.id else None
    row.name, row.start_date, row.end_date = body.name, body.start_date, body.end_date
    row.max_student_credits = body.max_student_credits
    db.add(row); db.flush()
    for course in courses:
        course.semester_id = row.id
    log_audit_event(db, user_id=user.id, user_name=user.profile_name or user.email, user_role="admin",
        category="admin", action="UPDATE_SEMESTER" if before else "CREATE_SEMESTER",
        details=f"before={before}; after={semester_dict(row)}; courses={sorted(ids)}", commit=False)
    db.commit()
    return {**semester_dict(row), "course_ids": sorted(ids)}


@router.post("/admin/semesters", status_code=201)
def create_semester(body: SemesterWrite, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return save_semester(db, current_user, body)


@router.put("/admin/semesters/{semester_id}")
def update_semester(semester_id: UUID, body: SemesterWrite, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return save_semester(db, current_user, body, str(semester_id))


@router.delete("/admin/semesters/{semester_id}")
def delete_semester(semester_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Removes a semester, ongoing ones included. Its courses are kept with their students, classes and attendance; they only
    leave the semester (so its dates and credit limit stop applying), which then lets the admin delete them or the programme."""
    row = db.get(AcademicSemester, str(semester_id))
    if row is None:
        raise HTTPException(404, "Semester not found")
    lock_programme(db, row.programme_id)
    courses = db.query(Course).filter(Course.semester_id == row.id).all()
    if courses and db.query(ClassSession.id).filter(ClassSession.course_id.in_([c.id for c in courses]),
                                                    ClassSession.is_open.is_(True)).first():
        raise HTTPException(409, "A class in this semester is open for check-in; close it before deleting the semester")
    before = semester_dict(row)
    for course in courses:
        course.semester_id = None
    db.flush()
    db.delete(row)
    log_audit_event(db, user_id=current_user.id, user_name=current_user.profile_name or current_user.email, user_role="admin",
        category="admin", action="DELETE_SEMESTER",
        details=f"semester={before}; detached courses={sorted(c.course_code for c in courses)}", commit=False)
    db.commit()
    return {"message": f"{before['name']} was deleted", "detached_courses": len(courses)}

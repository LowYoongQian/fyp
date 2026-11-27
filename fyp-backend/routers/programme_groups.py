"""Programme groups across semesters (GROUP-ROLLOVER-01) and the smallest staff permission for course groups (ENROL-MORE-01)."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Course, Enrolment, Lecturer, User
from domain import programme_groups as groups
from domain.audit import log_admin_action
from domain.risk_access import teaches_group
from domain.scheduler import groups_for_course
from domain.semesters import run_transaction
from routers.admin_academic import enrol_student
from utils.db_helpers import my_course_ids, require_own_profile
from utils.security import get_current_user, require_admin, require_lecturer

router = APIRouter(tags=["Programme Groups"])


class GroupPreview(BaseModel):
    source_semester_id: UUID
    target_semester_id: UUID


class GroupPlanRow(BaseModel):
    student_id: UUID
    class_group: str = Field(min_length=2, max_length=16)


class GroupPlan(BaseModel):
    rows: list[GroupPlanRow] = Field(max_length=2000)


class GroupChange(BaseModel):
    class_group: str = Field(min_length=2, max_length=16)
    dry_run: bool = False


class StaffEnrolment(BaseModel):
    student_id: UUID
    course_id: UUID
    class_group: str = Field(min_length=2, max_length=16)


@router.post("/admin/semesters/group-preview")
def preview_groups(body: GroupPreview, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Read-only: who returns to which group, who is new and where they would go, and who needs a person to decide."""
    return groups.build_group_preview(db, body.source_semester_id, body.target_semester_id)


@router.post("/admin/semesters/{semester_id}/groups")
def save_groups(semester_id: UUID, body: GroupPlan, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return groups.apply_group_plan(db, current_user, semester_id, [row.model_dump() for row in body.rows])


@router.get("/admin/semesters/{semester_id}/groups")
def group_roster(semester_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return groups.roster(db, groups.semester_or_404(db, semester_id))


@router.put("/admin/semesters/{semester_id}/groups/{student_id}")
def place_in_group(semester_id: UUID, student_id: UUID, body: GroupChange, db: Session = Depends(get_db),
                   current_user: User = Depends(require_admin)):
    """Programme scope: the student's group for the semester, and their courses that followed the old group."""
    return groups.move_programme_group(db, current_user, semester_id, student_id, body.class_group, body.dry_run)


@router.delete("/admin/semesters/{semester_id}/groups/{student_id}")
def remove_from_group(semester_id: UUID, student_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return groups.remove_programme_group(db, current_user, semester_id, student_id)


@router.put("/enrolments/{enrolment_id}/group")
def move_course_group(enrolment_id: UUID, body: GroupChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Course scope: one enrolment to another group of that course. Admins anywhere; staff only in courses they teach, into a group that exists."""
    if current_user.role == "admin":
        allowed = None
    elif current_user.role == "lecturer":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        allowed = my_course_ids(db, lecturer.id)
        enrolment = db.get(Enrolment, str(enrolment_id))
        target = groups.valid_group(body.class_group)
        if enrolment is not None and not (teaches_group(db, lecturer.id, enrolment.course_id, enrolment.class_group)
                                          and teaches_group(db, lecturer.id, enrolment.course_id, target)):
            raise HTTPException(403, "You can only move students between groups you teach.")
    else:
        raise HTTPException(403, "Lecturer or Admin permission required")
    return groups.move_course_group(db, current_user, enrolment_id, body.class_group, body.dry_run, allowed)


@router.post("/lecturers/me/enrolments")
def staff_add_course(body: StaffEnrolment, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    """Staff add one of their own courses for a student already in that course's programme semester, into an existing group.
    Never assigns or changes a programme, never opens a group. The same enrolment transaction the admin allocation uses."""
    if current_user.role != "lecturer":
        raise HTTPException(403, "Administrators use Student Allocation.")
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    course = db.get(Course, str(body.course_id))
    if course is None or course.id not in set(my_course_ids(db, lecturer.id)):
        raise HTTPException(403, "You can only add students to courses you teach.")
    group = groups.valid_group(body.class_group)
    if not teaches_group(db, lecturer.id, course.id, group):
        raise HTTPException(403, "You can only add students to groups you teach.")
    student_id = str(body.student_id)

    def work():
        existing = db.query(Enrolment).filter_by(student_id=student_id, course_id=course.id).first()
        if existing:
            if existing.class_group != group:
                raise HTTPException(409, f"This student is already in {course.course_code} group {existing.class_group}.")
            return {"enrolled": False}
        semester = course.semester
        placed, conflicts = groups.memberships(db, semester) if semester else ({}, {})
        if student_id not in placed and student_id not in conflicts:
            raise HTTPException(403, "This student has no group or course in this course's semester yet; ask an administrator.")
        if group not in groups_for_course(db, course.id):
            raise HTTPException(403, f"{course.course_code} has no group {group} yet; only an administrator can open a new group.")
        student, _, term_name = enrol_student(db, student_id, course.id, None, group)
        log_admin_action(db, current_user, "CREATE_ENROLMENT", f"Enrolled {student.student_code} in {course.course_code} ({group}, {term_name})", commit=False)
        return {"enrolled": True}
    result = run_transaction(db, work)
    return {**result, "message": "Course added" if result["enrolled"] else "This course was already added"}

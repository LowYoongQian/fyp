from datetime import timedelta

from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from db.database import get_db
from domain import timetable_access
from domain.attendance import require_no_attendance_history
from domain.audit import log_admin_action
from domain.scheduler import (DAY_END_MIN, DAY_START_MIN, TIMES, add_missing_meetings, conflicting_meetings, groups_for_course,
                              lecturer_slot_conflict, lecture_meetings, meeting_key_for, pick_slot_for_new)
from domain.session_sync import sync_class_sessions
from db.models import User, Student, Lecturer, Course, Enrolment, Programme, AcademicSemester, CourseStaffAssignment, RiskScore, Alert, ClassSession, AttendanceRecord, ClassMeeting
from domain.semesters import lock_programme, lock_programmes, enrolment_semester, run_transaction, semester_dict
from utils.security import require_admin, require_lecturer
from utils.db_helpers import get_or_404, ensure_unique
from utils.timeutil import campus_now, local_offset, utcnow
from schemas import (
    MessageResponse,
    ProgrammeCreate, ProgrammeResponse,
    CourseCreate, CourseResponse,
    AssignmentCreate, AssignmentBatchCreate, AssignmentResponse, AssignmentRolesUpdate, StaffRole
)

router = APIRouter(prefix="/admin", tags=["Admin Academic"])

# =====================================================================
# PROGRAMMES CRUD
# =====================================================================

@router.get("/programmes", response_model=List[dict])
def get_programmes(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programmes = db.query(Programme).all()
    return [{"id": p.id, "name": p.name, "code": p.code} for p in programmes]

@router.post("/programmes", response_model=ProgrammeResponse, status_code=201)
def create_programme(body: ProgrammeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    ensure_unique(db, Programme, Programme.code, body.code, detail="Programme code already exists")
    programme = Programme(name=body.name, code=body.code)
    db.add(programme)
    db.commit()
    db.refresh(programme)

    log_admin_action(db, current_user, "CREATE_PROGRAMME",
                     f"Created programme {body.name} ({body.code})")

    return programme

@router.put("/programmes/{programme_id}", response_model=ProgrammeResponse)
def update_programme(programme_id: str, body: ProgrammeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = get_or_404(db, Programme, programme_id, "Programme")
    
    ensure_unique(db, Programme, Programme.code, body.code, exclude_id=programme_id, detail="Programme code already exists")
        
    changed = []
    if body.name != programme.name:
        changed.append(f"name {programme.name} -> {body.name}")
    if body.code != programme.code:
        changed.append(f"code {programme.code} -> {body.code}")

    programme.name = body.name
    programme.code = body.code
    db.commit()
    db.refresh(programme)

    log_admin_action(db, current_user, "UPDATE_PROGRAMME",
                     f"Updated programme {programme.code}: "
                     f"{', '.join(changed) if changed else 'no changes'}")

    return programme

@router.delete("/programmes/{programme_id}", response_model=MessageResponse)
def delete_programme(programme_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = get_or_404(db, Programme, programme_id, "Programme")
    # An ongoing semester protects its programme until the admin deletes that semester; upcoming and ended ones go with it.
    terms = db.query(AcademicSemester).filter(AcademicSemester.programme_id == programme.id).all()
    ongoing = next((t for t in terms if semester_dict(t)["status"] == "active"), None)
    if ongoing:
        raise HTTPException(409, f"{programme.code} has the ongoing semester {ongoing.name}. Delete that semester first "
                                 "(Academics → Semesters), then delete the programme.")

    # Read before the delete makes them unavailable.
    deleted_desc = f"{programme.name} ({programme.code})"

    term_names = sorted(t.name for t in terms)
    if terms:
        db.query(Course).filter(Course.semester_id.in_([t.id for t in terms])).update({Course.semester_id: None}, synchronize_session=False)
        for term in terms:
            db.delete(term)
        db.flush()
    detached_students = db.query(Student).filter(Student.programme_id == programme_id).update({Student.programme_id: None})
    detached_courses = db.query(Course).filter(Course.programme_id == programme_id).update({Course.programme_id: None})

    db.delete(programme)
    db.commit()

    log_admin_action(db, current_user, "DELETE_PROGRAMME",
                     f"Deleted programme {deleted_desc}; detached "
                     f"{detached_students} student(s) and {detached_courses} course(s); "
                     f"removed semester(s): {', '.join(term_names) or 'none'}")

    return {"message": "Programme deleted successfully"}


# =====================================================================
# COURSES CRUD
# =====================================================================

@router.get("/courses", response_model=List[dict])
def get_courses(programme_id: Optional[UUID] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Every course, or with programme_id only that programme's courses (the timetable page picks a course from one programme)."""
    query = db.query(Course).options(
        joinedload(Course.lecturer),
        joinedload(Course.programme),
        joinedload(Course.semester)
    )
    if programme_id:
        query = query.filter(Course.programme_id == str(programme_id))
    courses = query.all()
    # Lecture times come from class_meetings (source of truth), not the dead
    # Course.schedule_* columns.
    lecture_by_course = lecture_meetings(db, [c.id for c in courses])
    result = []
    for c in courses:
        m = lecture_by_course.get(c.id)
        result.append({
            "id": c.id,
            "course_name": c.course_name,
            "course_code": c.course_code,
            "semester_id": c.semester_id,
            "semester": semester_dict(c.semester) if c.semester_id else None,
            "lecturer_id": c.lecturer_id,
            "lecturer_name": c.lecturer.name if c.lecturer else None,
            "programme_id": c.programme_id,
            "programme_name": c.programme.name if c.programme else None,
            **timetable_access.lecture_slot(c, m),
        })
    return result

@router.post("/courses", response_model=CourseResponse, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    ensure_unique(db, Course, Course.course_code, body.course_code, detail="Course code already exists")

    # Validate foreign keys up front so a bad id returns a clear 400 instead of
    # a database IntegrityError surfacing as an opaque 500.
    if body.lecturer_id is not None and \
       not db.query(Lecturer).filter(Lecturer.id == body.lecturer_id).first():
        raise HTTPException(status_code=400, detail="Selected lecturer does not exist")
    if body.programme_id is not None and \
       not db.query(Programme).filter(Programme.id == body.programme_id).first():
        raise HTTPException(status_code=400, detail="Selected programme does not exist")

    course = Course(
        course_name=body.course_name,
        course_code=body.course_code,
        lecturer_id=body.lecturer_id,
        programme_id=body.programme_id,
    )
    db.add(course)
    db.flush()  # assign course.id

    # Auto-assign a clash-free slot for this course's Lecture and record it in
    # class_meetings (the timetable source of truth). No free slot -> 400.
    try:
        slot = pick_slot_for_new(db, course.id, course.lecturer_id, "Lecture")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.add(ClassMeeting(
        meeting_key=meeting_key_for("Lecture", course.id, None),
        course_id=course.id, assignment_id=None,
        role="Lecture", lecturer_id=course.lecturer_id, **slot,
    ))

    db.commit()
    db.refresh(course)

    log_admin_action(db, current_user, "CREATE_COURSE",
                     f"Created course {body.course_name} ({body.course_code}), "
                     f"lecture {slot['day']} {slot['start']}-{slot['end']} in {slot['room']}")

    return course

@router.put("/courses/{course_id}", response_model=CourseResponse)
def update_course(course_id: str, body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = get_or_404(db, Course, course_id, "Course")
    lock_programme(db, course.programme_id)
    db.refresh(course)
    if course.semester_id:
        if body.programme_id != course.programme_id:
            raise HTTPException(409, "A semester course cannot be moved to another programme")

    ensure_unique(db, Course, Course.course_code, body.course_code, exclude_id=course_id, detail="Course code already exists")

    # Validate foreign keys up front (see create_course) — clear 400, not a 500.
    if body.lecturer_id is not None and \
       not db.query(Lecturer).filter(Lecturer.id == body.lecturer_id).first():
        raise HTTPException(status_code=400, detail="Selected lecturer does not exist")
    if body.programme_id is not None and \
       not db.query(Programme).filter(Programme.id == body.programme_id).first():
        raise HTTPException(status_code=400, detail="Selected programme does not exist")

    changed = []
    for field, new in (
        ("course_name", body.course_name), ("course_code", body.course_code),
        ("lecturer_id", body.lecturer_id),
        ("programme_id", body.programme_id),
    ):
        old = getattr(course, field)
        if old != new:
            changed.append(f"{field} {old} -> {new}")

    course.course_name = body.course_name
    course.course_code = body.course_code
    course.lecturer_id = body.lecturer_id
    course.programme_id = body.programme_id

    # Timetable times live in class_meetings, not on the course. Keep the
    # Lecture meeting's lecturer in sync so clash detection stays correct.
    # Matched on the course_id foreign key, not the meeting_key string: seeded
    # rows still carry pre-UUID keys ("Lecture-8"), so a string match silently
    # found nothing and left the meeting pointing at the previous lecturer.
    lecture_meeting = db.query(ClassMeeting).filter(
        ClassMeeting.course_id == course.id,
        ClassMeeting.role == "Lecture",
    ).first()
    if lecture_meeting:
        lecture_meeting.lecturer_id = body.lecturer_id

    db.commit()
    db.refresh(course)

    log_admin_action(db, current_user, "UPDATE_COURSE",
                     f"Updated course {course.course_code}: "
                     f"{', '.join(changed) if changed else 'no changes'}")

    return course

@router.delete("/courses/{course_id}", response_model=MessageResponse)
def delete_course(course_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = get_or_404(db, Course, course_id, "Course")
    if course.semester_id and semester_dict(course.semester)["status"] == "active":
        raise HTTPException(409, f"{course.course_code} is in the ongoing semester {course.semester.name}. Delete that semester "
                                 "first (Academics → Semesters), then delete the course.")

    # Read before the cascade deletes make them unavailable.
    deleted_desc = f"{course.course_name} ({course.course_code})"

    dropped_enrolments = db.query(Enrolment).filter(Enrolment.course_id == course_id).delete()
    db.query(RiskScore).filter(RiskScore.course_id == course_id).delete()
    db.query(Alert).filter(Alert.course_id == course_id).delete()

    sessions = db.query(ClassSession).filter(ClassSession.course_id == course_id).all()
    for s in sessions:
        db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).delete()
        db.delete(s)

    db.delete(course)
    db.commit()

    log_admin_action(db, current_user, "DELETE_COURSE",
                     f"Deleted course {deleted_desc}, {dropped_enrolments} enrolment(s), "
                     f"{len(sessions)} session(s) and all related records")

    return {"message": "Course deleted successfully"}


# =====================================================================
# COURSE STAFF ASSIGNMENTS CRUD
# =====================================================================

@router.get("/assignments", response_model=List[dict])
def get_assignments(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    assignments = db.query(CourseStaffAssignment).options(
        joinedload(CourseStaffAssignment.course),
        joinedload(CourseStaffAssignment.lecturer)
    ).all()
    result = []
    for a in assignments:
        result.append({
            "id": a.id,
            "course_id": a.course_id,
            "course_code": a.course.course_code if a.course else "Unknown",
            "course_name": a.course.course_name if a.course else "Unknown",
            "lecturer_id": a.lecturer_id,
            "lecturer_name": a.lecturer.name if a.lecturer else "Unknown",
            "role": a.role
        })
    return result

@router.post("/assignments", response_model=AssignmentResponse, status_code=201)
def create_assignment(body: AssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return save_assignment_roles(db, current_user, body.course_id, body.lecturer_id, [body.role], single=True)[0]


@router.post("/assignments/batch", response_model=list[AssignmentResponse], status_code=201)
def create_assignments(body: AssignmentBatchCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return save_assignment_roles(db, current_user, str(body.course_id), str(body.lecturer_id), [role.value for role in body.roles])


def _lock_course_and_lecturer(db, course_id, lecturer_id):
    course = db.query(Course).filter_by(id=str(course_id)).with_for_update().first()
    if not course:
        raise HTTPException(400, "Selected course does not exist")
    lecturer = db.query(Lecturer).filter_by(id=str(lecturer_id)).with_for_update().first()
    if not lecturer:
        raise HTTPException(404, "Lecturer not found")
    return course, lecturer


def _add_role(db, user, course, lecturer, role, single=False):
    """Give one staff member one teaching role in one course, inside the caller's transaction (never commits). A role already held
    is returned unchanged, so a retry adds nothing."""
    course_id, lecturer_id = course.id, lecturer.id
    row = db.query(CourseStaffAssignment).filter_by(course_id=course_id, lecturer_id=lecturer_id, role=role).first()
    if row and single:
        raise HTTPException(400, "Staff already assigned to this course in this role")
    if role == "Lecturer":
        if course.lecturer_id and course.lecturer_id != lecturer_id:
            raise HTTPException(409, "The Lecture already has a different lecturer. Remove that allocation first.")
        for lecture in db.query(ClassMeeting).filter_by(course_id=course_id, role="Lecture").all():
            if lecture.lecturer_id != lecturer_id:
                conflict = lecturer_slot_conflict(db, lecture, lecturer_id)
                if conflict:
                    raise HTTPException(409, f"This lecturer already teaches another class on {conflict.day} during {conflict.start}-{conflict.end}.")
                lecture.lecturer_id = lecturer_id
        course.lecturer_id = lecturer_id
    if row is None:
        if role == "Tutor" and db.query(CourseStaffAssignment.id).filter_by(course_id=course_id, role=role).first():
            raise HTTPException(409, f"Another staff member already teaches {role} for this course's groups.")
        row = CourseStaffAssignment(course_id=course_id, lecturer_id=lecturer_id, role=role)
        db.add(row)
        db.flush()
        if role in ("Tutor", "Practical"):
            try:
                add_missing_meetings(db, course_id, [row], groups_for_course(db, course_id))
            except ValueError as error:
                raise HTTPException(400, str(error)) from error
        log_admin_action(db, user, "CREATE_ASSIGNMENT", f"Assigned {lecturer.name} as {role} for {course.course_code}", commit=False)
    return row


def _role_meetings(db, assignment):
    """The timetable slots that leave with this role: a Tutor's or Practical's own group meetings (the database deletes them with the
    assignment). A Lecturer's lecture is never deleted; it stays on the timetable without a lecturer."""
    if assignment.role == "Lecturer":
        return []
    return db.query(ClassMeeting).filter(ClassMeeting.assignment_id == assignment.id).order_by(ClassMeeting.class_group).all()


def role_impact(db, assignments) -> dict:
    """What removing these roles would change, read before anything is deleted."""
    meetings = [m for a in assignments for m in _role_meetings(db, a)]
    meeting_ids = [m.id for m in meetings]
    sessions = db.query(ClassSession).filter(ClassSession.meeting_id.in_(meeting_ids)).all() if meeting_ids else []
    completed = [s.id for s in sessions if s.status == "completed"]
    records = db.query(func.count(AttendanceRecord.id)).filter(AttendanceRecord.session_id.in_(completed)).scalar() if completed else 0
    open_now = sum(1 for s in sessions if s.status == "open")
    lectures_kept = sum(1 for a in assignments if a.role == "Lecturer"
                        and db.query(ClassMeeting.id).filter_by(course_id=a.course_id, role="Lecture", lecturer_id=a.lecturer_id).first())
    return {
        "roles": [a.role for a in assignments],
        "slots_removed": [{"role": m.role, "class_group": m.class_group, "day": m.day, "start": m.start, "end": m.end, "room": m.room} for m in meetings],
        "lectures_left_without_lecturer": lectures_kept,
        "completed_classes_kept": len(completed),
        "attendance_records_kept": records,
        "classes_in_progress": open_now,
        "blocked": open_now > 0,
    }


def _remove_role(db, user, assignment):
    """Remove one teaching role inside the caller's transaction. Completed classes and attendance are kept (their sessions only lose the
    link to the deleted slot); other staff members' roles are never touched. Refused while one of its classes is in progress."""
    if role_impact(db, [assignment])["blocked"]:
        raise HTTPException(409, f"A {assignment.role.lower()} class is in progress. Remove this role after it ends.")
    course = assignment.course
    if assignment.role == "Lecturer" and course.lecturer_id == assignment.lecturer_id:
        course.lecturer_id = None
        db.query(ClassMeeting).filter_by(course_id=assignment.course_id, role="Lecture",
                                         lecturer_id=assignment.lecturer_id).update({"lecturer_id": None})
    description = (f"{assignment.lecturer.name if assignment.lecturer else assignment.lecturer_id} as {assignment.role} for "
                   f"{course.course_code if course else assignment.course_id}")
    db.delete(assignment)
    log_admin_action(db, user, "DELETE_ASSIGNMENT", f"Unassigned {description}", commit=False)


def save_assignment_roles(db, user, course_id, lecturer_id, roles, single=False):
    def work():
        course, lecturer = _lock_course_and_lecturer(db, course_id, lecturer_id)
        return [_add_role(db, user, course, lecturer, role, single) for role in dict.fromkeys(roles)]
    return run_transaction(db, work)


@router.get("/assignments/impact")
def assignment_impact(course_id: UUID, lecturer_id: UUID, roles: List[StaffRole] = Query(..., max_length=3),
                      db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Read-only: what removing these roles of one staff member in one course would change, for the confirmation."""
    wanted = [role.value for role in roles]
    rows = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == str(course_id), CourseStaffAssignment.lecturer_id == str(lecturer_id),
                                                  CourseStaffAssignment.role.in_(wanted)).all()
    if not rows:
        raise HTTPException(404, "That teaching role was not found.")
    return role_impact(db, rows)


@router.put("/assignments/roles", response_model=list[AssignmentResponse])
def update_assignment_roles(body: AssignmentRolesUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Set exactly which roles one staff member holds in one course, in one transaction: if any added role conflicts, nothing changes.
    An empty list removes the assignment."""
    wanted = list(dict.fromkeys(role.value for role in body.roles))

    def work():
        course, lecturer = _lock_course_and_lecturer(db, body.course_id, body.lecturer_id)
        held = db.query(CourseStaffAssignment).filter_by(course_id=course.id, lecturer_id=lecturer.id).all()
        if not held and not wanted:
            raise HTTPException(404, "That assignment was not found.")
        for assignment in held:
            if assignment.role not in wanted:
                _remove_role(db, current_user, assignment)
        db.flush()
        return [_add_role(db, current_user, course, lecturer, role) for role in wanted]
    return run_transaction(db, work)


@router.delete("/assignments/{assignment_id}", response_model=MessageResponse)
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    def work():
        assignment = db.query(CourseStaffAssignment).filter_by(id=assignment_id).with_for_update().first()
        if assignment is None:
            raise HTTPException(404, "Assignment not found")
        _remove_role(db, current_user, assignment)
    run_transaction(db, work)
    return {"message": "Assignment deleted successfully"}


@router.get("/timetable", response_model=List[dict])
def get_global_timetable(semester_id: UUID = Query(...), programme_id: UUID = Query(...), course_id: Optional[UUID] = Query(None),
                         db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Read the class_meetings table (source of truth). meeting_id lets the admin UI edit a specific slot. One programme's courses in one
    # semester (or just one of them), and only the current semester: programme, course and semester must belong together, so no id can
    # widen the read beyond the chosen programme. Each course stays its own record; a course with no meetings simply has no rows here.
    programme, course = timetable_access.scope_timetable(db, current_user, programme_id, course_id)
    semester = timetable_access.require_viewable_semester(db, current_user, str(semester_id), course, programme)
    course_ids = [course.id] if course is not None else [
        cid for (cid,) in db.query(Course.id).filter(Course.programme_id == programme.id, Course.semester_id == semester.id)]
    meetings = db.query(ClassMeeting).filter(ClassMeeting.course_id.in_(course_ids)).options(
        joinedload(ClassMeeting.course), joinedload(ClassMeeting.lecturer)
    ).all() if course_ids else []
    result = []
    for m in meetings:
        c = m.course
        result.append({
            "meeting_id": m.id,
            "id": m.id,
            "course_id": m.course_id,
            "semester_id": semester.id,
            "course_code": c.course_code if c else "Unknown",
            "course_name": c.course_name if c else "Unknown",
            "schedule_day": m.day,
            "programme_id": c.programme_id if c else None,
            "programme_name": c.programme.name if c and c.programme else None,
            "schedule_start": m.start,
            "schedule_end": m.end,
            "schedule_room": m.room,
            "lecturer_name": m.lecturer.name if m.lecturer else "TBA",
            "role": m.role,
            # Required by the admin UI: tutorial/practical rows are group-specific.
            # Hiding this made G1 and G2 cards look identical and admins edited the
            # wrong group while the mobile app correctly filtered it back out.
            "class_group": m.class_group,
        })
    return result


class TimetableSlotUpdate(BaseModel):
    day: str
    start: str
    end: str
    room: str


@router.put("/timetable/{meeting_id}", response_model=MessageResponse)
def update_timetable_slot(meeting_id: str, body: TimetableSlotUpdate,
                          db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    meeting = db.query(ClassMeeting).filter_by(id=meeting_id).with_for_update().first()
    if meeting is None:
        raise HTTPException(404, "Timetable slot not found")

    def _to_min(hhmm: str) -> int:
        try:
            h, m = hhmm.split(":")
            v = int(h) * 60 + int(m)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail=f"Invalid time '{hhmm}', expected HH:MM")
        if f"{int(h):02d}:{int(m):02d}" != hhmm:
            raise HTTPException(status_code=400, detail=f"Invalid time '{hhmm}', expected 24-hour HH:MM")
        if not (0 <= int(h) < 24 and 0 <= int(m) < 60):
            raise HTTPException(status_code=400, detail=f"Time '{hhmm}' out of range")
        return v

    new_start, new_end = _to_min(body.start), _to_min(body.end)
    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # The teaching day the generator allocates in, and the only range the
    # timetable grid can draw. Accepting 02:00 here put a class where no UI can
    # show it. Only the NEW values are checked — an already-stored out-of-range
    # row must stay editable so an admin can move it back in.
    if new_start < DAY_START_MIN or new_end > DAY_END_MIN:
        raise HTTPException(status_code=400,
            detail=f"Class times must fall within the {TIMES[0][0]}-{TIMES[-1][1]} teaching day")

    time_changed = (meeting.day, meeting.start, meeting.end) != (body.day, body.start, body.end)
    if time_changed:
        local = campus_now()
        midnight = local.replace(hour=0, minute=0, second=0, microsecond=0) - local_offset()
        session_start = func.coalesce(ClassSession.scheduled_start, ClassSession.opened_at)
        generated = db.query(ClassSession.id).filter(
            ClassSession.meeting_id == meeting.id, session_start >= midnight,
            session_start < midnight + timedelta(days=1)).first()
        term = meeting.course.semester
        in_window = (meeting.day == local.strftime("%A") and meeting.start <= local.strftime("%H:%M") < meeting.end
                     and (term is None or term.start_date <= local.date() <= term.end_date))
        if generated or in_window:
            raise HTTPException(409, "Today's class has already been generated or is in progress. Its day and times must stay fixed; edit the weekly slot on another day.")

    # Clash check against every OTHER meeting on the same day. Two classes clash
    # when their time ranges OVERLAP (not just when identical): [a,b) overlaps
    # [c,d) iff a < d and c < b. No shared room, no double-booked lecturer.
    others = conflicting_meetings(db, meeting.course).filter(ClassMeeting.id != meeting_id, ClassMeeting.day == body.day).all()
    for o in others:
        if not (new_start < _to_min(o.end) and _to_min(o.start) < new_end):
            continue  # no time overlap
        if o.room == body.room:
            raise HTTPException(status_code=400,
                detail=f"Room {body.room} is already booked on {body.day} during {o.start}-{o.end}")
        if meeting.lecturer_id and o.lecturer_id == meeting.lecturer_id:
            raise HTTPException(status_code=400,
                detail=f"This lecturer already teaches another class on {body.day} during {o.start}-{o.end}")
        # Same students cannot be in two places at once. A lecture has no group
        # because the whole course attends it, so it overlaps EVERY group — treating
        # its NULL as just another value would let a lecture and a tutorial for the
        # same students be booked at the same hour.
        if o.course_id == meeting.course_id and (
            meeting.class_group is None or o.class_group is None
            or o.class_group == meeting.class_group
        ):
            who = o.class_group or "all groups"
            raise HTTPException(status_code=400,
                detail=f"{o.role} for {who} is already scheduled on {body.day} during {o.start}-{o.end}")

    was = f"{meeting.day} {meeting.start}-{meeting.end} in {meeting.room}"
    course_code = meeting.course.course_code if meeting.course else meeting.course_id

    # Persist one unambiguous 24-hour representation. The browser time input sends
    # HH:MM, and every scheduler/session comparison consumes that same contract.
    normalized_start = f"{new_start // 60:02d}:{new_start % 60:02d}"
    normalized_end = f"{new_end // 60:02d}:{new_end % 60:02d}"
    if time_changed:
        meeting.effective_from = utcnow()   # a moved class is new from now on; days before the move must not become missed classes
    meeting.day, meeting.start, meeting.end, meeting.room = body.day, normalized_start, normalized_end, body.room
    from routers.attendance_features import notify_timetable_change
    notify_timetable_change(db, meeting, was)
    db.commit()

    # Timetable edits can make a class eligible to open immediately. Bypass the
    # normal one-minute throttle so mobile clients do not have to wait for an
    # unrelated API request to notice the new window.
    sync_class_sessions(force=True)

    log_admin_action(db, current_user, "UPDATE_TIMETABLE",
                     f"Moved {meeting.role} for {course_code}"
                     f"{f' {meeting.class_group}' if meeting.class_group else ''}: "
                     f"{was} -> {body.day} {normalized_start}-{normalized_end} in {body.room}")

    return {"message": "Timetable slot updated successfully"}


@router.delete("/timetable/{meeting_id}", response_model=MessageResponse)
def delete_timetable_slot(meeting_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_admin)):
    meeting = get_or_404(db, ClassMeeting, meeting_id, detail="Timetable slot not found")
    course_code = meeting.course.course_code if meeting.course else str(meeting.course_id)
    slot_description = (
        f"{meeting.role}{f' {meeting.class_group}' if meeting.class_group else ''} "
        f"on {meeting.day} {meeting.start}-{meeting.end}"
    )

    # ClassSession.meeting_id uses ON DELETE SET NULL, so completed attendance
    # history remains available while this recurring timetable slot is removed.
    db.delete(meeting)
    db.commit()

    log_admin_action(
        db,
        current_user,
        "DELETE_TIMETABLE",
        f"Removed {slot_description} for {course_code}",
    )
    return {"message": "Timetable slot deleted successfully"}


# =====================================================================
# ENROLMENTS CRUD
# =====================================================================

@router.get("/enrolments", response_model=List[dict])
def get_enrolments(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    enrolments = db.query(Enrolment).options(
        joinedload(Enrolment.student),
        joinedload(Enrolment.course)
    ).all()
    result = []
    for e in enrolments:
        result.append({
            "id": e.id,
            "student_id": e.student_id,
            "student_name": e.student.name if e.student else "Unknown",
            "student_code": e.student.student_code if e.student else "Unknown",
            "course_id": e.course_id,
            "course_code": e.course.course_code if e.course else "Unknown",
            "course_name": e.course.course_name if e.course else "Unknown",
            "semester": e.semester,
            "class_group": e.class_group
        })
    return result

def enrol_student(db, student_id, course_id, semester, class_group):
    """Validate and add ONE enrolment inside the caller's transaction (never commits). Lock order: programme, student, semester.
    Returns (student, course, semester name)."""
    course = get_or_404(db, Course, course_id, "Course")
    lock_programme(db, course.programme_id)
    db.refresh(course)
    student = db.query(Student).filter(Student.id == student_id).with_for_update().first()
    if not student:
        raise HTTPException(400, "Selected student does not exist")
    # One student, one programme: a course is only ever added from the student's own programme, whatever the client sent.
    if course.programme_id and str(student.programme_id or "") != str(course.programme_id):
        raise HTTPException(400, "A course can only be added from the student's own study programme." if student.programme_id
                            else "Allocate the student to this course's study programme first.")
    term = enrolment_semester(db, course)
    if term:
        if student.programme_id != term.programme_id:
            raise HTTPException(400, "Allocate the student to this study programme before enrolling in its semester")
        semester = term.name

    existing = db.query(Enrolment).filter(
        Enrolment.student_id == student_id,
        Enrolment.course_id == course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this course")

    # Check if the chosen group is full (max 25 students)
    group_count = db.query(Enrolment).filter(
        Enrolment.course_id == course_id,
        Enrolment.class_group == class_group
    ).count()
    if group_count >= 25:
        raise HTTPException(status_code=400, detail=f"Group '{class_group}' is full. Maximum 25 students allowed.")

    first_in_group = class_group not in groups_for_course(db, course_id)
    db.add(Enrolment(student_id=student_id, course_id=course_id, semester=semester, class_group=class_group))
    if first_in_group:
        # A group's first student: tutorials and practicals assigned before anyone was enrolled have no meeting for it yet.
        # Only a NEW group is filled in, so a class time an admin deliberately removed is not brought back by a later enrolment.
        try:
            db.flush()
            add_missing_meetings(db, course_id, db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == course_id).all(), [class_group])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    return student, course, semester


@router.post("/enrolments", response_model=MessageResponse, status_code=201)
def create_enrolment(body: dict, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    student_id = body.get("student_id")
    course_id = body.get("course_id")
    semester = body.get("semester", "2026-Semester 1")
    class_group = body.get("class_group", "G1")

    if not student_id or not course_id:
         raise HTTPException(status_code=400, detail="student_id and course_id are required")

    def work():
        student, course, term_name = enrol_student(db, student_id, course_id, semester, class_group)
        log_admin_action(db, current_user, "CREATE_ENROLMENT",
                         f"Enrolled {student.student_code} in {course.course_code} ({class_group}, {term_name})", commit=False)

    run_transaction(db, work)
    return {"message": "Student successfully enrolled"}


@router.post("/student-allocations", response_model=dict)
def save_student_allocation(body: dict, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """One student's programme and course enrolment saved together, or not at all. Safe to repeat: a second call finds the
    same result already stored and changes nothing, so a reply lost after the save never turns into a false failure."""
    student_id, programme_id, course_id = body.get("student_id"), body.get("programme_id"), body.get("course_id")
    semester, class_group = body.get("semester", "2026-Semester 1"), body.get("class_group", "G1")
    if not student_id or not programme_id or not course_id:
        raise HTTPException(400, "student_id, programme_id and course_id are required")

    def work():
        course = get_or_404(db, Course, course_id, "Course")
        lock_programmes(db, programme_id, course.programme_id)   # programmes first, student second, semester last
        db.refresh(course)   # an admin may have moved the course while we waited for the lock; only a locked programme is accepted below
        if course.programme_id and str(course.programme_id) != str(programme_id):
            raise HTTPException(400, "This course belongs to a different study programme.")
        student = db.query(Student).filter(Student.id == student_id).populate_existing().with_for_update().first()
        if not student:
            raise HTTPException(400, "Selected student does not exist")
        if student.programme_id and str(student.programme_id) != str(programme_id):
            # Course allocation never moves a student to another programme; that would silently orphan their current courses.
            raise HTTPException(409, f"This student already belongs to {student.programme.code if student.programme else 'another programme'}. "
                                     "Add a course from that programme instead.")
        existing = db.query(Enrolment).filter(Enrolment.student_id == student_id, Enrolment.course_id == course_id).first()
        if existing and existing.class_group != class_group:
            raise HTTPException(409, f"This student is already enrolled in this course in group {existing.class_group}. Remove that enrolment first to change the group.")
        result = {"programme_changed": str(student.programme_id) != str(programme_id), "enrolled": existing is None}
        if result["programme_changed"]:
            was = student.programme.code if student.programme else "none"
            student.programme_id = programme_id
            db.flush()
            db.refresh(student)
            log_admin_action(db, current_user, "ASSIGN_STUDENT_PROGRAMME",
                             f"Programme for {student.student_code}: {was} -> {student.programme.code}", commit=False)
        if not existing:
            student, course, term_name = enrol_student(db, student_id, course_id, semester, class_group)
            log_admin_action(db, current_user, "CREATE_ENROLMENT",
                             f"Enrolled {student.student_code} in {course.course_code} ({class_group}, {term_name})", commit=False)
        return result

    result = run_transaction(db, work)
    return {**result, "message": "Allocation saved" if result["programme_changed"] or result["enrolled"] else "Allocation was already saved"}

@router.delete("/enrolments/{enrolment_id}", response_model=MessageResponse)
def delete_enrolment(enrolment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    enrol = db.query(Enrolment).filter_by(id=enrolment_id).with_for_update().first()
    if enrol is None:
        raise HTTPException(404, "Enrolment not found")

    require_no_attendance_history(db, enrol, enrol.course.course_code if enrol.course else "This course")

    # Read before the delete makes the relationships unavailable.
    deleted_desc = (
        f"{enrol.student.student_code if enrol.student else enrol.student_id} from "
        f"{enrol.course.course_code if enrol.course else enrol.course_id} "
        f"({enrol.class_group})"
    )

    db.delete(enrol)
    db.commit()

    log_admin_action(db, current_user, "DELETE_ENROLMENT", f"Unenrolled {deleted_desc}")

    return {"message": "Enrolment deleted successfully"}

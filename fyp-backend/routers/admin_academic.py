from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from pydantic import BaseModel

from utils.database import get_db
from utils.scheduler import pick_slot_for_new
from utils.models import User, Student, Lecturer, Course, Enrolment, Programme, CourseStaffAssignment, RiskScore, Alert, ClassSession, AttendanceRecord, ClassMeeting
from utils.security import require_admin, require_lecturer
from utils.db_helpers import get_or_404, ensure_unique
from utils.schemas import (
    MessageResponse,
    ProgrammeCreate, ProgrammeResponse,
    CourseCreate, CourseResponse,
    AssignmentCreate, AssignmentResponse
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
    return programme

@router.put("/programmes/{programme_id}", response_model=ProgrammeResponse)
def update_programme(programme_id: int, body: ProgrammeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = get_or_404(db, Programme, programme_id, "Programme")
    
    ensure_unique(db, Programme, Programme.code, body.code, exclude_id=programme_id, detail="Programme code already exists")
        
    programme.name = body.name
    programme.code = body.code
    db.commit()
    db.refresh(programme)
    return programme

@router.delete("/programmes/{programme_id}", response_model=MessageResponse)
def delete_programme(programme_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = get_or_404(db, Programme, programme_id, "Programme")
        
    db.query(Student).filter(Student.programme_id == programme_id).update({Student.programme_id: None})
    db.query(Course).filter(Course.programme_id == programme_id).update({Course.programme_id: None})
    
    db.delete(programme)
    db.commit()
    return {"message": "Programme deleted successfully"}


# =====================================================================
# COURSES CRUD
# =====================================================================

@router.get("/courses", response_model=List[dict])
def get_courses(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    courses = db.query(Course).options(
        joinedload(Course.lecturer),
        joinedload(Course.programme)
    ).all()
    # Lecture times come from class_meetings (source of truth), not the dead
    # Course.schedule_* columns.
    lecture_by_course = {
        m.course_id: m for m in db.query(ClassMeeting).filter(ClassMeeting.role == "Lecture").all()
    }
    result = []
    for c in courses:
        m = lecture_by_course.get(c.id)
        result.append({
            "id": c.id,
            "course_name": c.course_name,
            "course_code": c.course_code,
            "credit_hours": c.credit_hours,
            "lecturer_id": c.lecturer_id,
            "lecturer_name": c.lecturer.name if c.lecturer else None,
            "programme_id": c.programme_id,
            "programme_name": c.programme.name if c.programme else None,
            "schedule_day": m.day if m else None,
            "schedule_start": m.start if m else None,
            "schedule_end": m.end if m else None,
            "schedule_room": m.room if m else None,
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
        credit_hours=body.credit_hours,
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
        meeting_key=f"Lecture-{course.id}", course_id=course.id, assignment_id=None,
        role="Lecture", lecturer_id=course.lecturer_id, **slot,
    ))

    db.commit()
    db.refresh(course)
    return course

@router.put("/courses/{course_id}", response_model=CourseResponse)
def update_course(course_id: int, body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = get_or_404(db, Course, course_id, "Course")
        
    ensure_unique(db, Course, Course.course_code, body.course_code, exclude_id=course_id, detail="Course code already exists")

    # Validate foreign keys up front (see create_course) — clear 400, not a 500.
    if body.lecturer_id is not None and \
       not db.query(Lecturer).filter(Lecturer.id == body.lecturer_id).first():
        raise HTTPException(status_code=400, detail="Selected lecturer does not exist")
    if body.programme_id is not None and \
       not db.query(Programme).filter(Programme.id == body.programme_id).first():
        raise HTTPException(status_code=400, detail="Selected programme does not exist")

    course.course_name = body.course_name
    course.course_code = body.course_code
    course.credit_hours = body.credit_hours
    course.lecturer_id = body.lecturer_id
    course.programme_id = body.programme_id

    # Timetable times live in class_meetings, not on the course. Keep the
    # Lecture meeting's lecturer in sync so clash detection stays correct.
    lecture_meeting = db.query(ClassMeeting).filter(
        ClassMeeting.meeting_key == f"Lecture-{course.id}"
    ).first()
    if lecture_meeting:
        lecture_meeting.lecturer_id = body.lecturer_id

    db.commit()
    db.refresh(course)
    return course

@router.delete("/courses/{course_id}", response_model=MessageResponse)
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = get_or_404(db, Course, course_id, "Course")
        
    db.query(Enrolment).filter(Enrolment.course_id == course_id).delete()
    db.query(RiskScore).filter(RiskScore.course_id == course_id).delete()
    db.query(Alert).filter(Alert.course_id == course_id).delete()
    
    sessions = db.query(ClassSession).filter(ClassSession.course_id == course_id).all()
    for s in sessions:
        db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).delete()
        db.delete(s)
        
    db.delete(course)
    db.commit()
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
    existing = db.query(CourseStaffAssignment).filter(
        CourseStaffAssignment.course_id == body.course_id,
        CourseStaffAssignment.lecturer_id == body.lecturer_id,
        CourseStaffAssignment.role == body.role
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Staff already assigned to this course in this role")
        
    assignment = CourseStaffAssignment(
        course_id=body.course_id,
        lecturer_id=body.lecturer_id,
        role=body.role
    )
    db.add(assignment)
    db.flush()  # assign assignment.id

    # Tutor/Practical assignments are their own weekly meeting — auto-assign a
    # clash-free slot and record it. (A "Lecturer" role assignment is not a
    # separate meeting; the course's Lecture already covers it.)
    if body.role in ("Tutor", "Practical"):
        try:
            slot = pick_slot_for_new(db, assignment.course_id, assignment.lecturer_id, body.role)
        except ValueError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
        db.add(ClassMeeting(
            meeting_key=f"{body.role}-{assignment.id}", course_id=assignment.course_id,
            assignment_id=assignment.id, role=body.role,
            lecturer_id=assignment.lecturer_id, **slot,
        ))

    db.commit()
    db.refresh(assignment)
    return assignment

@router.delete("/assignments/{assignment_id}", response_model=MessageResponse)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    assignment = get_or_404(db, CourseStaffAssignment, assignment_id, "Assignment")
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}


@router.get("/timetable", response_model=List[dict])
def get_global_timetable(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Read the class_meetings table (source of truth). meeting_id lets the admin
    # UI edit a specific slot.
    meetings = db.query(ClassMeeting).options(
        joinedload(ClassMeeting.course), joinedload(ClassMeeting.lecturer)
    ).all()
    result = []
    for m in meetings:
        c = m.course
        result.append({
            "meeting_id": m.id,
            "id": m.id,
            "course_code": c.course_code if c else "Unknown",
            "course_name": c.course_name if c else "Unknown",
            "schedule_day": m.day,
            "schedule_start": m.start,
            "schedule_end": m.end,
            "schedule_room": m.room,
            "lecturer_name": m.lecturer.name if m.lecturer else "TBA",
            "role": m.role,
        })
    return result


class TimetableSlotUpdate(BaseModel):
    day: str
    start: str
    end: str
    room: str


@router.put("/timetable/{meeting_id}", response_model=MessageResponse)
def update_timetable_slot(meeting_id: int, body: TimetableSlotUpdate,
                          db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    meeting = get_or_404(db, ClassMeeting, meeting_id, detail="Timetable slot not found")

    def _to_min(hhmm: str) -> int:
        try:
            h, m = hhmm.split(":")
            v = int(h) * 60 + int(m)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail=f"Invalid time '{hhmm}', expected HH:MM")
        if not (0 <= v < 24 * 60):
            raise HTTPException(status_code=400, detail=f"Time '{hhmm}' out of range")
        return v

    new_start, new_end = _to_min(body.start), _to_min(body.end)
    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # Clash check against every OTHER meeting on the same day. Two classes clash
    # when their time ranges OVERLAP (not just when identical): [a,b) overlaps
    # [c,d) iff a < d and c < b. No shared room, no double-booked lecturer.
    others = db.query(ClassMeeting).filter(ClassMeeting.id != meeting_id).all()
    for o in others:
        if o.day != body.day:
            continue
        if not (new_start < _to_min(o.end) and _to_min(o.start) < new_end):
            continue  # no time overlap
        if o.room == body.room:
            raise HTTPException(status_code=400,
                detail=f"Room {body.room} is already booked on {body.day} during {o.start}-{o.end}")
        if meeting.lecturer_id and o.lecturer_id == meeting.lecturer_id:
            raise HTTPException(status_code=400,
                detail=f"This lecturer already teaches another class on {body.day} during {o.start}-{o.end}")

    meeting.day, meeting.start, meeting.end, meeting.room = body.day, body.start, body.end, body.room
    db.commit()
    return {"message": "Timetable slot updated successfully"}


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

@router.post("/enrolments", response_model=MessageResponse, status_code=201)
def create_enrolment(body: dict, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    student_id = body.get("student_id")
    course_id = body.get("course_id")
    semester = body.get("semester", "2026-Semester 1")
    class_group = body.get("class_group", "G1")
    
    if not student_id or not course_id:
         raise HTTPException(status_code=400, detail="student_id and course_id are required")
         
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

    enrol = Enrolment(
        student_id=student_id,
        course_id=course_id,
        semester=semester,
        class_group=class_group
    )
    db.add(enrol)
    db.commit()
    return {"message": "Student successfully enrolled"}

@router.delete("/enrolments/{enrolment_id}", response_model=MessageResponse)
def delete_enrolment(enrolment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    enrol = get_or_404(db, Enrolment, enrolment_id, "Enrolment")
    db.delete(enrol)
    db.commit()
    return {"message": "Enrolment deleted successfully"}

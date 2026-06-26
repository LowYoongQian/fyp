from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import random

from utils.database import get_db
from utils.models import User, Student, Lecturer, Course, Enrolment, Programme, CourseStaffAssignment, RiskScore, Alert, ClassSession, AttendanceRecord
from utils.security import require_admin, require_lecturer
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
    if db.query(Programme).filter(Programme.code == body.code).first():
        raise HTTPException(status_code=400, detail="Programme code already exists")
    programme = Programme(name=body.name, code=body.code)
    db.add(programme)
    db.commit()
    db.refresh(programme)
    return programme

@router.put("/programmes/{programme_id}", response_model=ProgrammeResponse)
def update_programme(programme_id: int, body: ProgrammeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = db.query(Programme).filter(Programme.id == programme_id).first()
    if not programme:
        raise HTTPException(status_code=404, detail="Programme not found")
    
    existing = db.query(Programme).filter(Programme.code == body.code, Programme.id != programme_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Programme code already exists")
        
    programme.name = body.name
    programme.code = body.code
    db.commit()
    db.refresh(programme)
    return programme

@router.delete("/programmes/{programme_id}", response_model=MessageResponse)
def delete_programme(programme_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    programme = db.query(Programme).filter(Programme.id == programme_id).first()
    if not programme:
        raise HTTPException(status_code=404, detail="Programme not found")
        
    db.query(Student).filter(Student.programme_id == programme_id).update({Student.programme_id: None})
    db.query(Course).filter(Course.programme_id == programme_id).update({Course.programme_id: None})
    
    db.delete(programme)
    db.commit()
    return {"message": "Programme deleted successfully"}


def assign_random_schedule(seed_val: str):
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    starts = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
    rooms = ["Theatre 1", "Theatre 2", "Lab 1", "Lab 2", "Lab 3", "Seminar Room 1", "Seminar Room 2"]
    
    # Stable seed based on course code
    random.seed(hash(seed_val))
    day = random.choice(days)
    start_t = random.choice(starts)
    hour = int(start_t.split(":")[0])
    end_t = f"{hour + 2:02d}:00"
    room = random.choice(rooms)
    return day, start_t, end_t, room

# =====================================================================
# COURSES CRUD
# =====================================================================

@router.get("/courses", response_model=List[dict])
def get_courses(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    courses = db.query(Course).options(
        joinedload(Course.lecturer),
        joinedload(Course.programme)
    ).all()
    result = []
    for c in courses:
        result.append({
            "id": c.id,
            "course_name": c.course_name,
            "course_code": c.course_code,
            "credit_hours": c.credit_hours,
            "lecturer_id": c.lecturer_id,
            "lecturer_name": c.lecturer.name if c.lecturer else None,
            "programme_id": c.programme_id,
            "programme_name": c.programme.name if c.programme else None,
            "schedule_day": c.schedule_day,
            "schedule_start": c.schedule_start,
            "schedule_end": c.schedule_end,
            "schedule_room": c.schedule_room
        })
    return result

@router.post("/courses", response_model=CourseResponse, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(Course).filter(Course.course_code == body.course_code).first():
        raise HTTPException(status_code=400, detail="Course code already exists")
    
    # Generate random schedule if not provided
    day = body.schedule_day
    start_t = body.schedule_start
    end_t = body.schedule_end
    room = body.schedule_room
    
    if not day or not start_t or not room:
        day, start_t, end_t, room = assign_random_schedule(body.course_code)

    course = Course(
        course_name=body.course_name,
        course_code=body.course_code,
        credit_hours=body.credit_hours,
        lecturer_id=body.lecturer_id,
        programme_id=body.programme_id,
        schedule_day=day,
        schedule_start=start_t,
        schedule_end=end_t,
        schedule_room=room
    )
    db.add(course)
    
    # Verify slot availability under deterministic scheduler
    try:
        db.flush()
        from utils.scheduler import calculate_schedule
        calculate_schedule(db)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    db.commit()
    db.refresh(course)
    return course

@router.put("/courses/{course_id}", response_model=CourseResponse)
def update_course(course_id: int, body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    existing = db.query(Course).filter(Course.course_code == body.course_code, Course.id != course_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course code already exists")
        
    course.course_name = body.course_name
    course.course_code = body.course_code
    course.credit_hours = body.credit_hours
    course.lecturer_id = body.lecturer_id
    course.programme_id = body.programme_id
    
    # Update schedule if provided in body
    if body.schedule_day:
        course.schedule_day = body.schedule_day
    if body.schedule_start:
        course.schedule_start = body.schedule_start
    if body.schedule_end:
        course.schedule_end = body.schedule_end
    if body.schedule_room:
        course.schedule_room = body.schedule_room
        
    db.commit()
    db.refresh(course)
    return course

@router.delete("/courses/{course_id}", response_model=MessageResponse)
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
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
    
    # Verify slot availability under deterministic scheduler
    try:
        db.flush()
        from utils.scheduler import calculate_schedule
        calculate_schedule(db)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    db.commit()
    db.refresh(assignment)
    return assignment

@router.delete("/assignments/{assignment_id}", response_model=MessageResponse)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    assignment = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}


@router.get("/timetable", response_model=List[dict])
def get_global_timetable(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from utils.scheduler import calculate_schedule
    schedule_map = calculate_schedule(db)
    
    courses = db.query(Course).options(joinedload(Course.lecturer)).all()
    assignments = db.query(CourseStaffAssignment).options(
        joinedload(CourseStaffAssignment.course),
        joinedload(CourseStaffAssignment.lecturer)
    ).all()
    
    result = []
    # 1. Lectures
    for c in courses:
        lect_slot = schedule_map.get(f"Lecture-{c.id}")
        if lect_slot:
            lecturer_name = c.lecturer.name if c.lecturer else "TBA"
            result.append({
                "id": c.id * 10,
                "course_code": c.course_code,
                "course_name": c.course_name,
                "schedule_day": lect_slot["day"],
                "schedule_start": lect_slot["start"],
                "schedule_end": lect_slot["end"],
                "schedule_room": lect_slot["room"],
                "lecturer_name": lecturer_name,
                "role": "Lecture"
            })
            
    # 2. Staff assignments (Tutors / Practicals)
    for a in assignments:
        if a.role in ("Tutor", "Practical"):
            slot = schedule_map.get(f"{a.role}-{a.id}")
            if slot:
                c = a.course
                lecturer_name = a.lecturer.name if a.lecturer else "TBA"
                result.append({
                    "id": a.id * 1000 + 9999,
                    "course_code": c.course_code if c else "Unknown",
                    "course_name": c.course_name if c else "Unknown",
                    "schedule_day": slot["day"],
                    "schedule_start": slot["start"],
                    "schedule_end": slot["end"],
                    "schedule_room": slot["room"],
                    "lecturer_name": lecturer_name,
                    "role": a.role
                })
                
    return result


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
    enrol = db.query(Enrolment).filter(Enrolment.id == enrolment_id).first()
    if not enrol:
        raise HTTPException(status_code=404, detail="Enrolment not found")
    db.delete(enrol)
    db.commit()
    return {"message": "Enrolment deleted successfully"}

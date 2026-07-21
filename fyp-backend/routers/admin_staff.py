from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from utils.database import get_db
from utils.models import User, Lecturer, Course, Enrolment, ClassSession, AttendanceRecord, RiskScore, Alert
from utils.security import require_admin, hash_password
from utils.db_helpers import get_or_404, ensure_unique, require_email_domain
from utils.schemas import (
    AdminStaffCreate, AdminStaffUpdate,
    MessageResponse
)

router = APIRouter(prefix="/admin", tags=["Admin Staff"])

@router.get("/staff")
def get_staff(
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(Lecturer).options(joinedload(Lecturer.user))
    if search:
        search_val = f"%{search}%"
        query = query.outerjoin(User, User.id == Lecturer.user_id).filter(
            (Lecturer.name.ilike(search_val)) |
            (Lecturer.staff_id.ilike(search_val)) |
            (User.email.ilike(search_val))
        )
    total = query.count()
    if skip is not None:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    lecturers = query.all()
    
    result = []
    for l in lecturers:
        result.append({
            "id": l.id,
            "user_id": l.user_id,
            "name": l.name,
            "staff_id": l.staff_id,
            "email": l.user.email if l.user else "",
            "role": l.role
        })
    return {"items": result, "total": total}

@router.post("/staff", response_model=MessageResponse, status_code=201)
def create_staff(
    body: AdminStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Enforce email domain
    require_email_domain(body.email, "@staff.school.edu", "Staff")

    # Check if email exists
    ensure_unique(db, User, User.email, body.email, detail="Email already registered")
    
    # Check if staff code exists
    ensure_unique(db, Lecturer, Lecturer.staff_id, body.staff_id, detail="Staff ID already exists")
    
    # Create credentials
    hashed = hash_password(body.password)
    user_role = "admin" if body.role.lower() == "admin" else "lecturer"
    user = User(email=body.email, password_hash=hashed, role=user_role)
    db.add(user)
    db.flush()
    
    # Create Lecturer profile
    lecturer = Lecturer(user_id=user.id, name=body.name, staff_id=body.staff_id, role=body.role)
    db.add(lecturer)
    db.commit()
    
    return {"message": "Staff registered successfully", "user_id": user.id}

@router.put("/staff/{lecturer_id}", response_model=MessageResponse)
def update_staff(
    lecturer_id: int,
    body: AdminStaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    lecturer = get_or_404(db, Lecturer, lecturer_id, detail="Lecturer profile not found")
    
    user = get_or_404(db, User, lecturer.user_id, detail="User account not found")
        
    if body.email is not None and body.email != user.email:
        require_email_domain(body.email, "@staff.school.edu", "Staff")
        # Check uniqueness
        ensure_unique(db, User, User.email, body.email, detail="Email already registered")
        user.email = body.email
        
    if body.password is not None and body.password.strip() != "":
        user.password_hash = hash_password(body.password)
        
    if body.name is not None:
        lecturer.name = body.name
        
    if body.staff_id is not None and body.staff_id != lecturer.staff_id:
        # Check uniqueness
        ensure_unique(db, Lecturer, Lecturer.staff_id, body.staff_id, detail="Staff ID already exists")
        lecturer.staff_id = body.staff_id

    if body.role is not None:
        lecturer.role = body.role
        user.role = "admin" if body.role.lower() == "admin" else "lecturer"
        
    db.commit()
    return {"message": "Staff updated successfully", "user_id": user.id}

@router.delete("/staff/{lecturer_id}", response_model=MessageResponse)
def delete_staff(
    lecturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    lecturer = get_or_404(db, Lecturer, lecturer_id, detail="Lecturer profile not found")
    
    user_id = lecturer.user_id
    
    # Find all courses for this lecturer
    courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()
    for course in courses:
        # Delete course enrolments
        db.query(Enrolment).filter(Enrolment.course_id == course.id).delete()
        # Delete course risk scores
        db.query(RiskScore).filter(RiskScore.course_id == course.id).delete()
        # Delete course alerts
        db.query(Alert).filter(Alert.course_id == course.id).delete()
        
        # Delete course sessions and their attendance records
        sessions = db.query(ClassSession).filter(ClassSession.course_id == course.id).all()
        for session in sessions:
            db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).delete()
            db.delete(session)
            
        # Delete Course itself
        db.delete(course)
        
    # Delete lecturer profile
    db.delete(lecturer)
    
    # Delete user account
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
        
    db.commit()
    return {"message": "Lecturer and corresponding account deleted successfully"}

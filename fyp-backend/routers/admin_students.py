from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from utils.database import get_db
from utils.models import User, Student, Enrolment, FaceEmbedding, AttendanceRecord, RiskScore, Alert
from utils.security import require_admin, require_lecturer, hash_password
from utils.db_helpers import get_or_404, ensure_unique, require_email_domain
from utils.schemas import (
    AdminStudentCreate, AdminStudentUpdate,
    MessageResponse, StudentProgrammeAssign
)

router = APIRouter(prefix="/admin", tags=["Admin Students"])

@router.get("/students")
def get_students(
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    total = db.query(Student).count()
    query = db.query(Student).options(joinedload(Student.user))
    if skip is not None:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    students = query.all()
    
    result = []
    for s in students:
        result.append({
            "id": s.id,
            "user_id": s.user_id,
            "name": s.name,
            "student_code": s.student_code,
            "is_face_registered": s.is_face_registered,
            "email": s.user.email if s.user else "",
            "programme_id": s.programme_id
        })
    return {"items": result, "total": total}

@router.put("/students/{student_id}/programme", response_model=MessageResponse)
def assign_student_programme(
    student_id: int,
    body: StudentProgrammeAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = get_or_404(db, Student, student_id, "Student")
    student.programme_id = body.programme_id
    db.commit()
    return {"message": "Programme assigned to student successfully"}

@router.post("/students", response_model=MessageResponse, status_code=201)
def create_student(
    body: AdminStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Enforce email domain
    require_email_domain(body.email, "@student.school.edu", "Student")
        
    # Check if email exists
    ensure_unique(db, User, User.email, body.email, detail="Email already registered")
    
    # Check if student code exists
    ensure_unique(db, Student, Student.student_code, body.student_code, detail="Student code already exists")
    
    # Create credentials
    hashed = hash_password(body.password)
    user = User(email=body.email, password_hash=hashed, role="student")
    db.add(user)
    db.flush()
    
    # Create Student profile
    student = Student(user_id=user.id, name=body.name, student_code=body.student_code, is_face_registered=False)
    db.add(student)
    db.commit()
    
    return {"message": "Student registered successfully", "user_id": user.id}

@router.put("/students/{student_id}", response_model=MessageResponse)
def update_student(
    student_id: int,
    body: AdminStudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = get_or_404(db, Student, student_id, detail="Student profile not found")
    
    user = get_or_404(db, User, student.user_id, detail="User account not found")
        
    if body.email is not None and body.email != user.email:
        require_email_domain(body.email, "@student.school.edu", "Student")
        # Check uniqueness
        ensure_unique(db, User, User.email, body.email, detail="Email already registered")
        user.email = body.email
        
    if body.password is not None and body.password.strip() != "":
        user.password_hash = hash_password(body.password)
        
    if body.name is not None:
        student.name = body.name
        
    if body.student_code is not None and body.student_code != student.student_code:
        # Check uniqueness
        ensure_unique(db, Student, Student.student_code, body.student_code, detail="Student code already exists")
        student.student_code = body.student_code
        
    db.commit()
    return {"message": "Student updated successfully", "user_id": user.id}

@router.delete("/students/{student_id}", response_model=MessageResponse)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = get_or_404(db, Student, student_id, detail="Student profile not found")
    
    user_id = student.user_id
    
    # 1. Delete enrolments
    db.query(Enrolment).filter(Enrolment.student_id == student.id).delete()
    # 2. Delete face embedding
    db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student.id).delete()
    # 3. Delete attendance records
    db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).delete()
    # 4. Delete risk scores
    db.query(RiskScore).filter(RiskScore.student_id == student.id).delete()
    # 5. Delete alerts
    db.query(Alert).filter(Alert.student_id == student.id).delete()
    
    # 6. Delete student profile
    db.delete(student)
    
    # 7. Delete user account
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
        
    db.commit()
    return {"message": "Student and corresponding account deleted successfully"}

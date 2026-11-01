from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from db.database import get_db
from db.models import Course, User, Student, Enrolment, FaceEmbedding, AttendanceRecord, RiskScore, Alert
from routers.face_enrolment import face_version, owe_photo, settle_photo
from utils.timeutil import iso_utc
from utils.security import require_admin, require_lecturer, hash_password
from utils.db_helpers import get_or_404, ensure_unique, require_email_domain
from domain.audit import log_admin_action
from domain.semesters import lock_programmes, run_transaction
from schemas import (
    AdminStudentCreate, AdminStudentUpdate,
    MessageResponse, StudentProgrammeAssign
)

router = APIRouter(prefix="/admin", tags=["Admin Students"])

@router.get("/students")
def get_students(
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    query = db.query(Student).options(joinedload(Student.user))
    if search:
        search_val = f"%{search}%"
        query = query.outerjoin(User, User.id == Student.user_id).filter(
            (Student.name.ilike(search_val)) |
            (Student.student_code.ilike(search_val)) |
            (User.email.ilike(search_val))
        )
    total = query.count()
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

@router.get("/students/{student_id}/details")
def get_student_details(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Explicit allowlist: the User row also holds password, recovery, reset and session secrets.
    student = get_or_404(db, Student, student_id, "Student")
    user = student.user
    programme = student.programme
    enrolments = (db.query(Enrolment).options(joinedload(Enrolment.course).joinedload(Course.semester))
                  .filter(Enrolment.student_id == student.id).all())
    face = db.query(FaceEmbedding).filter_by(student_id=student.id).first()
    registered = bool(face and face.is_active)
    return {
        "identity": {
            "student_id": student.id, "user_id": student.user_id, "name": student.name,
            "student_code": student.student_code, "email": user.email if user else None,
            "avatar_url": user.avatar_url if user else None,
        },
        "account": {
            "account_role": user.role, "status": user.status, "created_at": iso_utc(user.created_at), "last_login_at": iso_utc(user.last_login_at),
            "recovery_email": user.recovery_email, "recovery_email_verified": user.recovery_email_verified,
        } if user else None,
        "programme": {"code": programme.code, "name": programme.name} if programme else None,
        "courses": sorted((
            {"code": e.course.course_code, "name": e.course.course_name, "credits": e.course.credit_hours,
             "semester": e.course.semester.name if e.course.semester else e.semester, "class_group": e.class_group}
            for e in enrolments if e.course), key=lambda c: c["code"]),
        "face": {
            "is_registered": registered, "registration_version": face_version(face) if registered else None,
            "sample_count": face.sample_count if registered else None,
            "updated_at": iso_utc(face.updated_at) if registered else None,
            "photo_available": registered and bool(face.photo_key),
        },
    }

@router.put("/students/{student_id}/programme", response_model=MessageResponse)
def assign_student_programme(
    student_id: str,
    body: StudentProgrammeAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    get_or_404(db, Student, student_id, "Student")

    def work():
        # Programme first, student second: the same order as an enrolment, so the two can never wait on each other.
        lock_programmes(db, body.programme_id)
        student = db.query(Student).filter(Student.id == student_id).populate_existing().with_for_update().first()
        if not student:
            raise HTTPException(404, "Student not found")
        was = student.programme.code if student.programme else "none"
        student.programme_id = body.programme_id
        db.flush()
        db.refresh(student)
        log_admin_action(db, current_user, "ASSIGN_STUDENT_PROGRAMME",
                         f"Programme for {student.student_code}: {was} -> {student.programme.code if student.programme else 'none'}", commit=False)

    run_transaction(db, work)
    return {"message": "Programme assigned to student successfully"}

@router.post("/students", response_model=MessageResponse, status_code=201)
def create_student(
    body: AdminStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Enforce email domain
    require_email_domain(body.email, "@student.school.edu", "Student")
    email = body.email.strip().lower()   # one stored spelling, so sign-in (case-insensitive) can never match two accounts

    # Check if email exists
    ensure_unique(db, User, func.lower(User.email), email, detail="Email already registered")
    
    # Check if student code exists
    ensure_unique(db, Student, Student.student_code, body.student_code, detail="Student code already exists")
    
    # Create credentials
    hashed = hash_password(body.password)
    user = User(email=email, password_hash=hashed, role="student")
    db.add(user)
    db.flush()
    
    # Create Student profile
    student = Student(user_id=user.id, name=body.name, student_code=body.student_code, is_face_registered=False)
    db.add(student)
    db.commit()

    log_admin_action(db, current_user, "CREATE_STUDENT",
                     f"Created student {body.name} ({body.student_code})")

    return {"message": "Student registered successfully", "user_id": user.id}

@router.put("/students/{student_id}", response_model=MessageResponse)
def update_student(
    student_id: str,
    body: AdminStudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = get_or_404(db, Student, student_id, detail="Student profile not found")

    user = get_or_404(db, User, student.user_id, detail="User account not found")

    changed = []

    if body.email is not None and body.email.strip().lower() != user.email.lower():
        require_email_domain(body.email, "@student.school.edu", "Student")
        new_email = body.email.strip().lower()
        # Check uniqueness
        ensure_unique(db, User, func.lower(User.email), new_email, exclude_id=user.id, detail="Email already registered")
        changed.append(f"email {user.email} -> {new_email}")
        user.email = new_email

    if body.password is not None and body.password.strip() != "":
        user.password_hash = hash_password(body.password)
        changed.append("password reset")

    if body.name is not None and body.name != student.name:
        changed.append(f"name {student.name} -> {body.name}")
        student.name = body.name

    if body.student_code is not None and body.student_code != student.student_code:
        # Check uniqueness
        ensure_unique(db, Student, Student.student_code, body.student_code, detail="Student code already exists")
        changed.append(f"student_code {student.student_code} -> {body.student_code}")
        student.student_code = body.student_code

    db.commit()

    log_admin_action(db, current_user, "UPDATE_STUDENT",
                     f"Updated student {student.name} ({student.student_code}): "
                     f"{', '.join(changed) if changed else 'no changes'}")

    return {"message": "Student updated successfully", "user_id": user.id}

@router.delete("/students/{student_id}", response_model=MessageResponse)
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = get_or_404(db, Student, student_id, detail="Student profile not found")

    user_id = student.user_id
    # Read before the cascade deletes make them unavailable.
    deleted_desc = f"{student.name} ({student.student_code})"

    # 1. Delete enrolments
    db.query(Enrolment).filter(Enrolment.student_id == student.id).delete()
    # 2. Delete face embedding (and owe the stored registration photo's delete in the same transaction)
    face = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student.id).first()
    photo_key = face.photo_key if face else None
    owe_photo(db, photo_key)
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
    settle_photo(db, photo_key)

    log_admin_action(db, current_user, "DELETE_STUDENT",
                     f"Deleted student {deleted_desc} and all related records")

    return {"message": "Student and corresponding account deleted successfully"}

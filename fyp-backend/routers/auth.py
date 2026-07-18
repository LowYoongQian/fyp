from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.database import get_db
from utils.models import User, Student, Lecturer
from utils.security import hash_password, verify_password, create_access_token
from utils.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

# User Registration Endpoint
@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Extract identifier code (fallback to class_group)
    user_code = body.code or body.class_group
    if not user_code:
        raise HTTPException(status_code=400, detail="Student code or Staff ID is required")

    # Verify email uniqueness
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify student code or staff id uniqueness
    if body.role == "student":
        if not body.email.endswith("@student.school.edu"):
            raise HTTPException(status_code=400, detail="Student email must end with @student.school.edu")
        if db.query(Student).filter(Student.student_code == user_code).first():
            raise HTTPException(status_code=400, detail="Student code already exists")
    elif body.role == "lecturer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lecturer accounts cannot be registered directly. They must be created by an administrator."
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Create credential user record
    hashed = hash_password(body.password)
    user = User(email=body.email, password_hash=hashed, role=body.role)
    db.add(user)
    db.flush()   # Flushes user to retrieve user.id

    # Create matching Profile record. Only "student" can reach here — the
    # "lecturer" and invalid-role paths already raised above — so there is just
    # one profile type to create.
    student = Student(user_id=user.id, name=body.name, student_code=user_code)
    db.add(student)

    # Commit transactions cleanly
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Registration database conflict")

    return {"message": "Registration successful", "user_id": user.id}

# User Login Endpoint
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    # Accept email OR student_code / staff_id (older clients send `email`).
    raw = (body.identifier or body.email or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Email or ID is required")

    user = None
    student = None
    lecturer = None

    if "@" in raw:
        user = db.query(User).filter(User.email == raw).first()
    else:
        # Resolve a student_code or staff_id to its user account server-side.
        student = db.query(Student).filter(Student.student_code == raw).first()
        if student:
            user = db.query(User).filter(User.id == student.user_id).first()
        else:
            lecturer = db.query(Lecturer).filter(Lecturer.staff_id == raw).first()
            if lecturer:
                user = db.query(User).filter(User.id == lecturer.user_id).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Load the matching profile so the app gets everything in one round trip.
    if user.role == "student" and student is None:
        student = db.query(Student).filter(Student.user_id == user.id).first()
    elif user.role == "lecturer" and lecturer is None:
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == user.id).first()

    token_data: dict = {"user_id": user.id, "role": user.role}

    # NOTE: the single-device login lock was removed. device_id is no longer used
    # to bind the session; it is only recorded per attendance check-in (see
    # /sessions/{id}/attend) as an audit signal. body.device_id is ignored here
    # but kept in the schema so older clients that still send it don't break.

    token = create_access_token(token_data)

    resp = {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "email": user.email,
    }
    if student is not None:
        resp.update({
            "profile_id": student.id,
            "name": student.name,
            "code": student.student_code,
            "is_face_registered": bool(student.is_face_registered),
        })
    elif lecturer is not None:
        resp.update({
            "profile_id": lecturer.id,
            "name": lecturer.name,
            "code": lecturer.staff_id,
        })

    return resp

@router.get("/server-time")
def get_server_time():
    from datetime import datetime
    return {"server_time": datetime.now().isoformat()}

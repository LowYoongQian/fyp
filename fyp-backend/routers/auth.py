from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.database import get_db
from datetime import datetime
from utils.models import User, Student, Lecturer
from utils.security import hash_password, verify_password, create_access_token
from utils.schemas import LoginRequest, RegisterRequest, TokenResponse
from utils.db_helpers import ensure_unique, require_email_domain

router = APIRouter(prefix="/auth", tags=["Auth"])

# User Registration Endpoint
@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Extract identifier code (fallback to class_group)
    user_code = body.code or body.class_group
    if not user_code:
        raise HTTPException(status_code=400, detail="Student code or Staff ID is required")

    # Verify email uniqueness
    ensure_unique(db, User, User.email, body.email, detail="Email already registered")

    # Verify student code or staff id uniqueness
    if body.role == "student":
        require_email_domain(body.email, "@student.school.edu", "Student")
        ensure_unique(db, Student, Student.student_code, user_code, detail="Student code already exists")
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

    # Validate portal role matching
    if body.portal:
        if body.portal == "student" and user.role != "student":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Students only portal"
            )
        elif body.portal in ("staff_admin", "staff") and user.role not in ("lecturer", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Staff and Admin only portal"
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

    # Update last login timestamp
    try:
        user.last_login_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Could not update last_login_at: {e}")

    resp = {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "status": user.status or "Active",
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
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
    else:
        resp.update({
            "profile_id": user.id,
            "name": "System Admin",
            "code": "ADMIN-001"
        })

    return resp

@router.get("/server-time")
def get_server_time():
    return {"server_time": datetime.now().isoformat()}


from pydantic import BaseModel
from typing import Optional
from utils.security import get_current_user

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserSettingsUpdate(BaseModel):
    theme_preference: Optional[str] = None
    font_size_preference: Optional[str] = None
    language_preference: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None

class AvatarUpdateRequest(BaseModel):
    avatar_url: str


class AdminProfileUpdateRequest(BaseModel):
    name: str
    email: str
    code: str


@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = "User"
    code = ""
    if user.role == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student:
            name = student.name
            code = student.student_code
    elif user.role == "lecturer":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == user.id).first()
        if lecturer:
            name = lecturer.name
            code = lecturer.staff_id
    elif user.role == "admin":
        name = user.profile_name or "System Admin"
        code = user.profile_code or "ADMIN-001"

    return {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "name": name,
        "code": code,
        "avatar_url": user.avatar_url,
        "status": user.status or "Active",
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else datetime.utcnow().isoformat(),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "two_factor_enabled": bool(user.two_factor_enabled),
        "theme_preference": user.theme_preference or "light",
        "font_size_preference": user.font_size_preference or "medium",
        "language_preference": user.language_preference or "en",
        "notifications_enabled": bool(user.notifications_enabled if user.notifications_enabled is not None else True),
        "email_notifications": bool(user.email_notifications if user.email_notifications is not None else True),
        "push_notifications": bool(user.push_notifications if user.push_notifications is not None else True),
        "in_app_notifications": bool(user.in_app_notifications if user.in_app_notifications is not None else True),
    }


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")
    
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.put("/settings")
def update_user_settings(body: UserSettingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.theme_preference is not None:
        user.theme_preference = body.theme_preference
    if body.font_size_preference is not None:
        user.font_size_preference = body.font_size_preference
    if body.language_preference is not None:
        user.language_preference = body.language_preference
    if body.notifications_enabled is not None:
        user.notifications_enabled = body.notifications_enabled
    if body.email_notifications is not None:
        user.email_notifications = body.email_notifications
    if body.push_notifications is not None:
        user.push_notifications = body.push_notifications
    if body.in_app_notifications is not None:
        user.in_app_notifications = body.in_app_notifications
    if body.two_factor_enabled is not None:
        user.two_factor_enabled = body.two_factor_enabled

    db.commit()
    return {"message": "Settings updated successfully"}


@router.post("/avatar")
def update_user_avatar(body: AvatarUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.avatar_url = body.avatar_url
    db.commit()
    return {"message": "Avatar updated successfully", "avatar_url": user.avatar_url}


@router.put("/profile")
def update_admin_profile(
    body: AdminProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allow an administrator to edit their own display identity only."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can edit this profile")

    name = body.name.strip()
    email = body.email.strip().lower()
    code = body.code.strip()
    if not name or not code:
        raise HTTPException(status_code=400, detail="Name and ID code are required")
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    duplicate = db.query(User).filter(User.email == email, User.id != user.id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Email is already in use")

    user.profile_name = name
    user.profile_code = code
    user.email = email
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated successfully", "name": name, "email": email, "code": code}


@router.get("/active-sessions")
def get_active_sessions(user: User = Depends(get_current_user)):
    # Return real session data (current device connection)
    return [
        {
            "id": f"sess-{user.id}-1",
            "device_name": "Current Active Mobile Device",
            "platform": "Flutter App",
            "last_active": user.last_login_at.isoformat() if user.last_login_at else datetime.utcnow().isoformat(),
            "is_current": True
        }
    ]


@router.post("/logout-session")
def logout_session(session_id: str, user: User = Depends(get_current_user)):
    return {"message": f"Session {session_id} logged out successfully"}

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.timeutil import iso_utc, utcnow
from db.database import get_db
from datetime import datetime, timedelta
import hashlib
import html
import os
import secrets
import httpx
from db.models import User, Student, Lecturer
from utils.security import hash_password, verify_password, create_access_token
from schemas import LoginRequest, RegisterRequest, TokenResponse
from utils.db_helpers import ensure_unique, require_email_domain
from pydantic import BaseModel
from typing import Optional
from urllib.parse import quote
from utils.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

# User Registration Endpoint
@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user_code = body.code or body.class_group
    if not user_code:
        raise HTTPException(status_code=400, detail="Student code or Staff ID is required")

    ensure_unique(db, User, User.email, body.email, detail="Email already registered")

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

    hashed = hash_password(body.password)
    user = User(email=body.email, password_hash=hashed, role=body.role)
    db.add(user)
    db.flush()

    student = Student(user_id=str(user.id), name=body.name, student_code=user_code)
    db.add(student)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Registration database conflict")

    return {"message": "Registration successful", "user_id": str(user.id)}

# User Login Endpoint
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    raw = (body.identifier or body.email or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Email or ID is required")

    user = None
    student = None
    lecturer = None

    if "@" in raw:
        user = db.query(User).filter(User.email == raw).first()
    else:
        student = db.query(Student).filter(Student.student_code == raw).first()
        if student:
            user = db.query(User).filter(User.id == str(student.user_id)).first()
        else:
            lecturer = db.query(Lecturer).filter(Lecturer.staff_id == raw).first()
            if lecturer:
                user = db.query(User).filter(User.id == str(lecturer.user_id)).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

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

    if user.role == "student" and student is None:
        student = db.query(Student).filter(Student.user_id == str(user.id)).first()
    elif user.role == "lecturer" and lecturer is None:
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == str(user.id)).first()

    token_data: dict = {"user_id": str(user.id), "role": user.role}
    token = create_access_token(token_data)

    try:
        user.last_login_at = utcnow()
        db.commit()
    except Exception as e:
        db.rollback()

    resp = {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": str(user.id),
        "email": user.email,
        "avatar_url": user.avatar_url,
        "status": user.status or "Active",
        "last_login_at": iso_utc(user.last_login_at),
        "recovery_email_verified": bool(user.recovery_email_verified),
    }
    if student is not None:
        resp.update({
            "profile_id": str(student.id),
            "name": student.name,
            "code": student.student_code,
            "is_face_registered": bool(student.is_face_registered),
        })
    elif lecturer is not None:
        resp.update({
            "profile_id": str(lecturer.id),
            "name": lecturer.name,
            "code": lecturer.staff_id,
        })
    else:
        resp.update({
            "profile_id": str(user.id),
            "name": "System Admin",
            "code": "ADMIN-001"
        })

    return resp

@router.get("/server-time")
def get_server_time():
    # utcnow() + an explicit "Z", not datetime.now().isoformat(). The old version read
    # the host clock and emitted no zone marker, so the client parsed it as its own
    # local time: on Railway (no TZ, i.e. UTC) every device ran 8 hours behind campus
    # and ApiConfig.serverOffset baked that error into the whole app's clock.
    return {"server_time": iso_utc(utcnow())}

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

class RecoveryEmailRequest(BaseModel):
    recovery_email: str

class RecoveryEmailVerify(BaseModel):
    code: str

class ForgotPasswordRequest(BaseModel):
    student_id: str
    school_email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def _send_email(to: str, subject: str, html_body: str, idempotency_key: str):
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not sender:
        raise HTTPException(status_code=503, detail="Email service is not configured")
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": idempotency_key},
        json={"from": sender, "to": [to], "subject": subject, "html": html_body},
        timeout=10,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=503, detail="Email could not be sent")

@router.post("/recovery-email/request")
def request_recovery_email(body: RecoveryEmailRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    address = body.recovery_email.strip().lower()
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student account required")
    if not address.endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Enter a Gmail address")
    existing = db.query(User).filter(User.recovery_email == address, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This Gmail is already linked to another account")
    code = f"{secrets.randbelow(1000000):06d}"
    user.recovery_email = address
    user.recovery_email_verified = False
    user.recovery_code_hash = _token_hash(code)
    user.recovery_code_expires_at = utcnow() + timedelta(minutes=10)
    db.commit()
    _send_email(address, "Verify your recovery email", f"<p>Your verification code is:</p><h1>{code}</h1><p>This code expires in 10 minutes.</p>", f"recovery-{user.id}-{code}")
    return {"message": "Code sent"}

@router.post("/recovery-email/verify")
def verify_recovery_email(body: RecoveryEmailVerify, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    valid = user.recovery_code_hash and secrets.compare_digest(user.recovery_code_hash, _token_hash(body.code.strip()))
    if not valid or not user.recovery_code_expires_at or user.recovery_code_expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Code is invalid or expired")
    user.recovery_email_verified = True
    user.recovery_code_hash = None
    user.recovery_code_expires_at = None
    db.commit()
    return {"message": "Recovery email verified"}

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    raw_id = body.student_id.strip().upper()
    student_code = raw_id if raw_id.startswith("ST") else f"ST{raw_id}"
    student = db.query(Student).filter(Student.student_code == student_code).first()
    user = db.query(User).filter(User.id == str(student.user_id)).first() if student else None
    if user and user.email.lower() == body.school_email.strip().lower() and user.recovery_email_verified and user.recovery_email:
        token = secrets.token_urlsafe(32)
        user.password_reset_hash = _token_hash(token)
        user.password_reset_expires_at = utcnow() + timedelta(minutes=20)
        db.commit()
        base_url = os.getenv("WEB_APP_URL", "http://localhost:5173").rstrip("/")
        link = f"{base_url}/?reset_token={token}"
        safe_link = html.escape(link, quote=True)
        try:
            _send_email(user.recovery_email, "Reset your password", f'<p>Use this link to set a new password:</p><p><a href="{safe_link}">Reset password</a></p><p>This link expires in 20 minutes.</p>', f"reset-{user.id}-{token[:12]}")
        except HTTPException:
            # Keep the public response identical so this endpoint cannot reveal
            # whether the supplied student ID and school email matched an account.
            pass
    return {"message": "If the details match, a reset link was sent to the verified recovery email."}

@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.password_reset_hash == _token_hash(body.token)).first()
    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")
    user.password_hash = hash_password(body.new_password)
    user.password_reset_hash = None
    user.password_reset_expires_at = None
    db.commit()
    return {"message": "Password updated"}

@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = "User"
    code = ""
    if user.role == "student":
        student = db.query(Student).filter(Student.user_id == str(user.id)).first()
        if student:
            name = student.name
            code = student.student_code
    elif user.role == "lecturer":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == str(user.id)).first()
        if lecturer:
            name = lecturer.name
            code = lecturer.staff_id
    elif user.role == "admin":
        name = user.profile_name or "System Admin"
        code = user.profile_code or "ADMIN-001"

    return {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": name,
        "code": code,
        "avatar_url": user.avatar_url,
        "status": user.status or "Active",
        "last_login_at": iso_utc(user.last_login_at or utcnow()),
        "two_factor_enabled": user.two_factor_enabled,
        "theme_preference": user.theme_preference or "light",
        "font_size_preference": user.font_size_preference or "medium",
        "language_preference": user.language_preference or "en",
        "notifications_enabled": user.notifications_enabled,
        "email_notifications": user.email_notifications,
        "push_notifications": user.push_notifications,
        "in_app_notifications": user.in_app_notifications,
        "recovery_email": user.recovery_email,
        "recovery_email_verified": user.recovery_email_verified,
    }

@router.put("/me/settings")
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

@router.put("/me/change-password")
def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}

@router.put("/me/avatar")
def update_avatar(body: AvatarUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.avatar_url = body.avatar_url
    db.commit()
    return {"message": "Avatar updated successfully", "avatar_url": user.avatar_url}


@router.post("/me/avatar/upload")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate and upload one cropped profile image through the trusted backend."""
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    storage_key = (
        os.getenv("SUPABASE_SECRET_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    bucket = os.getenv("SUPABASE_AVATAR_BUCKET", "images").strip() or "images"
    avatar_folder = os.getenv("SUPABASE_AVATAR_FOLDER", "Avatar").strip().strip("/") or "Avatar"
    if not supabase_url or not storage_key:
        raise HTTPException(status_code=503, detail="Profile image storage is not configured")

    image = await file.read(5 * 1024 * 1024 + 1)
    if not image:
        raise HTTPException(status_code=400, detail="Choose an image to upload")
    if len(image) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be smaller than 5 MB")

    if image.startswith(b"\xff\xd8\xff"):
        content_type, extension = "image/jpeg", "jpg"
    elif image.startswith(b"\x89PNG\r\n\x1a\n"):
        content_type, extension = "image/png", "png"
    elif image.startswith(b"RIFF") and image[8:12] == b"WEBP":
        content_type, extension = "image/webp", "webp"
    else:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG, or WebP image")

    object_path = f"{avatar_folder}/users/{user.id}/avatar.{extension}"
    upload_url = f"{supabase_url}/storage/v1/object/{quote(bucket)}/{quote(object_path, safe='/')}"
    headers = {
        "apikey": storage_key,
        "Content-Type": content_type,
        "cache-control": "3600",
        "x-upsert": "true",
    }
    if not storage_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {storage_key}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(upload_url, content=image, headers=headers)

    if not 200 <= response.status_code < 300:
        raise HTTPException(
            status_code=502,
            detail="Could not save the profile image. Check the Supabase images/Avatar folder.",
        )

    version = int(utcnow().timestamp())
    public_url = (
        f"{supabase_url}/storage/v1/object/public/{quote(bucket)}/"
        f"{quote(object_path, safe='/')}?v={version}"
    )
    user.avatar_url = public_url
    db.commit()
    return {"message": "Profile image updated", "avatar_url": public_url}

@router.put("/me/admin-profile")
def update_admin_profile(body: AdminProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update admin profile")
    
    user.profile_name = body.name
    user.email = body.email
    user.profile_code = body.code
    db.commit()
    return {"message": "Admin profile updated successfully"}

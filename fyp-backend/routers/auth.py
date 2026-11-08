import hashlib
import os
import secrets
from datetime import timedelta
from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, StrictBool
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AuthAttempt, AuthLoginChallenge, Lecturer, Student, User
from schemas import LoginRequest, TokenResponse, LoginChallengeResponse
from domain.account_security import (active, token_hash, lock_user, factor_for, check_factor_limit,
    verify_factor, new_session, revoke_all)
from domain import personal_email
from integrations import resend_mail
from utils.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from utils.timeutil import iso_utc, utcnow

router = APIRouter(prefix="/auth", tags=["Auth"])

# Accounts are created by an administrator from the approved student and staff records. A typed school-looking address is not proof of
# being a student, so nobody can register themselves.
@router.post("/register", status_code=403)
def register():
    raise HTTPException(status_code=403, detail="Accounts are created by an administrator.")

# User Login Endpoint
@router.post("/login", response_model=TokenResponse | LoginChallengeResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    raw = (body.identifier or body.email or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Email or ID is required")

    attempt_key = token_hash(raw.lower())
    # Reserve the bucket atomically: concurrent first attempts must not lose failures.
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    db.execute(insert(AuthAttempt).values(key=attempt_key, failures=0, updated_at=utcnow()).on_conflict_do_nothing(index_elements=['key']))
    attempt = db.query(AuthAttempt).filter_by(key=attempt_key).with_for_update().first()
    if attempt and attempt.blocked_until and attempt.blocked_until > utcnow():
        raise HTTPException(429, 'Too many login attempts. Try again in 15 minutes.')

    user = None

    if "@" in raw:
        # Only the account's own sign-in email (the school address). recovery_email is never looked at here.
        user = db.query(User).filter(func.lower(User.email) == raw.lower()).first()
    else:
        # A student has no ID sign-in: only staff sign in with their staff ID.
        lecturer = db.query(Lecturer).filter(Lecturer.staff_id == raw).first()
        if lecturer:
            user = db.query(User).filter(User.id == str(lecturer.user_id)).first()

    # A student account counts only with its approved school address and its Student record; otherwise it fails like a wrong password.
    if user and user.role == "student" and not _approved_student(db, user):
        user = None

    verified_hash = user.password_hash if user else None
    if not user or not verify_password(body.password, verified_hash):
        if not attempt:
            attempt = AuthAttempt(key=attempt_key, failures=0, updated_at=utcnow())
            db.add(attempt)
        if (utcnow() - attempt.updated_at).total_seconds() > 900:
            attempt.failures = 0
        attempt.failures += 1
        attempt.updated_at = utcnow()
        attempt.blocked_until = utcnow() + timedelta(minutes=15) if attempt.failures >= 5 else None
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
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

    user = lock_user(db, user.id)
    if user.password_hash != verified_hash and not verify_password(body.password, user.password_hash):
        raise HTTPException(401, 'Password changed. Sign in again.')
    if attempt:
        attempt.failures, attempt.blocked_until, attempt.updated_at = 0, None, utcnow()
    label = 'Mobile device' if body.device_id else 'Web browser'
    if user.two_factor_enabled:
        factor = factor_for(db, user.id)
        check_factor_limit(factor)
        if not factor.secret:
            raise HTTPException(409, 'Authenticator setup is incomplete. Contact the administrator.')
        challenge = secrets.token_urlsafe(32)
        db.add(AuthLoginChallenge(token_hash=token_hash(challenge), user_id=user.id,
            auth_version=user.auth_version, expires_at=utcnow() + timedelta(minutes=5), device_label=label))
        db.commit()
        return {'requires_two_factor': True, 'challenge_token': challenge, 'expires_in': 300}
    return _login_response(db, user, label)


def _approved_student(db, user) -> bool:
    return personal_email.is_student_identity(user.email) and db.query(Student.id).filter(Student.user_id == str(user.id)).first() is not None


def _login_response(db, user, label):
    student, lecturer = None, None
    if user.role == "student":
        student = db.query(Student).filter(Student.user_id == str(user.id)).first()
    elif user.role == "lecturer":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == str(user.id)).first()

    session = new_session(db, user, label)
    token = create_access_token({'user_id': str(user.id), 'role': user.role, 'sid': str(session.id)},
                                expires_delta=session.expires_at - utcnow())
    db.commit()  # Never issue a usable token if persistence failed.

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
        "recovery_prompt_dismissed": bool(user.recovery_prompt_dismissed),
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
            "staff_role": lecturer.role,
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


class MFALogin(BaseModel):
    challenge_token: str = Field(min_length=32, max_length=128)
    code: str = Field(min_length=6, max_length=32)


@router.post('/login/verify', response_model=TokenResponse)
def verify_login(body: MFALogin, db: Session = Depends(get_db)):
    challenge = db.get(AuthLoginChallenge, token_hash(body.challenge_token))
    if not challenge:
        raise HTTPException(401, 'Login verification expired. Sign in again.')
    user = lock_user(db, challenge.user_id)
    challenge = db.query(AuthLoginChallenge).filter_by(token_hash=challenge.token_hash).populate_existing().with_for_update().first()
    if challenge.consumed_at or challenge.expires_at <= utcnow() or challenge.auth_version != user.auth_version:
        raise HTTPException(401, 'Login verification expired. Sign in again.')
    if not user.two_factor_enabled:
        raise HTTPException(401, 'Account security changed. Sign in again.')
    if user.role == "student" and not _approved_student(db, user):
        raise HTTPException(401, 'Login verification expired. Sign in again.')
    verify_factor(db, factor_for(db, user.id), body.code)
    challenge.consumed_at = utcnow()
    return _login_response(db, user, challenge.device_label)

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

PET_CHOICES = ("luna-techbot", "hoodie-cat")
DEFAULT_PET = "luna-techbot"


class PetPosition(BaseModel):
    dx: int = Field(ge=0, le=10000)
    dy: int = Field(ge=0, le=10000)


class UserSettingsUpdate(BaseModel):
    recovery_prompt_dismissed: Optional[bool] = None
    pet_visible: Optional[StrictBool] = None
    pet_choice: Optional[Literal["luna-techbot", "hoodie-cat"]] = None
    pet_position: Optional[PetPosition] = None
    theme_preference: Optional[Literal["light", "dark", "system", "cycle"]] = None   # cycle = Day/Night by campus time
    font_size_preference: Optional[str] = None
    language_preference: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None
    push_quiet_enabled: Optional[bool] = None
    push_quiet_start: Optional[int] = Field(default=None, ge=0, le=1439)
    push_quiet_end: Optional[int] = Field(default=None, ge=0, le=1439)
    push_timezone: Optional[str] = Field(default=None, max_length=64)

class AvatarUpdateRequest(BaseModel):
    # A web link only: picked files go through /me/avatar/upload, so no base64 image bloats every profile and login response.
    avatar_url: str = Field(max_length=2048, pattern=r"^https?://\S+$")

class AdminProfileUpdateRequest(BaseModel):
    name: str
    email: str
    code: str

class RecoveryEmailRequest(BaseModel):
    recovery_email: str

class RecoveryEmailVerify(BaseModel):
    code: str

class ForgotPasswordRequest(BaseModel):
    school_email: str = Field(max_length=255)   # PASSWORD-RESET-PAGE-18: the school email alone; an old client's extra student_id is ignored

class ResetPasswordRequest(BaseModel):
    token: str = Field(max_length=128)
    new_password: str = Field(max_length=128)

class ResetTokenCheck(BaseModel):
    token: str = Field(max_length=128)

def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

RECOVERY_CODE_MINUTES, RECOVERY_RESEND_SECONDS, RECOVERY_VERIFY_TRIES = 10, 60, 5


def _mail(to: str, subject: str, text: str, idempotency_key: str):
    """Send one account email; a provider failure is a short 503, never a claim that it was sent."""
    try:
        resend_mail.send(to, subject, text, idempotency_key)
    except resend_mail.EmailError:
        raise HTTPException(status_code=503, detail="The email could not be sent. Please try again.")


@router.post("/recovery-email/request")
def request_recovery_email(body: RecoveryEmailRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student account required")
    address = personal_email.require_linkable(db, user, body.recovery_email)
    if user.recovery_email_verified and personal_email.normalized(user.recovery_email) == address:
        return {"message": "Already verified"}
    issued = user.recovery_code_expires_at - timedelta(minutes=RECOVERY_CODE_MINUTES) if user.recovery_code_expires_at else None
    if issued and (utcnow() - issued).total_seconds() < RECOVERY_RESEND_SECONDS:
        raise HTTPException(status_code=429, detail="Please wait a minute before asking for another code.")
    code = f"{secrets.randbelow(1000000):06d}"
    # The address stays PENDING (not verified) until its owner enters the code; a pending or replaced address is never a destination.
    user.recovery_email = address
    user.recovery_email_verified = False
    user.recovery_code_hash = _token_hash(code)
    user.recovery_code_expires_at = utcnow() + timedelta(minutes=RECOVERY_CODE_MINUTES)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email cannot be used.")
    try:
        _mail(address, "Verify your recovery email", f"Your verification code is {code}.\n\nIt expires in {RECOVERY_CODE_MINUTES} minutes.", f"recovery-{user.id}-{code}")
    except HTTPException:
        user.recovery_code_hash = user.recovery_code_expires_at = None   # nothing was sent: no code to guess, and an immediate retry is allowed
        db.commit()
        raise
    return {"message": "Code sent"}

@router.post("/recovery-email/verify")
def verify_recovery_email(body: RecoveryEmailVerify, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = _token_hash(f"recovery-verify:{user.id}")
    tries = db.query(AuthAttempt).filter_by(key=key).first()
    if tries and tries.blocked_until and tries.blocked_until > utcnow():
        raise HTTPException(status_code=429, detail="Too many wrong codes. Ask for a new code later.")
    valid = user.recovery_code_hash and secrets.compare_digest(user.recovery_code_hash, _token_hash(body.code.strip()))
    if not valid or not user.recovery_code_expires_at or user.recovery_code_expires_at < utcnow():
        # A six-digit code must not be guessable: after a few wrong tries it is destroyed.
        tries = tries or AuthAttempt(key=key, failures=0, updated_at=utcnow())
        db.add(tries)
        tries.failures, tries.updated_at = (tries.failures or 0) + 1, utcnow()
        if tries.failures >= RECOVERY_VERIFY_TRIES:
            tries.failures, tries.blocked_until = 0, utcnow() + timedelta(minutes=15)
            user.recovery_code_hash = user.recovery_code_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Code is invalid or expired")
    if tries:
        db.delete(tries)
    user.recovery_email_verified = True
    user.recovery_code_hash = None
    user.recovery_code_expires_at = None
    db.commit()
    return {"message": "Recovery email verified"}

RESET_LINK_MINUTES, RESET_RESEND_SECONDS = 20, 60


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    """A reset link goes to the account's VERIFIED personal email. The answer is the same whatever happens (unknown address, staff or
    personal address, no verified link, a link sent a moment ago, a provider failure), so it never shows whether an account exists."""
    school_email = personal_email.normalized(body.school_email)
    user = db.query(User).filter(func.lower(User.email) == school_email).first() if personal_email.is_student_identity(school_email) else None
    address = personal_email.deliverable_address(user) if user and _approved_student(db, user) else None
    issued = user.password_reset_expires_at - timedelta(minutes=RESET_LINK_MINUTES) if user and address and user.password_reset_expires_at else None
    if address and not (issued and (utcnow() - issued).total_seconds() < RESET_RESEND_SECONDS):
        token = secrets.token_urlsafe(32)
        user.password_reset_hash = _token_hash(token)
        user.password_reset_expires_at = utcnow() + timedelta(minutes=RESET_LINK_MINUTES)
        db.commit()
        base_url = os.getenv("WEB_APP_URL", "http://localhost:5173").rstrip("/")
        link = f"{base_url}/login/reset?token={token}"
        # Sent after the answer, so a matching account does not make the reply slower than an unknown one.
        background.add_task(_send_reset_link, db, user.id, user.password_reset_hash, address, link, f"reset-{user.id}-{token[:12]}")
    return {"message": "If this school email has a verified recovery email, a reset link has been sent to it."}


def _send_reset_link(db: Session, user_id, token_digest: str, address: str, link: str, idempotency_key: str):
    try:
        text = f"Open this link to set a new password for your school account:\n\n{link}\n\nThis link works once and expires in {RESET_LINK_MINUTES} minutes."
        resend_mail.send(address, "Reset your password", text, idempotency_key)
    except resend_mail.EmailError:
        # Nothing was delivered: drop that unusable link (not a newer one) so the student can ask again at once.
        try:
            user = db.get(User, user_id)
            if user and user.password_reset_hash == token_digest:
                user.password_reset_hash = user.password_reset_expires_at = None
                db.commit()
        except Exception:
            db.rollback()


def _reset_user(db: Session, token: str, lock: bool = False):
    query = db.query(User).filter(User.password_reset_hash == _token_hash(token))
    user = (query.with_for_update() if lock else query).first()
    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid, expired or already used.")
    return user


@router.post("/reset-password/check")
def check_reset_token(body: ResetTokenCheck, db: Session = Depends(get_db)):
    """Lets the reset page say at once that a link is no longer usable, before a new password is typed. It never names the account."""
    _reset_user(db, body.token)
    return {"valid": True}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = _reset_user(db, body.token, lock=True)
    user.password_hash = hash_password(body.new_password)
    user.password_reset_hash = None
    user.password_reset_expires_at = None
    revoke_all(db, user)
    db.commit()
    return {"message": "Password updated"}

@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = "User"
    code = ""
    staff_role = None
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
            staff_role = lecturer.role
    elif user.role == "admin":
        name = user.profile_name or "System Admin"
        code = user.profile_code or "ADMIN-001"

    return {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": name,
        "staff_role": staff_role,
        "code": code,
        "avatar_url": user.avatar_url,
        "status": user.status or "Active",
        "last_login_at": iso_utc(user.last_login_at or utcnow()),
        "two_factor_enabled": user.two_factor_enabled,
        "push_quiet_enabled": user.push_quiet_enabled,
        "push_quiet_start": user.push_quiet_start,
        "push_quiet_end": user.push_quiet_end,
        "push_timezone": user.push_timezone,
        "theme_preference": user.theme_preference or "light",
        "font_size_preference": user.font_size_preference or "medium",
        "language_preference": user.language_preference or "en",
        "notifications_enabled": user.notifications_enabled,
        "email_notifications": user.email_notifications,
        "push_notifications": user.push_notifications,
        "in_app_notifications": user.in_app_notifications,
        "recovery_email": user.recovery_email,
        "recovery_email_verified": user.recovery_email_verified,
        "recovery_prompt_dismissed": bool(user.recovery_prompt_dismissed),
        # Raw so the client can tell "never chosen" (null) from an explicit choice when carrying over an old browser-only setting.
        "pet_visible": user.pet_visible,
        "pet_choice": user.pet_choice if user.pet_choice in PET_CHOICES else DEFAULT_PET,
        "pet_position": {"dx": user.pet_offset_x, "dy": user.pet_offset_y} if user.pet_offset_x is not None and user.pet_offset_y is not None else None,
    }

@router.put("/me/settings")
def update_user_settings(body: UserSettingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.two_factor_enabled is not None and body.two_factor_enabled != user.two_factor_enabled:
        raise HTTPException(400, 'Use verified authenticator setup or disable verification to change 2FA.')
    if body.push_timezone is not None:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(body.push_timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise HTTPException(400, 'Select a valid notification timezone.')
    if body.recovery_prompt_dismissed is not None:
        if user.role != "student":
            raise HTTPException(status_code=403, detail="Student account required")
        user.recovery_prompt_dismissed = body.recovery_prompt_dismissed
    if body.pet_visible is not None:
        user.pet_visible = body.pet_visible
    if body.pet_choice is not None:
        user.pet_choice = body.pet_choice
    if body.pet_position is not None:
        user.pet_offset_x, user.pet_offset_y = body.pet_position.dx, body.pet_position.dy
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
    for field in ('push_quiet_enabled', 'push_quiet_start', 'push_quiet_end', 'push_timezone'):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)
    
    db.commit()
    return {"message": "Settings updated successfully"}

@router.put("/me/change-password")
def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    user.password_hash = hash_password(body.new_password)
    revoke_all(db, user)
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

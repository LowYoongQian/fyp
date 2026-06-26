import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import User, DeviceSession

# Configurations
SECRET_KEY  = os.getenv("JWT_SECRET_KEY")
ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MINS = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

# Fail fast rather than silently signing tokens with a guessable default.
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Define it in fyp-backend/.env "
        "(generate one with: python -c \"import secrets; print(secrets.token_hex(32))\")"
    )

oauth2_scheme  = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Password utility functions using native bcrypt (bypasses buggy passlib)
def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        plain_bytes = plain.encode("utf-8")
        hashed_bytes = hashed.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

# JWT generation
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=EXPIRE_MINS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# JWT decoding and verification
def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# FastAPI dependency to fetch currently logged in user
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    payload = decode_token(token)
    user_id: int = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Multi-device binding check: if the token carries a device_id, verify it
    # matches the binding registered at login. A mismatch means the token is
    # being used from a second device — reject it.
    token_device_id: str | None = payload.get("device_id")
    if token_device_id:
        binding = db.query(DeviceSession).filter(DeviceSession.user_id == user_id).first()
        if not binding or binding.device_id != token_device_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session invalidated: this account has been logged in from another device.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return user

# Role validation dependency: Lecturer or Admin
def require_lecturer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("lecturer", "admin"):
        raise HTTPException(status_code=403, detail="Lecturer or Admin permission required")
    return current_user

# Role validation dependency: Student
def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student permission required")
    return current_user

# Role validation dependency: Admin
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")
    return current_user

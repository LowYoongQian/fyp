from sqlalchemy.orm import Session
from db.models import AuditLog, User
from typing import Optional
from contextvars import ContextVar


_request_client_ip: ContextVar[Optional[str]] = ContextVar("audit_client_ip", default=None)


def set_audit_client_ip(ip_address: str):
    return _request_client_ip.set(ip_address)


def reset_audit_client_ip(token) -> None:
    _request_client_ip.reset(token)


def log_admin_action(db: Session, current_user: User, action: str, details: str) -> Optional[AuditLog]:
    """Record an admin action, deriving the actor fields from `current_user`.

    Every admin endpoint passed the same four values (id, profile_name or email,
    "admin", "admin") to log_audit_event, so they are stated once here instead of
    at each call site.
    """
    return log_audit_event(
        db,
        user_id=str(current_user.id),
        user_name=current_user.profile_name or current_user.email,
        user_role="admin",
        category="admin",
        action=action,
        details=details,
    )


def log_audit_event(
    db: Session,
    *,
    user_id: Optional[str] = None,
    user_name: str = "System Administrator",
    user_role: str = "admin",
    category: str = "admin",  # 'admin' | 'staff'
    action: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Helper function to insert a real-time audit log into Supabase audit_logs table."""
    try:
        log = AuditLog(
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            category=category.lower(),
            action=action,
            details=details,
            ip_address=ip_address or _request_client_ip.get() or "127.0.0.1"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    except Exception as exc:
        db.rollback()
        print(f"⚠️ Audit logging warning: {exc}")
        return None

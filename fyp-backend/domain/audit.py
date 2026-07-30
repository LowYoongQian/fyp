from sqlalchemy.orm import Session
from db.models import AuditLog
from typing import Optional

def log_audit_event(
    db: Session,
    *,
    user_id: Optional[str] = None,
    user_name: str = "System Administrator",
    user_role: str = "admin",
    category: str = "admin",  # 'admin' | 'staff'
    action: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = "127.0.0.1"
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
            ip_address=ip_address or "127.0.0.1"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    except Exception as exc:
        db.rollback()
        print(f"⚠️ Audit logging warning: {exc}")
        return None

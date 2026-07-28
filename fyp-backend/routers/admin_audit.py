from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel

from utils.database import get_db
from utils.models import User, AuditLog
from utils.security import require_admin

router = APIRouter(prefix="/admin/audit", tags=["Admin Audit"])

class AuditLogResponse(BaseModel):
    id: Any
    user_id: Optional[Any] = None
    user_name: str
    user_role: str
    category: str
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = "127.0.0.1"
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogCreate(BaseModel):
    category: str = "admin"
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = "127.0.0.1"

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    category: Optional[str] = Query(None), # 'admin' | 'staff' | 'all'
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(AuditLog)
    if category and category.lower() != "all":
        query = query.filter(AuditLog.category == category.lower())
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (AuditLog.user_name.ilike(pattern)) |
            (AuditLog.action.ilike(pattern)) |
            (AuditLog.details.ilike(pattern)) |
            (AuditLog.ip_address.ilike(pattern))
        )
    return query.order_by(AuditLog.created_at.desc()).all()


@router.post("/logs", response_model=AuditLogResponse, status_code=201)
def create_audit_log(
    body: AuditLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    log = AuditLog(
        user_id=current_user.id,
        user_name=current_user.profile_name or current_user.email,
        user_role=current_user.role,
        category=body.category.lower(),
        action=body.action,
        details=body.details,
        ip_address=body.ip_address or "127.0.0.1"
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

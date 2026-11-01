from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime, timezone
import ipaddress
import os
import time
import httpx
from pydantic import BaseModel

from db.database import get_db
from db.models import User, AuditLog
from domain.audit import log_audit_event
from integrations.network_verify import normalize_client_ip
from schemas import UtcDateTime
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
    created_at: UtcDateTime

    class Config:
        from_attributes = True

class AuditLogCreate(BaseModel):
    category: str = "admin"
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None


class AuditIPLocationResponse(BaseModel):
    available: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    resolved_ip: Optional[str] = None
    network: Optional[str] = None
    is_approximate: bool = True
    source_kind: str = "public"
    message: Optional[str] = None


class AuditMapConfigResponse(BaseModel):
    api_key: str


_location_cache: dict[str, tuple[float, AuditIPLocationResponse]] = {}
_LOCATION_CACHE_SECONDS = 3600


@router.get("/map-config", response_model=AuditMapConfigResponse)
def get_audit_map_config(current_user: User = Depends(require_admin)):
    del current_user
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        return AuditMapConfigResponse(api_key="")
    return AuditMapConfigResponse(api_key=api_key)

def _utc_bound(value: Optional[datetime], label: str) -> Optional[datetime]:
    """Stored audit times are naive UTC; a bound must say which instant it means, so a bare local time is refused."""
    if value is None:
        return None
    if value.tzinfo is None:
        raise HTTPException(422, f"{label} must include a timezone offset, for example +08:00.")
    return value.astimezone(timezone.utc).replace(tzinfo=None)


@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    category: Optional[str] = Query(None), # 'admin' | 'staff' | 'all'
    search: Optional[str] = Query(None),
    # Half-open range: created_from is inclusive, created_to is EXCLUSIVE, so a whole local day is [00:00, next 00:00)
    # and an inclusive end minute is sent as the following minute. Both are applied before ordering.
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    start, end = _utc_bound(created_from, "created_from"), _utc_bound(created_to, "created_to")
    if start and end and end <= start:
        raise HTTPException(422, "The end of the range must be after its start.")
    query = db.query(AuditLog)
    if start:
        query = query.filter(AuditLog.created_at >= start)
    if end:
        query = query.filter(AuditLog.created_at < end)
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
    return log_audit_event(
        db,
        user_id=str(current_user.id),
        user_name=current_user.profile_name or current_user.email,
        user_role=current_user.role,
        category=body.category,
        action=body.action,
        details=body.details,
        # Never trust a browser-supplied address for an audit record.
        ip_address=None,
    )


@router.get("/ip-location", response_model=AuditIPLocationResponse)
async def get_audit_ip_location(
    ip: str = Query(..., min_length=2, max_length=64),
    current_user: User = Depends(require_admin),
):
    del current_user
    normalized_ip = normalize_client_ip(ip)
    try:
        parsed_ip = ipaddress.ip_address(normalized_ip)
    except ValueError:
        return AuditIPLocationResponse(
            available=False,
            source_kind="invalid",
            message="Location unavailable",
        )

    cached = _location_cache.get(normalized_ip)
    if cached and time.monotonic() - cached[0] < _LOCATION_CACHE_SECONDS:
        return cached[1]

    is_local = parsed_ip.is_loopback or parsed_ip.is_private or parsed_ip.is_link_local
    lookup_url = "https://ipwho.is/" if is_local else f"https://ipwho.is/{normalized_ip}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(lookup_url)
            response.raise_for_status()
            data = response.json()

        if not data.get("success", True) or data.get("latitude") is None or data.get("longitude") is None:
            raise ValueError("No coordinates returned")

        connection = data.get("connection") or {}
        result = AuditIPLocationResponse(
            available=True,
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            city=data.get("city"),
            region=data.get("region"),
            country=data.get("country"),
            resolved_ip=data.get("ip") or normalized_ip,
            network=connection.get("isp") or connection.get("org"),
            is_approximate=True,
            source_kind="local_egress" if is_local else "public",
            message="Approximate network location",
        )
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        result = AuditIPLocationResponse(
            available=False,
            resolved_ip=normalized_ip,
            source_kind="local" if is_local else "public",
            message="Location unavailable",
        )

    _location_cache[normalized_ip] = (time.monotonic(), result)
    return result

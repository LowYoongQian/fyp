from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from utils.database import get_db
from utils.models import User, Announcement, CampusNetwork, SecuritySetting
from utils.security import require_admin
from utils.schemas import (
    AnnouncementCreate, AnnouncementResponse,
    CampusNetworkCreate, CampusNetworkUpdate, CampusNetworkResponse,
    SecuritySettingsUpdate, MessageResponse
)

router = APIRouter(prefix="/admin", tags=["Admin Config"])

# =====================================================================
# ANNOUNCEMENTS CRUD
# =====================================================================

@router.get("/announcements", response_model=List[AnnouncementResponse])
def get_announcements(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).all()
    return announcements

@router.post("/announcements", response_model=AnnouncementResponse, status_code=201)
def create_announcement(body: AnnouncementCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = Announcement(
        title=body.title,
        content=body.content,
        faculty=body.faculty,
        department=body.department,
        is_draft=body.is_draft,
        priority=body.priority,
        image_base64=body.image_base64,
        publish_start=body.publish_start,
        publish_end=body.publish_end,
        target_scope=body.target_scope,
        target_role=body.target_role,
        target_programme_code=body.target_programme_code if body.target_scope == "programme" else None,
        target_course_code=body.target_course_code if body.target_scope == "course" else None,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement

@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(announcement_id: int, body: AnnouncementCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    announcement.title = body.title
    announcement.content = body.content
    announcement.faculty = body.faculty
    announcement.department = body.department
    announcement.is_draft = body.is_draft
    announcement.priority = body.priority
    announcement.image_base64 = body.image_base64
    announcement.publish_start = body.publish_start
    announcement.publish_end = body.publish_end
    announcement.target_scope = body.target_scope
    announcement.target_role = body.target_role
    announcement.target_programme_code = body.target_programme_code if body.target_scope == "programme" else None
    announcement.target_course_code = body.target_course_code if body.target_scope == "course" else None

    db.commit()
    db.refresh(announcement)
    return announcement

@router.delete("/announcements/{announcement_id}", response_model=MessageResponse)
def delete_announcement(announcement_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}


# =====================================================================
# CAMPUS NETWORK WHITELIST CRUD (Network-based location verification)
# =====================================================================

@router.get("/campus-networks", response_model=List[CampusNetworkResponse])
def get_campus_networks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(CampusNetwork).order_by(CampusNetwork.id).all()


def _validate_cidr(cidr: str):
    import ipaddress
    try:
        ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid CIDR/subnet: '{cidr}'. Example: 10.52.0.0/16")


@router.post("/campus-networks", response_model=CampusNetworkResponse, status_code=201)
def create_campus_network(body: CampusNetworkCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not (body.cidr or body.ssid or body.bssid_prefix):
        raise HTTPException(status_code=400, detail="Provide at least one rule: CIDR, SSID, or BSSID prefix.")
    if body.cidr:
        _validate_cidr(body.cidr)
    net = CampusNetwork(
        label=body.label,
        cidr=body.cidr,
        ssid=body.ssid,
        bssid_prefix=body.bssid_prefix,
        is_active=body.is_active,
    )
    db.add(net)
    db.commit()
    db.refresh(net)
    return net


@router.put("/campus-networks/{net_id}", response_model=CampusNetworkResponse)
def update_campus_network(net_id: int, body: CampusNetworkUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    net = db.query(CampusNetwork).filter(CampusNetwork.id == net_id).first()
    if not net:
        raise HTTPException(status_code=404, detail="Campus network rule not found")
    if body.cidr is not None and body.cidr != "":
        _validate_cidr(body.cidr)
    for field in ("label", "cidr", "ssid", "bssid_prefix", "is_active"):
        val = getattr(body, field)
        if val is not None:
            setattr(net, field, val)
    db.commit()
    db.refresh(net)
    return net


@router.delete("/campus-networks/{net_id}", response_model=MessageResponse)
def delete_campus_network(net_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    net = db.query(CampusNetwork).filter(CampusNetwork.id == net_id).first()
    if not net:
        raise HTTPException(status_code=404, detail="Campus network rule not found")
    db.delete(net)
    db.commit()
    return {"message": "Campus network rule deleted"}


# =====================================================================
# SECURITY SETTINGS (policy toggles for network verification)
# =====================================================================

ALLOWED_SETTING_KEYS = {
    "network_check_enabled", "fail_closed", "trust_proxy_header",
    "demo_simulate_network", "demo_simulated_ip"
}

@router.get("/security-settings", response_model=dict)
def get_security_settings(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rows = db.query(SecuritySetting).all()
    return {r.key: r.value for r in rows}


@router.put("/security-settings", response_model=dict)
def update_security_settings(body: SecuritySettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    for key, value in body.settings.items():
        if key not in ALLOWED_SETTING_KEYS:
            continue
        if key == "demo_simulated_ip" and value.strip():
            import ipaddress
            try:
                ipaddress.ip_address(value.strip())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid simulated IP: '{value}'")
        row = db.query(SecuritySetting).filter(SecuritySetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SecuritySetting(key=key, value=value))
    db.commit()
    rows = db.query(SecuritySetting).all()
    return {r.key: r.value for r in rows}

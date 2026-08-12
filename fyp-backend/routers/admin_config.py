from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Union, Optional

from domain.security_settings import is_enabled
from integrations.network_verify import get_client_ip
from db.database import get_db
import ipaddress
import socket
from db.models import User, Announcement, CampusNetwork, SecuritySetting
from utils.security import require_admin
from utils.db_helpers import get_or_404
from schemas import (
    AnnouncementCreate, AnnouncementResponse,
    CampusNetworkCreate, CampusNetworkUpdate, CampusNetworkResponse,
    SecuritySettingsUpdate, MessageResponse
)
from domain.audit import log_audit_event

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
        publisher=body.publisher or "ADMIN",
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
    log_audit_event(
        db,
        user_id=str(current_user.id),
        user_name=current_user.profile_name or current_user.email,
        user_role="admin",
        category="admin",
        action="CREATE_ANNOUNCEMENT",
        details=f"Created announcement: '{announcement.title}'"
    )
    return announcement

@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(announcement_id: Union[int, str], body: AnnouncementCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = get_or_404(db, Announcement, str(announcement_id), "Announcement")
        
    announcement.title = body.title
    announcement.content = body.content
    announcement.faculty = body.faculty
    announcement.department = body.department
    announcement.is_draft = body.is_draft
    announcement.priority = body.priority
    announcement.publisher = body.publisher or "ADMIN"
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
def delete_announcement(announcement_id: Union[int, str], db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = get_or_404(db, Announcement, str(announcement_id), "Announcement")
        
    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}


# ASSUMPTION: Server and student client devices share the same local network subnet without NAT in between,
# unless reverse proxy headers (X-Forwarded-For) are explicitly trusted via the Security Settings policy.

@router.get("/detect-connection")
def detect_connection(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Same policy read the check-in path uses, so both agree on what "trusted" means.
    trust_proxy = is_enabled(db, "trust_proxy_header")

    client_ip = get_client_ip(request, trust_proxy) or "127.0.0.1"

    # Resolve local LAN/Wi-Fi socket interface IP if client is on loopback
    ipv6_address = None
    if client_ip in ("127.0.0.1", "::1", "localhost"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            lan_ip = s.getsockname()[0]
            s.close()
            if lan_ip and lan_ip not in ("127.0.0.1", "::1"):
                client_ip = lan_ip
        except Exception:
            pass

    # Try resolving host machine IPv6 address
    try:
        s6 = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        s6.connect(('2001:4860:4860::8888', 80))
        ipv6_address = s6.getsockname()[0]
        s6.close()
    except Exception:
        try:
            addr_info = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET6)
            for item in addr_info:
                ip = item[4][0]
                if not ip.startswith("::1"):
                    ipv6_address = ip
                    break
        except Exception:
            ipv6_address = None

    try:
        ip_obj = ipaddress.ip_address(client_ip)
        if ip_obj.version == 4:
            network = ipaddress.ip_network(f"{client_ip}/24", strict=False)
            cidr = str(network)
            subnet_name = f"Detected Active Subnet ({cidr})"
        else:
            cidr = f"{client_ip}/128"
            subnet_name = f"Detected IPv6 Connection ({client_ip})"
            ipv6_address = client_ip
    except Exception:
        cidr = f"{client_ip}/32"
        subnet_name = f"Detected Connection ({client_ip})"

    return {
        "client_ip": client_ip,
        "ipv6_address": ipv6_address,
        "cidr": cidr,
        "label": subnet_name,
        "user_agent": request.headers.get("user-agent", "Browser Client") if request else "Unknown Client",
        "protocol": "HTTP Connection"
    }


@router.get("/campus-networks", response_model=List[CampusNetworkResponse])
def get_campus_networks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(CampusNetwork).order_by(CampusNetwork.id).all()


def _validate_cidr(cidr: str):
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
def update_campus_network(net_id: Union[int, str], body: CampusNetworkUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    net = get_or_404(db, CampusNetwork, str(net_id), detail="Campus network rule not found")
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
def delete_campus_network(net_id: Union[int, str], db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    net = get_or_404(db, CampusNetwork, str(net_id), detail="Campus network rule not found")
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

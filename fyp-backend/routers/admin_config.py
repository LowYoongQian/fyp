from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Union, Optional

from domain.security_settings import is_enabled, get_settings, truthy, development_network_demo_allowed
from integrations.network_verify import (get_server_local_ip, get_server_wifi_details, hosted_deployment, lookup_public_ip,
                                         resolve_client_ip)
from db.database import get_db
import ipaddress
import os
import socket
from db.models import User, Announcement, CampusNetwork, SecuritySetting
from integrations.announcement_files import attachment_response
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
        target_group=body.target_group if body.target_scope == "course" else None,
        external_link=body.external_link,
        creator_user_id=current_user.id,
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
    announcement.target_group = (body.target_group or announcement.target_group) if body.target_scope == "course" else None
    announcement.external_link = body.external_link if body.external_link is not None else announcement.external_link

    db.commit()
    db.refresh(announcement)
    return announcement

@router.get("/announcements/{announcement_id}/attachment")
def announcement_attachment(announcement_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """The file on any notice (a lecturer's course notice can carry one), for the administrator who manages it."""
    return attachment_response(get_or_404(db, Announcement, str(announcement_id), "Announcement"))


@router.delete("/announcements/{announcement_id}", response_model=MessageResponse)
def delete_announcement(announcement_id: Union[int, str], db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    announcement = get_or_404(db, Announcement, str(announcement_id), "Announcement")
        
    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}


@router.get("/detect-connection")
def detect_connection(request: Request, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """The admin's router as check-in will see it. First its ISP public address: a deployed server sees every phone on that
    Wi-Fi as that one address. Then its local Wi-Fi range, which only a server running on that same Wi-Fi sees."""
    # Same policy read the check-in path uses, so both agree on what "trusted" means.
    client_ip, reason = resolve_client_ip(request, is_enabled(db, "trust_proxy_header"))
    if not client_ip:
        # The reason is a short code for the administrator (e.g. client_ip_missing), never a header value.
        raise HTTPException(503, f"Unable to verify your network ({reason}). Check CLIENT_IP_SOURCE and the proxy settings, or enter the campus IP range manually.")
    try:
        observed = ipaddress.ip_address(client_ip)
    except ValueError:
        raise HTTPException(503, "The server could not read your network address.")

    public_ip = local_ip = ipv6_address = ssid = bssid = None
    if observed.is_global:
        public_ip = client_ip
    else:
        # A hosted app can see a proxy's private peer address. Do not offer its
        # range for whitelisting as if it were the administrator's router.
        if hosted_deployment() or os.getenv("APP_ENV", "production").strip().lower() != "development":
            raise HTTPException(503, "Unable to detect a public router address. Check trusted proxy configuration or enter the campus IP range manually.")
        local_ip = get_server_local_ip() if observed.is_loopback else client_ip
        public_ip = lookup_public_ip()
        ssid, bssid = get_server_wifi_details()
        try:
            with socket.socket(socket.AF_INET6, socket.SOCK_DGRAM) as s6:
                s6.connect(('2001:4860:4860::8888', 80))
                ipv6_address = s6.getsockname()[0]
        except OSError:
            pass

    def network_of(address, v4_prefix, v6_prefix):
        parsed = ipaddress.ip_address(address)
        return str(ipaddress.ip_network(f"{address}/{v4_prefix if parsed.version == 4 else v6_prefix}", strict=False))

    # One captured public address is suggested as exactly that address; a broader campus range is the admin's own entry.
    public_cidr = network_of(public_ip, 32, 128) if public_ip else None
    local_cidr = network_of(local_ip, 24, 64) if local_ip and local_ip != "127.0.0.1" else None
    return {
        "client_ip": client_ip,
        "public_ip": public_ip,
        "public_cidr": public_cidr,
        "local_ip": local_ip,
        "local_cidr": local_cidr,
        "ipv6_address": ipv6_address or (client_ip if observed.version == 6 and observed.is_global else None),
        "ssid": ssid,
        "bssid": bssid,
        "cidr": public_cidr or local_cidr,
        "label": f"Router public IP ({public_ip})" if public_ip else f"Local Wi-Fi ({local_cidr or client_ip})",
        "user_agent": request.headers.get("user-agent", "Browser Client"),
        "protocol": "HTTP Connection",
    }


@router.get("/campus-networks", response_model=List[CampusNetworkResponse])
def get_campus_networks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(CampusNetwork).order_by(CampusNetwork.id).all()


def _validate_cidr(cidr: str):
    try:
        network = ipaddress.ip_network(cidr, strict=False)
        if network.prefixlen == 0 or network.network_address.is_loopback:
            raise HTTPException(400, "Use the actual campus IP range, not all addresses or localhost.")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid CIDR/subnet: '{cidr}'. Example: 10.52.0.0/16")


@router.post("/campus-networks", response_model=CampusNetworkResponse, status_code=201)
def create_campus_network(body: CampusNetworkCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not (body.cidr or "").strip() and not (body.subnet_range or "").strip():
        raise HTTPException(status_code=400, detail="Add the router's public IP or its local Wi-Fi range. SSID and BSSID alone cannot verify campus presence.")
    for value in (body.cidr, body.subnet_range):
        if (value or "").strip():
            _validate_cidr(value)
    net = CampusNetwork(
        label=body.label,
        cidr=(body.cidr or "").strip() or None,
        subnet_range=(body.subnet_range or "").strip() or None,
        gateway_ip=(body.gateway_ip or "").strip() or None,
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
    effective_cidr = body.cidr if body.cidr is not None else net.cidr
    effective_subnet = body.subnet_range if body.subnet_range is not None else net.subnet_range
    effective_active = body.is_active if body.is_active is not None else net.is_active
    if effective_active and not (effective_cidr or "").strip() and not (effective_subnet or "").strip():
        raise HTTPException(400, "Add the router's public IP or its local Wi-Fi range before activating this rule.")
    for value in (body.cidr, body.subnet_range):
        if value:
            _validate_cidr(value)
    for field in ("label", "cidr", "subnet_range", "gateway_ip", "ssid", "bssid_prefix", "is_active"):
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
    return get_settings(db)


@router.put("/security-settings", response_model=dict)
def update_security_settings(body: SecuritySettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not development_network_demo_allowed():
        for key in ("network_check_enabled", "fail_closed"):
            if key in body.settings and not truthy(body.settings[key]):
                raise HTTPException(400, "Campus network verification must remain enabled and fail-closed outside explicitly enabled local demos.")
        if truthy(body.settings.get("demo_simulate_network", "false")) or body.settings.get("demo_simulated_ip", "").strip():
            raise HTTPException(400, "Network simulation is disabled on this server.")
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
    return get_settings(db)

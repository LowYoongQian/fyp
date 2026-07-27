"""
Network-based location verification for attendance check-in.

Security layers:
  1. Server-observed source IP (request.client.host) -- cannot be forged by the
     client, set by the TCP stack. This is the authoritative layer.
  2. Client-reported facts (gateway IP, local IP, SSID, BSSID) -- spoofable
     individually, used only as corroboration / audit detail.

The source-IP check is the one that actually enforces "you must be on campus".
"""
import ipaddress
import subprocess
import socket
import re
from typing import Optional, List, Tuple


def get_client_ip(request, trust_proxy_header: bool = False) -> str:
    """Resolve the client's source IP.

    Only honour X-Forwarded-For when explicitly told we sit behind a trusted
    proxy -- otherwise the header is attacker-controlled and must be ignored.
    """
    if trust_proxy_header:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            # left-most entry is the original client
            return fwd.split(",")[0].strip()
    client = request.client
    return client.host if client else ""


def _ip_in_cidr(ip_str: str, cidr: str) -> bool:
    try:
        return ipaddress.ip_address(ip_str) in ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return False


def _norm_mac(mac: Optional[str]) -> str:
    if not mac:
        return ""
    return mac.replace("-", ":").upper().strip()


def get_server_wifi_details() -> Tuple[Optional[str], Optional[str]]:
    """Get the current WiFi SSID and BSSID of the server (laptop) running on Windows."""
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        if result.returncode != 0:
            return None, None
            
        ssid = None
        bssid = None
        
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("SSID"):
                parts = line.split(":", 1)
                if len(parts) == 2:
                    ssid = parts[1].strip()
            elif line.startswith("AP BSSID"):
                parts = line.split(":", 1)
                if len(parts) == 2:
                    bssid = parts[1].strip().lower()
                    
        return ssid, bssid
    except Exception:
        return None, None


def get_server_local_ip() -> str:
    """Get the local IP of the server on the LAN."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def verify_network(
    *,
    source_ip: str,
    reported_gateway_ip: Optional[str],
    reported_local_ip: Optional[str],
    reported_ssid: Optional[str],
    reported_bssid: Optional[str],
    networks: List,  # list of CampusNetwork rows (active only)
) -> Tuple[bool, str]:
    """Verify if the student is connected to a whitelisted campus network."""
    
    server_ssid, server_bssid = get_server_wifi_details()
    server_local_ip = get_server_local_ip()
    
    notes = []
    
    # Exclude loopback/localhost during local development
    is_loopback = source_ip in ('127.0.0.1', '::1', 'localhost')
    
    # 1. If database whitelist rules are configured, validate against them
    if networks:
        cidr_rules = [n for n in networks if n.cidr]
        ssid_rules = [n for n in networks if n.ssid]
        bssid_rules = [n for n in networks if n.bssid_prefix or n.bssid]
        
        matches = []
        failures = []

        # Check CIDR IP subnet match
        if cidr_rules:
            ip_match = any(_ip_in_cidr(source_ip, n.cidr) for n in cidr_rules if n.cidr)
            if ip_match:
                matches.append(f"IP {source_ip} matches whitelisted CIDR range")
            else:
                failures.append(f"IP {source_ip} outside whitelisted CIDR range")

        # Check SSID match
        if ssid_rules:
            normalized_reported_ssid = reported_ssid.strip().lower() if reported_ssid else ""
            ssid_match = any(
                normalized_reported_ssid == n.ssid.strip().lower() for n in ssid_rules if n.ssid
            )
            if ssid_match:
                matches.append(f"SSID '{reported_ssid}' matches whitelisted network")
            else:
                failures.append(f"SSID '{reported_ssid or 'None'}' mismatch")

        # Check BSSID / MAC match
        if bssid_rules:
            normalized_reported_bssid = _norm_mac(reported_bssid) if reported_bssid else ""
            bssid_match = any(
                normalized_reported_bssid.startswith(_norm_mac(n.bssid_prefix or n.bssid or ""))
                for n in bssid_rules
            )
            if bssid_match:
                matches.append(f"BSSID '{reported_bssid}' matches whitelisted AP")
            else:
                failures.append(f"BSSID '{reported_bssid or 'None'}' mismatch")

        # If loopback localhost, pass for local dev
        if is_loopback:
            return True, f"Loopback connection passed for local dev ({source_ip})"

        # Student passes if they match any whitelisted CIDR, SSID, or BSSID
        if matches:
            return True, " ; ".join(matches)
        else:
            return False, " ; ".join(failures) if failures else "Connection not in whitelisted campus networks"

    # 2. Fallback: If no DB rules configured, check server local subnet
    server_subnet = None
    if server_local_ip and server_local_ip != '127.0.0.1':
        parts = server_local_ip.split('.')
        if len(parts) == 4:
            server_subnet = '.'.join(parts[:3]) + '.'

    if server_subnet and not is_loopback:
        if source_ip.startswith(server_subnet):
            return True, f"Subnet verified: source_ip={source_ip} in server LAN ({server_subnet}*)"
        else:
            return False, f"Subnet mismatch: source_ip={source_ip} not in server LAN ({server_subnet}*)"

    # Default pass if no rules or subnet constraints exist
    return True, "No active network restriction rules enforced"

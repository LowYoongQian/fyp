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
    """Verify if the student is connected to the same WiFi network as the server."""
    
    server_ssid, server_bssid = get_server_wifi_details()
    server_local_ip = get_server_local_ip()
    
    notes = []
    passed = True
    
    # Extract subnet prefix of the server (e.g. "192.168.100." from "192.168.100.190")
    # For a standard /24 subnet, they must share the first 3 octets.
    server_subnet = None
    if server_local_ip and server_local_ip != '127.0.0.1':
        parts = server_local_ip.split('.')
        if len(parts) == 4:
            server_subnet = '.'.join(parts[:3]) + '.'
            
    notes.append(f"server_ip={server_local_ip} server_ssid={server_ssid} server_bssid={server_bssid}")
    
    # --- Check 1: SSID Match (if both server and client SSID are available) ---
    if server_ssid:
        if reported_ssid:
            if reported_ssid.strip().lower() != server_ssid.strip().lower():
                passed = False
                notes.append(f"SSID mismatch: client={reported_ssid} vs server={server_ssid}")
            else:
                notes.append(f"SSID matches: {server_ssid}")
        else:
            notes.append("Client SSID not reported; falling back to subnet validation")
    else:
        notes.append("Server not connected to WiFi; skipping SSID checks")

    # --- Check 2: BSSID Match (if both are available) ---
    if server_bssid:
        if reported_bssid:
            cb = _norm_mac(reported_bssid)
            sb = _norm_mac(server_bssid)
            # Match first 5 octets to handle dual-band AP channel differences
            if not cb.startswith(sb[:14]):
                passed = False
                notes.append(f"BSSID mismatch: client={cb} vs server={sb}")
            else:
                notes.append(f"BSSID matches: {sb}")
        else:
            notes.append("Client BSSID not reported; falling back to subnet validation")

    # --- Check 3: Subnet / LAN Match (observed client source IP) ---
    if server_subnet:
        # The client's observed source_ip MUST be in the same local subnet as the server
        # (Exclude loopback checks if testing locally on emulator)
        is_loopback = source_ip in ('127.0.0.1', '::1', 'localhost')
        if not is_loopback and not source_ip.startswith(server_subnet):
            passed = False
            notes.append(f"Subnet mismatch: source_ip={source_ip} not in server subnet {server_subnet}*")
        else:
            notes.append(f"Subnet verified: source_ip={source_ip}")
            
        # The client's reported local_ip (if provided) should belong to the same subnet
        if reported_local_ip:
            if not reported_local_ip.startswith(server_subnet):
                passed = False
                notes.append(f"Reported local_ip={reported_local_ip} mismatch: not in server subnet {server_subnet}*")
            else:
                notes.append("Reported local_ip subnet verified")
                
        # The client's reported gateway_ip (if provided) should belong to the same subnet
        if reported_gateway_ip:
            if not reported_gateway_ip.startswith(server_subnet):
                passed = False
                notes.append(f"Reported gateway_ip={reported_gateway_ip} mismatch: not in server subnet {server_subnet}*")
            else:
                notes.append("Reported gateway subnet verified")
    else:
        notes.append("No server local subnet found; skipping subnet validation")

    # Fallback to configured CIDR/CampusNetwork DB checks if server has no LAN connection details
    if not server_subnet and not server_ssid:
        cidr_rules = [n for n in networks if n.cidr]
        ssid_rules = [n.ssid.strip().lower() for n in networks if n.ssid]
        bssid_rules = [_norm_mac(n.bssid_prefix) for n in networks if n.bssid_prefix]
        
        if cidr_rules:
            source_ip_ok = any(_ip_in_cidr(source_ip, n.cidr) for n in cidr_rules)
            notes.append(f"source_ip={source_ip} {'in' if source_ip_ok else 'NOT in'} campus range")
            if not source_ip_ok:
                passed = False
        if ssid_rules:
            ssid_ok = bool(reported_ssid) and reported_ssid.strip().lower() in ssid_rules
            notes.append(f"SSID {'matches' if ssid_ok else 'mismatch'} database rules")
            if not ssid_ok:
                passed = False
        if bssid_rules:
            rb = _norm_mac(reported_bssid)
            bssid_ok = bool(rb) and any(rb.startswith(pfx) for pfx in bssid_rules)
            notes.append(f"BSSID {'matches' if bssid_ok else 'mismatch'} database rules")
            if not bssid_ok:
                passed = False
        if not cidr_rules and not ssid_rules and not bssid_rules:
            passed = False
            notes.append("No campus network rules configured in DB and no server subnet found")

    return passed, "; ".join(notes)

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


def verify_network(
    *,
    source_ip: str,
    reported_gateway_ip: Optional[str],
    reported_local_ip: Optional[str],
    reported_ssid: Optional[str],
    reported_bssid: Optional[str],
    networks: List,  # list of CampusNetwork rows (active only)
) -> Tuple[bool, str]:
    """Return (passed, human_readable_detail).

    Policy:
      - If any CIDR rules exist, the server-observed source IP MUST fall inside
        one of them. This is the hard gate.
      - SSID / BSSID / gateway matches are recorded as corroboration and can
        strengthen the verdict but never substitute for the source-IP gate.
    """
    cidr_rules = [n for n in networks if n.cidr]
    ssid_rules = [n.ssid.strip().lower() for n in networks if n.ssid]
    bssid_rules = [_norm_mac(n.bssid_prefix) for n in networks if n.bssid_prefix]

    notes = []

    # --- Layer 1: authoritative source-IP gate -------------------------------
    source_ip_ok = None
    if cidr_rules:
        source_ip_ok = any(_ip_in_cidr(source_ip, n.cidr) for n in cidr_rules)
        notes.append(f"source_ip={source_ip} {'in' if source_ip_ok else 'NOT in'} campus range")
    else:
        notes.append(f"source_ip={source_ip} (no CIDR rules configured)")

    # --- Layer 2: corroborating client-reported signals ----------------------
    if reported_gateway_ip and cidr_rules:
        gw_ok = any(_ip_in_cidr(reported_gateway_ip, n.cidr) for n in cidr_rules)
        notes.append(f"gateway={reported_gateway_ip} {'matches' if gw_ok else 'mismatch'}")

    if reported_local_ip and cidr_rules:
        lan_ok = any(_ip_in_cidr(reported_local_ip, n.cidr) for n in cidr_rules)
        notes.append(f"local_ip={reported_local_ip} {'matches' if lan_ok else 'mismatch'}")

    if ssid_rules:
        ssid_ok = bool(reported_ssid) and reported_ssid.strip().lower() in ssid_rules
        notes.append(f"ssid {'matches' if ssid_ok else 'mismatch'}")

    if bssid_rules:
        rb = _norm_mac(reported_bssid)
        bssid_ok = bool(rb) and any(rb.startswith(pfx) for pfx in bssid_rules)
        notes.append(f"bssid {'matches' if bssid_ok else 'mismatch'}")

    # --- Verdict --------------------------------------------------------------
    if cidr_rules:
        passed = bool(source_ip_ok)
    elif ssid_rules or bssid_rules:
        # No IP rules: fall back to soft signals (weaker, but better than nothing)
        ssid_ok = (not ssid_rules) or (
            bool(reported_ssid) and reported_ssid.strip().lower() in ssid_rules
        )
        rb = _norm_mac(reported_bssid)
        bssid_ok = (not bssid_rules) or (
            bool(rb) and any(rb.startswith(pfx) for pfx in bssid_rules)
        )
        passed = ssid_ok and bssid_ok
    else:
        # No rules configured at all -> nothing to verify against
        passed = False
        notes.append("no campus networks configured")

    return passed, "; ".join(notes)

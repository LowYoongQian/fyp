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
import os
import socket
import subprocess
from typing import List, Optional, Tuple


def normalize_client_ip(value: Optional[str]) -> str:
    """Return a canonical IP from common reverse-proxy address formats.

    Some hosts forward IPv4 as ``address:source-port`` while bracketed IPv6
    may arrive as ``[address]:source-port``.  ``ipaddress`` rejects both forms
    unless the transport port is removed first.
    """
    candidate = (value or "").strip().strip('"')
    if candidate.lower().startswith("for="):
        candidate = candidate[4:].strip().strip('"')

    try:
        address = ipaddress.ip_address(candidate)
        return str(address.ipv4_mapped or address) if address.version == 6 else str(address)
    except ValueError:
        pass

    if candidate.startswith("[") and "]" in candidate:
        host = candidate[1:candidate.index("]")]
        try:
            return str(ipaddress.ip_address(host))
        except ValueError:
            return candidate

    host, separator, port = candidate.rpartition(":")
    if separator and port.isdigit():
        try:
            parsed = ipaddress.ip_address(host)
            if parsed.version == 4:
                return str(parsed)
        except ValueError:
            pass

    return candidate


def get_client_ip(request, trust_proxy_header: bool = False) -> str:
    """Resolve the client's source IP.

    Only honour X-Forwarded-For when explicitly told we sit behind a trusted
    proxy -- otherwise the header is attacker-controlled and must be ignored.
    """
    client = request.client
    # Uvicorn's proxy middleware discards the transport peer and sets port=0.
    # Refuse that rewritten address rather than trusting evidence we cannot
    # authenticate; supported launchers use --no-proxy-headers.
    if client and getattr(client, "port", None) == 0 and request.headers.get("x-forwarded-for"):
        return ""
    peer = normalize_client_ip(client.host if client else "")
    trusted = trusted_proxy_ranges()
    # Walk from our transport peer towards the client; never trust an arbitrary
    # left-most value supplied by a client before the proxy appended its own.
    if any(_ip_in_cidr(peer, cidr) for cidr in trusted):
        fwd = request.headers.get("x-forwarded-for")
        if trust_proxy_header and fwd:
            chain = [normalize_client_ip(value) for value in fwd.split(",")]
            if len(chain) > 16:
                return ""
            for address in reversed(chain):
                try:
                    ipaddress.ip_address(address)
                except ValueError:
                    return ""
                peer = address
                if not any(_ip_in_cidr(address, cidr) for cidr in trusted):
                    return address
        # A proxy's own address is not the client's campus presence. Missing
        # forwarding, disabled trust or an all-proxy chain cannot grant access.
        return ""
    return peer


def trusted_proxy_ranges():
    ranges = []
    for value in os.getenv("TRUSTED_PROXY_CIDRS", "").split(","):
        if not value.strip():
            continue
        try:
            network = ipaddress.ip_network(value.strip(), strict=False)
        except ValueError as exc:
            raise RuntimeError("TRUSTED_PROXY_CIDRS must contain explicit proxy IPs/CIDRs, not wildcards.") from exc
        if network.prefixlen == 0:
            raise RuntimeError("TRUSTED_PROXY_CIDRS cannot trust the entire Internet.")
        ranges.append(str(network))
    return ranges


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
    """Only configured campus CIDRs and server-observed IP can authorise attendance.

    Wi-Fi names, MACs and reported addresses remain audit metadata, not proof.
    No shell probes, inferred LAN ranges, localhost exceptions or default passes.
    """
    try:
        address = ipaddress.ip_address(normalize_client_ip(source_ip))
    except ValueError:
        return False, "Unable to establish your network address. Contact the administrator."
    if address.is_loopback or address.is_unspecified:
        return False, "Localhost is not campus network evidence. Connect through the campus network."
    cidrs = []
    for rule in networks:
        if not getattr(rule, "is_active", True) or not rule.cidr:
            continue
        try:
            network = ipaddress.ip_network(rule.cidr, strict=False)
            if network.prefixlen > 0 and not network.network_address.is_loopback:
                cidrs.append(network)
        except ValueError:
            continue
    if not cidrs:
        return False, "Campus network is not configured. Ask an administrator to add an active campus IP range."
    if any(address in network for network in cidrs):
        return True, "Server-observed IP matches a configured campus range; Wi-Fi details are supporting information only."
    return False, "Your server-observed IP is outside the campus network. Connect to campus Wi-Fi and try again."

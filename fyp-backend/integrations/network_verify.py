"""
Network-based location verification for attendance check-in.

Security layers:
  1. Server-observed source IP (request.client.host) -- cannot be forged by the
     client, set by the TCP stack. This is the authoritative layer.
  2. Client-reported facts (gateway IP, local IP, SSID, BSSID) -- spoofable
     individually, used only as corroboration / audit detail.

The source-IP check is the one that actually enforces "you must be on campus".

How the source IP is established is chosen explicitly with CLIENT_IP_SOURCE:
  direct             (default) the TCP peer, or X-Forwarded-For walked right to left from
                     peers listed in TRUSTED_PROXY_CIDRS. Local and campus-LAN servers.
  azure_app_service  the Client-IP header that the App Service front end writes, and
                     overwrites, on every request it routes. Nothing else is used, and a
                     missing or ambiguous header leaves the address unresolved.
"""
import ipaddress
import logging
import os
import re
import socket
import subprocess
import urllib.request
from typing import List, Optional, Tuple

DIRECT = "direct"
AZURE_APP_SERVICE = "azure_app_service"
UNVERIFIED = ("Unable to verify your network. The server could not establish a trusted network address for this "
              "request, so attendance cannot be confirmed. Ask an administrator to check the server's network settings.")
OUTSIDE = "Your connection is outside the approved campus network. Connect to campus Wi-Fi and try again."
_PORT = re.compile(r"[1-9][0-9]{0,4}")
_log = logging.getLogger(__name__)


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


def client_ip_source() -> str:
    """The configured way of establishing the client address. Anything unknown stops startup rather than guessing."""
    value = os.getenv("CLIENT_IP_SOURCE", "").strip().lower() or DIRECT
    if value not in (DIRECT, AZURE_APP_SERVICE):
        raise RuntimeError("CLIENT_IP_SOURCE must be 'direct' or 'azure_app_service'.")
    return value


def hosted_deployment() -> bool:
    """A hosted server, where only a verified public address is campus evidence: a private address there is the platform's
    own network, never the student's. WEBSITE_SITE_NAME (set by App Service) is used only to restrict, never to trust a header."""
    return client_ip_source() == AZURE_APP_SERVICE or bool(os.getenv("WEBSITE_SITE_NAME", "").strip())


def _valid_port(text: str) -> bool:
    return bool(_PORT.fullmatch(text)) and int(text) <= 65535


def parse_single_address(value: Optional[str]) -> Optional[str]:
    """Exactly one address as a front end writes it: IPv4, IPv6, IPv4-mapped IPv6, "IPv4:port" or "[IPv6]:port".
    Lists, spaces, quotes, zone IDs, bad ports and trailing text are refused (None), never trimmed into shape."""
    text = (value or "").strip()
    if not text or any(ch in text for ch in ' ,;"%\t'):
        return None
    host, with_port = text, False
    if text.startswith("["):
        close = text.find("]")
        if close == -1:
            return None
        host, rest = text[1:close], text[close + 1:]
        if rest and not (rest.startswith(":") and _valid_port(rest[1:])):
            return None
        if ":" not in host:
            return None   # brackets only ever hold IPv6
    elif text.count(":") == 1:
        host, port = text.split(":")
        if not _valid_port(port):
            return None
        with_port = True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return None
    if with_port and address.version != 4:
        return None
    mapped = address.ipv4_mapped if address.version == 6 else None
    return str(mapped or address)


def is_public_unicast(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return address.is_global and not address.is_multicast


def _header_values(headers, name: str) -> List[str]:
    getlist = getattr(headers, "getlist", None)
    if getlist is not None:
        return list(getlist(name))
    value = headers.get(name)
    return [] if value is None else [value]


def resolve_client_ip(request, trust_proxy_header: bool = False) -> Tuple[str, str]:
    """The client address and how it was decided, as (address, reason). An empty address means the server has no
    reliable evidence; callers must then refuse campus verification, never fall back to something weaker."""
    client = request.client
    # Uvicorn's proxy middleware discards the transport peer and sets port=0.
    # Refuse that rewritten address rather than trusting evidence we cannot
    # authenticate; supported launchers use --no-proxy-headers.
    if client and getattr(client, "port", None) == 0 and request.headers.get("x-forwarded-for"):
        return "", "peer_rewritten"
    peer = normalize_client_ip(client.host if client else "")
    if client_ip_source() == AZURE_APP_SERVICE:
        try:
            peer_address = ipaddress.ip_address(peer)
        except ValueError:
            return "", "peer_missing"
        # The front end reaches the container over the platform's internal network. A public peer did not come
        # through it, so its Client-IP (or lack of one) proves nothing.
        if peer_address.is_global:
            return "", "peer_not_front_end"
        values = _header_values(request.headers, "client-ip")
        if not values:
            return "", "client_ip_missing"
        if len(values) > 1:
            return "", "client_ip_duplicate"
        address = parse_single_address(values[0])
        if address is None:
            return "", "client_ip_malformed"
        if not is_public_unicast(address):
            return "", "client_ip_not_public"
        return address, "client_ip"
    trusted = trusted_proxy_ranges()
    resolved, how = peer, "peer"
    # Walk from our transport peer towards the client; never trust an arbitrary
    # left-most value supplied by a client before the proxy appended its own.
    if any(_ip_in_cidr(peer, cidr) for cidr in trusted):
        # A proxy's own address is not the client's campus presence. Missing
        # forwarding, disabled trust or an all-proxy chain cannot grant access.
        resolved, how = "", "forwarding_untrusted"
        fwd = request.headers.get("x-forwarded-for")
        if trust_proxy_header and fwd:
            chain = [normalize_client_ip(value) for value in fwd.split(",")]
            how = "forwarding_unusable"
            if len(chain) <= 16:
                for address in reversed(chain):
                    try:
                        ipaddress.ip_address(address)
                    except ValueError:
                        break
                    if not any(_ip_in_cidr(address, cidr) for cidr in trusted):
                        resolved, how = address, "forwarded"
                        break
        elif trust_proxy_header:
            how = "forwarding_missing"
    if resolved and hosted_deployment() and not is_public_unicast(resolved):
        return "", "private_on_hosted"
    return resolved, how


def get_client_ip(request, trust_proxy_header: bool = False) -> str:
    """The client's source IP, or "" when the server has no reliable evidence of it."""
    address, reason = resolve_client_ip(request, trust_proxy_header)
    if os.getenv("NETWORK_DIAGNOSTICS", "").strip().lower() in ("1", "true", "yes", "on"):
        # Temporary and off by default: enough to correlate one request and explain the decision. Header counts only,
        # never header values, cookies or credentials.
        headers = request.headers
        _log.warning("network-diagnostics path=%s log_id=%s source=%s reason=%s peer=%s client_ip_headers=%d "
                     "forwarded_headers=%d resolved=%s",
                     getattr(getattr(request, "url", None), "path", "?"), headers.get("x-arr-log-id", "-"),
                     client_ip_source(), reason, normalize_client_ip(request.client.host if request.client else ""),
                     len(_header_values(headers, "client-ip")), len(_header_values(headers, "x-forwarded-for")),
                     address or "-")
    return address


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
            timeout=4,
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


def lookup_public_ip() -> Optional[str]:
    """This machine's internet address as the world sees it: the public IP its router got from the ISP.
    Only meaningful on a server that shares the admin's router (a local run); a hosted server would get its own."""
    try:
        with urllib.request.urlopen("https://api.ipify.org", timeout=4) as answer:
            address = ipaddress.ip_address(answer.read(64).decode().strip())
        return str(address) if address.is_global else None
    except Exception:
        return None


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
    public_only: bool = False,
) -> Tuple[bool, str]:
    """Only configured campus CIDRs and server-observed IP can authorise attendance.

    Wi-Fi names, MACs and reported addresses remain audit metadata, not proof.
    No shell probes, inferred LAN ranges, localhost exceptions or default passes.
    public_only (a hosted server): only a public address and the rules' public ranges count; local subnets never do.
    """
    try:
        address = ipaddress.ip_address(normalize_client_ip(source_ip))
    except ValueError:
        return False, UNVERIFIED
    if address.is_loopback or address.is_unspecified or (public_only and not is_public_unicast(str(address))):
        return False, UNVERIFIED
    cidrs = []
    for rule in networks:
        if not getattr(rule, "is_active", True):
            continue
        # One rule is one router: its ISP public address (what a deployed server sees) and its local Wi-Fi range
        # (what a server on that same Wi-Fi sees). A hosted server only ever compares the public range.
        for value in (rule.cidr,) if public_only else (rule.cidr, getattr(rule, "subnet_range", None)):
            try:
                network = ipaddress.ip_network(value, strict=False) if value else None
            except ValueError:
                continue
            if network and network.prefixlen > 0 and not network.network_address.is_loopback \
                    and (not public_only or network.is_global):
                cidrs.append(network)
    if not cidrs:
        return False, "Campus network is not configured. Ask an administrator to add an active campus IP range."
    if any(address in network for network in cidrs):
        return True, "Server-observed IP matches a configured campus range; Wi-Fi details are supporting information only."
    return False, OUTSIDE

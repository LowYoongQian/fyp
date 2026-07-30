"""Network-verification policy, read from the security_settings table.

Two routers need these switches: check-in enforces them, and the admin connection probe
has to honour trust_proxy_header to report the right client IP. They were read in two
places with two different notions of truth — one accepted only the exact string "true",
so a value of "1" or "yes" silently disabled proxy trust on one path and not the other.

Defaults are stated here so a missing row degrades to the safe setting rather than to
whatever `or ""` happens to mean: verification on, and closed on failure.
"""
from sqlalchemy.orm import Session

from db.models import SecuritySetting

DEFAULTS = {
    "network_check_enabled": "true",   # master switch for network verification
    "fail_closed": "true",             # reject check-in when the network is unverified
    "trust_proxy_header": "false",     # honour X-Forwarded-For (only behind a trusted proxy)
    "demo_simulate_network": "false",  # demo: override the observed IP with a simulated one
    "demo_simulated_ip": "",           # the simulated campus IP used in demo mode
}

_TRUE_VALUES = ("1", "true", "yes", "on")


def truthy(v) -> bool:
    """Whether a stored setting string means yes. Values are hand-edited through the
    admin UI, so "1", "yes" and "on" all have to count."""
    return str(v).strip().lower() in _TRUE_VALUES


def get_settings(db: Session) -> dict:
    """Every switch, with defaults filled in for rows that do not exist yet."""
    cfg = dict(DEFAULTS)
    cfg.update({r.key: (r.value or "") for r in db.query(SecuritySetting).all()})
    return cfg


def is_enabled(db: Session, key: str) -> bool:
    """One switch as a bool. For callers that need a single flag, not the whole set."""
    return truthy(get_settings(db)[key])

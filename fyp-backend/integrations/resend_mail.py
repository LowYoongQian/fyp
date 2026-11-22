"""Send one transactional email through Resend; the app's single runtime sender for warnings.

Uses the same endpoint, credentials and Idempotency-Key header as the account emails in routers/auth.py. Provider
acceptance (HTTP 2xx + message id) is the only thing reported as success: it does not prove inbox delivery or reading.
"""
import os

import httpx

from domain import personal_email
from integrations import email_template


class EmailError(Exception):
    """A failed send, with a short stable code the caller can store and show."""

    def __init__(self, code: str, status: int = 502, provider: str = ""):
        super().__init__(code)
        # provider: Resend's own error name (e.g. validation_error), never its message, which can quote addresses.
        self.code, self.status, self.provider = code, status, provider


def _sender_is_real() -> bool:
    """The sender must be a real address on a domain we can send from, never a school identity alias (it has no mailbox or DNS of ours)."""
    sender = (os.getenv("RESEND_FROM_EMAIL") or "").strip()
    address = (sender.rpartition("<")[2].rstrip(">") if "<" in sender else sender).strip().lower()
    return "@" in address and not personal_email.is_school_identity(address)


def missing_settings() -> list:
    """Which sending settings are absent or unusable, by name only (for operator logs; never the values)."""
    missing = [name for name in ("RESEND_API_KEY", "RESEND_FROM_EMAIL") if not (os.getenv(name) or "").strip()]
    if "RESEND_FROM_EMAIL" not in missing and not _sender_is_real():
        missing.append("RESEND_FROM_EMAIL (not a usable sender address)")
    return missing


def configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY") and os.getenv("RESEND_FROM_EMAIL")) and _sender_is_real()


def send(to: str, subject: str, text: str, idempotency_key: str, html: str | None = None) -> str:
    """html: a branded layout the caller built (with a code or a button); otherwise the text is put in the same layout."""
    api_key, sender = os.getenv("RESEND_API_KEY"), os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not sender or not _sender_is_real():
        raise EmailError("not_configured", 503)
    try:
        response = httpx.post("https://api.resend.com/emails", timeout=10,
            headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": idempotency_key},
            json={"from": sender, "to": [to], "subject": subject, "text": text, "html": html or email_template.render(subject, text)})
    except httpx.TimeoutException as exc:
        raise EmailError("timeout", 504) from exc
    except httpx.HTTPError as exc:
        raise EmailError("network", 502) from exc
    provider = ""
    if response.status_code >= 400:
        try:
            provider = str((response.json() or {}).get("name") or "")[:64]
        except ValueError:
            provider = ""
    if response.status_code == 429:
        raise EmailError("rate_limited", 429, provider)
    if response.status_code >= 500:
        raise EmailError("provider_error", 502, provider)
    if response.status_code >= 400:
        # e.g. validation_error for an unverified sending domain or an invalid recipient; details stay out of the UI
        raise EmailError("rejected", 502, provider)
    try:
        message_id = response.json().get("id")
    except ValueError:
        message_id = None
    if not message_id:
        raise EmailError("no_acknowledgement", 502)
    return str(message_id)[:64]

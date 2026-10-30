"""Send one transactional email through Resend; the app's single runtime sender for warnings.

Uses the same endpoint, credentials and Idempotency-Key header as the account emails in routers/auth.py. Provider
acceptance (HTTP 2xx + message id) is the only thing reported as success: it does not prove inbox delivery or reading.
"""
import html
import os

import httpx


class EmailError(Exception):
    """A failed send, with a short stable code the caller can store and show."""

    def __init__(self, code: str, status: int = 502):
        super().__init__(code)
        self.code, self.status = code, status


def configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY") and os.getenv("RESEND_FROM_EMAIL"))


def to_html(text: str) -> str:
    """Escape everything, then keep the author's line breaks; no user text is ever interpreted as markup."""
    paragraphs = [part for part in text.replace("\r\n", "\n").split("\n\n")]
    return "".join("<p>" + html.escape(part).replace("\n", "<br>") + "</p>" for part in paragraphs)


def send(to: str, subject: str, text: str, idempotency_key: str) -> str:
    api_key, sender = os.getenv("RESEND_API_KEY"), os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not sender:
        raise EmailError("not_configured", 503)
    try:
        response = httpx.post("https://api.resend.com/emails", timeout=10,
            headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": idempotency_key},
            json={"from": sender, "to": [to], "subject": subject, "text": text, "html": to_html(text)})
    except httpx.TimeoutException as exc:
        raise EmailError("timeout", 504) from exc
    except httpx.HTTPError as exc:
        raise EmailError("network", 502) from exc
    if response.status_code == 429:
        raise EmailError("rate_limited", 429)
    if response.status_code >= 500:
        raise EmailError("provider_error", 502)
    if response.status_code >= 400:
        raise EmailError("rejected", 502)  # e.g. unverified sending domain or invalid recipient; details stay out of the UI
    try:
        message_id = response.json().get("id")
    except ValueError:
        message_id = None
    if not message_id:
        raise EmailError("no_acknowledgement", 502)
    return str(message_id)[:64]

from types import SimpleNamespace
import asyncio

from domain.audit import log_admin_action, reset_audit_client_ip, set_audit_client_ip
import main


class _FakeSession:
    def __init__(self):
        self.added = None

    def add(self, value):
        self.added = value

    def commit(self):
        pass

    def refresh(self, value):
        pass

    def rollback(self):
        pass


def test_admin_audit_uses_server_observed_request_ip():
    """Audit rows must inherit the trusted request address, never a fixed localhost value."""
    db = _FakeSession()
    user = SimpleNamespace(id=7, profile_name="Admin", email="admin@example.com")
    token = set_audit_client_ip("192.168.1.42")
    try:
        log_admin_action(db, user, "UPDATE_TIMETABLE", "Moved one class")
    finally:
        reset_audit_client_ip(token)

    assert db.added.ip_address == "192.168.1.42"


def test_localhost_audit_uses_lan_address(monkeypatch):
    """Local development should identify the machine on its LAN instead of loopback."""
    db = _FakeSession()
    user = SimpleNamespace(id=7, profile_name="Admin", email="admin@example.com")
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    monkeypatch.setattr(main, "_trust_proxy_headers", lambda: False)
    monkeypatch.setattr(main, "get_server_local_ip", lambda: "192.168.1.25")

    async def call_next(_request):
        log_admin_action(db, user, "UPDATE_TIMETABLE", "Moved one class")
        return "ok"

    middleware = main.AuditClientIPMiddleware(lambda scope, receive, send: None)
    asyncio.run(middleware.dispatch(request, call_next))

    assert db.added.ip_address == "192.168.1.25"


def test_hosted_audit_uses_trusted_forwarded_address(monkeypatch):
    """A configured HTTPS proxy should preserve the original public client address."""
    db = _FakeSession()
    user = SimpleNamespace(id=7, profile_name="Admin", email="admin@example.com")
    request = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.18, 10.0.0.4"},
        client=SimpleNamespace(host="10.0.0.4"),
    )
    monkeypatch.setattr(main, "_trust_proxy_headers", lambda: True)

    async def call_next(_request):
        log_admin_action(db, user, "UPDATE_TIMETABLE", "Moved one class")
        return "ok"

    middleware = main.AuditClientIPMiddleware(lambda scope, receive, send: None)
    asyncio.run(middleware.dispatch(request, call_next))

    assert db.added.ip_address == "203.0.113.18"

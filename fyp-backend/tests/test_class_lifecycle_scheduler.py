import asyncio

import pytest


def test_background_lifecycle_runs_immediately_and_requests_forced_sync(monkeypatch):
    import main

    calls = []
    monkeypatch.setattr(main, "sync_class_sessions", lambda *, force=False: calls.append(force))

    async def stop_after_first_cycle(_seconds):
        raise asyncio.CancelledError

    monkeypatch.setattr(main.asyncio, "sleep", stop_after_first_cycle)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(main._class_lifecycle_loop())

    assert calls == [True]

"""Sync must not run inline, and must still be throttled once per minute.

Both properties are the point of the change: an inline sync made one request per
minute pay ~2s of queries, and dropping the throttle would trade that for a query
storm instead.
"""
import time

import domain.session_sync as ss


def _reset():
    ss._last_sync_time = 0.0
    ss._is_syncing = False


def test_returns_before_work_finishes_and_throttles():
    calls = []
    started = ss.threading.Event()
    release = ss.threading.Event()

    def fake_work(db):
        calls.append(1)
        started.set()
        release.wait(5)

    original = ss._sync_class_sessions_now
    ss._sync_class_sessions_now = fake_work
    _reset()
    try:
        t0 = time.perf_counter()
        ss.sync_class_sessions()
        returned_in = time.perf_counter() - t0

        assert started.wait(5), "sync never started on its worker thread"
        # The caller returned while the work was still blocked, i.e. off the request path.
        assert returned_in < 0.5, f"sync_class_sessions blocked for {returned_in:.2f}s"
        assert len(calls) == 1

        # Second call while the first is in flight must be skipped, not queued.
        ss.sync_class_sessions()
        assert len(calls) == 1, "concurrent sync was not suppressed"

        release.set()
        for _ in range(100):
            if not ss._is_syncing:
                break
            time.sleep(0.05)
        assert not ss._is_syncing, "_is_syncing never cleared"

        # Finished, but inside the throttle window -> still skipped.
        ss.sync_class_sessions()
        assert len(calls) == 1, "throttle window not honoured"

        # Past the window -> runs again.
        ss._last_sync_time = time.time() - ss._SYNC_THROTTLE_SECONDS - 1
        ss.sync_class_sessions()
        for _ in range(100):
            if len(calls) == 2:
                break
            time.sleep(0.05)
        assert len(calls) == 2, "sync did not run after the throttle expired"
    finally:
        release.set()
        ss._sync_class_sessions_now = original
        _reset()


def test_worker_clears_flag_when_work_raises():
    """A crashing sync must not wedge _is_syncing and block every later sync."""
    def boom(db):
        raise RuntimeError("boom")

    original = ss._sync_class_sessions_now
    ss._sync_class_sessions_now = boom
    _reset()
    try:
        ss.sync_class_sessions()
        for _ in range(100):
            if not ss._is_syncing:
                break
            time.sleep(0.05)
        assert not ss._is_syncing, "a failed sync left _is_syncing stuck True"
    finally:
        ss._sync_class_sessions_now = original
        _reset()


if __name__ == "__main__":
    test_returns_before_work_finishes_and_throttles()
    test_worker_clears_flag_when_work_raises()
    print("ok")

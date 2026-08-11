"""Single UTC clock for the app.

`datetime.utcnow()` is deprecated from Python 3.12. But this codebase stores
and compares datetimes as *naive* UTC everywhere (DB columns have no tzinfo,
session_sync does naive arithmetic). Switching call sites to
`datetime.now(timezone.utc)` would return *aware* datetimes and every
naive-vs-aware comparison against the DB would raise TypeError.

So this helper returns naive UTC — identical value to the old utcnow(), minus
the deprecation. It keeps the whole app on one consistent (naive UTC) clock.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# Timetable times ("14:00") are campus local time. Naming the zone beats reading the
# host clock: a container has no TZ set, so the same code placed a class two hours off
# in production from where it landed on a developer's machine.
CAMPUS_TZ = ZoneInfo("Asia/Kuala_Lumpur")


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (tzinfo stripped)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def local_offset() -> timedelta:
    """How far campus local time runs ahead of UTC, right now.

    Add it to a naive UTC datetime to read it as local, subtract to go back. One
    place computes this so a DST or policy change lands everywhere at once.
    """
    return datetime.now(CAMPUS_TZ).utcoffset() or timedelta(0)


def campus_now() -> datetime:
    """Current campus-local wall clock, naive.

    For comparing against timetable strings ("14:00"), which are campus local. Use this
    rather than `datetime.now()`: a container has no TZ set, so that returns UTC and any
    window check drifts by the whole offset.
    """
    return utcnow() + local_offset()


def iso_utc(dt: datetime | None) -> str | None:
    """Render a stored (naive UTC) datetime as an ISO string that says so.

    `datetime.isoformat()` on a naive value emits "2026-08-03T02:26:56" with no zone
    marker, and both clients then read it as *their own* local time: Dart's
    DateTime.parse and JS's new Date() both treat an unmarked string as local, so
    `.toLocal()` afterwards is a no-op. On a UTC host (Railway sets no TZ) that
    displayed every timestamp 8 hours behind Malaysia.

    Appending the offset is what makes the round trip correct — the client converts
    to the device's zone instead of guessing. Storage stays naive UTC; only the
    published representation changes.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

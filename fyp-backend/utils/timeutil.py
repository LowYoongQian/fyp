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

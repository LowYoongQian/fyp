"""Single UTC clock for the app.

`datetime.utcnow()` is deprecated from Python 3.12. But this codebase stores
and compares datetimes as *naive* UTC everywhere (DB columns have no tzinfo,
session_sync does naive arithmetic). Switching call sites to
`datetime.now(timezone.utc)` would return *aware* datetimes and every
naive-vs-aware comparison against the DB would raise TypeError.

So this helper returns naive UTC — identical value to the old utcnow(), minus
the deprecation. It keeps the whole app on one consistent (naive UTC) clock.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (tzinfo stripped)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

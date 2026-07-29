"""Runnable regression checks for the 2026-07-29 backend fixes.

Run:  python test_backend_fixes.py     (from fyp-backend/, with .venv active)

These are deliberately narrow. Each assert corresponds to a defect that was
live in the working tree on 2026-07-29 and would silently come back if someone
re-applied the change that caused it. No framework, no fixtures — the DB-backed
checks are skipped automatically when no database is reachable.
"""
import sys

from fastapi.testclient import TestClient


def check_model_fields():
    """The UUID migration (54abaf4) dropped columns the routers still use.

    Dropping them turned face check-in and both lecturer alert endpoints into
    500s: a class-level filter on a missing attribute raises AttributeError
    before any SQL is emitted.
    """
    from utils.models import Alert, FaceEmbedding, RiskScore

    # Would raise AttributeError if is_active were not declared.
    FaceEmbedding.is_active == True  # noqa: E712
    FaceEmbedding(student_id="s", embedding=b"x", is_active=True)

    # Would raise AttributeError / TypeError if these were not declared.
    a = Alert(student_id="s", course_id="c", email_body="b",
              triggered_by="lecturer", sent_at=None)
    assert a.email_body == "b"

    # analytics.recompute_risk_scores never sets these; NOT NULL here would make
    # create_all() build a schema that rejects every risk score the app writes.
    required = {c.name for c in RiskScore.__table__.columns
                if not c.nullable and c.default is None
                and c.server_default is None and not c.primary_key}
    assert required == {"risk_score"}, required

    # marked_at is a Python @property aliasing timestamp — it has no .desc(),
    # so it must never be used in an ORDER BY.
    from utils.models import AttendanceRecord
    assert not hasattr(AttendanceRecord.marked_at, "desc")


def check_uuid_path_params():
    """Ids are UUID strings. An `id: int` path param rejects them with 422,
    which took out every admin edit/delete plus session close and check-in."""
    from main import app

    client = TestClient(app)
    u = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    cases = [
        ("PUT", f"/admin/students/{u}"), ("DELETE", f"/admin/students/{u}"),
        ("PUT", f"/admin/staff/{u}"), ("PUT", f"/admin/programmes/{u}"),
        ("PUT", f"/admin/courses/{u}"), ("DELETE", f"/admin/assignments/{u}"),
        ("PUT", f"/admin/timetable/{u}"), ("DELETE", f"/admin/enrolments/{u}"),
        ("POST", f"/sessions/{u}/close"), ("POST", f"/sessions/{u}/attend"),
        ("GET", f"/sessions/course/{u}/sessions"),
    ]
    for method, path in cases:
        r = client.request(method, path, json={})
        # Unauthenticated, so 401 is the pass condition. A 422 whose loc starts
        # with "path" means the id parameter itself refused the UUID.
        if r.status_code == 422:
            bad = [d for d in r.json().get("detail", [])
                   if isinstance(d, dict) and d.get("loc", [None])[0] == "path"]
            assert not bad, f"{method} {path} still rejects a UUID id: {bad}"


def check_no_synthetic_ids():
    """`course.id * 10 + 1` was used to fabricate timetable row ids. On UUID
    strings that is a TypeError; `* 10` alone silently yields 360 junk chars."""
    cid = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    try:
        cid * 10 + 1
        raise AssertionError("expected TypeError — string id arithmetic")
    except TypeError:
        pass

    from pathlib import Path
    for name in ("routers/students.py", "routers/lecturers.py"):
        src = Path(name).read_text(encoding="utf-8")
        for line in src.splitlines():
            code = line.split("#", 1)[0]
            assert "id * 10" not in code, f"{name}: synthetic id returned: {line.strip()}"


def check_meeting_key_derived():
    """Seeded class_meetings rows still carry pre-UUID keys ("Lecture-8") while
    course_id was converted, so every f"Lecture-{course.id}" lookup missed and
    the timetable came back empty. The key must be derived from the FKs."""
    from utils.scheduler import meeting_key_for

    assert meeting_key_for("Lecture", "c-uuid", None) == "Lecture-c-uuid"
    assert meeting_key_for("Tutor", "c-uuid", "a-uuid") == "Tutor-a-uuid"
    assert meeting_key_for("Practical", "c-uuid", "a-uuid") == "Practical-a-uuid"


def check_attendance_policy():
    """One attendance policy: closed-only, present+leave, hours-weighted.
    routers/students.py used to compute a flat present-only rate, so the app and
    the web dashboard disagreed for the same student."""
    from utils.attendance import attendance_rate_percent, session_hours

    assert session_hours(None, None) == 2.0                  # missing -> default
    assert session_hours(*_span(hours=10)) == 6.0            # clamped high
    assert session_hours(*_span(minutes=6)) == 0.5           # clamped low

    # Two sessions, 1h and 3h; attended only the 1h one. Hours-weighted = 25%,
    # a flat per-session count would wrongly say 50%.
    sessions = [("s1", "All", 1.0), ("s2", "All", 3.0)]
    rate = attendance_rate_percent(sessions, {("stu", "s1")}, "stu", "All")
    assert abs(rate - 25.0) < 0.05, rate

    # A session for another group must not count against the student.
    other = [("s1", "G2", 2.0)]
    assert attendance_rate_percent(other, set(), "stu", "G1") == 100.0

    # "leave" counts as attended, so the caller passing it in present_set is
    # equivalent to a present record.
    both = [("s1", "All", 2.0)]
    assert attendance_rate_percent(both, {("stu", "s1")}, "stu", "All") == 100.0


def _span(**kw):
    from datetime import datetime, timedelta
    start = datetime(2026, 7, 29, 8, 0, 0)
    return start, start + timedelta(**kw)


def check_course_access_guard():
    """open/close session had no ownership check: any lecturer could open or
    close any other lecturer's class. All four lecturer-scoped operations must
    route through the one guard."""
    import inspect

    from routers import sessions

    assert hasattr(sessions, "require_course_access")
    for fn_name in ("open_session", "close_session",
                    "get_course_sessions", "update_lecturer_attendance",
                    "get_session_attendance"):
        src = inspect.getsource(getattr(sessions, fn_name))
        assert "require_course_access" in src, f"{fn_name} does not check course access"


def _db_available():
    try:
        from sqlalchemy import text
        from utils.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def check_model_matches_db():
    """Every column declared on a model must exist in the live database —
    otherwise the app emits SQL for columns that aren't there."""
    from sqlalchemy import inspect as sa_inspect

    from utils.database import engine
    from utils.models import Base

    insp = sa_inspect(engine)
    for name, table in Base.metadata.tables.items():
        if not insp.has_table(name):
            continue
        db_cols = {c["name"] for c in insp.get_columns(name)}
        missing = {c.name for c in table.columns} - db_cols
        assert not missing, f"{name}: model declares columns absent from DB: {sorted(missing)}"


def check_no_5xx_on_reads():
    """Every parameterless GET, for each role, must not return 5xx.
    This is what caught /students/me/attendance ordering by a @property."""
    from main import app
    from utils.database import SessionLocal
    from utils.models import User
    from utils.security import create_access_token

    db = SessionLocal()
    try:
        headers = {}
        for role in ("admin", "lecturer", "student"):
            user = db.query(User).filter(User.role == role).first()
            if user:
                headers[role] = {
                    "Authorization": "Bearer " + create_access_token(
                        {"user_id": user.id, "role": user.role})
                }
        if not headers:
            return
        client = TestClient(app)
        paths = sorted({r.path for r in app.routes
                        if hasattr(r, "methods") and "GET" in r.methods and "{" not in r.path})
        for path in paths:
            for role, hdr in headers.items():
                r = client.get(path, headers=hdr)
                assert r.status_code < 500, f"{role} GET {path} -> {r.status_code}: {r.text[:200]}"
    finally:
        db.close()


OFFLINE = [
    check_model_fields,
    check_no_synthetic_ids,
    check_meeting_key_derived,
    check_attendance_policy,
    check_course_access_guard,
]
NEEDS_DB = [
    check_uuid_path_params,
    check_model_matches_db,
    check_no_5xx_on_reads,
]


def main() -> int:
    checks = list(OFFLINE)
    if _db_available():
        checks += NEEDS_DB
    else:
        print("no database reachable — skipping "
              f"{len(NEEDS_DB)} DB-backed checks: "
              f"{', '.join(c.__name__ for c in NEEDS_DB)}")

    failed = 0
    for check in checks:
        try:
            check()
            print(f"PASS  {check.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL  {check.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"ERROR {check.__name__}: {type(e).__name__}: {e}")

    print()
    print(f"{len(checks) - failed}/{len(checks)} passed"
          + (f", {len(NEEDS_DB)} skipped (no DB)" if len(checks) == len(OFFLINE) else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

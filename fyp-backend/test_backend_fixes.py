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
    from db.models import Alert, FaceEmbedding, RiskScore

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

    # No @property may share a name with a mapped column. Four of them did: a rename
    # left the old names as forwarding properties, so SQLAlchemy stopped mapping the
    # real columns and every row's data went invisible to the API — while ORDER BY on
    # one of those names raised AttributeError and 500'd the endpoint.
    from db.models import AttendanceRecord

    mapped = {c.key for c in AttendanceRecord.__table__.columns}
    shadowed = {name for name in mapped
                if isinstance(getattr(AttendanceRecord, name, None), property)}
    assert not shadowed, f"@property shadowing physical column(s): {shadowed}"

    # The four names the API publishes must be sortable columns, not properties.
    for name in ("marked_at", "confidence_score", "network_verified", "liveness_passed"):
        assert hasattr(getattr(AttendanceRecord, name), "desc"), f"{name} is not a column"


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
    the timetable came back empty. The key must be derived from the FKs.

    Tutorials and practicals also carry their group: one assignment has one meeting
    per group, so a key without the group collides — which the unique meeting_key
    rejects on insert, and which silently drops a slot from the schedule dict."""
    from domain.scheduler import meeting_key_for

    # A lecture is one meeting for the whole course, so it takes no group.
    assert meeting_key_for("Lecture", "c-uuid", None) == "Lecture-c-uuid"
    assert meeting_key_for("Tutor", "c-uuid", "a-uuid", "G1") == "Tutor-a-uuid-G1"
    assert meeting_key_for("Practical", "c-uuid", "a-uuid", "G2") == "Practical-a-uuid-G2"

    # Two groups of the SAME assignment must not share a key.
    assert (meeting_key_for("Tutor", "c-uuid", "a-uuid", "G1")
            != meeting_key_for("Tutor", "c-uuid", "a-uuid", "G2"))


def check_attendance_policy():
    """One attendance policy: closed-only, present+leave, hours-weighted.
    routers/students.py used to compute a flat present-only rate, so the app and
    the web dashboard disagreed for the same student."""
    from domain.attendance import attendance_rate_percent, session_hours

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


def check_announcement_visibility():
    """Targeting is scope x role, and the two viewer roles must not drift apart.

    The student view and the staff view each carried their own 60-line copy of this,
    differing only in which role they excluded. Two copies of a visibility rule is
    two chances for one of them to show a notice to the wrong audience.
    """
    from domain.announcements import announcement_dict, visible_announcements

    seen = []

    class _Query:
        """Captures the filter the caller builds, then returns the fixture rows."""

        def __init__(self, rows):
            self.rows = rows

        def filter(self, *args):
            seen.append(args)
            return self

        def all(self):
            return self.rows

    class _DB:
        def __init__(self, rows):
            self.rows = rows

        def query(self, *_):
            return _Query(self.rows)

    def ann(scope="all", role="all", prog=None, course=None, priority="Medium"):
        from datetime import datetime
        a = type("A", (), {})()
        a.id, a.title, a.content = "x", "t", "c"
        a.faculty, a.department, a.publisher = "FOCS", "CS", "ADMIN"
        a.created_at = datetime(2026, 7, 1)
        a.priority, a.image_base64 = priority, None
        a.publish_start = a.publish_end = None
        a.is_draft = False
        a.target_scope, a.target_role = scope, role
        a.target_programme_code, a.target_course_code = prog, course
        return a

    all_staff = ann(role="staff")
    all_students = ann(role="students")
    prog_hit = ann(scope="programme", prog="RSW")
    prog_miss = ann(scope="programme", prog="OTHER")
    course_hit = ann(scope="course", course="BMCS3413")
    course_miss = ann(scope="course", course="NOPE")
    everyone = ann()
    rows = [all_staff, all_students, prog_hit, prog_miss,
            course_hit, course_miss, everyone]

    student = visible_announcements(_DB(rows), "students", {"RSW"}, {"BMCS3413"})
    staff = visible_announcements(_DB(rows), "staff", {"RSW"}, {"BMCS3413"})

    # Role gate cuts exactly one way for each viewer, and never hides "all".
    assert all_staff not in student and all_students in student
    assert all_students not in staff and all_staff in staff
    assert everyone in student and everyone in staff

    # Scope gate: only the matching programme / course code is addressed.
    for got in (student, staff):
        assert prog_hit in got and prog_miss not in got
        assert course_hit in got and course_miss not in got

    # Codes are compared case-insensitively — the student view used to .upper()
    # both sides, the staff view only one.
    lower = visible_announcements(_DB([prog_hit, course_hit]), "students",
                                  {"rsw"}, {"bmcs3413"})
    assert len(lower) == 2, lower

    # Priority ordering: High first, and an unrecognised value must not sort last
    # (it defaults to Medium, so a typo cannot bury a notice below "Low").
    ordered = visible_announcements(
        _DB([ann(priority="Low"), ann(priority="High"),
             ann(priority="Typo"), ann(priority="Medium")]),
        "students", set(), set())
    assert [a.priority for a in ordered][0] == "High"
    assert [a.priority for a in ordered][-1] == "Low"

    # Draft and publication window are filtered in SQL, not in Python — three
    # filter arguments must reach the query, or unpublished notices leak.
    assert seen and len(seen[0]) == 3, seen

    # One wire shape for every consumer. faculty/department were missing from the
    # public endpoint's own copy, so the mobile login screen read them as null.
    d = announcement_dict(everyone)
    assert {"faculty", "department", "publisher", "created_at"} <= set(d)
    assert d["created_at"] == "2026-07-01T00:00:00"


class _FakeSession:
    """Minimal stand-in for a ClassSession: the window helpers only read opened_at."""

    def __init__(self, opened_at):
        self.opened_at = opened_at


def _slot(day, start, end, group=None, role="Tutor"):
    return {"day": day, "start": start, "end": end, "room": "Lab 1",
            "role": role, "course_id": "c1", "assignment_id": "a1", "class_group": group}


def check_session_window():
    """A session's end comes from the slot on the day it OPENED, not from
    whichever slot the database listed first.

    Six copies of this calculation used slots[0]. With a group holding both a
    tutorial and a practical that meant an arbitrary pick, so the check-in window
    could close hours early or late. It also read the offset off the host clock,
    which differs between a developer machine and a container with no TZ set.
    """
    from datetime import datetime, timedelta

    from domain.scheduler import session_end_utc, session_window_utc, slot_on_day
    from utils.timeutil import local_offset

    offset = local_offset()
    # A Wednesday, 09:00 local, expressed as the naive UTC we store.
    opened_local = datetime(2026, 7, 29, 9, 0)
    session = _FakeSession(opened_local - offset)

    slots = [_slot("Tuesday", "18:00", "20:00", "G2"),
             _slot("Wednesday", "10:00", "12:00", "G1")]

    # Picks by weekday, not by list order — reversing the list must not change it.
    assert slot_on_day(slots, opened_local.date())["start"] == "10:00"
    assert slot_on_day(list(reversed(slots)), opened_local.date())["start"] == "10:00"

    start, end = session_window_utc(session, slots)
    assert start == datetime(2026, 7, 29, 10, 0) - offset, start
    assert end == datetime(2026, 7, 29, 12, 0) - offset, end
    assert session_end_utc(session, slots) == end

    # Two slots on the same weekday: the window must cover the later ending one,
    # otherwise a back-to-back double period closes at the first break.
    same_day = [_slot("Wednesday", "10:00", "12:00", "G1"),
                _slot("Wednesday", "12:00", "14:00", "G1", role="Practical")]
    assert session_end_utc(session, same_day) == datetime(2026, 7, 29, 14, 0) - offset

    # No slot for that weekday, and no slots at all, both fall back to +2h — the
    # long-standing default for an unscheduled session.
    assert session_end_utc(session, [_slot("Friday", "08:00", "10:00", "G1")]) \
        == session.opened_at + timedelta(hours=2)
    assert session_window_utc(session, []) == (None, session.opened_at + timedelta(hours=2))

    # The offset must come from the named campus zone, not the host clock. On a
    # machine set to UTC the two agree by accident, so assert the zone directly.
    assert local_offset() == timedelta(hours=8), local_offset()


def _db_available():
    try:
        from sqlalchemy import text
        from db.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def check_model_matches_db():
    """Every column declared on a model must exist in the live database —
    otherwise the app emits SQL for columns that aren't there."""
    from sqlalchemy import inspect as sa_inspect

    from db.database import engine
    from db.models import Base

    insp = sa_inspect(engine)
    for name, table in Base.metadata.tables.items():
        if not insp.has_table(name):
            continue
        db_cols = {c["name"] for c in insp.get_columns(name)}
        missing = {c.name for c in table.columns} - db_cols
        assert not missing, f"{name}: model declares columns absent from DB: {sorted(missing)}"


def check_duplicate_checkin_rejected():
    """The database, not the handler, is what stops a double check-in.

    The handler's "already checked in?" query cannot stop two concurrent requests
    from both passing it and both inserting. This constraint was built and verified
    once, then dropped again with the model declaration — which left the handler
    catching an IntegrityError that could no longer be raised, and the comment
    calling it "the authoritative backstop" while nothing enforced it.

    Verified with raw SQL in an explicit transaction that is rolled back. NOT by
    calling an endpoint: several of them commit internally, and a past self-audit
    using that "fake rollback" really deleted a course.
    """
    import uuid

    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    from db.database import engine

    with engine.connect() as conn:
        names = {r[0] for r in conn.execute(text(
            "SELECT conname FROM pg_constraint "
            "WHERE conrelid = 'attendance_records'::regclass"))}
        assert "uq_attendance_student_session" in names, sorted(names)

        row = conn.execute(text(
            "SELECT session_id, student_id FROM attendance_records LIMIT 1")).first()
        if row is None:
            return
        before = conn.execute(text("SELECT count(*) FROM attendance_records")).scalar()

        conn.begin_nested()
        raised = False
        try:
            conn.execute(
                text("INSERT INTO attendance_records (id, session_id, student_id, status) "
                     "VALUES (:i, :s, :t, 'present')"),
                {"i": str(uuid.uuid4()), "s": row[0], "t": row[1]},
            )
        except IntegrityError:
            raised = True
        conn.rollback()
        assert raised, "duplicate (student_id, session_id) insert was accepted"

    with engine.connect() as conn:
        after = conn.execute(text("SELECT count(*) FROM attendance_records")).scalar()
        assert after == before, f"probe leaked rows: {before} -> {after}"
        dupes = conn.execute(text(
            "SELECT count(*) FROM (SELECT student_id, session_id FROM attendance_records "
            "GROUP BY 1, 2 HAVING count(*) > 1) t")).scalar()
        assert dupes == 0, dupes


def check_override_enrolment_rule():
    """Admin and lecturer overrides must apply the SAME enrolment rule, and a
    student cannot be marked into another group's session.

    The lecturer endpoint validated enrolment and group; the admin one only checked
    that both ids existed. A mistyped student_id there fabricated a record for
    someone who never took the course — and that record feeds attendance rates and
    the risk model. Both now route through one helper.
    """
    import inspect

    from fastapi import HTTPException

    from db.database import SessionLocal
    from db.models import ClassSession, Enrolment, Student
    from domain.attendance import require_session_enrolment
    from routers import admin_attendance, sessions

    # Both override handlers must go through the shared rule, not their own copy.
    for module, fn_name in ((sessions, "update_lecturer_attendance"),
                            (admin_attendance, "update_admin_attendance")):
        src = inspect.getsource(getattr(module, fn_name))
        assert "require_session_enrolment" in src, f"{fn_name} skips the enrolment rule"

    db = SessionLocal()
    try:
        session = db.query(ClassSession).filter(ClassSession.class_group != "All").first()
        if session is None:
            return

        enrolled = db.query(Enrolment).filter(
            Enrolment.course_id == session.course_id,
            Enrolment.class_group == session.class_group).first()
        wrong_group = db.query(Enrolment).filter(
            Enrolment.course_id == session.course_id,
            Enrolment.class_group != session.class_group).first()
        # Genuinely not on this course. "Enrolled on some OTHER course" is not enough:
        # most students take several, so such a student is usually on this one too.
        on_this_course = db.query(Enrolment.student_id).filter(
            Enrolment.course_id == session.course_id)
        outsider = db.query(Student).filter(
            ~Student.id.in_(on_this_course)).first()

        if enrolled:
            require_session_enrolment(db, session, enrolled.student_id)

        # Not enrolled on the course at all.
        if outsider:
            try:
                require_session_enrolment(db, session, outsider.id)
                raise AssertionError("a student not enrolled on the course was accepted")
            except HTTPException as e:
                assert e.status_code == 400, e.status_code

        # Enrolled, but in a different group than this session.
        if wrong_group:
            try:
                require_session_enrolment(db, session, wrong_group.student_id)
                raise AssertionError("a student from another group was accepted")
            except HTTPException as e:
                assert e.status_code == 400, e.status_code

            # The student-facing path states the same rule as a 403.
            try:
                require_session_enrolment(db, session, wrong_group.student_id,
                                          status_code=403)
                raise AssertionError("cross-group check-in was accepted")
            except HTTPException as e:
                assert e.status_code == 403, e.status_code
    finally:
        db.close()


def check_group_slots_isolated():
    """A group's check-in window is built from ITS OWN slots only.

    class_meetings had no class_group column, so this returned every tutorial and
    practical of the course and the callers took slots[0]. Two consequences: the
    window came from an arbitrary slot, and validate_student_checkin accepted any
    matching slot — so a student could satisfy the time check using another group's
    tutorial.
    """
    from db.database import SessionLocal
    from db.models import ClassMeeting, Enrolment
    from domain.scheduler import calculate_schedule, get_course_group_slots

    db = SessionLocal()
    try:
        # Every stored meeting must declare its group unless it is a lecture, and
        # the derived keys must stay unique once groups are split out.
        rows = db.query(ClassMeeting).all()
        for m in rows:
            if m.role == "Lecture":
                assert m.class_group is None, f"lecture {m.id} carries a group"
            else:
                assert m.class_group is not None, f"{m.role} {m.id} has no group"
        assert len(calculate_schedule(db)) == len(rows), "meeting keys collide"

        course_id = db.query(Enrolment.course_id).filter(
            Enrolment.class_group != "All").first()
        if course_id is None:
            return
        course_id = course_id[0]
        groups = sorted({g for (g,) in db.query(Enrolment.class_group)
                         .filter(Enrolment.course_id == course_id).distinct()})

        for group in groups:
            slots = get_course_group_slots(db, course_id, group)
            # Never another group's slot: that was the cross-group bypass.
            assert all(s["class_group"] == group for s in slots), \
                f"group {group} got: {[s['class_group'] for s in slots]}"
            # "All" means the lecture; a specific group means its own tutorials.
            assert all(s["role"] != "Lecture" for s in slots), \
                f"group {group} picked up the lecture, widening its window"

        lecture_slots = get_course_group_slots(db, course_id, "All")
        assert all(s["role"] == "Lecture" for s in lecture_slots), lecture_slots
    finally:
        db.close()


def check_no_5xx_on_reads():
    """Every parameterless GET, for each role, must not return 5xx.
    This is what caught /students/me/attendance ordering by a @property."""
    from main import app
    from db.database import SessionLocal
    from db.models import User
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
    check_announcement_visibility,
    check_session_window,
]
NEEDS_DB = [
    check_uuid_path_params,
    check_model_matches_db,
    check_duplicate_checkin_rejected,
    check_override_enrolment_rule,
    check_group_slots_isolated,
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

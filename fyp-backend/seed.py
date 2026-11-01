"""One-off data seeds. Run explicitly: `python seed.py`.

These used to run at main.py import time, which meant every process start silently
wrote to the database — and a failure only printed a warning while the app carried on
pretending it had succeeded. Schema now belongs to Alembic; data seeds belong here,
behind an explicit invocation.

Both seeds are idempotent: they only insert when their table is empty, so running this
twice cannot duplicate or overwrite anything.
"""
from sqlalchemy import text

from db.database import SessionLocal, engine
from db.models import ClassMeeting

# Defaults for the network-verification switches. Absent rows fall back to the same
# values in routers/sessions.py::_get_settings, so this seed is a convenience, not a
# requirement.
SECURITY_DEFAULTS = {
    "network_check_enabled": "true",   # master switch for network verification
    "fail_closed": "true",             # reject check-in when network not verified
    "trust_proxy_header": "false",     # honour X-Forwarded-For (only behind a trusted proxy)
    "demo_simulate_network": "false",  # demo: override observed IP with a simulated one
    "demo_simulated_ip": "10.52.13.77" # the simulated campus IP used in demo mode
}


def seed_security_settings() -> None:
    with engine.begin() as conn:
        if conn.execute(text("SELECT COUNT(*) FROM security_settings;")).scalar():
            print("security_settings already populated, skipping.")
            return
        for k, v in SECURITY_DEFAULTS.items():
            conn.execute(
                text("INSERT INTO security_settings (key, value) VALUES (:k, :v) ON CONFLICT (key) DO NOTHING;"),
                {"k": k, "v": v},
            )
        print("Seeded default security settings.")


def seed_class_meetings() -> None:
    """Allocate the initial clash-free timetable. Only ever runs on an empty table —
    class_meetings is the timetable's single source of truth once populated."""
    from domain.scheduler import generate_clashfree_slots

    db = SessionLocal()
    try:
        if db.query(ClassMeeting).first() is not None:
            print("class_meetings already populated, skipping.")
            return
        rows = generate_clashfree_slots(db)
        for r in rows:
            db.add(ClassMeeting(**r))
        db.commit()
        print(f"Seeded class_meetings timetable with {len(rows)} meetings.")
    finally:
        db.close()


def reconcile_group_meetings(apply: bool = False) -> None:
    """List, and with --apply create, the Tutor/Practical meetings that staff assignments and enrolled groups imply but class_meetings lacks.

    Dry run unless applied. Additive: an existing meeting, including a customised one, is never changed. It does bring back a class
    time an admin deliberately deleted, which is why this is an explicit command and not automatic."""
    from db.models import Course, CourseStaffAssignment
    from domain.scheduler import add_missing_meetings, groups_for_course

    db = SessionLocal()
    try:
        total = 0
        for course in db.query(Course).order_by(Course.course_code):
            assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == course.id).all()
            for row in add_missing_meetings(db, course.id, assignments, groups_for_course(db, course.id)):
                print(f"  {course.course_code}: {row.role} for {row.class_group} -> {row.day} {row.start}-{row.end} {row.room}")
                total += 1
        if apply:
            db.commit()
        else:
            db.rollback()
        print(f"{'Created' if apply else 'Would create'} {total} missing group meeting(s)." + ("" if apply else " Re-run with --apply to create them."))
    except ValueError as error:   # the timetable is full: nothing is half-applied
        db.rollback()
        print(f"Nothing changed: {error}")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if "reconcile-groups" in sys.argv:
        reconcile_group_meetings(apply="--apply" in sys.argv)
    else:
        seed_security_settings()
        seed_class_meetings()

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from pydantic import ValidationError


def test_scheduled_time_not_early_open_time_controls_contact_hours():
    """Opening a 14:00-16:00 class at 13:00 must still count as two hours."""
    from domain.attendance import session_hours

    assert session_hours(
        datetime(2026, 8, 21, 5, 0),
        datetime(2026, 8, 21, 8, 0),
        scheduled_start=datetime(2026, 8, 21, 6, 0),
        scheduled_end=datetime(2026, 8, 21, 8, 0),
    ) == 2.0


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("completed", True),
        ("cancelled", False),
        ("scheduled", False),
        ("needs_attention", False),
        ("open", False),
    ],
)
def test_only_completed_classes_count_toward_attendance(status, expected):
    from domain.attendance import class_counts_toward_attendance

    assert class_counts_toward_attendance(SimpleNamespace(status=status)) is expected


def test_cancel_class_requires_a_real_reason():
    from schemas import ClassCancellation

    with pytest.raises(ValidationError):
        ClassCancellation(reason="   ")


def test_replacement_must_end_after_it_starts():
    from schemas import ReplacementClassCreate

    with pytest.raises(ValidationError):
        ReplacementClassCreate(
            scheduled_start=datetime(2026, 8, 22, 8, 0),
            scheduled_end=datetime(2026, 8, 22, 7, 0),
            room="Lab 1",
        )


def test_automatic_close_uses_scheduled_end():
    from domain.class_lifecycle import close_class_if_due

    scheduled_end = datetime(2026, 8, 21, 8, 0)
    lesson = SimpleNamespace(status="open", is_open=True, closed_at=None,
                             scheduled_end=scheduled_end)

    assert close_class_if_due(lesson, scheduled_end + timedelta(seconds=1)) is True
    assert lesson.status == "completed"
    assert lesson.is_open is False
    assert lesson.closed_at == scheduled_end


def test_unresolved_class_blocks_final_barred_list():
    from domain.class_lifecycle import barred_list_readiness

    result = barred_list_readiness([
        SimpleNamespace(status="completed"),
        SimpleNamespace(status="needs_attention"),
    ])

    assert result == {"ready": False, "unresolved_count": 1}


def test_completed_replacement_counts_but_scheduled_replacement_does_not():
    from domain.class_lifecycle import effective_class_count

    lessons = [SimpleNamespace(status="completed") for _ in range(11)]
    lessons.append(SimpleNamespace(status="cancelled"))
    lessons.append(SimpleNamespace(status="scheduled"))
    assert effective_class_count(lessons) == 11

    lessons[-1].status = "completed"
    assert effective_class_count(lessons) == 12


def test_cancelled_hours_leave_plan_and_return_only_after_replacement_completed():
    from domain.attendance import effective_planned_hours

    start = datetime(2026, 8, 21, 6, 0)
    end = datetime(2026, 8, 21, 8, 0)
    cancelled = SimpleNamespace(
        status="cancelled", replacement_for_session_id=None,
        scheduled_start=start, scheduled_end=end,
    )
    replacement = SimpleNamespace(
        status="scheduled", replacement_for_session_id="cancelled-id",
        scheduled_start=start + timedelta(days=1), scheduled_end=end + timedelta(days=1),
    )

    assert effective_planned_hours(24.0, [cancelled, replacement]) == 22.0
    replacement.status = "completed"
    assert effective_planned_hours(24.0, [cancelled, replacement]) == 24.0


def test_replacement_uses_its_own_scheduled_window_instead_of_weekly_timetable():
    """A Saturday replacement must not inherit the original Friday class window."""
    from domain.scheduler import session_window_utc

    replacement_start = datetime(2026, 8, 22, 1, 0)
    replacement_end = datetime(2026, 8, 22, 3, 0)
    replacement = SimpleNamespace(
        opened_at=datetime(2026, 8, 22, 0, 0),
        scheduled_start=replacement_start,
        scheduled_end=replacement_end,
    )
    original_weekly_slot = [
        {"day": "friday", "start": "14:00", "end": "16:00"},
    ]

    assert session_window_utc(replacement, original_weekly_slot) == (
        replacement_start,
        replacement_end,
    )


@pytest.mark.parametrize(
    ("now_offset", "expected"),
    [
        (timedelta(seconds=-1), "before"),
        (timedelta(0), "open"),
        (timedelta(hours=1), "open"),
        (timedelta(hours=2), "ended"),
        (timedelta(hours=2, seconds=1), "ended"),
    ],
)
def test_replacement_checkin_state_follows_its_own_time(now_offset, expected):
    from domain.scheduler import session_checkin_state

    start = datetime(2026, 8, 22, 1, 0)
    replacement = SimpleNamespace(
        opened_at=datetime(2026, 8, 22, 0, 0),
        scheduled_start=start,
        scheduled_end=start + timedelta(hours=2),
    )

    assert session_checkin_state(replacement, [], start + now_offset) == expected


def test_scheduled_class_has_no_database_default_open_time():
    """Creating a pending class must not make it look as if a lecturer opened it."""
    from db.models import ClassSession

    assert ClassSession.__table__.c.opened_at.server_default is None


@pytest.mark.parametrize(
    ("now_offset", "expected"),
    [
        (timedelta(hours=-1, seconds=-1), False),
        (timedelta(hours=-1), True),
        (timedelta(0), True),
        (timedelta(hours=2, seconds=-1), True),
        (timedelta(hours=2), False),
    ],
)
def test_class_can_open_from_one_hour_before_but_not_at_end(now_offset, expected):
    from domain.class_lifecycle import class_can_open

    start = datetime(2026, 8, 21, 6, 0)
    lesson = SimpleNamespace(scheduled_start=start, scheduled_end=start + timedelta(hours=2))

    assert class_can_open(lesson, start + now_offset) is expected


def test_cancelled_replacement_does_not_block_arranging_another_one():
    from domain.class_lifecycle import has_active_replacement

    assert has_active_replacement([SimpleNamespace(status="cancelled")]) is False
    assert has_active_replacement([SimpleNamespace(status="scheduled")]) is True
    assert has_active_replacement([SimpleNamespace(status="completed")]) is True


@pytest.mark.parametrize(
    ("offset", "status", "expected"),
    [
        (timedelta(minutes=-15), "scheduled", "before"),
        (timedelta(0), "scheduled", "started"),
        (timedelta(minutes=10), "scheduled", "not_opened"),
        (timedelta(minutes=10), "open", None),
        (timedelta(minutes=10), "cancelled", None),
    ],
)
def test_reminders_cover_pre_start_start_and_forgotten_gate(offset, status, expected):
    """A lecturer gets useful checkpoints without nagging after opening or cancellation."""
    from domain.class_lifecycle import reminder_stage

    start = datetime(2026, 8, 21, 6, 0)
    assert reminder_stage(start, start + timedelta(hours=2), status, start + offset) == expected


def test_class_held_resolves_review_without_creating_a_replacement():
    """Forgetting the gate must not turn a class that happened into a cancellation."""
    from domain.class_lifecycle import mark_class_held

    start = datetime(2026, 8, 21, 6, 0)
    end = start + timedelta(hours=2)
    lesson = SimpleNamespace(
        status="needs_attention", is_open=False, opened_at=None, closed_at=None,
        scheduled_start=start, scheduled_end=end, opened_by_user_id=None,
    )

    mark_class_held(lesson, "lecturer-1")

    assert lesson.status == "completed"
    assert lesson.opened_at == start
    assert lesson.closed_at == end
    assert lesson.opened_by_user_id == "lecturer-1"


def test_admin_escalation_waits_for_24_hours_of_unresolved_review():
    """Admins should see persistent omissions, not every class the instant it ends."""
    from domain.class_lifecycle import needs_admin_escalation

    end = datetime(2026, 8, 21, 8, 0)
    lesson = SimpleNamespace(status="needs_attention", scheduled_end=end)

    assert needs_admin_escalation(lesson, end + timedelta(hours=23, minutes=59)) is False
    assert needs_admin_escalation(lesson, end + timedelta(hours=24)) is True


def test_replacement_attention_resolves_original_meeting_for_lecturer_notification():
    from domain.session_sync import source_meeting_id

    original = SimpleNamespace(meeting_id="meeting-1", replacement_for_session_id=None)
    replacement = SimpleNamespace(meeting_id=None, replacement_for_session_id="original-1")
    db = SimpleNamespace(get=lambda _model, record_id: original if record_id == "original-1" else None)

    assert source_meeting_id(db, replacement) == "meeting-1"


def test_scheduled_classes_have_no_manual_close_route():
    from main import app

    routes = {(method, route.path) for route in app.routes for method in getattr(route, "methods", set())}

    assert ("POST", "/sessions/{id}/close") not in routes


def test_missed_classes_have_review_and_held_recovery_routes():
    """A forgotten gate must remain discoverable and resolvable after class day."""
    from main import app

    routes = {(method, route.path) for route in app.routes for method in getattr(route, "methods", set())}

    assert ("GET", "/sessions/needs-attention") in routes
    assert ("POST", "/sessions/{id}/held") in routes

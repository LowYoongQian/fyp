from datetime import datetime
from unittest.mock import MagicMock


def test_timetable_sync_never_marks_absent_when_lecturer_takes_no_action(monkeypatch):
    """A scheduled class is not evidence that it was held.

    When the lecturer never opens a session, the sync must leave the database
    in needs_attention so it blocks finalisation, but it must not mark anyone absent.
    """
    from domain import session_sync

    now = datetime(2026, 8, 21, 6, 0)  # Friday 14:00 in Malaysia
    monkeypatch.setattr(session_sync, "utcnow", lambda: now)
    monkeypatch.setattr(session_sync, "local_offset", lambda: datetime(2026, 8, 21, 14, 0) - now)
    monkeypatch.setattr(session_sync, "calculate_schedule", lambda _db: {
        "Lecture-course-1": {
            "meeting_id": "meeting-1",
            "course_id": "course-1",
            "role": "Lecture",
            "class_group": None,
            "day": "Friday",
            "start": "10:00",
            "end": "12:00",
            "room": "Theatre 1",
        }
    })

    sessions_query = MagicMock()
    sessions_query.filter.return_value.all.return_value = []

    users_query = MagicMock()
    users_query.filter.return_value.all.return_value = []

    meeting_query = MagicMock()
    meeting_query.filter.return_value.first.return_value = None

    db = MagicMock()
    db.query.side_effect = [sessions_query, users_query, meeting_query]

    session_sync._sync_class_sessions_now(db)

    added = [call.args[0] for call in db.add.call_args_list]
    assert len(added) == 1
    assert added[0].status == "needs_attention"
    assert all(item.__class__.__name__ != "AttendanceRecord" for item in added)

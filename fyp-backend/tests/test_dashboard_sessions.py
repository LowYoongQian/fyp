from datetime import datetime, timedelta

from test_medical_leave_review import db, seed
from db.models import AttendanceRecord, ClassSession, User
from routers.attendance_features import student_attendance_sessions


def test_dashboard_receives_only_assigned_completed_sessions_with_policy_hours(db):
    student, _, course, _ = seed(db)
    user = User(email='dashboard@test.example', password_hash='unused', role='student')
    db.add(user)
    db.flush()
    student.user_id = user.id
    start = datetime(2026, 10, 5, 1)
    for index, (group, state, status, hours) in enumerate([
        ('G1', 'completed', 'leave', 3),
        ('All', 'completed', None, 1),
        ('G2', 'completed', None, 2),
        ('G1', 'cancelled', None, 2),
        ('G1', 'open', None, 2),
    ]):
        row = ClassSession(course_id=course.id, class_group=group, status=state,
            is_open=state == 'open', opened_at=start + timedelta(days=index),
            closed_at=start + timedelta(days=index, minutes=10),
            scheduled_start=start + timedelta(days=index),
            scheduled_end=start + timedelta(days=index, hours=hours))
        db.add(row)
        db.flush()
        if status:
            db.add(AttendanceRecord(student_id=student.id, session_id=row.id, status=status))
    db.commit()
    rows = student_attendance_sessions(scope="all", db=db, current_user=user)
    assert len(rows) == 2
    assert {r['status']: r['contact_hours'] for r in rows} == {'leave': 3, 'absent': 1}
    assert all(r['scheduled_start'] for r in rows)

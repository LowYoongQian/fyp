from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from test_medical_leave_review import db, seed
from db.models import AttendanceRecord, AttendanceRequest, ClassSession, User
from domain.medical_leave import review_attendance_request
from routers.attendance_features import OfflineRecovery, reconcile_offline_checkin


def setup(db, state='completed', group='G1'):
    student, admin, course, _ = seed(db)
    user = User(email='offline@test.example', password_hash='unused', role='student')
    db.add(user)
    db.flush()
    student.user_id = user.id
    now = datetime.utcnow()
    session = ClassSession(course_id=course.id, class_group=group, status=state,
        is_open=state == 'open', opened_at=now - timedelta(hours=1),
        scheduled_start=now-timedelta(hours=1),
        scheduled_end=now+timedelta(hours=1) if state == 'open' else now-timedelta(minutes=1))
    db.add(session)
    db.commit()
    return student, admin, user, session


def body():
    return OfflineRecovery(client_request_id=uuid4(), captured_at=datetime(2000, 1, 1))


@pytest.mark.parametrize('status,expected', [('present','synced'), ('leave','excused')])
def test_lost_response_after_close_reconciles_without_duplicate(db, status, expected):
    student, _, user, session = setup(db)
    db.add(AttendanceRecord(student_id=student.id, session_id=session.id, status=status))
    db.commit()
    assert reconcile_offline_checkin(session.id, body(), db, user)['status'] == expected
    assert db.query(AttendanceRequest).filter_by(request_type='correction').count() == 0


def test_open_class_requires_normal_verification(db):
    _, _, user, session = setup(db, 'open')
    assert reconcile_offline_checkin(session.id, body(), db, user)['status'] == 'retry_checkin'
    assert db.query(AttendanceRecord).count() == 0


@pytest.mark.parametrize('decision', ['approved', 'rejected'])
def test_expired_attempt_reuses_review_and_only_approval_marks_present(db, decision):
    student, admin, user, session = setup(db)
    db.add(AttendanceRecord(student_id=student.id, session_id=session.id, status='absent'))
    db.commit()
    result = reconcile_offline_checkin(session.id, body(), db, user)
    assert result['status'] == 'needs_review'
    assert reconcile_offline_checkin(session.id, body(), db, user)['request_id'] == result['request_id']
    row = db.get(AttendanceRequest, result['request_id'])
    assert 'unverified' in row.reason
    assert db.query(AttendanceRecord).first().status == 'absent'
    review_attendance_request(db, row, decision, admin.id, 'Checked with lecturer')
    db.commit()
    assert db.query(AttendanceRecord).first().status == ('present' if decision == 'approved' else 'absent')
    assert reconcile_offline_checkin(session.id, body(), db, user)['status'] == ('synced' if decision == 'approved' else 'rejected')
    assert db.query(AttendanceRequest).filter_by(request_type='correction').count() == 1


@pytest.mark.parametrize('state,group,code', [('cancelled','G1',409),('completed','G2',403)])
def test_ineligible_class_cannot_create_recovery(db, state, group, code):
    _, _, user, session = setup(db, state, group)
    with pytest.raises(HTTPException) as error:
        reconcile_offline_checkin(session.id, body(), db, user)
    assert error.value.status_code == code
    assert db.query(AttendanceRequest).filter_by(request_type='correction').count() == 0

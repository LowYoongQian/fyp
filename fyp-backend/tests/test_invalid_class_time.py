from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

NOW = datetime(2026, 10, 9, 10, 30)


def slot(start='10:00', end='12:00'):
    return dict(day='Friday', start=start, end=end, room='Lab', meeting_id='meeting')


@pytest.mark.parametrize('start,end', [('bad','12:00'), ('10:00','25:00'), (None,'12:00'), ('10:60','12:00'), ('12:00','10:00'), ('10:00','10:00')])
@pytest.mark.parametrize('validator,code', [('validate_session_opening',400),('validate_student_checkin',403)])
def test_bad_timetable_cannot_authorize_opening_or_checkin(monkeypatch,start,end,validator,code):
    from routers import sessions
    monkeypatch.setattr(sessions,'get_course_group_slots',lambda *args:[slot(start,end)])
    with pytest.raises(HTTPException) as exc:
        getattr(sessions,validator)(MagicMock(),'course','G1',NOW)
    assert exc.value.status_code == code
    assert 'invalid' in exc.value.detail.lower()


def test_normal_windows_still_work(monkeypatch):
    from routers import sessions
    monkeypatch.setattr(sessions,'get_course_group_slots',lambda *args:[slot()])
    assert sessions.validate_session_opening(None,'course','G1',NOW.replace(hour=9,minute=0)) == slot()
    assert sessions.validate_student_checkin(None,'course','G1',NOW) is None
    for hour,minute in [(9,59),(12,0),(12,1)]:
        with pytest.raises(HTTPException):
            sessions.validate_student_checkin(None,'course','G1',NOW.replace(hour=hour,minute=minute))


@pytest.mark.parametrize('stored', [False,True])
def test_attend_route_rejects_invalid_time_without_writing(monkeypatch,stored):
    from routers import sessions
    from db.database import get_db
    from utils.security import require_student
    lesson=SimpleNamespace(is_open=True,course_id='course',class_group='G1',opened_at=NOW-timedelta(hours=8),
                           scheduled_start=NOW if stored else None,scheduled_end=NOW-timedelta(hours=1) if stored else None)
    db=MagicMock()
    monkeypatch.setattr(sessions,'get_or_404',lambda *args:lesson)
    monkeypatch.setattr(sessions,'require_semester_date',lambda *args:None)
    monkeypatch.setattr(sessions,'get_course_group_slots',lambda *args:[slot('bad')])
    monkeypatch.setattr(sessions,'utcnow',lambda:NOW-timedelta(hours=8))
    app=FastAPI(); app.include_router(sessions.router)
    app.dependency_overrides[get_db]=lambda:db
    app.dependency_overrides[require_student]=lambda:SimpleNamespace(id='student', status='active')
    response=TestClient(app).post('/sessions/session/attend',json={'image_base64':'test','liveness_passed':True,'challenge_token':'x'*48,'wifi_ssid':'Campus'})
    assert response.status_code == 403, response.text
    assert 'invalid' in response.json()['detail'].lower()
    db.add.assert_not_called(); db.commit.assert_not_called()
    assert lesson.is_open is True

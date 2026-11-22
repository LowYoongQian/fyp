"""Production account endpoints: owner isolation and revocation, no external sends."""
from datetime import timedelta

import pytest

from test_auth_access_regression import context, headers, identity
from db.models import PushDevice
from domain.account_security import new_session
from utils.timeutil import utcnow


@pytest.mark.parametrize('method,path,body', [
    ('get', '/auth/sessions', None),
    ('post', '/auth/logout', None),
    ('post', '/auth/logout-all', {'current_password': 'irrelevant'}),
    ('post', '/auth/push/device', {'token': 'x' * 40, 'platform': 'android'}),
    ('delete', '/auth/push/device', {'token': 'x' * 40, 'platform': 'android'}),
])
def test_sensitive_production_routes_require_authentication(context, method, path, body):
    _, client = context
    assert client.request(method, path, json=body).status_code == 401


def test_session_list_never_exposes_other_users_or_dead_sessions(context):
    db, client = context
    user, current = identity(db)
    second = new_session(db, user, 'Second browser')
    revoked = new_session(db, user, 'Revoked browser')
    revoked.revoked_at = utcnow()
    expired = new_session(db, user, 'Expired browser')
    expired.expires_at = utcnow() - timedelta(seconds=1)
    old_version = new_session(db, user, 'Old password session')
    old_version.auth_version = user.auth_version - 1
    other, other_session = identity(db)
    db.commit()
    response = client.get('/auth/sessions', headers=headers(user, current))
    assert response.status_code == 200
    rows = response.json()
    assert {r['id'] for r in rows} == {str(current.id), str(second.id)}
    assert {r['id'] for r in rows if r['current']} == {str(current.id)}
    assert all(set(r) <= {'id', 'device_label', 'created_at', 'expires_at', 'current', 'ip_address', 'kind'} for r in rows)
    other_rows = client.get('/auth/sessions', headers=headers(other, other_session)).json()
    assert {r['id'] for r in other_rows} == {str(other_session.id)}


def test_unregister_cannot_disable_another_users_push_device(context):
    db, client = context
    user, session = identity(db)
    other, other_session = identity(db)
    payload = {'token': 'synthetic-device-' + 'x' * 40, 'platform': 'android'}
    assert client.post('/auth/push/device', headers=headers(other, other_session), json=payload).status_code == 200
    response = client.request('DELETE', '/auth/push/device', headers=headers(user, session), json=payload)
    assert response.status_code == 200
    db.expire_all()
    row = db.query(PushDevice).filter_by(token=payload['token']).one()
    assert row.enabled and str(row.user_id) == str(other.id)
    assert client.request('DELETE', '/auth/push/device', headers=headers(other, other_session), json=payload).status_code == 200
    db.refresh(row)
    assert row.enabled is False


def test_logout_disables_only_devices_bound_to_that_session(context):
    db, client = context
    user, first = identity(db)
    second = new_session(db, user, 'Second browser')
    db.commit()
    for index, session in enumerate([first, second]):
        payload = {'token': f'device-{index}-' + 'x' * 40, 'platform': 'android'}
        assert client.post('/auth/push/device', headers=headers(user, session), json=payload).status_code == 200
    first_headers = headers(user, first)
    assert client.post('/auth/logout', headers=first_headers).status_code == 200
    db.expire_all()
    assert {str(r.session_id): r.enabled for r in db.query(PushDevice)} == {
        str(first.id): False, str(second.id): True}
    assert client.get('/auth/sessions', headers=first_headers).status_code == 401

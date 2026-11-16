"""Security boundary regression: real JWT/session validation; isolated SQLite.

Probe routes exercise shared guards, not every production route's wiring.
The logout test uses the actual account-security HTTP endpoints.
"""
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from db.database import get_db
from db.models import Base, User
from domain.account_security import new_session
from routers.account_security import router
from utils import security
from utils.timeutil import utcnow


@pytest.fixture
def context():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[t for t in Base.metadata.sorted_tables
                                            if t.name not in ('ai_chat_sessions', 'ai_chat_messages')])
    with Session(engine) as db:
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: db
        for name, guard in [('student', security.require_student),
                            ('lecturer', security.require_lecturer), ('admin', security.require_admin)]:
            def probe(user=Depends(guard)):
                return {'user_id': str(user.id), 'role': user.role}
            app.add_api_route('/probe/' + name, probe, methods=['GET'])
        with TestClient(app) as client:
            yield db, client
    engine.dispose()


def identity(db, role='student'):
    user = User(email=f'{uuid4()}@test.invalid', role=role, password_hash='not-used')
    db.add(user)
    db.flush()
    session = new_session(db, user, 'Web test')
    db.commit()
    return user, session


def headers(user, session, **claims):
    return {'Authorization': 'Bearer ' + security.create_access_token(
        {'user_id': str(user.id), 'sid': str(session.id), **claims})}


@pytest.mark.parametrize('role', ['student', 'lecturer', 'admin'])
@pytest.mark.parametrize('target', ['student', 'lecturer', 'admin'])
def test_role_matrix_enforces_server_role(context, role, target):
    db, client = context
    user, session = identity(db, role)
    response = client.get('/probe/' + target, headers=headers(user, session))
    allowed = role == target or (role == 'admin' and target == 'lecturer')
    assert response.status_code == (200 if allowed else 403)
    if allowed:
        assert response.json()['user_id'] == str(user.id)


@pytest.mark.parametrize('kind', ['missing', 'malformed', 'expired', 'wrong_signature', 'missing_sid', 'invalid_sid'])
def test_untrusted_credentials_never_reach_protected_handler(context, kind):
    db, client = context
    user, session = identity(db)
    claims = {'user_id': str(user.id), 'sid': str(session.id)}
    if kind == 'missing':
        auth = {}
    elif kind == 'malformed':
        auth = {'Authorization': 'Bearer invalid'}
    else:
        if kind == 'missing_sid':
            claims.pop('sid')
        if kind == 'invalid_sid':
            claims['sid'] = 'not-a-uuid'
        if kind == 'wrong_signature':
            token = jwt.encode(claims, 'different-test-key', algorithm='HS256')
        else:
            token = security.create_access_token(claims, expires_delta=timedelta(minutes=-5)
                                                 if kind == 'expired' else None)
        auth = {'Authorization': 'Bearer ' + token}
    assert client.get('/probe/student', headers=auth).status_code == 401


@pytest.mark.parametrize('state,expected', [('revoked', 401), ('expired', 401),
                                          ('version_changed', 401), ('inactive', 403), ('foreign_session', 401)])
def test_database_session_state_overrules_valid_signed_token(context, state, expected):
    db, client = context
    user, session = identity(db)
    auth = headers(user, session)
    if state == 'revoked':
        session.revoked_at = utcnow()
    elif state == 'expired':
        session.expires_at = utcnow() - timedelta(seconds=1)
    elif state == 'version_changed':
        user.auth_version += 1
    elif state == 'inactive':
        user.status = 'Suspended'
    else:
        other, _ = identity(db)
        session.user_id = other.id
    db.commit()
    assert client.get('/probe/student', headers=auth).status_code == expected


def test_role_claim_cannot_escalate_student(context):
    db, client = context
    user, session = identity(db)
    assert client.get('/probe/admin', headers=headers(user, session, role='admin')).status_code == 403


def test_logout_revokes_only_current_session(context):
    db, client = context
    user, first = identity(db)
    second = new_session(db, user, 'Second browser')
    db.commit()
    first_auth, second_auth = headers(user, first), headers(user, second)
    assert client.get('/probe/student', headers=first_auth).status_code == 200
    response = client.post('/auth/logout', headers=first_auth)
    assert response.status_code == 200, response.text
    assert client.get('/probe/student', headers=first_auth).status_code == 401
    assert client.get('/probe/student', headers=second_auth).status_code == 200


def test_logout_all_does_not_revoke_another_users_session(context):
    db, client = context
    user, first = identity(db)
    user.password_hash = security.hash_password('Local-auth-test!42')
    second = new_session(db, user, 'Second browser')
    other, other_session = identity(db)
    db.commit()
    auth = [headers(user, first), headers(user, second)]
    other_auth = headers(other, other_session)
    rejected = client.post('/auth/logout-all', headers=auth[0], json={'current_password': 'wrong'})
    assert rejected.status_code == 400, rejected.text
    for token in auth:
        assert client.get('/probe/student', headers=token).status_code == 200
    response = client.post('/auth/logout-all', headers=auth[0], json={'current_password': 'Local-auth-test!42'})
    assert response.status_code == 200, response.text
    for token in auth:
        assert client.get('/probe/student', headers=token).status_code == 401
    assert client.get('/probe/student', headers=other_auth).status_code == 200

"""Real routes/auth/SQL in a disposable DB; inference and photo storage are explicit stubs."""
import hashlib
import os
import struct
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Base, User, Student, FaceEmbedding, FaceSelfTestChallenge, AttendanceRecord, CheckinChallenge
from domain.account_security import new_session
from domain.face_self_test import consume_self_test
from routers import students, face_enrolment, sessions
from utils.security import create_access_token
from utils.timeutil import utcnow

VECTOR = struct.pack('512f', *([1.0] * 512))


@pytest.fixture
def env(tmp_path, monkeypatch):
    postgres_url = os.environ.get('FYP_QA_MIGRATED_URL')
    if postgres_url:
        # Only a newly marked synthetic migration database is eligible for resets.
        from urllib.parse import urlsplit
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from qa.common import guard_database
        guard_database(urlsplit(postgres_url).path.lstrip('/'))
        engine = create_engine(postgres_url)
        with engine.begin() as connection:
            connection.execute(text('TRUNCATE TABLE users CASCADE'))
    else:
        engine = create_engine('sqlite:///' + str(tmp_path / 'synthetic-face.db'), connect_args={'check_same_thread': False})
        tables = [t for t in Base.metadata.sorted_tables if t.name not in ('ai_chat_sessions', 'ai_chat_messages')]
        Base.metadata.create_all(engine, tables=tables)
    app = FastAPI()
    for router in (students.router, face_enrolment.router, sessions.router):
        app.include_router(router)
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    identities = {}
    with Session(engine) as db:
        for index, (label, role) in enumerate([('owner', 'student'), ('other', 'student'), ('lecturer', 'lecturer'), ('admin', 'admin')], start=1):
            user = User(email=f'{uuid4()}@test.invalid', password_hash='unused', role=role)
            db.add(user); db.flush()
            auth = new_session(db, user, 'Isolated face test'); db.flush()
            student = None
            if role == 'student':
                student = Student(user_id=user.id, name='Synthetic', student_code=f'ST{9000000 + index:07d}', is_face_registered=True)
                db.add(student); db.flush()
                db.add(FaceEmbedding(student_id=student.id, embedding=VECTOR, is_active=True))
            identities[label] = (str(user.id), str(auth.id), str(student.id) if student else None)
        db.commit()
    monkeypatch.setattr(students, 'extract_live_embedding', lambda _: VECTOR)
    monkeypatch.setattr(face_enrolment, 'extract_live_embedding', lambda _: VECTOR)
    monkeypatch.setattr(face_enrolment, 'stage_photo', lambda *args: None)
    def headers(label='owner'):
        user, auth, _ = identities[label]
        return {'Authorization': 'Bearer ' + create_access_token({'user_id': user, 'sid': auth})}
    with TestClient(app) as client:
        yield engine, client, identities, headers
    engine.dispose()


def challenge(env, label='owner'):
    engine, client, _, headers = env
    response = client.post('/students/me/face/self-test/challenge', headers=headers(label))
    assert response.status_code == 200, response.text
    token = response.json()['challenge_token']
    # Advance only this synthetic security timestamp, without slowing the suite.
    with Session(engine) as db:
        row = db.get(FaceSelfTestChallenge, hashlib.sha256(token.encode()).hexdigest())
        row.issued_at -= timedelta(seconds=3); db.commit()
    return token


def submit(env, token, live=True, label='owner', **extra):
    return env[1].post('/students/me/face/self-test', headers=env[3](label),
        json={'image_base64': 'synthetic-image', 'liveness_passed': live, 'challenge_token': token, **extra})


def business_snapshot(engine):
    with engine.connect() as conn:
        return {t.name: conn.execute(select(t)).fetchall() for t in Base.metadata.sorted_tables
                if t.name not in ('ai_chat_sessions', 'ai_chat_messages', 'face_self_test_challenges')}


@pytest.mark.parametrize('outcome', ['match', 'mismatch', 'liveness', 'client_liveness', 'bad_capture', 'unavailable'])
def test_verdict_is_server_owned_and_business_data_unchanged(env, monkeypatch, outcome):
    before = business_snapshot(env[0])
    token = challenge(env)
    calls = []
    def infer(image):
        calls.append(image)
        if outcome in ('liveness', 'bad_capture', 'unavailable'):
            raise HTTPException({'liveness': 403, 'bad_capture': 422, 'unavailable': 503}[outcome], 'Synthetic verifier boundary')
        return struct.pack('512f', *([-1.0] * 512)) if outcome == 'mismatch' else VECTOR
    monkeypatch.setattr(students, 'extract_live_embedding', infer)
    response = submit(env, token, live=outcome != 'client_liveness')
    assert response.status_code == (503 if outcome == 'unavailable' else 200), response.text
    if response.status_code == 200:
        assert response.json()['passed'] is (outcome == 'match')
        assert set(response.json()) == {'passed', 'reason', 'message'}
    assert len(calls) == (0 if outcome == 'client_liveness' else 1)
    assert submit(env, token).status_code == 409
    assert business_snapshot(env[0]) == before


def test_quota_is_per_student_and_cannot_be_reset_by_consuming_tokens(env):
    for _ in range(5):
        assert submit(env, challenge(env)).status_code == 200
    assert env[1].post('/students/me/face/self-test/challenge', headers=env[3]()).status_code == 429
    assert env[1].post('/students/me/face/self-test/challenge', headers=env[3]('other')).status_code == 200


@pytest.mark.parametrize('label', ['lecturer', 'admin', None])
def test_only_authenticated_students_can_issue_or_submit(env, label):
    headers = env[3](label) if label else {}
    expected = 403 if label else 401
    for path in ('/students/me/face/self-test/challenge', '/students/me/face/self-test', '/students/me/face/verify'):
        r = env[1].post(path, headers=headers, json={'image_base64': 'synthetic', 'liveness_passed': True, 'challenge_token': 'x' * 43})
        assert r.status_code == expected


def test_unregistered_student_has_no_self_test_authority(env):
    with Session(env[0]) as db:
        db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).delete(); db.commit()
    assert env[1].post('/students/me/face/self-test/challenge', headers=env[3]()).status_code == 400
    assert submit(env, 'x' * 43).status_code == 400


@pytest.mark.parametrize('attack', ['other_student', 'other_session', 'expired', 'reset', 'too_fast', 'classroom_token', 'extra_identity'])
def test_authority_is_bound_to_owner_session_revision_time_and_purpose(env, attack):
    token = challenge(env)
    with Session(env[0]) as db:
        row = db.get(FaceSelfTestChallenge, hashlib.sha256(token.encode()).hexdigest())
        if attack == 'expired': row.expires_at = utcnow() - timedelta(seconds=1)
        if attack == 'too_fast': row.issued_at = utcnow() + timedelta(seconds=1)
        if attack == 'reset':
            db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).update({'updated_at': utcnow() + timedelta(seconds=1)})
        if attack == 'other_session': row.auth_session_id = env[2]['other'][1]
        db.commit()
    if attack == 'classroom_token': token = 'unrelated-classroom-token-' + 'x' * 30
    response = submit(env, token, label='other' if attack == 'other_student' else 'owner',
        **({'student_id': env[2]['other'][2]} if attack == 'extra_identity' else {}))
    assert response.status_code == (422 if attack == 'extra_identity' else 400 if attack == 'too_fast' else 409)
    with Session(env[0]) as db:
        assert db.query(AttendanceRecord).count() == db.query(CheckinChallenge).count() == 0


def test_face_reset_during_inference_invalidates_result(env, monkeypatch):
    token = challenge(env)
    def infer(_):
        with Session(env[0]) as db:
            db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).update({'updated_at': utcnow() + timedelta(seconds=1)})
            db.commit()
        return VECTOR
    monkeypatch.setattr(students, 'extract_live_embedding', infer)
    assert submit(env, token).status_code == 409


def test_atomic_claim_survives_concurrent_replay_from_separate_connections(env):
    token = challenge(env)
    with Session(env[0]) as db:
        version = db.get(FaceSelfTestChallenge, hashlib.sha256(token.encode()).hexdigest()).registration_version
    def claim(_):
        with Session(env[0]) as db:
            try:
                consume_self_test(db, token, env[2]['owner'][2], env[2]['owner'][1], version)
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(claim, range(2))) == [200, 409]


def test_first_registration_and_duplicate_never_create_attendance(env):
    with Session(env[0]) as db:
        db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).delete()
        db.query(Student).filter_by(id=env[2]['owner'][2]).update({'is_face_registered': False})
        db.commit()
    body = {'image_base64': 'synthetic-image', 'registration_version': None}
    first = env[1].post('/students/me/face', headers=env[3](), json=body)
    assert first.status_code == 200 and first.json()['is_face_registered'] is True, first.text
    second = env[1].post('/students/me/face', headers=env[3](), json=body)
    assert second.status_code == 409 and 'already registered' in second.json()['detail']
    assert 'attendance' not in second.text.lower()
    with Session(env[0]) as db:
        assert db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).count() == 1
        assert db.query(AttendanceRecord).count() == db.query(CheckinChallenge).count() == 0


def test_registration_rechecks_a_competing_commit_after_inference(env, monkeypatch):
    with Session(env[0]) as db:
        db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).delete(); db.commit()
    def competing_registration(_):
        with Session(env[0]) as db:
            db.add(FaceEmbedding(student_id=env[2]['owner'][2], embedding=VECTOR, is_active=True))
            db.commit()
        return struct.pack('512f', *([-1.0] * 512))
    monkeypatch.setattr(face_enrolment, 'extract_live_embedding', competing_registration)
    response = env[1].post('/students/me/face', headers=env[3](),
        json={'image_base64': 'synthetic', 'registration_version': None})
    assert response.status_code == 409
    with Session(env[0]) as db:
        assert db.query(FaceEmbedding).filter_by(student_id=env[2]['owner'][2]).one().embedding == VECTOR
        assert db.query(AttendanceRecord).count() == 0


def test_already_attended_is_distinct_and_self_test_preserves_existing_attendance(env, monkeypatch):
    from db.models import Course, ClassSession, Enrolment
    with Session(env[0]) as db:
        course = Course(course_code='QA-FACE', course_name='Synthetic')
        db.add(course); db.flush()
        lesson = ClassSession(course_id=course.id, class_group='G1', is_open=True, status='open',
            scheduled_start=utcnow() - timedelta(minutes=5), scheduled_end=utcnow() + timedelta(minutes=50))
        db.add(lesson); db.flush()
        db.add_all([Enrolment(student_id=env[2]['owner'][2], course_id=course.id, class_group='G1'),
                    AttendanceRecord(student_id=env[2]['owner'][2], session_id=lesson.id, status='present')])
        lesson_id = str(lesson.id); db.commit()
    monkeypatch.setattr(sessions, 'extract_live_embedding', lambda _: pytest.fail('Duplicate attendance must stop before inference'))
    response = env[1].post(f'/sessions/{lesson_id}/attend', headers=env[3](),
        json={'wifi_ssid': '', 'image_base64': 'synthetic', 'liveness_passed': True, 'challenge_token': 'x' * 43})
    assert response.status_code == 400
    assert response.json()['detail'] == 'You have already registered attendance for this session'
    before = business_snapshot(env[0])
    assert submit(env, challenge(env)).json()['passed'] is True
    assert business_snapshot(env[0]) == before


@pytest.mark.parametrize('offset,passed', [(-0.00001, True), (0, True), (0.00001, False)])
def test_self_test_uses_the_attendance_threshold_including_boundary(env, monkeypatch, offset, passed):
    assert students._FACE_MATCH_THRESHOLD == sessions._FACE_MATCH_THRESHOLD
    monkeypatch.setattr(students, '_cosine_distance', lambda *_: sessions._FACE_MATCH_THRESHOLD + offset)
    assert submit(env, challenge(env)).json()['passed'] is passed


@pytest.mark.parametrize('is_real', [True, False, None])
def test_shared_extractor_demands_server_anti_spoof_and_arcface(monkeypatch, is_real):
    import base64
    import sys
    from types import SimpleNamespace
    import numpy as np
    from integrations import face, live_face
    calls = []
    # Model-contract test only: actual Torch/Fasnet execution needs device/model acceptance.
    monkeypatch.setitem(sys.modules, 'torch', SimpleNamespace())
    class Detector:
        @staticmethod
        def build_model(name, **kwargs):
            assert name == 'Fasnet' and kwargs['task'] == 'spoofing'
        @staticmethod
        def extract_faces(**kwargs):
            calls.append('liveness')
            assert kwargs['enforce_detection'] is True and kwargs['anti_spoofing'] is True
            result = {'face': np.ones((8, 8, 3), dtype=np.uint8)}
            if is_real is not None: result['is_real'] = is_real
            return [result]
        @staticmethod
        def represent(**kwargs):
            calls.append('arcface')
            assert kwargs['model_name'] == 'ArcFace' and kwargs['detector_backend'] == 'skip'
            return [{'embedding': [1.0] * 512}]
    monkeypatch.setattr(face, '_DEEPFACE_AVAILABLE', True)
    monkeypatch.setattr(face, 'DeepFace', Detector)
    monkeypatch.setattr(live_face.cv2, 'imdecode', lambda *_: np.ones((16, 16, 3), dtype=np.uint8))
    if is_real:
        assert live_face.extract_live_embedding(base64.b64encode(b'synthetic').decode()) == VECTOR
        assert calls == ['liveness', 'arcface']
    else:
        with pytest.raises(HTTPException) as error:
            live_face.extract_live_embedding(base64.b64encode(b'synthetic').decode())
        assert error.value.status_code == (503 if is_real is None else 403)
        assert calls == ['liveness']


def test_missing_server_liveness_runtime_fails_closed(monkeypatch):
    import sys
    from integrations import face, live_face
    monkeypatch.setattr(face, '_DEEPFACE_AVAILABLE', True)
    monkeypatch.setitem(sys.modules, 'torch', None)
    with pytest.raises(HTTPException) as error:
        live_face.extract_live_embedding('synthetic')
    assert error.value.status_code == 503


def test_logout_during_inference_invalidates_self_test(env, monkeypatch):
    from db.models import AuthSession
    token = challenge(env)
    def infer(_):
        with Session(env[0]) as db:
            db.get(AuthSession, env[2]['owner'][1]).revoked_at = utcnow(); db.commit()
        return VECTOR
    monkeypatch.setattr(students, 'extract_live_embedding', infer)
    assert submit(env, token).status_code == 401


def test_additive_migration_builds_only_self_test_security_schema():
    import importlib.util
    import io
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'alembic/versions/a6c9e2f41083_face_self_test_challenges.py'
    spec = importlib.util.spec_from_file_location('self_test_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    output = io.StringIO()
    context = MigrationContext.configure(dialect_name='postgresql', opts={'as_sql': True, 'output_buffer': output})
    with Operations.context(context):
        migration.upgrade(); migration.downgrade()
    sql = output.getvalue()
    assert 'CREATE TABLE face_self_test_challenges' in sql
    assert 'FOREIGN KEY(auth_session_id) REFERENCES auth_sessions (id) ON DELETE CASCADE' in sql
    assert 'ALTER TABLE public.face_self_test_challenges ENABLE ROW LEVEL SECURITY' in sql
    assert 'REVOKE ALL ON public.face_self_test_challenges FROM PUBLIC, anon, authenticated' in sql
    assert 'attendance_records' not in sql and 'checkin_challenges' not in sql

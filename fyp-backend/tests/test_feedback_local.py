"""Real local database/storage acceptance; synthetic accounts only."""
import json
import os
from pathlib import Path
import socket
import subprocess
import threading
import time
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(os.getenv('RUN_LOCAL_FEEDBACK') != '1', reason='Opt-in local Supabase acceptance')


@pytest.fixture
def scenario():
    assert os.environ['DATABASE_URL'] == 'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/postgres'
    assert os.environ['SUPABASE_URL'] == 'http://127.0.0.1:56421'
    from main import app
    from db.database import SessionLocal
    from db.models import Student, StudentFeedback, User
    from integrations import feedback_files
    from utils.security import hash_password, create_access_token
    from domain.account_security import new_session
    from db.database import engine
    from sqlalchemy import text
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database()")) == 'FYP SYNTHETIC STORAGE QA ONLY'
    suffix = uuid.uuid4().hex[:10]
    users, tokens = [], []
    with SessionLocal() as db:
        for i, role in enumerate(['student', 'student', 'admin']):
            user = User(email=f'feedback-{suffix}-{i}@student.school.edu', role=role, password_hash=hash_password('Local-test!42'))
            db.add(user); db.flush()
            if role == 'student':
                db.add(Student(user_id=user.id, name=f'Feedback Test {suffix}', student_code=f'ST{(int(suffix,16)+i)%10000000:07d}'))
            users.append({'user_id':user.id, 'email':user.email, 'role':role})
            session = new_session(db, user, 'Synthetic feedback QA')
            tokens.append(create_access_token({'user_id':str(user.id), 'sid':str(session.id)}))
        db.commit()
    try:
        yield app, TestClient(app), [{'Authorization': f'Bearer {t}'} for t in tokens], users
    finally:
        with SessionLocal() as db:
            students = db.query(Student).filter(Student.user_id.in_([u['user_id'] for u in users])).all()
            rows = db.query(StudentFeedback).filter(StudentFeedback.student_id.in_([s.id for s in students])).all()
            for row in rows:
                if row.attachment_path: feedback_files.delete(row.attachment_path)
                db.delete(row)
            db.flush()
            for student in students: db.delete(student)
            db.flush()
            db.query(User).filter(User.id.in_([u['user_id'] for u in users])).delete(synchronize_session=False)
            db.commit()


DATA = {'subject':'Attendance inquiry', 'message':'Please investigate my attendance.', 'category':'Attendance Discrepancy', 'priority':'High'}
PDF = b'%PDF-1.4\nLocal feedback proof\n%%EOF'


def test_submission_permissions_storage_and_reply(scenario):
    from integrations.feedback_files import _config
    from db.database import SessionLocal
    from db.models import StudentFeedback
    import httpx
    _, client, headers, _ = scenario
    response = client.post('/students/me/feedback', headers=headers[0], data=DATA, files={'attachment':('proof.pdf',PDF,'application/pdf')})
    assert response.status_code == 201, response.text
    ticket = response.json(); ticket_id = ticket['id']
    assert 'priority' not in ticket and ticket['status'] == 'Pending'
    assert 'attachment_path' not in ticket
    assert client.get('/students/me/feedback',headers=headers[0]).json()[0]['id'] == ticket_id
    assert client.get('/students/me/feedback',headers=headers[1]).json() == []
    assert client.get(f'/students/me/feedback/{ticket_id}/attachment',headers=headers[1]).status_code == 404
    assert client.get('/admin/reports/feedback',headers=headers[0]).status_code == 403
    assert client.post('/students/me/feedback',headers=headers[2],data=DATA).status_code == 403
    assert client.get(f'/students/me/feedback/{ticket_id}/attachment').status_code == 401
    for url in [f'/students/me/feedback/{ticket_id}/attachment',f'/admin/reports/feedback/{ticket_id}/attachment']:
        r = client.get(url,headers=headers[2] if '/admin/' in url else headers[0])
        assert r.status_code == 200 and r.content == PDF
        assert r.headers['cache-control'] == 'no-store'
    with SessionLocal() as db: path = db.get(StudentFeedback,ticket_id).attachment_path
    url,_ = _config()
    assert httpx.get(f'{url}/storage/v1/object/public/student-feedback/{path}').status_code != 200
    assert any(t['id'] == ticket_id for t in client.get('/admin/reports/feedback',headers=headers[2]).json())
    assert client.put(f'/admin/reports/feedback/{ticket_id}',headers=headers[2],json={'status':'Invalid'}).status_code == 422
    assert client.put(f'/admin/reports/feedback/{ticket_id}',headers=headers[2],json={'status':'Resolved'}).status_code == 422
    r = client.put(f'/admin/reports/feedback/{ticket_id}',headers=headers[2],json={'status':'Resolved','priority':'High','expected_status':'Pending','admin_notes':'Private staff note','student_response':'Attendance checked.'})
    assert r.status_code == 200
    latest = client.get('/students/me/feedback',headers=headers[0])
    assert latest.headers['cache-control'] == 'no-store'
    assert latest.json()[0]['student_response'] == 'Attendance checked.'
    assert 'admin_notes' not in latest.json()[0]
    assert 'Private staff note' not in latest.text
    assert 'priority' not in latest.json()[0]
    assert latest.json()[0]['status'] == 'Resolved'


def test_validation_and_failed_upload_keep_database_clean(scenario, monkeypatch):
    from integrations import feedback_files
    _,client,headers,_ = scenario
    for data in [{**DATA,'subject':'  '},{**DATA,'message':' '},{**DATA,'category':'fake'}]:
        assert client.post('/students/me/feedback',headers=headers[0],data=data).status_code == 422
    for body,mime in [(b'fake','image/png'),(b'%PDF-'+b'x'*(5*1024*1024),'application/pdf'),(b'','application/pdf')]:
        assert client.post('/students/me/feedback',headers=headers[0],data=DATA,files={'attachment':('proof',body,mime)}).status_code == 422
    def fail(*args): raise RuntimeError('simulated outage')
    monkeypatch.setattr(feedback_files,'upload',fail)
    assert client.post('/students/me/feedback',headers=headers[0],data=DATA,files={'attachment':('proof.pdf',PDF,'application/pdf')}).status_code == 503
    assert client.get('/students/me/feedback',headers=headers[0]).json() == []
    created = client.post('/students/me/feedback',headers=headers[0],data={**DATA,'priority':'fake'})
    assert created.status_code == 201
    assert 'priority' not in created.json()


def test_browser_submission_and_admin_reply(scenario):
    import uvicorn
    app, _, _, users = scenario
    sock=socket.socket(); sock.bind(('127.0.0.1',0))
    server=uvicorn.Server(uvicorn.Config(app,log_level='error',lifespan='off'))
    thread=threading.Thread(target=server.run,kwargs={'sockets':[sock]},daemon=True); thread.start()
    root=Path(__file__).resolve().parents[2]
    vite_env={**os.environ,'VITE_API_BASE_URL':f'http://127.0.0.1:{sock.getsockname()[1]}'}
    vite=subprocess.Popen(['node',str(root/'fyp_web/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5183','--strictPort'],cwd=root/'fyp_web',env=vite_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        import httpx
        for _ in range(100):
            try:
                if server.started and httpx.get('http://127.0.0.1:5183').status_code==200: break
            except httpx.HTTPError: pass
            time.sleep(.1)
        env={**os.environ,'FEEDBACK_API':f'http://127.0.0.1:{sock.getsockname()[1]}','FEEDBACK_USERS':json.dumps(users)}
        result=subprocess.run(['node',str(Path(__file__).with_name('feedback_workflow.cjs'))],env=env,capture_output=True,text=True,encoding="utf-8",timeout=100)
        assert result.returncode == 0, result.stdout+result.stderr
        print(result.stdout)
    finally:
        vite.terminate(); vite.wait(10); server.should_exit=True; thread.join(10); sock.close()

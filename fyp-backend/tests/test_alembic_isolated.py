"""Real Alembic on empty, newly-created synthetic Supabase PostgreSQL databases."""
import json
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text, inspect

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_fyp-qa-synthetic'


@pytest.fixture
def migration_db():
    info = json.loads(subprocess.check_output(['docker', 'inspect', CONTAINER], encoding='utf-8'))[0]
    assert info['Config']['Labels']['com.supabase.cli.project'] == 'fyp-qa-synthetic'
    assert info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort'] == '56422'
    name = 'qa_migration_' + uuid4().hex[:12]
    subprocess.run(['docker', 'exec', CONTAINER, 'createdb', '-U', 'postgres', name], check=True)
    url = f'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/{name}'
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(f"COMMENT ON DATABASE {name} IS 'FYP SYNTHETIC MIGRATION REPLAY ONLY'"))
        conn.execute(text('CREATE SCHEMA extensions'))
    print('Synthetic migration database:', name)
    try:
        yield engine, url
    finally:
        engine.dispose()  # Retain synthetic database for evidence and follow-up route tests.


def migrate(url, *args):
    env = {**os.environ, 'DATABASE_URL': url, 'PYTHON_DOTENV_DISABLED': '1',
           'PYTHONIOENCODING': 'utf-8', 'OPENROUTER_API_KEY': ''}
    result = subprocess.run([sys.executable, '-m', 'alembic', *args], cwd=ROOT, env=env,
                            capture_output=True, encoding='utf-8')
    assert result.returncode == 0, result.stdout + result.stderr


def test_empty_database_upgrade_is_repeatable_and_installs_live_security(migration_db):
    engine, url = migration_db
    with engine.connect() as conn:
        assert inspect(conn).get_table_names() == []
    migrate(url, 'upgrade', 'head')
    migrate(url, 'upgrade', 'head')
    with engine.connect() as conn:
        assert conn.scalar(text('SELECT count(*) FROM users')) == 0
        tables = inspect(conn).get_table_names()
        for table in ('auth_sessions', 'auth_factors', 'academic_semesters', 'checkin_challenges', 'face_enrolment_requests'):
            assert table in tables
        assert conn.scalar(text("SELECT count(*) FROM pg_trigger WHERE tgname='sas_live_change'")) >= 13
        for table in ('student_feedback', 'auth_sessions', 'auth_factors', 'checkin_challenges'):
            assert conn.scalar(text('SELECT relrowsecurity FROM pg_class WHERE oid=CAST(:table AS regclass)'), {'table': table}) is True
            assert not conn.scalar(text("SELECT has_table_privilege('anon', :table, 'SELECT')"), {'table': table})
    # Commit-time invalidations must never expose private row data or fire on rollback.
    import psycopg
    with psycopg.connect(url.replace('postgresql+psycopg://', 'postgresql://'), autocommit=True) as listener:
        listener.execute('LISTEN sas_live_changes')
        user_id = str(uuid4())
        with engine.connect() as writer:
            writer.execute(text("INSERT INTO users(id,email,password_hash,role) VALUES (:id,'synthetic-listen@test.invalid','private-synthetic-hash','admin')"), {'id': user_id})
            assert list(listener.notifies(timeout=.1, stop_after=1)) == []
            writer.rollback()
            assert list(listener.notifies(timeout=.1, stop_after=1)) == []
            writer.execute(text("INSERT INTO users(id,email,password_hash,role) VALUES (:id,'synthetic-listen@test.invalid','private-synthetic-hash','admin')"), {'id': user_id})
            writer.commit()
            notifications = list(listener.notifies(timeout=2, stop_after=1))
            assert len(notifications) == 1
            payload = json.loads(notifications[0].payload)
            assert payload['user_id'] == user_id and payload['table'] == 'users'
            assert set(payload) <= {'table', 'student_id', 'course_id', 'user_id'}
            assert 'synthetic-listen' not in notifications[0].payload and 'hash' not in notifications[0].payload
            writer.execute(text('DELETE FROM users WHERE id=:id'), {'id': user_id})
            writer.commit()


def test_legacy_group_migration_preserves_history_and_splits_actual_groups(migration_db):
    engine, url = migration_db
    migrate(url, 'upgrade', '71c97fdeebc7')
    ids = {name: str(uuid4()) for name in ('course', 'teacher', 'assignment', 'meeting', 'student1', 'student2', 'session', 'attendance')}
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO lecturers(id,name,staff_id,role) VALUES (:teacher,'Synthetic Teacher','STAFF001','Tutor')"), ids)
        conn.execute(text("INSERT INTO courses(id,course_name,course_code,lecturer_id) VALUES (:course,'Synthetic Course','MIG101',:teacher)"), ids)
        conn.execute(text("INSERT INTO students(id,name,student_code) VALUES (:student1,'Synthetic G1','TP100001'),(:student2,'Synthetic G2','TP100002')"), ids)
        conn.execute(text("INSERT INTO enrolments(student_id,course_id,semester,class_group) VALUES (:student1,:course,'QA','G1'),(:student2,:course,'QA','G2')"), ids)
        conn.execute(text("INSERT INTO course_staff_assignments(id,course_id,lecturer_id,role) VALUES (:assignment,:course,:teacher,'Tutor')"), ids)
        conn.execute(text("INSERT INTO class_meetings(id,course_id,lecturer_id,assignment_id,meeting_key,role,day,start,\"end\",room) VALUES (:meeting,:course,:teacher,:assignment,'legacy-tutorial','Tutor','Monday','10:00','12:00','Lab 1')"), ids)
        conn.execute(text("INSERT INTO class_sessions(id,course_id,opened_at,is_open,class_group) VALUES (:session,:course,'2026-01-03 10:00',false,'G1')"), ids)
        conn.execute(text("INSERT INTO attendance_records(id,student_id,session_id,status,marked_at,timestamp,wifi_verified) VALUES (:attendance,:student1,:session,'present','2026-01-02 10:00','2026-01-03 10:15',true)"), ids)
    migrate(url, 'upgrade', 'head')
    with engine.connect() as conn:
        rows = conn.execute(text('SELECT id,class_group,day,start,"end",room,meeting_key FROM class_meetings ORDER BY class_group')).mappings().all()
        assert [row['class_group'] for row in rows] == ['G1', 'G2']
        assert str(rows[0]['id']) == ids['meeting']
        assert (rows[0]['day'], rows[0]['start'], rows[0]['end'], rows[0]['room']) == ('Monday', '10:00', '12:00', 'Lab 1')
        assert (rows[0]['day'], rows[0]['start'], rows[0]['end']) != (rows[1]['day'], rows[1]['start'], rows[1]['end'])
        assert all(row['meeting_key'] == f"Tutor-{ids['assignment']}-{row['class_group']}" for row in rows)
        assert set(conn.scalars(text('SELECT student_code FROM students'))) == {'ST0100001', 'ST0100002'}
        assert conn.scalar(text('SELECT staff_id FROM lecturers')) == 'T000001'
        attendance = conn.execute(text('SELECT status,marked_at,network_verified FROM attendance_records')).one()
        assert attendance.status == 'present' and attendance.network_verified is True
        assert str(attendance.marked_at) == '2026-01-03 10:15:00'


@pytest.mark.parametrize('start,end,resource,blocked', [
    ('20:00','22:00','teacher',True),
    ('21:00','23:00','teacher',True),
    ('19:00','23:00','teacher',True),
    ('20:30','21:30','teacher',True),
    ('18:00','20:00','teacher',False),
    ('22:00','23:00','teacher',False),
    ('21:00','23:00','room',True),
    ('21:00','23:00','course',True),
    ('21:00','23:00','unrelated',False),
])
def test_historical_allocator_rejects_overlaps_but_allows_touching_and_independent_resources(
        migration_db, start, end, resource, blocked):
    """A teacher/room/course cannot overlap; half-open intervals may touch.

    Historical seed42 proposes Monday20-22/Lab2 first. An adversarial existing
    lesson exercises that proposal without changing the original G1 allocation.
    No current ORM or scheduler is used to determine the expected overlap.
    """
    engine, url = migration_db
    migrate(url, 'upgrade', '0f375205742a')
    ids={name:str(uuid4()) for name in ('course','other_course','teacher','other_teacher','assignment','meeting','blocker','student1','student2')}
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO lecturers(id,name,staff_id,role) VALUES (:teacher,'Synthetic A','T910001','Tutor'),(:other_teacher,'Synthetic B','T910002','Lecturer')"),ids)
        conn.execute(text("INSERT INTO courses(id,course_name,course_code) VALUES (:course,'Synthetic Split','SPLIT'),(:other_course,'Synthetic Other','OTHER')"),ids)
        conn.execute(text("INSERT INTO students(id,name,student_code) VALUES (:student1,'Synthetic G1','ST0910001'),(:student2,'Synthetic G2','ST0910002')"),ids)
        conn.execute(text("INSERT INTO enrolments(student_id,course_id,semester,class_group) VALUES (:student1,:course,'QA','G1'),(:student2,:course,'QA','G2')"),ids)
        conn.execute(text("INSERT INTO course_staff_assignments(id,course_id,lecturer_id,role) VALUES (:assignment,:course,:teacher,'Tutor')"),ids)
        conn.execute(text("INSERT INTO class_meetings(id,course_id,lecturer_id,assignment_id,meeting_key,role,day,start,\"end\",room) VALUES (:meeting,:course,:teacher,:assignment,'original','Tutor','Monday','10:00','12:00','Lab 1')"),ids)
        conn.execute(text("INSERT INTO class_meetings(id,course_id,lecturer_id,meeting_key,role,day,start,\"end\",room) VALUES (:blocker,:block_course,:block_teacher,'blocker','Lecture','Monday',:start,:end,:room)"),
                     {**ids,'block_course':ids['course'] if resource=='course' else ids['other_course'],
                      'block_teacher':ids['teacher'] if resource=='teacher' else ids['other_teacher'],
                      'room':'Lab 2' if resource=='room' else 'Other Room','start':start,'end':end})
    migrate(url,'upgrade','edb760bda0ab')
    with engine.connect() as conn:
        before=conn.execute(text('SELECT id,class_group,day,start,"end",room FROM class_meetings WHERE role=\'Tutor\' ORDER BY class_group')).mappings().all()
        original,allocated=before
        assert original['class_group']=='G1' and str(original['id'])==ids['meeting']
        assert (original['day'],original['start'],original['end'],original['room'])==('Monday','10:00','12:00','Lab 1')
        assert allocated['class_group']=='G2'
        minute=lambda value:int(value.split(':')[0])*60+int(value.split(':')[1])
        overlap=allocated['day']=='Monday' and minute(allocated['start'])<minute(end) and minute(start)<minute(allocated['end'])
        if blocked:
            assert not overlap, f'Allocated {dict(allocated)} overlaps existing {start}-{end} for {resource}'
        else:
            assert (allocated['day'],allocated['start'],allocated['end'],allocated['room'])==('Monday','20:00','22:00','Lab 2')
        assert conn.scalar(text('SELECT count(*) FROM class_meetings WHERE id=:id'),{'id':ids['blocker']})==1
    migrate(url,'upgrade','edb760bda0ab')
    with engine.connect() as conn:
        after=conn.execute(text('SELECT id,class_group,day,start,"end",room FROM class_meetings WHERE role=\'Tutor\' ORDER BY class_group')).mappings().all()
        assert before==after, 'Repeating upgrade must not duplicate or reallocate historical groups'

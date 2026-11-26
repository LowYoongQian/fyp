from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
import os
from pathlib import Path
import subprocess
import sys
import time as clock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from db.database import SessionLocal
from db.models import (
    AcademicSemester, AttendanceRecord, AttendanceRequest, ClassMeeting, ClassSession, Course, CourseStaffAssignment, Enrolment,
    Lecturer, Programme, RiskScore, RiskUpdate, Student, TeachingPlan, TeachingRuleVersion, User,
)
from domain import risk_decision, risk_service, session_sync
from domain.planned_hours import next_teaching_week, planned_minutes
from domain.scheduler import calculate_schedule
from routers import admin_academic, admin_reports, analytics, lecturers, sessions
from schemas import ReplacementClassCreate
from utils.security import require_lecturer
from utils.timeutil import campus_now, local_offset


@pytest.fixture
def migration_db():
    if os.environ.get("RUN_AT_RISK_POSTGRES") != "1":
        pytest.skip("Requires the isolated migrated Phase 1 PostgreSQL database")
    with SessionLocal() as db:
        assert db.scalar(text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database()")) == 'FYP AT-RISK PHASE 1 SYNTHETIC ONLY'
        source = db.get_bind().url
    assert (source.host, source.port, source.database) == ('127.0.0.1', 55432, 'fyp_qa')
    name = f"fyp_risk_migration_{uuid4().hex[:12]}"
    control = create_engine(source, isolation_level='AUTOCOMMIT')
    with control.connect() as db:
        db.execute(text(f'CREATE DATABASE {name}'))
    control.dispose()
    url = source.set(database=name)
    test_engine = create_engine(url)
    with test_engine.begin() as db:
        db.execute(text('CREATE SCHEMA IF NOT EXISTS extensions'))
        db.execute(text(f"COMMENT ON DATABASE {name} IS 'FYP AT-RISK PHASE 1 SYNTHETIC MIGRATION'"))

    def migrate(*args):
        result = subprocess.run([sys.executable, '-m', 'alembic', *args],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True,
                                env={**os.environ, 'DATABASE_URL': url.render_as_string(hide_password=False)})
        assert result.returncode == 0, result.stdout + result.stderr

    try:
        yield test_engine, migrate
    finally:
        test_engine.dispose()


def test_fresh_migration_installs_restricted_plan_and_queue(migration_db):
    engine, migrate = migration_db
    migrate('upgrade', 'head')
    migrate('upgrade', 'head')
    with engine.connect() as db:
        assert db.scalar(text('SELECT version_num FROM alembic_version')) == 'e65f4d09a321'
        for table in ('teaching_rule_versions', 'teaching_plans', 'risk_updates', 'risk_score_history'):
            assert db.scalar(text('SELECT relrowsecurity FROM pg_class WHERE relname=:table'), {'table': table})
            assert not db.scalar(text("SELECT has_table_privilege('anon', :table, 'SELECT')"), {'table': table})


def test_first_lecture_on_semester_start_establishes_plan(migration_db):
    engine, migrate = migration_db
    migrate('upgrade', 'head')
    with SessionLocal(bind=engine) as db:
        today = campus_now().date()
        programme = Programme(name='Day one', code='DAY1')
        db.add(programme)
        db.flush()
        term = AcademicSemester(programme_id=programme.id, name='New term', start_date=today,
                                end_date=today + timedelta(days=13))
        db.add(term)
        db.flush()
        course = Course(course_name='First timetable', course_code='DAY101', programme_id=programme.id, semester_id=term.id)
        db.add(course)
        db.flush()
        meeting = ClassMeeting(course_id=course.id, meeting_key=str(uuid4()), role='Lecture',
                               day=today.strftime('%A'), start='15:00', end='16:00', room='QA')
        db.add(meeting)
        db.flush()
        db.refresh(course)  # semester binding is assigned by the database trigger
        obligations, issue = risk_service.get_plan(db, course, publish=False)
        assert issue is None
        assert planned_minutes(obligations, 'G1') == 120
        db.commit()
        meeting.room = 'Next room'
        db.commit()
        def lecture_room(day):
            return next(iter(calculate_schedule(db, course_id=course.id, on_date=day).values()))['room']
        assert lecture_room(today) == 'QA'
        assert lecture_room(next_teaching_week(today)) == 'Next room'
        assert risk_service.get_plan(db, course, publish=False) == (obligations, None)
        # Once the term is underway, new slots have only a pending version.
        term.start_date = today - timedelta(days=1)
        db.flush()
        new_slot = ClassMeeting(course_id=course.id, meeting_key=str(uuid4()), role='Tutor', class_group='G1',
                                day='Thursday', start='11:00', end='12:00', room='Temporary room')
        db.add(new_slot)
        db.flush()
        new_slot.room = 'Confirmed room'
        db.flush()
        pending = db.query(TeachingRuleVersion).filter_by(meeting_id=new_slot.id).one()
        assert pending.effective_date == next_teaching_week(today)
        assert pending.slot['room'] == new_slot.room


def test_upgrade_preserves_duplicate_score_history_and_does_not_bless_legacy_plan(migration_db):
    engine, migrate = migration_db
    migrate('upgrade', 'd7a2c5e9f1b3')
    ids = {key: str(uuid4()) for key in ('programme', 'semester', 'course', 'student', 'teacher', 'meeting', 'lesson', 'mc', 'old', 'new')}
    tables = ('programmes', 'academic_semesters', 'courses', 'students', 'lecturers', 'enrolments',
              'class_meetings', 'class_sessions', 'attendance_records', 'attendance_requests')
    with engine.begin() as db:
        db.execute(text("INSERT INTO programmes(id, name, code) VALUES (:programme, 'Synthetic', 'UPG')"), ids)
        db.execute(text("INSERT INTO academic_semesters(id, programme_id, name, start_date, end_date) "
                        "VALUES (:semester, :programme, 'Legacy', current_date - 20, current_date + 20)"), ids)
        db.execute(text("INSERT INTO courses(id, course_name, course_code, programme_id, semester_id, planned_total_hours) "
                        "VALUES (:course, 'Synthetic', 'UPG101', :programme, :semester, 40)"), ids)
        db.execute(text("INSERT INTO students(id, name, student_code) VALUES (:student, 'Synthetic', 'ST1234001')"), ids)
        db.execute(text("INSERT INTO class_meetings(id, course_id, meeting_key, role, day, start, \"end\", room) "
                        "VALUES (:meeting, :course, 'legacy', 'Lecture', 'Monday', '09:00', '11:00', 'QA')"), ids)
        db.execute(text("INSERT INTO risk_scores(id, student_id, course_id, risk_score, updated_at) VALUES "
                        "(:old, :student, :course, .8, now() - interval '1 day'), (:new, :student, :course, .2, now())"), ids)
        db.execute(text("INSERT INTO lecturers(id,name,staff_id) VALUES (:teacher,'QA Staff','T123401')"), ids)
        db.execute(text("UPDATE class_meetings SET lecturer_id=:teacher WHERE id=:meeting"), ids)
        db.execute(text("INSERT INTO enrolments(student_id,course_id,semester,class_group) VALUES (:student,:course,'Legacy','G1')"), ids)
        db.execute(text("INSERT INTO class_sessions(id,meeting_id,course_id,class_group,status,is_open) "
                        "VALUES (:lesson,:meeting,:course,'All','completed',false)"), ids)
        db.execute(text("INSERT INTO attendance_records(student_id,session_id,status) VALUES (:student,:lesson,'leave')"), ids)
        db.execute(text("INSERT INTO attendance_requests(id,student_id,course_id,session_id,request_type,reason,status,proof_path) "
                        "VALUES (:mc,:student,:course,:lesson,'leave','Synthetic MC','approved','synthetic/proof.pdf')"), ids)
        before = {table: db.execute(text(f'SELECT * FROM {table}')).mappings().one() for table in tables}
    migrate('upgrade', 'head')
    with SessionLocal(bind=engine) as db:
        assert str(db.scalar(text('SELECT id FROM risk_scores'))) == ids['new']
        assert str(db.scalar(text('SELECT id FROM risk_score_history'))) == ids['old']
        assert db.query(RiskScore).one().assessment_source is None
        for table, old in before.items():
            current = db.execute(text(f'SELECT * FROM {table}')).mappings().one()
            assert {key: current[key] for key in old} == dict(old), table
        _, issue = risk_service.get_plan(db, db.get(Course, ids['course']), publish=False)
        assert 'historical coverage' in issue
        # Importers may include semester_id when saving unrelated course fields.
        db.execute(text("UPDATE courses SET plan_recorded_from = current_date - 10 WHERE id=:course"), ids)
        db.execute(text("UPDATE courses SET semester_id=semester_id WHERE id=:course"), ids)
        assert db.scalar(text("SELECT plan_recorded_from = current_date - 10 FROM courses WHERE id=:course"), ids)
    migrate('downgrade', 'd7a2c5e9f1b3')
    with engine.connect() as db:
        assert db.scalar(text('SELECT count(*) FROM risk_scores')) == 2


def test_exact_decision_order_and_real_random_forest(monkeypatch):
    import joblib

    assert type(risk_decision._MODEL).__name__ == "RandomForestClassifier"
    assert risk_decision.assess([0, 1], [60, 60], 300)["assessment_source"] == "ML Prediction"
    assert risk_decision.assess([0], [21], 100)["assessment_source"] == "Guaranteed High"
    assert risk_decision.assess([0], [20], 100)["assessment_source"] == "Observing"
    assert risk_decision.assess([1, 0, 0, 0], [80, 2, 2, 2], 100)["assessment_source"] == "Guaranteed Low"
    assert risk_decision.assess([1, 0], [7999, 2001], 10000)["assessment_source"] == "Guaranteed High"
    assert risk_decision.assess([], [], 100)["assessment_source"] == "No Attendance Data"
    assert risk_decision.assess([1], [101], 100)["assessment_source"] == "Plan Incomplete"
    def broken_model(*args):
        raise FileNotFoundError
    monkeypatch.setattr(joblib, "load", broken_model)
    monkeypatch.setattr(risk_decision, "_MODEL", risk_decision._load_model())
    assert risk_decision.assess([0, 1], [60, 60], 300)["assessment_source"] == "Model Unavailable"
    assert risk_decision.assess([0], [21], 100)["risk_label"] == "high"


@pytest.fixture
def offering(monkeypatch):
    if os.environ.get("RUN_AT_RISK_POSTGRES") != "1":
        pytest.skip("Requires the isolated migrated Phase 1 PostgreSQL database")
    with SessionLocal() as db:
        assert db.scalar(text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database()")) == 'FYP AT-RISK PHASE 1 SYNTHETIC ONLY'
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == 'e65f4d09a321'
        marker = uuid4().hex[:7]
        programme = Programme(name=f"Synthetic {marker}", code=marker)
        db.add(programme)
        db.flush()
        today = campus_now().date()
        monday = today - timedelta(days=today.weekday())
        term = AcademicSemester(programme_id=programme.id, name="Synthetic term",
                                start_date=monday, end_date=monday + timedelta(days=27))
        db.add(term)
        db.flush()
        admin = User(email=f"admin-{marker}@test.invalid", password_hash="unused", role="admin")
        db.add(admin)
        staff = []
        students = []
        for index in range(3):
            account = User(email=f"teacher-{index}-{marker}@test.invalid", password_hash="unused", role="lecturer")
            db.add(account)
            db.flush()
            teacher = Lecturer(user_id=account.id, name=f"Teacher {index}", staff_id=f'T{uuid4().int % 1000000:06d}')
            db.add(teacher)
            staff.append((account, teacher))
        for index in range(2):
            account = User(email=f"student-{index}-{marker}@test.invalid", password_hash="unused", role="student",
                           recovery_email=f"recovery-{index}-{marker}@test.invalid", recovery_email_verified=True)
            db.add(account)
            db.flush()
            student = Student(user_id=account.id, name=f"Student {index}", student_code=f'ST{uuid4().int % 10000000:07d}')
            db.add(student)
            students.append(student)
        db.flush()
        course = Course(course_code=marker.upper(), course_name="Synthetic course", programme_id=programme.id,
                        lecturer_id=staff[0][1].id)
        db.add(course)
        db.flush()
        for (_, teacher), role in zip(staff[1:], ('Tutor', 'Practical')):
            db.add(CourseStaffAssignment(course_id=course.id, lecturer_id=teacher.id, role=role))
        meetings = []
        for index, (day, role, group, end) in enumerate([
            ("Monday", "Lecture", None, "11:00"), ("Tuesday", "Tutor", "G1", "10:00"),
            ("Wednesday", "Practical", "G2", "10:30"),
        ]):
            meeting = ClassMeeting(course_id=course.id, meeting_key=f"{marker}-{index}", day=day, start="09:00",
                                   end=end, room=f"QA {marker}", lecturer_id=staff[index][1].id, role=role, class_group=group)
            db.add(meeting)
            meetings.append(meeting)
        db.flush()
        course.semester_id = term.id
        db.flush()
        # The fixture supplies verified starting rules for a historical clock; normal writes below use the real triggers.
        db.query(TeachingRuleVersion).filter_by(course_id=course.id).update({"effective_date": monday})
        db.execute(text("UPDATE courses SET plan_recorded_from = :day WHERE id = :id"), {"day": monday, "id": course.id})
        for idx, student in enumerate(students):
            db.add(Enrolment(course_id=course.id, student_id=student.id, class_group=f"G{idx + 1}"))
        db.commit()
        data = dict(course=course.id, students=[s.id for s in students], teachers=[a.id for a, _ in staff],
                    meetings=[m.id for m in meetings], monday=monday, admin=admin.id)
    monkeypatch.setattr(admin_academic, "sync_class_sessions", lambda **_: None)
    monkeypatch.setattr(sessions, "_notify_course_people", lambda *args: None)
    monkeypatch.setattr(sessions, "_audit_class_action", lambda *args: None)
    risk_service.process_risk_updates(limit=100)
    return data


def add_lesson(db, data, *, meeting=0, day_offset=0, status="open", group="All", minutes=120):
    start = datetime.combine(data["monday"] + timedelta(days=day_offset), time(9)) - local_offset()
    lesson = ClassSession(meeting_id=data["meetings"][meeting], course_id=data["course"], class_group=group,
                          status=status, is_open=status == "open", opened_at=start if status == "open" else None,
                          scheduled_start=start, scheduled_end=start + timedelta(minutes=minutes))
    db.add(lesson)
    db.flush()
    return lesson


def snapshots(db, data):
    return {row.student_id: row for row in db.query(RiskScore).filter_by(course_id=data["course"]).populate_existing()}


def test_semester_close_without_event_and_admin_exception(offering, monkeypatch):
    from domain.account_security import new_session
    from utils.security import create_access_token

    end = offering['monday'] + timedelta(days=34)
    student, second = offering['students']
    with SessionLocal.begin() as db:
        db.get(Course, offering['course']).semester.end_date = end
        for week in range(5):
            lecture = add_lesson(db, offering, day_offset=7*week, status='completed')
            tutorial = add_lesson(db, offering, day_offset=7*week+1, meeting=1, group='G1',
                                  minutes=60, status='completed')
            if week < 4:
                for lesson in (lecture, tutorial):
                    db.add(AttendanceRecord(student_id=student, session_id=lesson.id, status='present'))
        cancelled = add_lesson(db, offering, day_offset=2, meeting=2, group='G2', minutes=90, status='cancelled')
        root_id = cancelled.id
        attention = add_lesson(db, offering, day_offset=9, meeting=2, group='G2', minutes=90, status='needs_attention')
        attention_id = attention.id
        admin = db.get(User, offering['admin'])
        token = create_access_token({'user_id': admin.id, 'sid': new_session(db, admin, 'Synthetic QA').id})
        teacher = db.get(User, offering['teachers'][0])
        teacher_token = create_access_token({'user_id': teacher.id, 'sid': new_session(db, teacher, 'Synthetic QA').id})
        start = datetime.combine(end + timedelta(days=1), time(10)) - local_offset()
        with pytest.raises(HTTPException) as refused:
            sessions.arrange_replacement_class(root_id, ReplacementClassCreate(
                scheduled_start=start, scheduled_end=start+timedelta(minutes=90), room='QA'), db, admin)
        assert refused.value.status_code == 400

    risk_service.process_risk_updates()
    monkeypatch.setattr(risk_service, 'campus_now', lambda: datetime.combine(end, time.max))
    risk_service.process_risk_updates()
    with SessionLocal() as db:
        assert db.query(RiskUpdate).filter_by(course_id=offering['course']).count() == 0
        assert snapshots(db, offering)[student].assessment_source == 'Guaranteed Low'
    after_midnight = datetime.combine(end+timedelta(days=1), time.min)
    monkeypatch.setattr(risk_service, 'campus_now', lambda: after_midnight)
    monkeypatch.setattr(analytics, 'campus_now', lambda: after_midnight)
    risk_service.process_risk_updates()
    with SessionLocal() as db:
        rows = snapshots(db, offering)
        assert (rows[student].assessment_source, rows[student].attendance_rate) == ('Final Attendance Met', .8)
        assert (rows[second].assessment_source, rows[second].risk_score, rows[second].risk_label) == (
            'Pending Teaching Completion', None, None)
        assert db.query(AttendanceRecord).filter_by(student_id=second).count() == 0
        timestamp = rows[second].updated_at
    app = FastAPI()
    app.include_router(analytics.router)
    with TestClient(app) as client:
        assert client.get('/analytics/pending-teaching', headers={'Authorization': 'Bearer ' + teacher_token}).status_code == 403
        response = client.get('/analytics/pending-teaching', headers={'Authorization': 'Bearer ' + token})
        assert response.status_code == 200
        row, = [r for r in response.json() if r['course_id'] == offering['course']]
        assert row['class_group'] == 'G2'
        assert (row['outstanding_minutes'], row['planned_minutes']) == (450, 1050)
        for reason in ('cancelled: 90', 'needs attention: 90', 'not generated: 270'):
            assert reason in row['reason']
    risk_service.process_risk_updates()
    with SessionLocal.begin() as db:
        assert snapshots(db, offering)[second].updated_at == timestamp
        root = db.get(ClassSession, root_id)
        start = root.scheduled_start + timedelta(days=1)
        db.add(ClassSession(course_id=root.course_id, replacement_for_session_id=root.id, class_group='G2',
                            status='completed', is_open=False, scheduled_start=start, scheduled_end=start+timedelta(minutes=90)))
        db.get(ClassSession, attention_id).status = 'completed'
        for week in range(2, 5):
            add_lesson(db, offering, day_offset=7*week+2, meeting=2, group='G2', minutes=90, status='completed')
    risk_service.process_risk_updates()
    with SessionLocal() as db:
        row = snapshots(db, offering)[second]
        assert (row.assessment_source, row.attendance_rate, row.risk_label) == ('Final Attendance Below Minimum', 0, 'high')
        assert not [r for r in analytics.pending_teaching(db, db.get(User, offering['admin']))
                    if r['course_id'] == offering['course']]


def test_semester_close_reports_obligations_without_enrolments(offering, monkeypatch):
    with SessionLocal.begin() as db:
        db.query(Enrolment).filter_by(course_id=offering['course']).delete()
    risk_service.process_risk_updates()
    after = datetime.combine(offering['monday'] + timedelta(days=28), time.min)
    monkeypatch.setattr(risk_service, 'campus_now', lambda: after)
    monkeypatch.setattr(analytics, 'campus_now', lambda: after)
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        rows = analytics.pending_teaching(db, db.get(User, offering['admin']))
        assert {(r['class_group'], r['outstanding_minutes']) for r in rows
                if r['course_id'] == offering['course']} == {('G1', 720), ('G2', 840)}


def test_pending_teaching_preserves_held_rate_and_suppresses_forecasts():
    for present, held in (([], []), ([1], [80]), ([0], [30]), ([1, 0], [40, 10])):
        row = risk_decision.assess(present, held, 100, semester_ended=True)
        assert row['assessment_source'] == 'Pending Teaching Completion'
        assert row['risk_label'] is row['risk_score'] is None
        assert row['attendance_rate'] == (sum(p*m for p, m in zip(present, held))/sum(held) if held else None)
    assert risk_decision.assess([1, 0], [79, 21], 100, semester_ended=True)['assessment_source'] == 'Final Attendance Below Minimum'
    assert risk_decision.assess([], [], None, semester_ended=True)['assessment_source'] == 'Plan Incomplete'


def test_commit_time_close_correction_mc_and_no_stale_snapshot(offering, monkeypatch):
    with SessionLocal() as db:
        assert {row.assessment_source for row in snapshots(db, offering).values()} == {"No Attendance Data"}
        lesson = add_lesson(db, offering)
        lesson_id, end = lesson.id, lesson.scheduled_end
        db.commit()
        assert not db.query(RiskUpdate).filter_by(course_id=offering['course']).count()
        monkeypatch.setattr(session_sync, "utcnow", lambda: end + timedelta(minutes=1))
        session_sync._sync_class_sessions_now(db)
        assert db.get(ClassSession, lesson_id).status == 'completed'
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        initial = snapshots(db, offering)
        assert {row.attendance_rate for row in initial.values()} == {0.0}
        first, second = offering['students']
        unchanged = initial[second].updated_at
        admin = db.get(User, offering['admin'])
        sessions.update_lecturer_attendance(lesson_id, first, sessions.LecturerAttendanceUpdate(status='present'), db, admin)
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        assert snapshots(db, offering)[first].attendance_rate == 1.0
        assert snapshots(db, offering)[second].updated_at == unchanged
        record = db.query(AttendanceRecord).filter_by(student_id=first, session_id=lesson_id).one()
        record.status = 'absent'
        db.flush()
        db.rollback()
        assert not db.query(RiskUpdate).filter_by(course_id=offering['course']).count()
        request = AttendanceRequest(student_id=second, course_id=offering['course'], request_type='leave',
                                    start_date=offering['monday'], end_date=offering['monday'],
                                    reason='Synthetic leave', proof_path='synthetic/unused.pdf')
        db.add(request)
        db.flush()
        admin_reports.update_mc_status(request.id, admin_reports.MCReportUpdate(status='Approved', source='request'),
                                       db, db.get(User, offering['admin']))
        record.mc_proof_url = 'synthetic/unused.pdf'
        db.commit()
        admin_reports.update_mc_status(record.id, admin_reports.MCReportUpdate(status='Approved', source='attendance'),
                                       db, db.get(User, offering['admin']))
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        record = db.query(AttendanceRecord).filter_by(student_id=first, session_id=lesson_id).one()
        assert record.status == 'mc_approved'
        assert db.query(AttendanceRecord).filter_by(student_id=second, session_id=lesson_id).one().status == 'leave'
        assert {row.attendance_rate for row in snapshots(db, offering).values()} == {1.0}
        with pytest.raises(HTTPException, match='approved medical leave'):
            sessions.update_lecturer_attendance(lesson_id, first, sessions.LecturerAttendanceUpdate(status='present'),
                                                  db, db.get(User, offering['admin']))
        db.query(AttendanceRecord).filter_by(session_id=lesson_id).delete()
        db.flush()
        db.delete(db.get(ClassSession, lesson_id))
        db.commit()
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        assert {(row.attendance_rate, row.assessment_source) for row in snapshots(db, offering).values()} == {(None, "No Attendance Data")}


def test_pending_revision_and_room_only_preserve_plan_history(offering, monkeypatch):
    today = campus_now().date()
    next_monday = next_teaching_week(today)
    with SessionLocal() as db:
        course = db.get(Course, offering['course'])
        original, issue = risk_service.get_plan(db, course, publish=False)
        assert issue is None
        assert [planned_minutes(original, group) for group in ('G1', 'G2')] == [720, 840]
        meeting = db.get(ClassMeeting, offering['meetings'][1])
        if meeting.day == today.strftime('%A'):
            monkeypatch.setattr(admin_academic, 'campus_now', lambda: datetime.combine(today, time(6)))
        admin_academic.update_timetable_slot(meeting.id, admin_academic.TimetableSlotUpdate(
            day='Thursday', start='09:00', end='11:00', room=meeting.room,
        ), db, db.get(User, offering['admin']))
        assert [slot['day'] for slot in calculate_schedule(db, course_id=course.id, on_date=today).values() if slot['class_group'] == 'G1'] == ['Tuesday']
        assert [slot['day'] for slot in calculate_schedule(db, course_id=course.id, on_date=next_monday).values() if slot['class_group'] == 'G1'] == ['Thursday']
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        course = db.get(Course, offering['course'])
        revised, issue = risk_service.get_plan(db, course, publish=False)
        assert issue is None
        assert [row for row in original if row.day < next_monday] == [row for row in revised if row.day < next_monday]
        assert planned_minutes(revised, 'G1') == 900
        next_monday_noon = datetime.combine(next_monday, time(12)) - local_offset()
        monkeypatch.setattr(session_sync, 'utcnow', lambda: next_monday_noon)
        session_sync._sync_class_sessions_now(db)
        old_tuesday = datetime.combine(offering['monday'] + timedelta(days=1), time(9)) - local_offset()
        recovered = db.query(ClassSession).filter_by(meeting_id=offering['meetings'][1], scheduled_start=old_tuesday).one()
        assert recovered.status == 'needs_attention'
        assert recovered.scheduled_end - recovered.scheduled_start == timedelta(hours=1)
        number_before = db.query(TeachingPlan).filter_by(course_id=course.id).count()
        meeting = db.get(ClassMeeting, offering['meetings'][1])
        meeting.room = 'Synthetic new room'
        db.commit()
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        assert db.query(TeachingPlan).filter_by(course_id=offering['course']).count() == number_before


def test_new_tutor_scope_starts_with_first_effective_slot(offering, monkeypatch):
    from domain import risk_access

    with SessionLocal.begin() as db:
        user = User(email=f'future-{uuid4()}@test.invalid', password_hash='unused', role='lecturer')
        db.add(user)
        db.flush()
        tutor = Lecturer(user_id=user.id, name='Future tutor', staff_id=f'T{uuid4().int % 1000000:06d}')
        db.add(tutor)
        db.flush()
        meeting = ClassMeeting(course_id=offering['course'], meeting_key=str(uuid4()), day='Friday',
                               start='13:00', end='14:00', room='QA', lecturer_id=tutor.id, role='Tutor', class_group='G1')
        db.add(meeting)
        db.flush()
        assert not risk_access.scoped_enrolments(db, user).all()
        assert not risk_access.risk_course_ids(db, tutor.id)
        monday = next_teaching_week(campus_now().date())
        monkeypatch.setattr(risk_access, 'campus_now', lambda: datetime.combine(monday, time.min))
        assert [e.student_id for e in risk_access.scoped_enrolments(db, user)] == offering['students'][:1]


def test_unassigning_tutor_preserves_current_week_obligation(offering, monkeypatch):
    from domain.risk_access import scoped_enrolments
    from routers import students

    with SessionLocal.begin() as db:
        course = db.get(Course, offering['course'])
        tutor = db.get(User, offering['teachers'][1])
        assignment = db.query(CourseStaffAssignment).filter_by(course_id=course.id, role='Tutor').one()
        meeting = db.get(ClassMeeting, offering['meetings'][1])
        meeting.assignment_id = assignment.id
        db.flush()
        admin_academic._remove_role(db, db.get(User, offering['admin']), assignment)
        db.flush()
        assert scoped_enrolments(db, tutor).count() == 0
        today = campus_now().date()
        def groups(day):
            return {s['class_group'] for s in calculate_schedule(db, course_id=course.id, on_date=day).values()}
        assert 'G1' in groups(today)
        assert 'G1' not in groups(next_teaching_week(today))
        monkeypatch.setattr(students, 'sync_class_sessions', lambda: None)
        student = db.get(Student, offering['students'][0])
        user = db.get(User, student.user_id)
        schedule = students.get_my_courses(None, db, user, today)
        assert any(row['meeting_id'] == meeting.id and row['lecturer_name'] == 'TBA' for row in schedule)
        future = students.get_my_courses(None, db, user, next_teaching_week(today))
        assert all(row['meeting_id'] != meeting.id for row in future)


def test_retiring_timetable_slot_keeps_this_week_and_dated_session(offering):
    today = campus_now().date()
    with SessionLocal() as db:
        lesson = add_lesson(db, offering, status='cancelled')
        course_id, original_id = lesson.course_id, lesson.id
        meeting_id = lesson.meeting_id
        db.commit()
        admin_academic.delete_timetable_slot(meeting_id, db, db.get(User, offering['admin']))
        assert db.get(ClassSession, original_id).meeting_id == meeting_id
        assert any(slot['meeting_id'] == meeting_id for slot in calculate_schedule(db, course_id=course_id, on_date=today).values())
        assert all(slot['meeting_id'] != meeting_id for slot in calculate_schedule(db, course_id=course_id,
                   on_date=next_teaching_week(today)).values())
        obligations, issue = risk_service.get_plan(db, db.get(Course, course_id), publish=False)
        assert issue is None
        assert [row.day for row in obligations if row.meeting_id == meeting_id] == [offering['monday']]


def test_worker_recovers_after_failure_and_marks_anomalous_lineage(offering, monkeypatch):
    with SessionLocal() as db:
        original = add_lesson(db, offering, status='cancelled')
        start = original.scheduled_start + timedelta(days=3)
        db.add(ClassSession(course_id=offering['course'], class_group='All', is_open=False, status='scheduled',
                            scheduled_start=start, scheduled_end=start + timedelta(hours=1),
                            replacement_for_session_id=original.id))
        db.commit()
    with monkeypatch.context() as temporary:
        def failed_assessment(*args, **kwargs):
            raise RuntimeError('Synthetic transient failure')
        temporary.setattr(risk_service, 'recompute_course', failed_assessment)
        risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        assert db.query(RiskUpdate).filter_by(course_id=offering['course']).count() >= 1
        assert {row.assessment_source for row in snapshots(db, offering).values()} == {'No Attendance Data'}
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        assert db.query(RiskUpdate).filter_by(course_id=offering['course']).count() == 0
        assert {(row.risk_label, row.assessment_source) for row in snapshots(db, offering).values()} == {(None, 'Plan Incomplete')}


def test_failed_course_does_not_starve_later_course(offering, monkeypatch):
    failed_course = str(uuid4())
    with SessionLocal.begin() as db:
        db.add(RiskUpdate(course_id=failed_course))
        db.flush()
        add_lesson(db, offering, status='completed')

    real_recompute = risk_service.recompute_course

    def fail_one(db, course_id, **kwargs):
        if str(course_id) == failed_course:
            raise RuntimeError('Synthetic course failure')
        return real_recompute(db, course_id, **kwargs)

    monkeypatch.setattr(risk_service, 'recompute_course', fail_one)
    try:
        risk_service.process_risk_updates(limit=1)
        with SessionLocal() as db:
            assert {row.attendance_rate for row in snapshots(db, offering).values()} == {0.0}
            assert db.query(RiskUpdate).filter_by(course_id=failed_course).count() == 1
    finally:
        with SessionLocal.begin() as db:
            db.query(RiskUpdate).filter_by(course_id=failed_course).delete()


def test_lifespan_consumes_committed_risk_event_without_recompute_route(offering):
    from main import app

    with SessionLocal() as db:
        add_lesson(db, offering, status='completed')
        db.commit()
    with TestClient(app) as client:
        assert client.get('/health').status_code == 200
        deadline = clock.monotonic() + 8
        while clock.monotonic() < deadline:
            with SessionLocal() as db:
                if {row.attendance_rate for row in snapshots(db, offering).values()} == {0.0}:
                    break
            clock.sleep(.1)
        else:
            pytest.fail('The application did not consume the committed risk event on startup')


def test_parallel_workers_apply_latest_committed_correction(offering):
    with SessionLocal.begin() as db:
        lesson = add_lesson(db, offering, status='completed')
        record = AttendanceRecord(student_id=offering['students'][0], session_id=lesson.id, status='absent')
        db.add(record)
        db.flush()
        record_id = record.id
    with SessionLocal.begin() as db:
        db.get(AttendanceRecord, record_id).status = 'present'
        db.add(RiskUpdate(course_id=offering['course']))
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(risk_service.process_risk_updates, [20, 20]))
    with SessionLocal() as db:
        scores = snapshots(db, offering)
        assert scores[offering['students'][0]].attendance_rate == 1
        assert scores[offering['students'][1]].attendance_rate == 0
        assert db.query(RiskUpdate).filter_by(course_id=offering['course']).count() == 0


def test_replacement_lineage_and_concurrent_recompute(offering):
    with SessionLocal() as db:
        lesson = add_lesson(db, offering, status='cancelled')
        original_id = lesson.id
        db.commit()
        course = db.get(Course, offering['course'])
        baseline, _ = risk_service.get_plan(db, course, publish=False)
        start = lesson.scheduled_start + timedelta(days=4)
        def request(duration):
            return ReplacementClassCreate(scheduled_start=start, scheduled_end=start + timedelta(minutes=duration), room='QA makeup')
        with pytest.raises(HTTPException, match='match the original'):
            sessions.arrange_replacement_class(original_id, request(60), db, db.get(User, offering['admin']))
        child = sessions.arrange_replacement_class(original_id, request(120), db, db.get(User, offering['admin']))
        assert risk_service.get_plan(db, course, publish=False) == (baseline, None)
        child.status = 'cancelled'
        child_id = child.id
        db.commit()

    def arrange(parent):
        with SessionLocal() as db:
            try:
                return sessions.arrange_replacement_class(parent, request(120), db, db.get(User, offering['admin'])).id
            except HTTPException as exc:
                assert exc.status_code == 400
                return None
    with ThreadPoolExecutor(max_workers=2) as pool:
        attempts = list(pool.map(arrange, [original_id, child_id]))
    assert sum(value is not None for value in attempts) == 1
    with SessionLocal() as db:
        active = db.get(ClassSession, next(value for value in attempts if value))
        active.status = 'completed'
        db.commit()
        with pytest.raises(HTTPException, match='already been arranged'):
            sessions.arrange_replacement_class(original_id, request(120), db, db.get(User, offering['admin']))
        plan, issue = risk_service.get_plan(db, db.get(Course, offering['course']), publish=False)
        assert issue is None and planned_minutes(plan, 'G1') == 720

    def recompute(_):
        with SessionLocal() as db:
            return analytics.recompute_risk_scores(db, db.get(User, offering['teachers'][0]))['recomputed']
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(recompute, [None, None])) == [2, 2]
    with SessionLocal() as db:
        assert db.query(RiskScore).filter_by(course_id=offering['course']).count() == 2


def test_warning_rejects_preview_when_only_rf_probability_changes(offering, monkeypatch):
    sent = []
    monkeypatch.setattr(lecturers.resend_mail, 'configured', lambda: True)
    monkeypatch.setattr(lecturers.resend_mail, 'send', lambda *args: sent.append(args) or 'qa-id')
    with SessionLocal() as db:
        course = db.get(Course, offering['course'])
        course.semester.end_date = offering['monday'] + timedelta(weeks=16, days=-1)
        records = []
        student_id = offering['students'][0]
        for week in range(8):
            lesson = add_lesson(db, offering, day_offset=7 * week, status='completed')
            record = AttendanceRecord(student_id=student_id, session_id=lesson.id,
                                      status='absent' if week < 2 else 'present')
            db.add(record)
            records.append(record)
        db.commit()
        teacher = db.get(User, offering['teachers'][0])
        body = lecturers.AlertCreate(course_id=course.id, student_id=student_id, alert_id=str(uuid4()))
        before = lecturers.warning_preview(body, db, teacher)
        records[1].status, records[2].status = 'present', 'absent'
        db.commit()
        after = lecturers.warning_preview(body, db, teacher)
        assert before['risk_score'] != after['risk_score']
        assert before['risk_label'] == after['risk_label']   # label unchanged; only the Risk Score moved
        body.assessment_token = before['assessment_token']
        with pytest.raises(HTTPException) as stale:
            lecturers.trigger_manual_alert(body, db, teacher)
        assert stale.value.status_code == 409
        assert not sent


def test_lecturer_api_scopes_and_warning_preview(offering, monkeypatch):
    first, second = offering['students']
    cursor = offering['teachers'][1]
    sent = []
    monkeypatch.setattr(lecturers.resend_mail, 'configured', lambda: True)
    monkeypatch.setattr(lecturers.resend_mail, 'send', lambda *args: sent.append(args) or 'synthetic-id')
    with SessionLocal() as db:
        lecture_id = None
        for day in range(0, 28, 7):
            lecture = add_lesson(db, offering, day_offset=day, status='completed')
            lecture_id = lecture.id
            tutorial = add_lesson(db, offering, meeting=1, day_offset=day + 1, status='completed', group='G1', minutes=60)
            for lesson in (lecture, tutorial):
                db.add(AttendanceRecord(student_id=first, session_id=lesson.id, status='present'))
        db.commit()
    risk_service.process_risk_updates(limit=100)
    from domain.risk_access import teaching_group_filter
    from routers.llm import _answer_from_database
    with SessionLocal() as db:
        group_one_teacher = db.query(Lecturer).filter_by(user_id=cursor).one()
        course = db.get(Course, offering['course'])
        scope = teaching_group_filter(db, group_one_teacher.id)
        _, visible_risks = _answer_from_database(db, {'intent': 'risk_list'}, [course],
                                                 enrolment_scope=scope, formal_risk=True)
        _, visible_student = _answer_from_database(db, {'intent': 'student_risk', 'student_id': second}, [course],
                                                   enrolment_scope=scope)
        assert visible_risks == 0 and visible_student == 0
    app = FastAPI()
    app.include_router(analytics.router)
    app.include_router(lecturers.router)
    app.include_router(sessions.router)

    def current_user():
        with SessionLocal() as db:
            return db.get(User, cursor)
    app.dependency_overrides[require_lecturer] = current_user
    with TestClient(app) as client:
        path = '/analytics/risk-scores'
        course = offering['course']
        assert [row['student_id'] for row in client.get(path, params={'course_id': course}).json()] == [first]
        assert client.get(path, params={'course_id': course, 'student_id': second}).json() == []
        assert client.post('/analytics/recompute').json() == {'recomputed': 1}
        assert client.post('/lecturers/me/alerts', json={'course_id': course, 'student_id': second}).status_code == 403
        assert client.post('/lecturers/me/alerts/preview', json={'course_id': course, 'student_id': second}).status_code == 403
        roster = client.get(f'/sessions/{lecture_id}/attendance').json()['attendance_list']
        assert [row['student_id'] for row in roster] == [first]
        assert client.put(f'/sessions/attendance/{lecture_id}/{second}', json={'status': 'present'}).status_code == 403
        payload = {'course_id': course, 'student_id': first, 'alert_id': str(uuid4())}
        preview = client.post('/lecturers/me/alerts/preview', json=payload)
        assert preview.status_code == 200, preview.text
        assert preview.json()['assessment_source'] == 'Guaranteed Low'
        assert 'below' not in preview.json()['email_body'].lower()
        payload.update(assessment_token=preview.json()['assessment_token'], email_body=preview.json()['email_body'])
        result = client.post('/lecturers/me/alerts', json=payload)
        assert result.status_code == 200, result.text
        assert client.post('/lecturers/me/alerts', json=payload).status_code == 200
        assert len(sent) == 1
        assert len(client.get('/lecturers/me/alerts').json()) == 1
        cursor = offering['teachers'][2]
        assert [row['student_id'] for row in client.get(path, params={'course_id': course}).json()] == [second]
        assert client.get('/lecturers/me/alerts').json() == []
        cursor = offering['teachers'][0]
        assert {row['student_id'] for row in client.get(path, params={'course_id': course}).json()} == {first, second}

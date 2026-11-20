import os
from datetime import date, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy import text

from db.models import (
    AttendanceRecord,
    AttendanceRequest,
    Base,
    ClassSession,
    Course,
    Enrolment,
    Student,
    User,
)


@pytest.fixture
def db():
    migrated = os.getenv("FYP_QA_MIGRATED_URL")
    local_url = migrated or os.getenv("FYP_QA_DATABASE_URL") or os.getenv("LOCAL_MC_TEST_DATABASE_URL")
    if local_url:
        url = make_url(local_url)
        migration_target = (migrated and url.host == '127.0.0.1' and url.port == 56422
                            and url.username == 'postgres' and url.database.startswith('qa_migration_')
                            and url.database.isidentifier())
        if not migration_target and (url.host != "127.0.0.1" or url.port != 55432
                or url.database != "fyp_qa" or url.username != "fyp_qa" or url.get_backend_name() != "postgresql"):
            raise ValueError("MC integration tests require the isolated synthetic QA database on port 55432")
        engine = create_engine(url)
        with engine.connect() as connection:
            marker = 'FYP SYNTHETIC MIGRATION REPLAY ONLY' if migrated else 'FYP SYNTHETIC QA ONLY'
            assert connection.scalar(text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database()")) == marker
            connection.rollback()
            transaction = connection.begin()
            try:
                with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                    yield session
            finally:
                transaction.rollback()
        engine.dispose()
        return
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[table for table in Base.metadata.sorted_tables
        if table.name not in ("ai_chat_sessions", "ai_chat_messages")])
    with Session(engine) as session:
        yield session
    engine.dispose()


def seed(db):
    student = Student(name="Student", student_code="ST0000001")
    admin = User(email="admin@test.example", password_hash="unused", role="admin")
    course = Course(course_code="MC101", course_name="Course")
    db.add_all([student, admin, course])
    db.flush()
    db.add(Enrolment(student_id=student.id, course_id=course.id, class_group="G1"))
    request = AttendanceRequest(student_id=student.id, course_id=course.id, request_type="leave",
        reason="Medical leave", start_date=date(2026, 10, 7), end_date=date(2026, 10, 8),
        proof_path="private/proof.pdf", proof_file_name="proof.pdf", proof_mime_type="application/pdf")
    db.add(request)
    db.commit()
    return student, admin, course, request


def test_admin_sees_and_reviews_student_submission_and_cannot_review_twice(db):
    from routers.admin_reports import MCReportUpdate, get_mc_reports, update_mc_status

    student, admin, course, request = seed(db)
    reports = get_mc_reports(status="Pending", db=db, current_user=admin)
    assert len(reports) == 1
    assert reports[0]["id"] == request.id
    assert reports[0]["source"] == "request"
    update_mc_status(request.id, MCReportUpdate(status="Approved", source="request"), db, admin)
    assert request.status == "approved"
    with pytest.raises(HTTPException) as error:
        update_mc_status(request.id, MCReportUpdate(status="Rejected", source="request"), db, admin)
    assert error.value.status_code == 409


def test_approval_credits_only_covered_completed_classes_and_preserves_checkins(db):
    from domain.medical_leave import review_attendance_request

    student, admin, course, request = seed(db)
    lessons = []
    for group, status, start in [
        ("All", "completed", datetime(2026, 10, 6, 17)),  # Oct 7 in Malaysia
        ("G1", "completed", datetime(2026, 10, 8, 1)),
        ("G2", "completed", datetime(2026, 10, 7, 1)),
        ("G1", "cancelled", datetime(2026, 10, 7, 1)),
        ("G1", "scheduled", datetime(2026, 10, 7, 2)),
        ("G1", "completed", datetime(2026, 10, 8, 17)),  # Oct 9 in Malaysia
    ]:
        lesson = ClassSession(course_id=course.id, class_group=group, status=status, scheduled_start=start)
        db.add(lesson)
        lessons.append(lesson)
    db.flush()
    db.add(AttendanceRecord(student_id=student.id, session_id=lessons[1].id, status="present"))
    db.commit()
    review_attendance_request(db, request, "approved", admin.id, "")
    db.flush()
    records = {r.session_id: r.status for r in db.query(AttendanceRecord).all()}
    assert records == {lessons[0].id: "leave", lessons[1].id: "present"}


def test_future_class_honors_approved_leave_when_completed(db):
    from domain.medical_leave import apply_approved_medical_leave

    student, admin, course, request = seed(db)
    request.status = "approved"
    db.commit()
    lesson = ClassSession(course_id=course.id, class_group="G1", status="completed",
                          scheduled_start=datetime(2026, 10, 7, 1))
    db.add(lesson)
    db.commit()
    apply_approved_medical_leave(db, lesson)
    db.flush()
    apply_approved_medical_leave(db, lesson)
    db.flush()
    records = db.query(AttendanceRecord).all()
    assert len(records) == 1
    assert records[0].status == "leave"


@pytest.mark.parametrize("decision", ["pending", "rejected", "cancelled"])
def test_unapproved_leave_never_excuses_absence(db, decision):
    from domain.medical_leave import apply_approved_medical_leave

    student, admin, course, request = seed(db)
    request.status = decision
    lesson = ClassSession(course_id=course.id, class_group="G1", status="completed",
                          scheduled_start=datetime(2026, 10, 7, 1))
    db.add(lesson)
    db.commit()
    apply_approved_medical_leave(db, lesson)
    assert db.query(AttendanceRecord).count() == 0


def test_rejection_notifies_student_without_changing_attendance(db):
    from db.models import UserNotification
    from routers.admin_reports import MCReportUpdate, get_mc_reports, update_mc_status

    student, admin, course, request = seed(db)
    user = User(email="student@test.example", password_hash="unused", role="student")
    db.add(user)
    db.flush()
    student.user_id = user.id
    db.commit()
    update_mc_status(request.id, MCReportUpdate(status="Rejected", source="request"), db, admin)
    assert request.status == "rejected"
    assert db.query(AttendanceRecord).count() == 0
    assert db.query(UserNotification).one().user_id == user.id
    assert get_mc_reports("Pending", db, admin) == []
    assert get_mc_reports("Rejected", db, admin)[0]["id"] == request.id


def test_admin_proof_returns_actual_private_bytes_and_reports_storage_failure(db, monkeypatch):
    from routers import admin_reports
    from utils.security import require_admin

    student, admin, course, request = seed(db)
    def download(path):
        assert path == request.proof_path
        return b"%PDF-test-private-proof"
    monkeypatch.setattr(admin_reports, "download_private_document", download)
    result = admin_reports.get_mc_proof(request.id, db, admin)
    assert result.body == b"%PDF-test-private-proof"
    assert result.media_type == "application/pdf"
    assert result.headers["cache-control"] == "no-store"
    with pytest.raises(HTTPException) as error:
        require_admin(User(role="student"))
    assert error.value.status_code == 403
    def fail(_path):
        raise RuntimeError("storage offline")
    monkeypatch.setattr(admin_reports, "download_private_document", fail)
    with pytest.raises(HTTPException) as error:
        admin_reports.get_mc_proof(request.id, db, admin)
    assert error.value.status_code == 503


def test_background_sync_applies_future_leave_before_end_of_day_absences(db, monkeypatch):
    from domain import session_sync

    student, admin, course, request = seed(db)
    request.status, request.reviewer_user_id = "approved", admin.id
    lesson = ClassSession(course_id=course.id, class_group="G1", status="completed",
        scheduled_start=datetime(2026, 10, 7, 1), scheduled_end=datetime(2026, 10, 7, 3))
    db.add(lesson)
    db.commit()
    monkeypatch.setattr(session_sync, "calculate_schedule", lambda _, **kwargs: {})
    monkeypatch.setattr(session_sync, "utcnow", lambda: datetime(2026, 10, 7, 4))
    session_sync._sync_class_sessions_now(db)
    assert db.query(AttendanceRecord).one().status == "leave"


def test_submitted_mc_is_reviewable_and_student_sees_approval_and_credited_rate(db, monkeypatch):
    from datetime import timedelta
    from io import BytesIO

    from fastapi import UploadFile
    from starlette.datastructures import Headers

    from domain.attendance import attendance_rate_percent
    from routers import admin_reports, medical_leave
    from utils.timeutil import local_offset

    student, admin, course, old_request = seed(db)
    db.delete(old_request)
    user = User(email="submission@test.example", password_hash="unused", role="student")
    db.add(user)
    db.flush()
    student.user_id = user.id
    today = date.today()
    lesson = ClassSession(course_id=course.id, class_group="G1", status="completed",
        scheduled_start=datetime.combine(today, datetime.min.time()) - local_offset())
    db.add(lesson)
    db.flush()
    db.add(AttendanceRecord(student_id=student.id, session_id=lesson.id, status="absent"))
    db.commit()
    uploaded = {}
    monkeypatch.setattr(medical_leave, "upload_private_document", lambda path, data, mime: uploaded.update({path: data}))
    proof = UploadFile(BytesIO(b"%PDF-test"), filename="proof.pdf", headers=Headers({"content-type": "application/pdf"}))
    submitted = medical_leave.submit_medical_leave(course.id, today, today + timedelta(days=1),
        "Medical leave for recovery", proof, db, user)
    assert uploaded
    reports = admin_reports.get_mc_reports("Pending", db, admin)
    assert reports[0]["id"] == submitted["id"]
    admin_reports.MCReportResponse(**reports[0])  # The HTTP response must retain request fields.
    admin_reports.update_mc_status(submitted["id"],
        admin_reports.MCReportUpdate(status="Approved", source="request"), db, admin)
    assert medical_leave.list_medical_leave(db, user)[0]["status"] == "approved"
    record = db.query(AttendanceRecord).one()
    assert record.status == "leave"
    assert attendance_rate_percent([(lesson.id, "G1", 2)], {(student.id, lesson.id)}, student.id, "G1") == 100

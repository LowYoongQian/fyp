"""Opt-in acceptance tests: real local Postgres/Storage; only document AI is fixed."""

import json
import os
import socket
import subprocess
import threading
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from sqlalchemy import delete, or_
from sqlalchemy.engine import make_url

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LOCAL_MC") != "1", reason="Opt-in local Supabase acceptance"
)
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def server():
    url = make_url(os.environ["DATABASE_URL"])
    assert url.host == "127.0.0.1" and url.port == 56422 and url.database == "postgres"
    assert os.environ["SUPABASE_URL"] == "http://127.0.0.1:56421"
    from db.database import engine
    from sqlalchemy import text
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database()")) == 'FYP SYNTHETIC STORAGE QA ONLY'
    import uvicorn

    from main import app

    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    service = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    thread = threading.Thread(
        target=service.run, kwargs={"sockets": [sock]}, daemon=True
    )
    thread.start()
    try:
        for _ in range(200):
            if service.started:
                break
            time.sleep(0.05)
        assert service.started
        yield f"http://127.0.0.1:{port}"
    finally:
        service.should_exit = True
        thread.join(10)
        sock.close()


@pytest.fixture
def scenario(server):
    from db.database import SessionLocal
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
    from utils.security import hash_password
    from utils.timeutil import local_offset

    suffix = uuid.uuid4().hex[:8]
    password = "Local-MC-test-only!42"
    ids = []
    with SessionLocal() as db:
        student_user = User(
            email=f"mc-{suffix}@student.school.edu",
            role="student",
            password_hash=hash_password(password),
        )
        admin = User(
            email=f"mc-{suffix}@admin.test",
            role="admin",
            password_hash=hash_password(password),
        )
        db.add_all([student_user, admin])
        db.flush()
        student = Student(
            user_id=student_user.id,
            name=f"MC Test {suffix}",
            student_code=f"ST{int(suffix, 16) % 10000000:07d}",
        )
        course = Course(course_code=f"MC{suffix}", course_name="MC Acceptance Course")
        db.add_all([student, course])
        db.flush()
        enrolment = Enrolment(
            student_id=student.id, course_id=course.id, class_group="G1"
        )
        start = datetime.combine(date.today(), datetime.min.time()) - local_offset()
        lessons = [
            ClassSession(
                course_id=course.id,
                class_group="G1",
                status="completed",
                is_open=False,
                scheduled_start=start + timedelta(hours=i),
                scheduled_end=start + timedelta(hours=i + 1),
            )
            for i in range(2)
        ]
        db.add_all([enrolment, *lessons])
        db.flush()
        records = [
            AttendanceRecord(student_id=student.id, session_id=lesson.id, status=status)
            for lesson, status in zip(lessons, ["absent", "present"], strict=True)
        ]
        db.add_all(records)
        db.flush()
        ids = [
            x.id
            for x in [
                student_user,
                admin,
                student,
                course,
                enrolment,
                *lessons,
                *records,
            ]
        ]
        data = dict(
            student_email=student_user.email,
            admin_email=admin.email,
            password=password,
            course_id=course.id,
            student_id=student.id,
            course_code=course.course_code,
            today=date.today().isoformat(),
            tomorrow=(date.today() + timedelta(days=1)).isoformat(),
        )
        db.commit()
    try:
        yield data
    finally:
        headers = {
            "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        }
        with SessionLocal() as db:
            paths = [
                r.proof_path
                for r in db.query(AttendanceRequest).filter_by(
                    student_id=data["student_id"]
                )
                if r.proof_path
            ]
            if paths:
                response = httpx.request(
                    "DELETE",
                    os.environ["SUPABASE_URL"] + "/storage/v1/object/medical-leave",
                    headers=headers,
                    json={"prefixes": paths},
                )
                response.raise_for_status()
            for table in reversed(Base.metadata.sorted_tables):
                columns = [c for c in table.c if c.name == "id" or c.foreign_keys]
                if columns:
                    db.execute(delete(table).where(or_(*(c.in_(ids) for c in columns))))
            db.commit()


def login(client, data, role):
    r = client.post(
        "/auth/login",
        json={"identifier": data[role + "_email"], "password": data["password"]},
    )
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


@pytest.mark.parametrize(
    "decision,expected_rate,expected_status",
    [("approved", 100, "leave"), ("rejected", 50, "absent")],
)
def test_http_mc_result_and_actual_student_rate(
    server, scenario, decision, expected_rate, expected_status
):
    with httpx.Client(base_url=server, timeout=30) as c:
        student, admin = login(c, scenario, "student"), login(c, scenario, "admin")
        assert (
            c.get("/students/me/enrolments", headers=student).json()[0][
                "attendance_rate"
            ]
            == 50
        )
        proof = b"%PDF-local-acceptance"
        r = c.post(
            "/students/me/medical-leave",
            headers=student,
            data={
                "course_id": scenario["course_id"],
                "start_date": scenario["today"],
                "end_date": scenario["tomorrow"],
                "reason": "Medical recovery test",
            },
            files={"proof": ("proof.pdf", proof, "application/pdf")},
        )
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        rows = c.get("/admin/reports/mc", headers=admin).json()
        assert any(row["id"] == rid and row["source"] == "request" for row in rows)
        assert c.get(f"/admin/reports/mc/{rid}/proof", headers=admin).content == proof
        assert (
            c.put(
                f"/admin/reports/mc/{rid}",
                headers=student,
                json={"source": "request", "status": decision.title()},
            ).status_code
            == 403
        )
        assert (
            c.put(
                f"/admin/reports/mc/{rid}",
                headers=admin,
                json={"source": "request", "status": decision.title()},
            ).status_code
            == 200
        )
        assert (
            c.put(
                f"/admin/reports/mc/{rid}",
                headers=admin,
                json={"source": "request", "status": decision.title()},
            ).status_code
            == 409
        )
        assert (
            c.get("/students/me/medical-leave", headers=student).json()[0]["status"]
            == decision
        )
        statuses = [
            r["status"]
            for r in c.get("/students/me/attendance", headers=student).json()
        ]
        assert sorted(statuses) == sorted([expected_status, "present"])
        assert (
            c.get("/students/me/enrolments", headers=student).json()[0][
                "attendance_rate"
            ]
            == expected_rate
        )


def test_playwright_mc_workflow(server, scenario):
    env = {
        **os.environ,
        "VITE_API_BASE_URL": server,
        "MC_SCENARIO": json.dumps(scenario),
        "MC_API": server,
    }
    log = Path(__file__).parent / "artifacts" / "mc-vite.log"
    log.parent.mkdir(exist_ok=True)
    with log.open("w") as out:
        vite = subprocess.Popen(
            [
                "node",
                "node_modules/vite/bin/vite.js",
                "--host",
                "127.0.0.1",
                "--port",
                "5179",
                "--strictPort",
            ],
            cwd=ROOT / "fyp_web",
            env=env,
            stdout=out,
            stderr=out,
        )
        try:
            for _ in range(100):
                try:
                    if httpx.get("http://127.0.0.1:5179").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.1)
            result = subprocess.run(
                ["node", str(Path(__file__).with_name("mc_workflow.cjs"))],
                env=env,
                capture_output=True,
                text=True, encoding="utf-8",
                timeout=150,
            )
            assert result.returncode == 0, result.stdout + result.stderr
            print(result.stdout)
        finally:
            vite.terminate()
            vite.wait(10)

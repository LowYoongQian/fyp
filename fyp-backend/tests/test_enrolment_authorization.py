"""Targeted authorization QA: group-level teaching scope for enrolment, student lookup, attendance, At-Risk and
warning email (docs/03-MLModel/final-acceptance/FINAL_SECURITY_RELEASE_REPORT.md). Isolated synthetic PostgreSQL only."""
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from db.database import SessionLocal
from db.models import ClassMeeting, Course, Enrolment, Student, TeachingRuleVersion, User
from routers import admin_academic, admin_students, analytics, lecturers, programme_groups, sessions
from test_at_risk_phase1 import add_lesson, offering  # noqa: F401  (offering is a fixture)


def _client():
    app = FastAPI()
    for router in (admin_academic.router, admin_students.router, lecturers.router, programme_groups.router,
                   sessions.router, analytics.router):
        app.include_router(router)
    return TestClient(app)


def _bearer(user_id):
    from domain.account_security import new_session
    from utils.security import create_access_token
    with SessionLocal.begin() as db:
        user = db.get(User, user_id)
        return {"Authorization": "Bearer " + create_access_token({"user_id": user.id, "sid": new_session(db, user, "Synthetic QA").id})}


def test_enrolment_and_student_lists_follow_teaching_scope(offering):
    first, second = offering["students"]            # G1, G2 of the same synthetic course
    lecturer, tutor_g1, practical_g2 = offering["teachers"]
    course = offering["course"]
    with SessionLocal() as db:
        student_user = db.get(Student, first).user_id
        all_students = db.query(Student).count()
        all_enrolments = db.query(Enrolment).count()
        second_code = db.get(Student, second).student_code
        second_enrolment = db.query(Enrolment).filter_by(course_id=course, student_id=second).one().id
        first_enrolment = db.query(Enrolment).filter_by(course_id=course, student_id=first).one().id
        lecture = add_lesson(db, offering, status="completed").id
        db.commit()
    assert all_students > 2 and all_enrolments > 2   # unrelated synthetic students exist, so isolation is observable
    as_admin, as_lecturer = _bearer(offering["admin"]), _bearer(lecturer)
    as_tutor, as_practical, as_student = _bearer(tutor_g1), _bearer(practical_g2), _bearer(student_user)
    with _client() as client:
        # Admin keeps full administrative access.
        rows = client.get("/admin/enrolments", headers=as_admin)
        assert rows.status_code == 200 and len(rows.json()) == all_enrolments
        assert client.get("/admin/students", headers=as_admin).json()["total"] == all_students

        # No system-wide enrolment list for staff or students.
        for headers in (as_lecturer, as_tutor, as_practical, as_student):
            denied = client.get("/admin/enrolments", headers=headers)
            assert denied.status_code == 403 and "student_name" not in denied.text

        def students(headers, **params):
            body = client.get("/admin/students", headers=headers, params=params).json()
            assert body["total"] >= len(body["items"])
            return body
        lecture_view = {row["id"]: row for row in students(as_lecturer)["items"]}
        assert set(lecture_view) == {first, second}       # a Lecture covers every group of the course
        assert all(row["email"].endswith("@test.invalid") for row in lecture_view.values())   # roster emails resolve
        assert [row["id"] for row in students(as_tutor)["items"]] == [first]
        assert [row["id"] for row in students(as_practical)["items"]] == [second]
        assert students(as_tutor, search=second_code)["total"] == 0                  # search cannot reach G2
        paged = students(as_tutor, skip=0, limit=50)
        assert (paged["total"], [row["id"] for row in paged["items"]]) == (1, [first])  # counting/paging inside scope

        def own(headers):
            reply = client.get("/lecturers/me/enrolments", headers=headers)
            assert reply.status_code == 200
            assert {row["course_id"] for row in reply.json()} == {course}               # never an unrelated course
            return {row["student_id"] for row in reply.json()}
        assert own(as_lecturer) == {first, second}
        assert own(as_tutor) == {first}
        assert own(as_practical) == {second}
        assert client.get("/lecturers/me/enrolments", headers=as_student).status_code == 403

        # Writes: no cross-group transfer or add for a tutor; the Lecture assignment keeps its course-wide right.
        refused = client.put(f"/enrolments/{second_enrolment}/group", json={"class_group": "G1", "dry_run": True}, headers=as_tutor)
        assert refused.status_code == 403 and "groups you teach" in refused.text
        refused = client.put(f"/enrolments/{first_enrolment}/group", json={"class_group": "G2", "dry_run": True}, headers=as_tutor)
        assert refused.status_code == 403
        assert client.put(f"/enrolments/{first_enrolment}/group", json={"class_group": "G2", "dry_run": True},
                          headers=as_lecturer).status_code != 403
        refused = client.post("/lecturers/me/enrolments", json={"course_id": course, "student_id": str(uuid4()), "class_group": "G2"},
                              headers=as_tutor)
        assert refused.status_code == 403 and "groups you teach" in refused.text

        # Attendance: roster and correction stay group-scoped.
        roster = client.get(f"/sessions/{lecture}/attendance", headers=as_tutor).json()["attendance_list"]
        assert [row["student_id"] for row in roster] == [first]
        assert client.put(f"/sessions/attendance/{lecture}/{second}", json={"status": "present"}, headers=as_tutor).status_code == 403

        # At-Risk scope unchanged.
        assert {row["student_id"] for row in client.get("/analytics/risk-scores", headers=as_tutor).json()} <= {first}
        assert second not in {row["student_id"] for row in client.get("/analytics/risk-scores", headers=as_tutor).json()}

        # Unauthenticated callers get nothing.
        assert client.get("/admin/students", headers=as_student).status_code == 403
        for headers in ({}, {"Authorization": "Bearer not-a-token"}):
            for path in ("/admin/enrolments", "/admin/students", "/lecturers/me/enrolments"):
                assert client.get(path, headers=headers).status_code == 401

    # Multiple assignments: the G1 tutor also takes a G2 class -> the union of both groups, still one course only.
    with SessionLocal.begin() as db:
        extra = ClassMeeting(course_id=course, meeting_key=f"extra-{uuid4().hex[:6]}", day="Thursday", start="09:00", end="10:00",
                             room="QA", lecturer_id=db.get(ClassMeeting, offering["meetings"][1]).lecturer_id,
                             role="Tutor", class_group="G2")
        db.add(extra)
        db.flush()
        db.query(TeachingRuleVersion).filter_by(meeting_id=extra.id).update({"effective_date": offering["monday"]})
    with _client() as client:
        assert {row["student_id"] for row in client.get("/lecturers/me/enrolments", headers=as_tutor).json()} == {first, second}
        assert {row["id"] for row in client.get("/admin/students", headers=as_tutor).json()["items"]} == {first, second}


def test_default_warning_email_is_sendable_and_limit_is_consistent(offering, monkeypatch):
    first, second = offering["students"]
    sent = []
    monkeypatch.setattr(lecturers.resend_mail, "configured", lambda: True)
    monkeypatch.setattr(lecturers.resend_mail, "send", lambda *args: sent.append(args) or "synthetic-id")
    with SessionLocal.begin() as db:   # longest names the admin forms accept (255)
        db.get(Student, first).name = "N" * 255
        db.get(Course, offering["course"]).course_name = "C" * 255
    as_lecturer, as_practical = _bearer(offering["teachers"][0]), _bearer(offering["teachers"][2])
    payload = {"course_id": offering["course"], "student_id": first}
    with _client() as client:
        assert client.post("/lecturers/me/alerts/preview", json=payload, headers=as_practical).status_code == 403   # G2 staff, G1 student
        preview = client.post("/lecturers/me/alerts/preview", json=payload, headers=as_lecturer).json()
        body = preview["email_body"]
        assert 255 < len(body) <= 5000 and "N" * 255 in body and "C" * 255 in body   # nothing truncated
        unchanged = client.post("/lecturers/me/alerts", json={**payload, "alert_id": str(uuid4()), "email_body": body,
                                                              "assessment_token": preview["assessment_token"]}, headers=as_lecturer)
        assert unchanged.status_code == 200 and sent[-1][2] == body                    # the unmodified default draft is sent
        for size, status in ((5000, 200), (5001, 422)):                               # the one limit, front and back
            reply = client.post("/lecturers/me/alerts", json={**payload, "alert_id": str(uuid4()), "email_body": "x" * size,
                                                              "assessment_token": preview["assessment_token"]}, headers=as_lecturer)
            assert reply.status_code == status
        assert len(sent) == 2   # mocked provider only

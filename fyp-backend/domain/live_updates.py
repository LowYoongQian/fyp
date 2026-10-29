"""Commit-time PostgreSQL NOTIFY -> role/owner-filtered invalidations, never row data."""
import asyncio
import json
import logging
import os
import threading

import psycopg

from db.database import SessionLocal
from db.models import Course, CourseStaffAssignment, Enrolment, Lecturer, Student, User
from utils.security import decode_token
from domain.account_security import validate_session

TOPICS = {"feedback", "medical", "attendance", "sessions", "timetable", "notifications", "notices", "account", "registry"}
TABLE_TOPICS = {
    "academic_semesters": {"timetable", "registry"},
    "student_feedback": {"feedback"}, "attendance_requests": {"medical", "attendance"},
    "attendance_records": {"attendance", "medical"}, "class_sessions": {"sessions", "attendance"},
    "class_meetings": {"timetable", "sessions"}, "courses": {"timetable", "sessions", "registry"},
    "enrolments": {"timetable", "attendance", "sessions", "registry"},
    "course_staff_assignments": {"timetable", "sessions", "registry"},
    "announcements": {"notices", "notifications"}, "user_notifications": {"notifications"},
    "users": {"account", "registry"}, "students": {"account", "registry"}, "lecturers": {"account", "registry"},
    "face_enrolment_requests": {"account", "registry"},
}


def read_scope(token):
    claims = decode_token(token)
    with SessionLocal() as db:
        user = validate_session(db, claims)
        scope = {"user_id": str(user.id), "role": user.role, "student_id": None, "courses": set()}
        if user.role == "student":
            student = db.query(Student).filter(Student.user_id == user.id).first()
            if student:
                scope["student_id"] = str(student.id)
                scope["courses"] = {str(row[0]) for row in db.query(Enrolment.course_id).filter(Enrolment.student_id == student.id)}
        elif user.role == "lecturer":
            lecturer = db.query(Lecturer).filter(Lecturer.user_id == user.id).first()
            if lecturer:
                scope["courses"] = {str(row[0]) for row in db.query(Course.id).filter(Course.lecturer_id == lecturer.id)}
                scope["courses"].update(str(row[0]) for row in db.query(CourseStaffAssignment.course_id).filter(CourseStaffAssignment.lecturer_id == lecturer.id))
        return scope


def authorised_topics(change, scope):
    topics = TABLE_TOPICS.get(change.get("table"), set())
    if scope["role"] == "admin":
        if change.get("table") == "user_notifications" and change.get("user_id") != scope["user_id"]:
            return set()
        return topics - ({"account"} if change.get("user_id") != scope["user_id"] else set())
    result = set()
    if change.get("table") == "academic_semesters":
        result = {"timetable"}  # Invalidation only; calendar GET remains role/course scoped.
    elif change.get("user_id") and change.get("table") not in {"course_staff_assignments", "courses"}:
        if change["user_id"] == scope["user_id"]:
            result = topics
    elif change.get("table") in {"course_staff_assignments", "courses"}:
        if change.get("user_id") == scope["user_id"] or change.get("course_id") in scope["courses"]:
            result = topics
    elif change.get("student_id"):
        if change["student_id"] == scope["student_id"] or (scope["role"] == "lecturer" and change.get("course_id") in scope["courses"]):
            result = topics
    elif change.get("course_id"):
        if change["course_id"] in scope["courses"]:
            result = topics
    elif change.get("table") == "announcements" and not change.get("target_course_code"):
        result = topics  # Public/all-student announcements have no course target.
    return result - {"registry"}


class LiveHub:
    def __init__(self):
        self.ready = False
        self.queues = set()

    def subscribe(self):
        queue = asyncio.Queue(maxsize=32)
        self.queues.add(queue)
        return queue

    def publish(self, change):
        for queue in tuple(self.queues):
            if queue.full():
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait({"resync": True})
            else:
                queue.put_nowait(change)


hub = LiveHub()


async def listen_for_commits(invalidate_cache=lambda: None):
    # LISTEN needs a dedicated direct/session-pool connection, never transaction pooling.
    url = os.getenv("LIVE_DATABASE_URL") or os.environ["DATABASE_URL"]
    url = url.replace("postgresql+psycopg://", "postgresql://", 1)
    loop = asyncio.get_running_loop()
    stopped = threading.Event()

    def deliver(change):
        invalidate_cache()
        hub.publish(change)

    def set_ready(value):
        hub.ready = value
        if value:
            deliver({"resync": True})

    def schedule(callback, *args):
        if not stopped.is_set():
            loop.call_soon_threadsafe(callback, *args)

    def listen():
        # A dedicated synchronous thread supports Windows Proactor event loops too.
        delay = 1
        while not stopped.is_set():
            try:
                with psycopg.connect(url, autocommit=True, connect_timeout=10) as connection:
                    connection.execute("LISTEN sas_live_changes")
                    installed = connection.execute("SELECT to_regprocedure('public.sas_notify_change()') IS NOT NULL").fetchone()[0]
                    if not installed:
                        raise RuntimeError("Live migration is not installed")
                    schedule(set_ready, True)
                    delay = 1
                    while not stopped.is_set():
                        for notification in connection.notifies(timeout=1, stop_after=32):
                            schedule(deliver, json.loads(notification.payload))
            except Exception as error:
                logging.getLogger(__name__).warning("Live notifications unavailable (%s); clients retain polling", type(error).__name__)
            finally:
                schedule(set_ready, False)
            stopped.wait(delay)
            delay = min(30, delay * 2)

    worker = asyncio.create_task(asyncio.to_thread(listen))
    try:
        await asyncio.shield(worker)
    finally:
        stopped.set()
        hub.ready = False
        await worker

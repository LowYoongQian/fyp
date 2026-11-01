"""Which semesters' timetables a person may see, and which of those may be opened.

Scope is the caller's own: an admin sees every saved semester, a lecturer the semesters of the courses they own or are
assigned to, a student the semesters of their enrolled courses and of their own programme. Only the CURRENT semester
(Asia/Kuala_Lumpur, end date inclusive) can be opened; an upcoming or ended one stays in the list with its reason but its
timetable is refused here, for every endpoint that serves one. Historical attendance, audit and course records are untouched.
"""
from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from db.models import AcademicSemester, ClassMeeting, Course, Enrolment, Lecturer, Programme, Student
from domain import semesters
from domain.semesters import semester_dict
from utils.db_helpers import my_course_ids, require_own_profile
from utils.timeutil import iso_utc, utcnow

BLOCK_REASONS = {"upcoming": "This semester has not started.", "ended": "This semester has ended."}
NOT_CURRENT = "This course is not in the current semester."


def current_semester(course):
    """The course's semester if it is running today (Malaysia date, end date inclusive); None when it has ended, not started or has no semester."""
    return course.semester if course is not None and course.semester_id and course.semester is not None and view_state(course.semester) == "current" else None


def held_in_semester(semester, when) -> bool:
    """Whether a class time (naive UTC) falls on a campus date inside the semester. A class with no time at all cannot be placed, so it is left out."""
    return semester is not None and when is not None and semester.start_date <= semesters.campus_date(when) <= semester.end_date


def teaching_course_ids(db: Session, lecturer_id=None) -> list:
    """Courses whose semester is running today (Malaysia date, end date inclusive); with lecturer_id, only that lecturer's own or assigned ones.

    Attendance, analytics, at-risk, warnings and the assistant use this. Ending a semester ends teaching access, not the assignment:
    Course Notices, the calendar and the timetable list keep my_course_ids. A course with no semester is never current."""
    today = semesters.campus_now().date()  # the same campus clock semester_dict uses
    query = db.query(Course.id).join(AcademicSemester, AcademicSemester.id == Course.semester_id).filter(
        AcademicSemester.start_date <= today, AcademicSemester.end_date >= today)
    if lecturer_id is not None:
        query = query.filter(Course.id.in_(my_course_ids(db, lecturer_id)))
    return [course_id for (course_id,) in query.all()]


def view_state(semester) -> str:
    """'current' | 'upcoming' | 'ended', from the one campus clock semester_dict uses."""
    status = semester_dict(semester)["status"]
    return "current" if status == "active" else status


def schedule_viewable(course) -> bool:
    """Whether this course's schedule may be shown anywhere: only while it belongs to a current semester.

    A course attached to no semester has no schedule to show yet (it is not assigned one to pass this check), and a course of an
    upcoming or ended semester stays blocked. The course itself, its enrolments and its attendance history are never affected."""
    return course is not None and bool(course.semester_id) and view_state(course.semester) == "current"


def lecture_slot(course, meeting) -> dict:
    """The schedule_* fields for a course's lecture in a course list: the real values only when the schedule may be shown, otherwise null."""
    shown = meeting is not None and schedule_viewable(course)
    return {"schedule_day": meeting.day if shown else None, "schedule_start": meeting.start if shown else None,
            "schedule_end": meeting.end if shown else None, "schedule_room": meeting.room if shown else None}


def _scope(db: Session, user):
    """(course ids in scope or None for everything, programme id whose semesters also belong to the caller)."""
    if user.role == "admin":
        return None, None
    if user.role == "lecturer":
        return set(my_course_ids(db, require_own_profile(db, Lecturer, user.id, "Lecturer").id)), None
    if user.role == "student":
        student = require_own_profile(db, Student, user.id, "Student")
        return {course_id for (course_id,) in db.query(Enrolment.course_id).filter(Enrolment.student_id == student.id)}, student.programme_id
    raise HTTPException(403, "Not authorized to view timetables")


def _authorized_query(db: Session, user):
    ids, programme_id = _scope(db, user)
    query = db.query(AcademicSemester)
    if ids is None:
        return query, ids
    clause = AcademicSemester.id.in_(db.query(Course.semester_id).filter(Course.id.in_(ids), Course.semester_id.isnot(None)))
    if programme_id:
        clause = or_(clause, AcademicSemester.programme_id == programme_id)
    return query.filter(clause), ids


def _row(semester, programme, courses: int, classes: int) -> dict:
    state = view_state(semester)
    # server_time lets the page use the server's clock instead of a device clock that may be wrong.
    return {**semester_dict(semester), "state": state, "server_time": iso_utc(utcnow()),
            "programme": {"code": programme.code, "name": programme.name} if programme else None,
            "course_count": courses, "class_count": classes,
            "can_view": state == "current", "block_reason": BLOCK_REASONS.get(state)}


def scope_course(db: Session, user, programme_id, course_id):
    """The course an admin chose on the timetable page, after checking it really belongs to the chosen programme.

    Admins must give both (no unfiltered all-semesters read); students and staff never use these filters, so a forged one is refused rather
    than ignored. A missing or mismatched id is 404 and never widens the scope. Returns None for a non-admin who sent no filter."""
    if user.role != "admin":
        if programme_id is not None or course_id is not None:
            raise HTTPException(403, "Only an administrator can filter by programme and course.")
        return None
    if programme_id is None or course_id is None:
        raise HTTPException(422, "Choose a programme and a course.")
    course = db.get(Course, str(course_id))
    if course is None or str(course.programme_id) != str(programme_id):
        raise HTTPException(404, "That course is not in the selected programme.")
    return course


def _course_rows(db: Session, course) -> list[dict]:
    """The one semester a course belongs to (a course has at most one), with counts for THAT course only. None when it has no semester yet."""
    semester = course.semester if course.semester_id else None
    if semester is None or str(semester.programme_id) != str(course.programme_id):
        return []
    classes = db.query(func.count(ClassMeeting.id)).filter(ClassMeeting.course_id == course.id).scalar() or 0
    # The course rides along so the page can show and restore which course this timetable is for.
    return [{**_row(semester, db.get(Programme, semester.programme_id), 1, classes), "course_id": str(course.id), "course_code": course.course_code, "course_name": course.course_name}]


def list_semesters(db: Session, user, course=None) -> list[dict]:
    """Authorised semesters from the semester records themselves, so one with no courses is still listed. Current first, then upcoming, then previous.

    With `course` (admin only, from scope_course) it is just that course's semester, counted for that course."""
    if course is not None:
        if user.role != "admin":
            raise HTTPException(403, "Only an administrator can filter by programme and course.")
        return _course_rows(db, course)
    query, ids = _authorized_query(db, user)
    semesters = query.all()
    if not semesters:
        return []
    course_query = db.query(Course.id, Course.semester_id).filter(Course.semester_id.in_([s.id for s in semesters]))
    if ids is not None:
        course_query = course_query.filter(Course.id.in_(ids))
    course_semester = dict(course_query.all())
    classes = dict(db.query(ClassMeeting.course_id, func.count(ClassMeeting.id)).filter(
        ClassMeeting.course_id.in_(list(course_semester))).group_by(ClassMeeting.course_id).all()) if course_semester else {}
    courses_in, classes_in = {}, {}
    for course_id, semester_id in course_semester.items():
        courses_in[semester_id] = courses_in.get(semester_id, 0) + 1
        classes_in[semester_id] = classes_in.get(semester_id, 0) + classes.get(course_id, 0)
    programmes = {p.id: p for p in db.query(Programme).filter(Programme.id.in_({s.programme_id for s in semesters}))}
    rows = [_row(s, programmes.get(s.programme_id), courses_in.get(s.id, 0), classes_in.get(s.id, 0)) for s in semesters]
    rows.sort(key=lambda r: r["start_date"])
    by_state = {state: [r for r in rows if r["state"] == state] for state in ("current", "upcoming", "ended")}
    return by_state["current"] + by_state["upcoming"] + by_state["ended"][::-1]  # Previous semesters newest first.


def require_viewable_semester(db: Session, user, semester_id: str, course=None) -> AcademicSemester:
    """The semester, only if it is in the caller's scope AND current. 404 hides semesters outside the scope; 403 carries the reason.

    With `course` (an admin's chosen course) the semester must be that course's own, so a stale or mismatched id is 404."""
    query, _ = _authorized_query(db, user)
    semester = query.filter(AcademicSemester.id == str(semester_id)).first()
    if semester is not None and course is not None and str(course.semester_id) != str(semester.id):
        semester = None
    if semester is None:
        raise HTTPException(404, "Semester not found")
    state = view_state(semester)
    if state != "current":
        raise HTTPException(403, BLOCK_REASONS[state])
    return semester


def semester_summary(db: Session, user, semester: AcademicSemester, course=None) -> dict:
    return next(row for row in list_semesters(db, user, course) if row["id"] == semester.id)


def meeting_semester(db: Session, user, meeting_id: str):
    """The semester a class meeting belongs to, if the caller may know about it (their own scope); None otherwise."""
    meeting = db.query(ClassMeeting).options(joinedload(ClassMeeting.course)).filter(ClassMeeting.id == str(meeting_id)).first()
    if meeting is None or meeting.course is None or not meeting.course.semester_id:
        return None
    course = meeting.course
    if user.role == "admin":
        # An admin opens a class from a notice inside that class's own course, so the page can restore its programme/course choice.
        return next(iter(_course_rows(db, course)), None)
    return next((row for row in list_semesters(db, user) if row["id"] == course.semester_id and _course_in_scope(db, user, meeting.course_id)), None)


def _course_in_scope(db: Session, user, course_id) -> bool:
    ids, _ = _scope(db, user)
    return ids is None or course_id in ids

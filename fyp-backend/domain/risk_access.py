from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, or_

from db.models import ClassMeeting, Enrolment, Lecturer, TeachingRuleVersion
from domain.timetable_access import teaching_course_ids
from utils.db_helpers import require_own_profile
from utils.timeutil import campus_now


def _active_meeting(db):
    today = campus_now().date()
    versions = db.query(TeachingRuleVersion.slot).filter(
        TeachingRuleVersion.meeting_id == ClassMeeting.id,
    ).correlate(ClassMeeting)
    current = versions.filter(TeachingRuleVersion.effective_date <= today).order_by(
        TeachingRuleVersion.effective_date.desc(),
    ).limit(1).scalar_subquery()
    return and_(or_(ClassMeeting.retire_on.is_(None), ClassMeeting.retire_on > today),
                or_(~versions.exists(), current.isnot(None)))


def risk_course_ids(db, lecturer_id):
    return [course_id for (course_id,) in db.query(ClassMeeting.course_id).filter(
        ClassMeeting.lecturer_id == lecturer_id,
        _active_meeting(db),
        ClassMeeting.course_id.in_(teaching_course_ids(db)),
    ).distinct()]


def teaching_group_filter(db, lecturer_id):
    return db.query(ClassMeeting.id).filter(
        ClassMeeting.lecturer_id == lecturer_id,
        ClassMeeting.course_id == Enrolment.course_id,
        _active_meeting(db),
        or_(ClassMeeting.role == "Lecture", ClassMeeting.class_group == Enrolment.class_group),
    ).correlate(Enrolment).exists()


def scoped_enrolments(db, user):
    query = db.query(Enrolment)
    if user.role == "admin":
        return query
    lecturer = require_own_profile(db, Lecturer, user.id, "Lecturer")
    return query.filter(Enrolment.course_id.in_(teaching_course_ids(db)),
                        teaching_group_filter(db, lecturer.id))


def require_risk_access(db, user, course_id, student_id):
    try:
        UUID(course_id)
        UUID(student_id)
    except ValueError as error:
        raise HTTPException(422, "Invalid course or student identifier") from error
    if not scoped_enrolments(db, user).filter_by(course_id=course_id, student_id=student_id).first():
        raise HTTPException(403, "The student is outside your teaching scope")

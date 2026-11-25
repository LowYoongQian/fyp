"""Attendance analytics and current, role-scoped At-Risk snapshots."""
from collections import defaultdict
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AcademicSemester, AttendanceRecord, ClassSession, Course, Enrolment, Lecturer, RiskScore, Student, TeachingPlan, User
from domain.attendance import CREDITED_STATUSES, session_hours
from domain.risk_access import risk_course_ids, scoped_enrolments
from domain.risk_service import ended_course_plans, lock_assessment, recompute_course
from domain.semesters import campus_date
from domain.timetable_access import held_in_semester, teaching_course_ids
from utils.db_helpers import require_own_profile
from utils.security import require_admin, require_lecturer
from utils.timeutil import campus_now, iso_utc, local_offset, utcnow

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/recompute")
def recompute_risk_scores(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    visible = scoped_enrolments(db, current_user).filter(Enrolment.course_id.in_(teaching_course_ids(db)))
    by_course = defaultdict(set)
    for course_id, student_id in visible.with_entities(Enrolment.course_id, Enrolment.student_id):
        by_course[course_id].add(student_id)
    count = 0
    for course_id, student_ids in sorted(by_course.items()):
        lock_assessment(db, course_id)
        count += recompute_course(db, course_id, allowed=student_ids)
        db.commit()
    return {"recomputed": count}


def risk_result(score):
    return {
        "attendance_rate": score.attendance_rate, "risk_score": score.risk_score,
        "risk_label": score.risk_label, "risk_factors": score.risk_factors,
        "assessment_source": score.assessment_source, "updated_at": iso_utc(score.updated_at),
    }


@router.get("/risk-scores")
def get_risk_scores(course_id: UUID | None = None, student_id: UUID | None = None,
                    db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    visible = scoped_enrolments(db, current_user)
    if course_id:
        if current_user.role == "lecturer":
            lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
            if str(course_id) not in risk_course_ids(db, lecturer.id):
                raise HTTPException(403, "Not authorized to view risk scores for this course")
        visible = visible.filter_by(course_id=str(course_id))
    if student_id:
        visible = visible.filter_by(student_id=str(student_id))
    pairs = visible.with_entities(Enrolment.student_id, Enrolment.course_id).distinct().subquery()
    rows = db.query(RiskScore, Student, Course).join(Student, Student.id == RiskScore.student_id).join(
        Course, Course.id == RiskScore.course_id,
    ).join(pairs, (pairs.c.student_id == RiskScore.student_id) & (pairs.c.course_id == RiskScore.course_id)).filter(
        RiskScore.assessment_source.isnot(None),
    ).order_by(RiskScore.risk_score.desc().nullslast(), RiskScore.id).all()
    return [dict(id=rs.id, student_id=s.id, student_name=s.name, student_code=s.student_code,
                 course_id=c.id, course_code=c.course_code, course_name=c.course_name, **risk_result(rs))
            for rs, s, c in rows]


@router.get("/pending-teaching")
def pending_teaching(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    closeout = TeachingPlan.details["closeout"]
    rows = ended_course_plans(db, campus_now().date()).with_entities(
        Course.id, Course.course_code, AcademicSemester.name, closeout
    ).filter(closeout.as_string() != "[]").order_by(Course.course_code)
    return [dict(course_id=cid, course_code=code, semester=name, **exception)
            for cid, code, name, exceptions in rows for exception in exceptions]


@router.get("/overview")
def get_analytics_overview(
    course_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Role-scoped, real-data analytics for one course at a time."""
    if current_user.role == "lecturer":
        lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        allowed_ids = risk_course_ids(db, lecturer.id)
    else:
        allowed_ids = [row[0] for row in db.query(Course.id).all()]

    courses = db.query(Course).filter(Course.id.in_(allowed_ids)).order_by(Course.course_code).all() if allowed_ids else []
    course_options = [{"id": c.id, "code": c.course_code, "name": c.course_name} for c in courses]
    if not courses:
        return {"courses": [], "selected_course_id": None, "summary": {}, "weekly": [], "weekdays": [], "groups": [], "verification": []}

    selected_id = course_id or courses[0].id
    if selected_id not in {c.id for c in courses}:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics for this course")

    enrolments = scoped_enrolments(db, current_user).filter(Enrolment.course_id == selected_id).all()
    sessions = db.query(ClassSession).filter(ClassSession.course_id == selected_id).order_by(
        ClassSession.scheduled_start.asc().nullslast(), ClassSession.opened_at.asc().nullslast()
    ).all()
    if current_user.role == "lecturer":
        term = next(c for c in courses if c.id == selected_id).semester
        sessions = [s for s in sessions if held_in_semester(term, s.scheduled_start or s.opened_at)]
    visible_groups = {e.class_group for e in enrolments} | {"All"}
    if current_user.role == "lecturer":
        sessions = [s for s in sessions if s.class_group in visible_groups]
    completed = [s for s in sessions if s.status == "completed"]
    tracked = [s for s in sessions if s.status != "cancelled"]
    session_ids = [s.id for s in completed]
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).all() if session_ids else []
    records_by_session = defaultdict(list)
    visible_student_ids = {e.student_id for e in enrolments}
    records = [r for r in records if r.student_id in visible_student_ids]
    for record in records:
        records_by_session[record.session_id].append(record)

    def eligible_students(session):
        group = (session.class_group or "All").lower()
        return {e.student_id for e in enrolments if group == "all" or (e.class_group or "").lower() == group}

    def session_stats(session):
        eligible = eligible_students(session)
        attended = {
            r.student_id for r in records_by_session.get(session.id, [])
            if r.student_id in eligible and r.status in CREDITED_STATUSES
        }
        hours = session_hours(session.opened_at, session.closed_at,
                              scheduled_start=session.scheduled_start, scheduled_end=session.scheduled_end)
        return len(attended) * hours, len(eligible) * hours

    attended_total = eligible_total = 0
    weekly = defaultdict(lambda: [0, 0, 0, 0])
    weekdays = defaultdict(lambda: [0, 0, 0])
    current_day = (utcnow() + local_offset()).date()
    current_monday = current_day - timedelta(days=current_day.weekday())
    dated_sessions = []
    for session in tracked:
        when = session.scheduled_start or session.opened_at
        if when and campus_date(when) <= current_day:
            day = campus_date(when)
            monday = day - timedelta(days=day.weekday())
            dated_sessions.append(monday)
            weekly[monday][3] += 1

    # Keep calendar weeks visible through today even when a lecturer has not
    # resolved a class yet. A missing rate is materially different from 0%.
    if dated_sessions:
        cursor = min(dated_sessions)
        while cursor <= current_monday:
            weekly[cursor]
            cursor += timedelta(days=7)

    for session in completed:
        attended, eligible = session_stats(session)
        attended_total += attended
        eligible_total += eligible
        when = session.scheduled_start or session.opened_at
        if when:
            day = campus_date(when)
            monday = day - timedelta(days=day.weekday())
            weekly[monday][0] += attended
            weekly[monday][1] += eligible
            weekly[monday][2] += 1
            weekdays[day.strftime("%a")][0] += attended
            weekdays[day.strftime("%a")][1] += eligible
            weekdays[day.strftime("%a")][2] += 1

    risk_students = {
        row.student_id for row in db.query(RiskScore).filter(
            RiskScore.course_id == selected_id,
            RiskScore.risk_label.in_(["medium", "high"]),
            RiskScore.assessment_source.isnot(None),
            RiskScore.student_id.in_(visible_student_ids),
        ).all()
    }
    group_rows = []
    group_names = sorted({e.class_group or "Unassigned" for e in enrolments})
    for group in group_names:
        members = {e.student_id for e in enrolments if (e.class_group or "Unassigned") == group}
        group_sessions = [s for s in completed if (s.class_group or "All") in ("All", group)]
        present = possible = 0
        for session in group_sessions:
            attended, eligible = session_stats(session)
            if (session.class_group or "All") == "All":
                hours = session_hours(session.opened_at, session.closed_at,
                                      scheduled_start=session.scheduled_start, scheduled_end=session.scheduled_end)
                present += len({r.student_id for r in records_by_session.get(session.id, []) if r.student_id in members and r.status in CREDITED_STATUSES}) * hours
                possible += len(members) * hours
            else:
                present += attended
                possible += eligible
        group_rows.append({"group": group, "students": len(members), "completed_classes": len(group_sessions), "attendance_rate": round(present * 100 / possible, 1) if possible else None})

    verification_counts = {"WiFi + Liveness": 0, "WiFi verified": 0, "Manual / other": 0}
    verified_records = [r for r in records if r.status == "present"]
    for record in verified_records:
        if record.network_verified and record.liveness_passed:
            verification_counts["WiFi + Liveness"] += 1
        elif record.network_verified:
            verification_counts["WiFi verified"] += 1
        else:
            verification_counts["Manual / other"] += 1

    return {
        "courses": course_options,
        "selected_course_id": selected_id,
        "summary": {
            "enrolled_students": len({e.student_id for e in enrolments}),
            "average_attendance": round(attended_total * 100 / eligible_total, 1) if eligible_total else None,
            "at_risk_students": len(risk_students),
            "completed_classes": len(completed),
            "tracked_classes": len(tracked),
        },
        "weekly": [
            {
                "week": day.isoformat(),
                "rate": round(attended * 100 / eligible, 1) if eligible else None,
                "classes": completed_count,
                "tracked_classes": tracked_count,
            }
            for day, (attended, eligible, completed_count, tracked_count) in sorted(weekly.items())
        ],
        "weekdays": [{"day": day, "rate": round(weekdays[day][0] * 100 / weekdays[day][1], 1) if weekdays[day][1] else None, "classes": weekdays[day][2]} for day in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun") if day in weekdays],
        "groups": group_rows,
        "verification": [{"name": name, "count": count} for name, count in verification_counts.items()],
    }

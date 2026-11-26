"""Publish plans and serialize per-course assessments from committed inputs."""
from collections import defaultdict
from dataclasses import asdict
from datetime import datetime
from itertools import groupby
import logging

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from db.database import SessionLocal
from db.models import AcademicSemester, AttendanceRecord, ClassSession, Course, Enrolment, RiskScore, RiskUpdate, TeachingPlan, TeachingRuleVersion
from domain.attendance import CREDITED_STATUSES
from domain.planned_hours import TeachingRule, planned_minutes, teaching_obligations
from domain.replacements import replacement_root, scheduled_minutes
from domain.risk_decision import assess
from domain.semesters import campus_date
from utils.timeutil import campus_now, local_offset, utcnow

logger = logging.getLogger(__name__)


def _plan_details(db, course):
    term = course.semester
    if term is None:
        return [], "The course has no semester", None, None
    versions = defaultdict(list)
    for version in db.query(TeachingRuleVersion).filter_by(course_id=course.id).order_by(TeachingRuleVersion.effective_date):
        versions[version.meeting_id].append(version)
    def contact_rule(version):
        return None if version.slot is None else tuple(
            version.slot[key] for key in ("day", "start", "end", "role", "class_group")
        )

    rules = []
    for meeting, history in versions.items():
        # Keep the original effective date when only the classroom changes.
        history = [next(group) for _, group in groupby(history, key=contact_rule)]
        for index, version in enumerate(history):
            slot = version.slot
            if slot is not None:
                until = history[index + 1].effective_date if index + 1 < len(history) else None
                rules.append(TeachingRule(meeting, slot["role"], slot["class_group"], slot["day"], slot["start"],
                                          slot["end"], version.effective_date, until))
    issue = None
    if course.plan_recorded_from is None or course.plan_recorded_from > term.start_date:
        issue = "The course's semester binding could not establish historical coverage"
    if not any(r.role == "Lecture" and r.effective_date <= term.start_date and
               (r.until_date is None or term.start_date < r.until_date) for r in rules):
        issue = issue or "Timetable history does not establish a plan from the start of the semester"
    obligations = []
    try:
        obligations = teaching_obligations(term.start_date, term.end_date, rules)
    except (ValueError, TypeError):
        issue = "The timetable contains invalid or conflicting rules"
    if not obligations:
        issue = issue or "No teaching obligations are configured"
    history = db.query(TeachingPlan).filter_by(course_id=course.id).order_by(TeachingPlan.id.desc())
    latest = history.first()
    details = dict(semester_id=term.id, start=term.start_date.isoformat(), end=term.end_date.isoformat(),
                   issue=issue, occurrences=[{**asdict(row), "day": row.day.isoformat(),
                       "rule_effective_date": row.rule_effective_date.isoformat()} for row in obligations])
    if latest and latest.details["semester_id"] == term.id:
        today = campus_now().date().isoformat()
        trusted = latest if latest.details.get("issue") is None else history.filter(
            TeachingPlan.details["semester_id"].as_string() == term.id,
            TeachingPlan.details["issue"].as_string().is_(None),
        ).first()
        new_past = [row for row in details["occurrences"] if row["day"] < today]
        if trusted and [row for row in trusted.details["occurrences"] if row["day"] < today] != new_past:
            details["issue"] = issue = "The semester changes previously recorded teaching obligations"
    return obligations, issue, latest, details


def get_plan(db, course, *, publish):
    obligations, issue, latest, details = _plan_details(db, course)
    if publish and details is not None and (latest is None or latest.details != details):
        db.add(TeachingPlan(course_id=course.id, details=details))
    return obligations, issue


def assess_course(db, course, enrolments, *, semester_ended, publish=False):
    obligations, plan_issue, latest, details = _plan_details(db, course)
    term = course.semester
    sessions = db.query(ClassSession).filter_by(course_id=course.id).all() if term else []
    by_id = {row.id: row for row in sessions}
    planned = defaultdict(list)
    for row in obligations:
        date_start = datetime.fromisoformat(f"{row.day}T{row.start}") - local_offset()
        planned[(date_start, row.class_group)].append(row)
    relevant = defaultdict(list)
    issues = set()
    fulfilled = defaultdict(set)
    statuses = defaultdict(set)
    for row in sessions:
        when = row.scheduled_start or row.opened_at
        if when and not term.start_date <= campus_date(when) <= term.end_date:
            if row.replacement_for_session_id:
                root = replacement_root(row, by_id.get)
                if root and root.scheduled_start and term.start_date <= campus_date(root.scheduled_start) <= term.end_date:
                    issues.add(root.class_group)
            continue
        if row.status == "completed":
            relevant[row.class_group].append(row)
            if semester_ended and row.scheduled_end and campus_date(row.scheduled_end) > term.end_date:
                issues.add(row.class_group or "All")
                continue
        if not semester_ended and row.status != "completed" and not row.replacement_for_session_id:
            continue
        if not row.class_group:
            issues.add("All")
            continue
        root = replacement_root(row, by_id.get)
        if root is None or (root is not row and (not when or not term
                or not term.start_date <= campus_date(when) <= term.end_date)):
            issues.add(row.class_group)
            continue
        matches = [entry for entry in planned.get((root.scheduled_start, root.class_group), [])
                   if (root.meeting_id is None or entry.meeting_id == root.meeting_id)]
        if semester_ended and len(matches) == 1:
            statuses[matches[0]].add(row.status)
        if row.status != "completed" and not row.replacement_for_session_id:
            continue
        duration = scheduled_minutes(row)
        if len(matches) != 1 or duration is None or duration != scheduled_minutes(root) or duration != matches[0].minutes:
            issues.add(row.class_group)
            continue
        if row.status != "cancelled":
            fulfilled[(root.scheduled_start, root.class_group, matches[0].meeting_id)].add(row.id)
            if len(fulfilled[(root.scheduled_start, root.class_group, matches[0].meeting_id)]) > 1:
                issues.add(row.class_group)
    session_ids = [row.id for rows in relevant.values() for row in rows]
    credited = set(db.query(AttendanceRecord.student_id, AttendanceRecord.session_id).filter(
        AttendanceRecord.session_id.in_(session_ids),
        AttendanceRecord.student_id.in_({e.student_id for e in enrolments}),
        AttendanceRecord.status.in_(CREDITED_STATUSES),
    )) if session_ids else set()
    outstanding = defaultdict(lambda: defaultdict(int))
    reasons_by_group = {}
    if semester_ended:
        for obligation in obligations:
            states = statuses[obligation]
            if "completed" in states:
                continue
            reason = ("not generated" if not states else "needs attention" if "needs_attention" in states
                      else "cancelled" if states == {"cancelled"} else "not completed")
            outstanding[obligation.class_group][reason] += obligation.minutes
        groups = {o.class_group for o in obligations} | {e.class_group for e in enrolments if e.class_group}
        exceptions = []
        for group in sorted(groups - {"All"} or {"All"}):
            reasons = defaultdict(int)
            for scope in {group, "All"}:
                for reason, duration in outstanding[scope].items():
                    reasons[reason] += duration
            if reasons and not plan_issue and not {group, "All"} & issues:
                description = ", ".join(f"{r}: {n} min" for r, n in sorted(reasons.items()))
                reasons_by_group[group] = description
                exceptions.append(dict(class_group=group, outstanding_minutes=sum(reasons.values()),
                                       planned_minutes=planned_minutes(obligations, group), reason=description))
        # A complete course snapshot also records a clean close (empty list).
        # This survives restarts and covers teaching obligations without any enrolments.
        details["closeout"] = exceptions
    if publish and details is not None and (latest is None or latest.details != details):
        db.add(TeachingPlan(course_id=course.id, details=details))
    for enrolment in enrolments:
        group = enrolment.class_group
        issue = plan_issue
        if not group or group == "All":
            issue = "The student's class group is unassigned"
        elif {group, "All"} & issues:
            issue = issue or "Class duration or replacement history requires review"
        classes = list(relevant["All"]) + (relevant[group] if group != "All" else [])
        classes.sort(key=lambda row: (row.scheduled_start or row.opened_at or datetime.min, row.id))
        minutes = [scheduled_minutes(row) for row in classes]
        if None in minutes:
            yield enrolment, assess([], [], None, issue or "A completed class has no verified duration")
            continue
        sequence = [int((enrolment.student_id, row.id) in credited) for row in classes]
        yield enrolment, assess(sequence, minutes, planned_minutes(obligations, group), issue,
                                semester_ended=semester_ended, outstanding_reason=reasons_by_group.get(group))


def lock_assessment(db, course_id, *, wait=True):
    lock = func.pg_advisory_xact_lock if wait else func.pg_try_advisory_xact_lock
    if db.get_bind().dialect.name == "postgresql":
        result = db.scalar(select(lock(func.hashtextextended(str(course_id), 27191))))
        return True if wait else result
    return True


def recompute_course(db, course_id, allowed=None, pending=None):
    course = db.get(Course, course_id, populate_existing=True)
    if course is None:
        return 0
    ended = course.semester is not None and course.semester.end_date < campus_now().date()
    if ended:
        pending = None  # Publish group exceptions and all enrolled snapshots together.
    enrolments = db.query(Enrolment).filter_by(course_id=course_id).order_by(Enrolment.id).all()
    by_student = {}
    conflicting = set()
    for e in enrolments:
        if e.student_id in by_student and by_student[e.student_id].class_group != e.class_group:
            conflicting.add(e.student_id)
        by_student[e.student_id] = e
    selected = [e for e in by_student.values() if e.student_id and (allowed is None or e.student_id in allowed)
                and (pending is None or any(
                    job.student_id == e.student_id or (job.student_id is None and job.class_group in (None, "All", e.class_group))
                    for job in pending))]
    for e, result in assess_course(db, course, selected, semester_ended=ended, publish=not ended or allowed is None):
        if e.student_id in conflicting:
            result = assess([], [], None, "The student has conflicting class group allocations")
        values = dict(student_id=e.student_id, course_id=e.course_id, updated_at=utcnow(), **result)
        if db.get_bind().dialect.name == "postgresql":
            query = insert(RiskScore).values(**values)
            db.execute(query.on_conflict_do_update(constraint="uq_current_risk_score", set_={
                key: query.excluded[key] for key in values if key not in {"student_id", "course_id"}
            }))
        else:
            row = db.query(RiskScore).filter_by(student_id=e.student_id, course_id=e.course_id).first()
            if row is None:
                db.add(RiskScore(**values))
            else:
                for key, value in values.items():
                    setattr(row, key, value)
    return len(selected)


def ended_course_plans(db, today):
    latest_id = select(func.max(TeachingPlan.id)).where(TeachingPlan.course_id == Course.id).correlate(Course).scalar_subquery()
    return db.query(Course, AcademicSemester, TeachingPlan).join(
        AcademicSemester, Course.semester_id == AcademicSemester.id
    ).outerjoin(TeachingPlan, TeachingPlan.id == latest_id).filter(AcademicSemester.end_date < today)


def process_risk_updates(limit=20):
    """Consume committed events. Failed transactions keep their inputs for the next pass."""
    with SessionLocal() as db:
        candidates = db.query(RiskUpdate.course_id).group_by(RiskUpdate.course_id).order_by(
            func.min(RiskUpdate.id), RiskUpdate.course_id,
        ).all()
        due = {row[0] for row in ended_course_plans(db, campus_now().date()).with_entities(Course.id)
               .filter(TeachingPlan.details["closeout"].as_string().is_(None))}
    for course_id in dict.fromkeys(sorted(due) + [row[0] for row in candidates]):
        if limit <= 0:
            break
        with SessionLocal() as db:
            try:
                if not lock_assessment(db, course_id, wait=False):
                    continue
                events = db.query(RiskUpdate).filter_by(course_id=course_id).all()
                if events or course_id in due:
                    recompute_course(db, course_id, pending=None if course_id in due else events)
                    db.query(RiskUpdate).filter(RiskUpdate.id.in_([event.id for event in events])).delete(synchronize_session=False)
                    db.commit()
                    limit -= 1
            except Exception:
                logger.exception("At-Risk refresh failed; update remains queued")


def _model_course_ids(db):
    return [row[0] for row in db.query(RiskScore.course_id).filter(
        RiskScore.assessment_source.in_(("ML Prediction", "Model Unavailable"))).distinct()]


def queue_model_refresh(db):
    """After a model switch or rollback: queue every course with a model-dependent snapshot so the
    existing worker reassesses it with the loaded model. Rule-based snapshots never depend on the
    model. Safe to repeat: the worker folds duplicate course events into one recompute."""
    ids = _model_course_ids(db)
    db.add_all(RiskUpdate(course_id=course_id) for course_id in ids)
    return len(ids)


def stale_model_courses(db):
    """Reassess every model-dependent course with THIS process's model inside a transaction that is
    always rolled back; return the courses whose stored snapshots differ. Writes nothing."""
    stale = []
    for course_id in _model_course_ids(db):
        lock_assessment(db, course_id)

        def stored():
            return {row.student_id: (row.assessment_source, row.risk_score, row.risk_label, row.risk_factors,
                                     row.attendance_rate)
                    for row in db.query(RiskScore).filter_by(course_id=course_id).populate_existing()}
        before = stored()
        recompute_course(db, course_id)
        db.flush()
        if stored() != before:
            stale.append(course_id)
        db.rollback()
    return stale


if __name__ == "__main__":   # deploy step, see docs/03-MLModel/phase2/INTEGRATION_REPORT.md §6
    import sys

    from domain.risk_decision import _MODEL, MODEL_VERSION
    if sys.argv[1:] == []:
        with SessionLocal.begin() as session:
            print(f"Queued {queue_model_refresh(session)} course(s) for At-Risk reassessment")
    elif sys.argv[1:] == ["verify"]:
        if _MODEL is None:
            sys.exit(f"At-Risk model {MODEL_VERSION} did not load here; cannot verify")
        with SessionLocal() as session:
            stale = stale_model_courses(session)
        print(f"Model {MODEL_VERSION}: {len(stale)} course(s) with snapshots not matching this model", *stale, sep="\n")
        sys.exit(1 if stale else 0)
    else:
        sys.exit("usage: python -m domain.risk_service [verify]")

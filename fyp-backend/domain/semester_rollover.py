"""Read-only preview of carrying a semester's courses into a later one (SEMESTER-PREVIEW-06).

Nothing here writes: no commit, no flush, no audit row. The preview says what would be retained, what a new offering would copy and
what is never copied, and lists what is missing or in conflict. It never reports a plan as ready, because the model has no safe way
to do the move yet: a course belongs to exactly one semester for good (the semester save refuses to move or detach it, since that
would relabel its sessions, attendance, risk scores and enrolments), and no copy step exists. `fingerprint` describes the source data
the preview looked at, so a later explicit apply can refuse a plan whose source has since changed.
"""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import AcademicSemester, ClassMeeting, Course, CourseStaffAssignment, Enrolment, Lecturer, Programme, Student, User
from domain import semesters
from domain.semesters import semester_dict

LIMITATION = ("A course cannot be moved into another semester: it keeps its own classes, attendance, risk scores and students, so relabelling it would "
              "rewrite history. Carrying a course forward needs a separate new course offering, and there is no copy step yet, so this plan cannot be applied.")
RETAINED = ["The course, its classes, attendance, risk scores and student enrolments stay in the source semester, unchanged.",
            "Course notices already delivered stay delivered; students the admin keeps enrolled in the old course keep receiving its notices."]
NEVER_COPIED = ["Student logins and face data", "Old attendance records and risk scores", "Delivered notices", "Past class sessions"]
STAFF_ROLES = ("Tutor", "Practical")


def _semester(db: Session, semester_id: str, label: str) -> AcademicSemester:
    row = db.get(AcademicSemester, str(semester_id))
    if row is None:
        raise HTTPException(404, f"The {label} semester was not found.")
    return row


def _brief(db: Session, semester: AcademicSemester) -> dict:
    programme = db.get(Programme, semester.programme_id)
    return {**semester_dict(semester), "programme": {"code": programme.code, "name": programme.name} if programme else None}


def build_preview(db: Session, source_id: str, target_id: str, course_ids=None) -> dict:
    source, target = _semester(db, source_id, "source"), _semester(db, target_id, "target")
    today = semesters.campus_now().date()
    blocking, warnings = [], []
    if source.id == target.id:
        blocking.append("Choose a different target semester.")
    if source.programme_id != target.programme_id:
        blocking.append("The source and target semesters belong to different programmes.")
    if target.end_date < today:
        blocking.append("The target semester has already ended.")
    elif target.start_date <= source.end_date and source.id != target.id and source.programme_id == target.programme_id:
        blocking.append("The target semester starts before the source semester ends.")
    if source.start_date > today:
        warnings.append("The source semester has not started, so there is nothing to carry forward yet.")
    if target.start_date <= today <= target.end_date:
        warnings.append("The target semester has already started.")

    source_courses = {c.id: c for c in db.query(Course).filter(Course.semester_id == source.id).order_by(Course.course_code).all()}
    target_names = {(c.course_name or "").strip().lower() for c in db.query(Course).filter(Course.semester_id == target.id)}
    chosen, not_included, duplicates = [], [], 0
    if course_ids is None:
        chosen = list(source_courses)
    else:
        seen = set()
        for value in course_ids:
            value = str(value)
            if value in seen:
                duplicates += 1
            elif value in source_courses:
                chosen.append(value)
            else:
                known = db.get(Course, value)
                not_included.append({"course_id": value, "course_code": known.course_code if known else None,
                                     "reason": "Not in the source semester." if known else "Course not found."})
            seen.add(value)
    if duplicates:
        warnings.append(f"{duplicates} duplicate selection{'s' if duplicates != 1 else ''} ignored.")
    if not chosen:
        blocking.append("No courses are selected from the source semester.")

    assignments = {}
    for assignment in db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id.in_(chosen)).all() if chosen else []:
        assignments.setdefault(assignment.course_id, []).append(assignment)
    enrolments = {}
    for enrolment in db.query(Enrolment).filter(Enrolment.course_id.in_(chosen)).all() if chosen else []:
        enrolments.setdefault(enrolment.course_id, []).append(enrolment)
    meetings = {}
    for meeting in db.query(ClassMeeting).filter(ClassMeeting.course_id.in_(chosen)).all() if chosen else []:
        meetings.setdefault(meeting.course_id, []).append(meeting)
    staff_ids = {source_courses[c].lecturer_id for c in chosen} | {a.lecturer_id for rows in assignments.values() for a in rows}
    staff = {s.id: s for s in db.query(Lecturer).filter(Lecturer.id.in_([i for i in staff_ids if i]))}
    accounts = {u.id: u for u in db.query(User).filter(User.id.in_([s.user_id for s in staff.values() if s.user_id])).all()}
    students = {s.id: s for s in db.query(Student).filter(Student.id.in_({e.student_id for rows in enrolments.values() for e in rows}))} if enrolments else {}
    student_accounts = {u.id: u for u in db.query(User).filter(User.id.in_([s.user_id for s in students.values() if s.user_id])).all()} if students else {}

    def active(lecturer):
        account = accounts.get(lecturer.user_id) if lecturer and lecturer.user_id else None
        return bool(account and account.status == "Active")

    rows, fingerprint_data = [], []
    for course_id in chosen:
        course = source_courses[course_id]
        owner = staff.get(course.lecturer_id)
        assigned = assignments.get(course_id, [])
        enrolled = enrolments.get(course_id, [])
        slots = meetings.get(course_id, [])
        issues = []
        if owner is None:
            issues.append("No lecturer is set for this course.")
        elif not active(owner):
            issues.append(f"The lecturer {owner.name} has no active account.")
        for role in STAFF_ROLES:
            if any(m.role == role for m in slots) and not any(a.role == role for a in assigned):
                issues.append(f"There are {role.lower()} classes but no {role.lower()} is assigned.")
        for a in assigned:
            if not active(staff.get(a.lecturer_id)):
                issues.append(f"The {a.role.lower()} {staff[a.lecturer_id].name if a.lecturer_id in staff else 'unknown'} has no active account.")
        counts = {}
        for e in enrolled:
            counts[(e.class_group or "").strip()] = counts.get((e.class_group or "").strip(), 0) + 1
        unassigned = counts.pop("", 0)
        for group in sorted({m.class_group for m in slots if m.class_group}):
            if not counts.get(group):
                issues.append(f"Group {group} has classes but no students.")
        if not enrolled:
            issues.append("No students are enrolled.")
        if unassigned:
            issues.append(f"{unassigned} student{'s have' if unassigned != 1 else ' has'} no class group.")
        if (course.course_name or "").strip().lower() in target_names:
            issues.append("The target semester already has a course with this name.")
        eligible = sum(1 for e in enrolled if (s := students.get(e.student_id)) and (a := student_accounts.get(s.user_id)) and a.status == "Active")
        rows.append({
            "course_id": course.id, "course_code": course.course_code, "course_name": course.course_name, "credit_hours": course.credit_hours,
            "lecturer": {"name": owner.name, "active": active(owner)} if owner else None,
            "staff": [{"name": staff[a.lecturer_id].name if a.lecturer_id in staff else "Unknown", "role": a.role, "active": active(staff.get(a.lecturer_id))} for a in assigned],
            "groups": [{"group": g, "students": n} for g, n in sorted(counts.items())], "students": len(enrolled), "unassigned_students": unassigned,
            "students_eligible": eligible, "students_without_active_account": len(enrolled) - eligible,
            "would_copy": {"staff": len(assigned) + (1 if owner else 0), "groups": len(counts)},
            "issues": issues, "status": "needs_attention" if issues else "clear",
        })
        fingerprint_data.append([course_id, course.lecturer_id, course.course_name, sorted((a.id, a.lecturer_id, a.role) for a in assigned),
                                 sorted((e.student_id, e.class_group or "") for e in enrolled), sorted((m.id, m.role, m.class_group or "") for m in slots)])
    fingerprint = hashlib.sha256(json.dumps([source.id, str(source.start_date), str(source.end_date), target.id, str(target.start_date), str(target.end_date),
                                             sorted(target_names), sorted(fingerprint_data)], sort_keys=True, default=str).encode()).hexdigest()
    return {
        "source": _brief(db, source), "target": _brief(db, target),
        "ready": False, "limitation": LIMITATION, "blocking": blocking, "warnings": warnings,
        "retained": RETAINED, "never_copied": NEVER_COPIED, "fingerprint": fingerprint,
        "totals": {"source_courses": len(source_courses), "selected": len(chosen), "needing_attention": sum(1 for r in rows if r["issues"]),
                   "students": sum(r["students"] for r in rows)},
        "courses": rows, "not_included": not_included,
    }

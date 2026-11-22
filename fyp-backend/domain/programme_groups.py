"""Tutorial groups that follow a programme's students from one semester to the next (GROUP-ROLLOVER-01).

A student's group in a semester is their recorded semester_group_members row, or else the one group all their course enrolments in that
semester agree on. When those enrolments disagree the student is flagged for review; nothing guesses. Carrying groups forward writes group
membership only: it never enrols anyone in a course, so a new semester with different subjects keeps classmates together without copying the
old subjects. Every write takes the programme lock first, the same lock course allocation uses, so two people filling the last seat of a
group at the same time cannot overfill it. A semester that has ended is read-only, so its roster and attendance stay as they were.
"""
import re
from collections import Counter

from fastapi import HTTPException
from sqlalchemy import true
from sqlalchemy.orm import Session

from db.models import AcademicSemester, Course, CourseStaffAssignment, Enrolment, Programme, SemesterGroupMember, Student, User
from domain.audit import log_admin_action
from domain.scheduler import add_missing_meetings, groups_for_course
from domain import semesters
from domain.semesters import lock_programme, run_transaction, semester_dict

CAPACITY = 25
NOTE = "Only group membership is saved. No course enrolment is created or changed."
_GROUP = re.compile(r"G([1-9][0-9]{0,2})")


def group_order(name):
    match = _GROUP.fullmatch(name or "")
    return (0, int(match[1]), "") if match else (1, 0, name or "")


def valid_group(name) -> str:
    name = (name or "").strip().upper()
    if not _GROUP.fullmatch(name):
        raise HTTPException(400, "A group is named G followed by a number, like G1.")
    return name


def semester_or_404(db: Session, semester_id, label="The") -> AcademicSemester:
    row = db.get(AcademicSemester, str(semester_id))
    if row is None:
        raise HTTPException(404, f"{label} semester was not found.")
    return row


def ended(semester) -> bool:
    return semesters.campus_now().date() > semester.end_date


def require_open(semester):
    if ended(semester):
        raise HTTPException(400, f"{semester.name} has ended, so its groups are kept as they were.")


def memberships(db: Session, semester) -> tuple[dict, dict]:
    """({student_id: group}, {student_id: [groups their enrolments disagree on]}) for one semester."""
    recorded = dict(db.query(SemesterGroupMember.student_id, SemesterGroupMember.class_group)
                    .filter(SemesterGroupMember.semester_id == semester.id).all())
    seen = {}
    for student_id, group in (db.query(Enrolment.student_id, Enrolment.class_group).join(Course, Course.id == Enrolment.course_id)
                              .filter(Course.semester_id == semester.id).all()):
        if student_id not in recorded and group:
            seen.setdefault(student_id, set()).add(group)
    derived = {sid: next(iter(groups)) for sid, groups in seen.items() if len(groups) == 1}
    conflicts = {sid: sorted(groups, key=group_order) for sid, groups in seen.items() if len(groups) > 1}
    return {**derived, **recorded}, conflicts


def _brief(db: Session, semester) -> dict:
    programme = db.get(Programme, semester.programme_id)
    return {**semester_dict(semester), "programme": {"code": programme.code, "name": programme.name} if programme else None}


def _person(student) -> dict:
    return {"student_id": student.id, "student_code": student.student_code, "name": student.name}


def build_group_preview(db: Session, source_id, target_id) -> dict:
    """Read-only plan for the target semester's groups. Deterministic: the same records always give the same plan."""
    source, target = semester_or_404(db, source_id, "The source"), semester_or_404(db, target_id, "The target")
    blocking = []
    if source.id == target.id:
        blocking.append("Choose a different target semester.")
    if source.programme_id != target.programme_id:
        blocking.append("The source and target semesters belong to different programmes.")
    if ended(target):
        blocking.append("The target semester has already ended.")
    result = {"source": _brief(db, source), "target": _brief(db, target), "blocking": blocking, "capacity": CAPACITY, "note": NOTE,
              "groups": [], "proposals": [], "already_placed": [], "review": []}
    if blocking:
        return result

    students = {s.id: (s, status) for s, status in db.query(Student, User.status).outerjoin(User, User.id == Student.user_id)
                .filter(Student.programme_id == target.programme_id).all()}
    source_groups, source_conflicts = memberships(db, source)
    target_groups, target_conflicts = memberships(db, target)
    for sid in source_groups.keys() | source_conflicts.keys():
        if sid not in students and (student := db.get(Student, sid)) is not None:
            students[sid] = (student, None)
    occupancy = Counter(target_groups.values())
    before = Counter(occupancy)
    review, proposals = [], []

    def add_review(sid, reason):
        review.append({**_person(students[sid][0]), "reason": reason})

    for sid, group in sorted(target_groups.items(), key=lambda item: (group_order(item[1]), students[item[0]][0].student_code if item[0] in students else "")):
        if sid in students:
            result["already_placed"].append({**_person(students[sid][0]), "class_group": group})
    for sid, groups in sorted(target_conflicts.items(), key=lambda item: students[item[0]][0].student_code if item[0] in students else ""):
        if sid in students:
            add_review(sid, f"Their courses in {target.name} are in different groups ({', '.join(groups)}).")

    returning = {}
    for sid, groups in source_conflicts.items():
        if sid not in target_groups and sid not in target_conflicts:
            add_review(sid, f"Their courses in {source.name} were in different groups ({', '.join(groups)}).")
    for sid, group in source_groups.items():
        if sid in target_groups or sid in target_conflicts or sid not in students:
            continue
        student, status = students[sid]
        if student.programme_id != target.programme_id:
            add_review(sid, "No longer in this programme.")
        elif (status or "Active") != "Active":
            add_review(sid, "The account is not active.")
        else:
            returning.setdefault(group, []).append(student)
    for group in sorted(returning, key=group_order):
        members = sorted(returning[group], key=lambda s: s.student_code)
        free = CAPACITY - occupancy[group]
        if len(members) > free:
            for student in members:
                add_review(student.id, f"Group {group} has {len(members)} returning students but only {max(free, 0)} seat{'s' if free != 1 else ''} left; "
                                        "place them by hand or make room.")
            continue
        for student in members:
            proposals.append({**_person(student), "class_group": group, "reason": "returning"})
        occupancy[group] += len(members)

    # New students: in the programme, with no group or course in any other semester of it, and not yet placed here.
    other_semesters = [sid for (sid,) in db.query(AcademicSemester.id).filter(AcademicSemester.programme_id == target.programme_id,
                                                                              AcademicSemester.id != target.id).all()]
    history = {sid for (sid,) in db.query(SemesterGroupMember.student_id).filter(SemesterGroupMember.semester_id.in_(other_semesters)).all()} if other_semesters else set()
    if other_semesters:
        history |= {sid for (sid,) in db.query(Enrolment.student_id).join(Course, Course.id == Enrolment.course_id)
                    .filter(Course.semester_id.in_(other_semesters)).all()}
    handled = target_groups.keys() | target_conflicts.keys() | source_groups.keys() | source_conflicts.keys()
    for sid, (student, status) in sorted(students.items(), key=lambda item: item[1][0].student_code):
        if sid in handled or (status or "Active") != "Active":
            continue
        if sid in history:
            add_review(sid, f"Not in {source.name}; place by hand.")
            continue
        open_groups = sorted(occupancy, key=group_order)
        group = next((g for g in open_groups if occupancy[g] < CAPACITY), None)
        if group is None:
            numbers = [group_order(g)[1] for g in open_groups if group_order(g)[0] == 0]
            group = f"G{max(numbers, default=0) + 1}"
        proposals.append({**_person(student), "class_group": group, "reason": "new"})
        occupancy[group] += 1

    for group in sorted(occupancy, key=group_order):
        result["groups"].append({"group": group, "already": before[group],
                                 "returning": sum(1 for p in proposals if p["class_group"] == group and p["reason"] == "returning"),
                                 "new": sum(1 for p in proposals if p["class_group"] == group and p["reason"] == "new"),
                                 "total": occupancy[group]})
    result["proposals"], result["review"] = proposals, review
    return result


def apply_group_plan(db: Session, user, target_id, rows) -> dict:
    """Save the confirmed plan exactly: each student into the group shown, never anyone already placed (so a retry or a reopened preview
    changes nothing), never past the capacity at the moment of saving."""
    target = semester_or_404(db, target_id, "The target")
    require_open(target)
    wanted = {}
    for row in rows:
        wanted.setdefault(str(row["student_id"]), valid_group(row["class_group"]))

    def work():
        lock_programme(db, target.programme_id)
        placed, conflicts = memberships(db, target)
        counts = Counter(placed.values())
        saved, already, skipped = [], 0, []
        for sid, group in wanted.items():
            student = db.get(Student, sid)
            if student is None or student.programme_id != target.programme_id:
                skipped.append({"student_id": sid, "reason": "Not in this programme."})
            elif sid in placed:
                if placed[sid] == group:
                    already += 1
                else:
                    skipped.append({**_person(student), "reason": f"Already in {placed[sid]}; not moved."})
            elif sid in conflicts:
                skipped.append({**_person(student), "reason": "Their courses are in different groups; review first."})
            elif counts[group] >= CAPACITY:
                skipped.append({**_person(student), "reason": f"{group} is full ({CAPACITY} seats)."})
            else:
                db.add(SemesterGroupMember(semester_id=target.id, student_id=sid, class_group=group, source="rollover"))
                counts[group] += 1
                placed[sid] = group
                saved.append({**_person(student), "class_group": group})
        if saved:
            log_admin_action(db, user, "CARRY_GROUPS", f"Placed {len(saved)} students in groups for {target.name}", commit=False)
        return {"saved": len(saved), "already": already, "skipped": skipped, "placed": saved}
    return run_transaction(db, work)


def roster(db: Session, semester) -> dict:
    """The semester's groups with their members, who needs review, and which of the programme's students have no group yet."""
    placed, conflicts = memberships(db, semester)
    recorded = {sid for (sid,) in db.query(SemesterGroupMember.student_id).filter(SemesterGroupMember.semester_id == semester.id).all()}
    ids = placed.keys() | conflicts.keys()
    people = {s.id: s for s in db.query(Student).filter(Student.id.in_(ids)).all()} if ids else {}
    groups = {}
    for sid, group in placed.items():
        if sid in people:
            groups.setdefault(group, []).append({**_person(people[sid]), "recorded": sid in recorded})
    # shortcut: lists the first 200 unplaced students only, page it if a programme ever has more waiting.
    unplaced = (db.query(Student).filter(Student.programme_id == semester.programme_id, Student.id.notin_(ids) if ids else true())
                .order_by(Student.student_code).limit(200).all())
    return {"semester": _brief(db, semester), "capacity": CAPACITY, "read_only": ended(semester),
            "groups": [{"group": g, "count": len(groups[g]), "members": sorted(groups[g], key=lambda p: p["student_code"])}
                       for g in sorted(groups, key=group_order)],
            "review": [{**_person(people[sid]), "groups": groups_seen} for sid, groups_seen in sorted(conflicts.items()) if sid in people],
            "unplaced": [_person(s) for s in unplaced]}


def _semester_enrolments(db: Session, semester, student_id):
    return (db.query(Enrolment, Course).join(Course, Course.id == Enrolment.course_id)
            .filter(Enrolment.student_id == student_id, Course.semester_id == semester.id).order_by(Course.course_code).all())


def _set_course_group(db: Session, enrolment, course, group, may_open=True):
    """Move one enrolment to another group of its course; the enrolment row (and every attendance record) stays."""
    if enrolment.class_group == group:
        return
    taken = db.query(Enrolment.id).filter(Enrolment.course_id == course.id, Enrolment.class_group == group, Enrolment.id != enrolment.id).count()
    if taken >= CAPACITY:
        raise HTTPException(409, f"{course.course_code} group {group} is full ({CAPACITY} seats).")
    first = group not in groups_for_course(db, course.id)
    if first and not may_open:
        raise HTTPException(403, f"{course.course_code} has no group {group} yet; only an administrator can open a new group.")
    enrolment.class_group = group
    if first:
        db.flush()
        try:
            add_missing_meetings(db, course.id, db.query(CourseStaffAssignment).filter(CourseStaffAssignment.course_id == course.id).all(), [group])
        except ValueError as error:
            raise HTTPException(400, str(error)) from error


def move_programme_group(db: Session, user, semester_id, student_id, group, dry_run=False) -> dict:
    """Put a student in a programme group for one semester (add or move). Their course enrolments that followed the old group move
    with them; a course where they were deliberately in another group stays as it is. Enrolments and attendance are never removed."""
    semester = semester_or_404(db, semester_id)
    group = valid_group(group)
    require_open(semester)

    def work():
        lock_programme(db, semester.programme_id)
        student = db.get(Student, str(student_id))
        if student is None or student.programme_id != semester.programme_id:
            raise HTTPException(400, "This student is not in the semester's programme.")
        placed, conflicts = memberships(db, semester)
        old = placed.get(student.id)
        members = sum(1 for sid, g in placed.items() if g == group and sid != student.id)
        if old != group and members >= CAPACITY:
            raise HTTPException(409, f"Group {group} is full ({CAPACITY} seats).")
        enrolled = _semester_enrolments(db, semester, student.id)
        follows = [(e, c) for e, c in enrolled if old is not None and e.class_group == old]
        stays = [(e, c) for e, c in enrolled if (e, c) not in follows]
        effect = {"scope": "programme", "student": _person(student), "from": old, "to": group,
                  "courses_moving": [c.course_code for _, c in follows], "courses_unchanged": [c.course_code for _, c in stays],
                  "review": conflicts.get(student.id)}
        if dry_run or old == group:
            db.rollback()
            return {**effect, "saved": False}
        row = db.query(SemesterGroupMember).filter_by(semester_id=semester.id, student_id=student.id).first()
        if row is None:
            db.add(SemesterGroupMember(semester_id=semester.id, student_id=student.id, class_group=group, source="manual"))
        else:
            row.class_group, row.source = group, "manual"
        for enrolment, course in follows:
            _set_course_group(db, enrolment, course, group)
        log_admin_action(db, user, "MOVE_PROGRAMME_GROUP", f"{student.student_code} in {semester.name}: {old or 'no group'} -> {group}"
                         f"{' (courses: ' + ', '.join(effect['courses_moving']) + ')' if follows else ''}", commit=False)
        return {**effect, "saved": True}
    return run_transaction(db, work)


def remove_programme_group(db: Session, user, semester_id, student_id) -> dict:
    """Take a student out of their recorded programme group. Course enrolments and attendance are untouched."""
    semester = semester_or_404(db, semester_id)
    require_open(semester)

    def work():
        lock_programme(db, semester.programme_id)
        row = db.query(SemesterGroupMember).filter_by(semester_id=semester.id, student_id=str(student_id)).first()
        if row is None:
            raise HTTPException(404, "This student has no recorded group in this semester; their course enrolments decide it.")
        student = db.get(Student, row.student_id)
        db.delete(row)
        log_admin_action(db, user, "REMOVE_PROGRAMME_GROUP", f"{student.student_code if student else row.student_id} left {row.class_group} in {semester.name}", commit=False)
        return {"removed": True, "class_group": row.class_group}
    return run_transaction(db, work)


def move_course_group(db: Session, user, enrolment_id, group, dry_run=False, allowed_course_ids=None) -> dict:
    """Move one course enrolment to another group of that course. allowed_course_ids (a lecturer's own courses) limits who may do it."""
    group = valid_group(group)
    probe = db.get(Enrolment, str(enrolment_id))
    if probe is None:
        raise HTTPException(404, "Enrolment not found")
    course = db.get(Course, probe.course_id)
    if allowed_course_ids is not None and course.id not in set(allowed_course_ids):
        raise HTTPException(403, "You can only change groups in courses you teach.")
    if course.semester is not None:
        require_open(course.semester)

    def work():
        lock_programme(db, course.programme_id)
        enrolment = db.query(Enrolment).filter_by(id=probe.id).with_for_update().populate_existing().one()
        student = db.get(Student, enrolment.student_id)
        programme_group = None
        if course.semester_id:
            programme_group = (db.query(SemesterGroupMember.class_group)
                               .filter_by(semester_id=course.semester_id, student_id=enrolment.student_id).scalar())
        effect = {"scope": "course", "student": _person(student), "course_code": course.course_code, "from": enrolment.class_group,
                  "to": group, "programme_group": programme_group}
        if dry_run or enrolment.class_group == group:
            db.rollback()
            return {**effect, "saved": False}
        old = enrolment.class_group
        _set_course_group(db, enrolment, course, group, may_open=allowed_course_ids is None)
        log_admin_action(db, user, "MOVE_COURSE_GROUP", f"{student.student_code} in {course.course_code}: {old} -> {group}", commit=False)
        return {**effect, "saved": True}
    return run_transaction(db, work)

import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from db.models import Course, CourseStaffAssignment, ClassMeeting, Enrolment
from utils.timeutil import local_offset

# ---------------------------------------------------------------------------
# Timetable = the class_meetings table (single source of truth).
#
# calculate_schedule() simply reads that table and rebuilds the dict shape the
# rest of the app already expects: { meeting_key: {day,start,end,room} }.
# All ~20 call sites are unchanged.
#
# The deterministic slot generator (fixed seed 42) is kept as
# generate_clashfree_slots() — used ONLY to seed the table initially and to pick
# a clash-free slot for a newly created course/assignment. It never runs on a
# normal read anymore.
# ---------------------------------------------------------------------------

DAYS  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
TIMES = [
    ("08:00", "10:00"), ("10:00", "12:00"), ("12:00", "14:00"),
    ("14:00", "16:00"), ("16:00", "18:00"), ("18:00", "20:00"),
    ("20:00", "22:00"),
]
ROOMS = ["Theatre 1", "Theatre 2", "Lab 1", "Lab 2", "Lab 3", "Seminar Room 1", "Seminar Room 2"]


def _hhmm_to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


# The teaching day, derived from TIMES so a manual edit cannot land outside the
# range the generator uses and the timetable grid draws.
DAY_START_MIN = _hhmm_to_min(TIMES[0][0])
DAY_END_MIN = _hhmm_to_min(TIMES[-1][1])


def meeting_key_for(role: str, course_id, assignment_id, class_group=None) -> str:
    """The lookup key callers build: "Lecture-<course_id>" for a course lecture,
    "<role>-<assignment_id>-<class_group>" for a Tutor/Practical staff assignment.

    A lecture is one meeting for the whole course, so it carries no group. Tutorials
    and practicals run once per group, so the group is part of their identity — without
    it two groups of the same assignment collide, which the unique meeting_key rejects
    on insert and, worse, silently overwrites in the schedule dict.
    """
    if role == "Lecture":
        return f"Lecture-{course_id}"
    return f"{role}-{assignment_id}-{class_group}"


def calculate_schedule(db: Session) -> dict:
    """Return { meeting_key: {day,start,end,room,role,course_id,assignment_id,class_group} }
    read from class_meetings.

    The key is DERIVED from the row's foreign keys, not read from the stored
    meeting_key column. The UUID migration left the seeded rows with pre-migration
    integer keys ("Lecture-8") while course_id/assignment_id were correctly
    converted, so every f"Lecture-{course.id}" lookup missed and the whole
    timetable came back empty. Deriving the key keeps this correct even if the
    stored column drifts again.

    The identifying fields ride along in each value so callers that need every group
    of one assignment can filter on them instead of parsing the key back apart.
    """
    rows = db.query(ClassMeeting).all()
    return {
        meeting_key_for(r.role, r.course_id, r.assignment_id, r.class_group): {
            "day": r.day, "start": r.start, "end": r.end, "room": r.room,
            "role": r.role, "course_id": r.course_id,
            "assignment_id": r.assignment_id, "class_group": r.class_group,
        }
        for r in rows
    }


def lecture_meetings(db: Session, course_ids) -> dict:
    """{course_id: the course's Lecture meeting} for these courses, in one query.

    Four handlers built this same map to answer "when is this course's lecture?", which
    is also why the answer has to come from class_meetings rather than the course row.
    """
    if not course_ids:
        return {}
    return {
        m.course_id: m for m in db.query(ClassMeeting).filter(
            ClassMeeting.role == "Lecture", ClassMeeting.course_id.in_(list(course_ids))
        ).all()
    }


def slots_for_assignment(schedule_map: dict, assignment_id) -> list:
    """Every group's slot for one Tutor/Practical assignment, group order stable.

    A tutorial assignment now has one meeting per group, so anything that used to
    look up a single key needs the whole set.
    """
    return sorted(
        (s for s in schedule_map.values() if s.get("assignment_id") == assignment_id),
        key=lambda s: (s.get("class_group") or ""),
    )


def get_course_group_slots(db: Session, course_id: str, class_group: str) -> list:
    """The timetabled slots a session for this course and group may run in.

    "All" means the whole course is invited, which is the lecture. Any other value names
    one group, whose slots are its own tutorial and practical — and ONLY its own. That
    filter is the fix: returning every group's tutorial let a student satisfy the time
    check using another group's slot, and left the window calculation taking whichever
    tutorial the database happened to list first.
    """
    slots = calculate_schedule(db).values()
    if class_group == "All":
        return [s for s in slots if s["course_id"] == course_id and s["role"] == "Lecture"]
    return [
        s for s in slots
        if s["course_id"] == course_id and s["class_group"] == class_group
    ]


def slot_on_day(slots: list, local_date) -> dict | None:
    """The slot that falls on this date's weekday, or None.

    A group can hold both a tutorial and a practical, so "which slot is this session?"
    is answered by the day it opened on — not by whichever row the database returned
    first, which is what the old slots[0] amounted to. Where two slots share a weekday
    the later-ending one wins, so the window covers the whole booking.
    """
    weekday = local_date.strftime("%A").lower()
    same_day = [s for s in slots if (s.get("day") or "").lower() == weekday]
    return max(same_day, key=lambda s: s["end"]) if same_day else None


def session_window_utc(session, slots: list) -> tuple:
    """(start, end) of this session's timetabled class, as naive UTC.

    With no slot for the day, start is None and end falls back to two hours after the
    session opened — the default the check-in guard has always applied to an
    unscheduled session. Callers that need a start in that case decide their own rule.
    """
    offset = local_offset()
    opened_local = session.opened_at + offset
    slot = slot_on_day(slots, opened_local.date())
    if not slot:
        return None, session.opened_at + timedelta(hours=2)
    on_date = lambda hhmm: datetime.combine(
        opened_local.date(), datetime.strptime(hhmm, "%H:%M").time()) - offset
    return on_date(slot["start"]), on_date(slot["end"])


def session_end_utc(session, slots: list) -> datetime:
    """When this session's class is timetabled to finish, as naive UTC."""
    return session_window_utc(session, slots)[1]


def _all_slots():
    return [
        {"day": day, "start": t[0], "end": t[1], "room": room}
        for day in DAYS for t in TIMES for room in ROOMS
    ]


def groups_for_course(db: Session, course_id) -> list:
    """The class groups actually enrolled on a course, sorted.

    Enrolments are the only place the group dimension lives — staff assignments have
    no group column — so this is what decides how many tutorial meetings a course needs.
    """
    rows = db.query(Enrolment.class_group).filter(
        Enrolment.course_id == course_id
    ).distinct().all()
    return sorted({g for (g,) in rows if g})


def _desired_meetings(db: Session):
    """The meetings that SHOULD exist, derived from courses + staff assignments.
    Ordered by id for stability — must match the old algorithm's ordering so the
    seed reproduces the exact same allocation as the pre-migration schedule.

    A lecture is one meeting for the whole course. A tutorial or practical is one
    meeting PER enrolled group: those groups meet at different times, and a single
    row cannot express two schedules."""
    meetings = []
    for c in db.query(Course).order_by(Course.id).all():
        meetings.append({
            "meeting_key": meeting_key_for("Lecture", c.id, None), "course_id": c.id,
            "assignment_id": None, "role": "Lecture", "lecturer_id": c.lecturer_id,
            "class_group": None,
        })
    for a in db.query(CourseStaffAssignment).order_by(CourseStaffAssignment.id).all():
        if a.role in ("Tutor", "Practical"):
            for group in groups_for_course(db, a.course_id):
                meetings.append({
                    "meeting_key": meeting_key_for(a.role, a.course_id, a.id, group),
                    "course_id": a.course_id, "assignment_id": a.id, "role": a.role,
                    "lecturer_id": a.lecturer_id, "class_group": group,
                })
    return meetings


def _greedy_allocate(meetings, occupied_rooms, occupied_lecturers, occupied_courses, slots):
    """Assign each meeting the first slot that clashes with nothing. Mutates the
    occupied sets. Returns {meeting_key: slot}. Raises ValueError if full."""
    allocated = {}
    for m in meetings:
        lecturer_id, course_id = m["lecturer_id"], m["course_id"]
        placed = False
        for slot in slots:
            day, time, room = slot["day"], (slot["start"], slot["end"]), slot["room"]
            if (day, time, room) in occupied_rooms:                       continue
            if lecturer_id and (day, time, lecturer_id) in occupied_lecturers: continue
            if (day, time, course_id) in occupied_courses:                continue
            allocated[m["meeting_key"]] = slot
            occupied_rooms.add((day, time, room))
            if lecturer_id:
                occupied_lecturers.add((day, time, lecturer_id))
            occupied_courses.add((day, time, course_id))
            placed = True
            break
        if not placed:
            raise ValueError(
                f"Academic schedule slots are fully booked. No clash-free slot "
                f"available for {m['role']} (course {course_id})."
            )
    return allocated


def generate_clashfree_slots(db: Session) -> list:
    """Deterministically assign a clash-free slot to EVERY desired meeting
    (seed 42). Returns a list of dicts ready to insert as ClassMeeting rows.
    Used only for initial seeding — reproduces the legacy schedule exactly."""
    meetings = _desired_meetings(db)
    slots = _all_slots()
    random.Random(42).shuffle(slots)
    allocated = _greedy_allocate(meetings, set(), set(), set(), slots)
    return [{**m, **allocated[m["meeting_key"]]} for m in meetings]


def pick_slot_for_new(db: Session, course_id: str, lecturer_id, role: str) -> dict:
    """Pick one clash-free slot for a single new meeting, against the slots
    already taken by existing class_meetings rows. Raises ValueError if full."""
    occupied_rooms, occupied_lecturers, occupied_courses = set(), set(), set()
    for r in db.query(ClassMeeting).all():
        t = (r.start, r.end)
        occupied_rooms.add((r.day, t, r.room))
        if r.lecturer_id:
            occupied_lecturers.add((r.day, t, r.lecturer_id))
        occupied_courses.add((r.day, t, r.course_id))
    slots = _all_slots()
    random.Random(42).shuffle(slots)
    allocated = _greedy_allocate(
        [{"meeting_key": "new", "course_id": course_id, "lecturer_id": lecturer_id, "role": role}],
        occupied_rooms, occupied_lecturers, occupied_courses, slots,
    )
    return allocated["new"]

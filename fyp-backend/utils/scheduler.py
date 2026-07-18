import random
from sqlalchemy.orm import Session
from utils.models import Course, CourseStaffAssignment, ClassMeeting

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


def calculate_schedule(db: Session) -> dict:
    """Return { meeting_key: {day,start,end,room} } read from class_meetings."""
    rows = db.query(ClassMeeting).all()
    return {
        r.meeting_key: {"day": r.day, "start": r.start, "end": r.end, "room": r.room}
        for r in rows
    }


def _all_slots():
    return [
        {"day": day, "start": t[0], "end": t[1], "room": room}
        for day in DAYS for t in TIMES for room in ROOMS
    ]


def _desired_meetings(db: Session):
    """The meetings that SHOULD exist, derived from courses + staff assignments.
    Ordered by id for stability — must match the old algorithm's ordering so the
    seed reproduces the exact same allocation as the pre-migration schedule."""
    meetings = []
    for c in db.query(Course).order_by(Course.id).all():
        meetings.append({
            "meeting_key": f"Lecture-{c.id}", "course_id": c.id,
            "assignment_id": None, "role": "Lecture", "lecturer_id": c.lecturer_id,
        })
    for a in db.query(CourseStaffAssignment).order_by(CourseStaffAssignment.id).all():
        if a.role in ("Tutor", "Practical"):
            meetings.append({
                "meeting_key": f"{a.role}-{a.id}", "course_id": a.course_id,
                "assignment_id": a.id, "role": a.role, "lecturer_id": a.lecturer_id,
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


def pick_slot_for_new(db: Session, course_id: int, lecturer_id, role: str) -> dict:
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

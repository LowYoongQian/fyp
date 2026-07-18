import random
import threading
from sqlalchemy.orm import Session
from utils.models import Course, CourseStaffAssignment

# ---------------------------------------------------------------------------
# In-process schedule cache
#
# calculate_schedule() runs a full scheduling algorithm (DB fetch + nested
# loop over all slots) and was previously called on every incoming request
# from 5 different routers.  That means a page load that calls 3 endpoints
# ran the algorithm 3 times — fetching all courses and assignments from the
# DB each time.
#
# The schedule is deterministic (fixed seed 42) and only changes when courses
# or assignments are created/updated/deleted.  We cache the result in memory
# and expose invalidate_schedule_cache() so any write endpoint can clear it.
# ---------------------------------------------------------------------------

_cache_lock   = threading.Lock()
_cached_map   = None   # dict or None
_cache_course_count     = None
_cache_assignment_count = None


def invalidate_schedule_cache():
    """Call this after any course or assignment create/update/delete."""
    global _cached_map, _cache_course_count, _cache_assignment_count
    with _cache_lock:
        _cached_map = None
        _cache_course_count = None
        _cache_assignment_count = None


def calculate_schedule(db: Session) -> dict:
    """Return the cached schedule map, recomputing only when the DB has changed.

    Cache validity is checked by comparing the current row counts for courses
    and staff assignments against the counts when the cache was last built.
    This is a lightweight O(1) check (two COUNT queries) vs. the full O(N×S)
    scheduling algorithm.
    """
    global _cached_map, _cache_course_count, _cache_assignment_count

    current_courses     = db.query(Course).count()
    current_assignments = db.query(CourseStaffAssignment).count()

    with _cache_lock:
        if (
            _cached_map is not None
            and _cache_course_count     == current_courses
            and _cache_assignment_count == current_assignments
        ):
            return _cached_map

    # Cache miss — recompute.
    result = _compute_schedule(db)

    with _cache_lock:
        _cached_map             = result
        _cache_course_count     = current_courses
        _cache_assignment_count = current_assignments

    return result


def _compute_schedule(db: Session) -> dict:
    # Fetch all courses and assignments sorted by ID for stability
    courses     = db.query(Course).order_by(Course.id).all()
    assignments = db.query(CourseStaffAssignment).order_by(CourseStaffAssignment.id).all()

    # Build a course lookup dict to avoid linear scans inside the loop
    course_by_id = {c.id: c for c in courses}

    classes_to_schedule = []

    # 1. Gather all Lectures
    for c in courses:
        classes_to_schedule.append({
            "type": "Lecture",
            "course_id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "lecturer_id": c.lecturer_id,
            "key": f"Lecture-{c.id}"
        })

    # 2. Gather all Tutor & Practical assignments
    for a in assignments:
        if a.role in ("Tutor", "Practical"):
            c = course_by_id.get(a.course_id)
            if c:
                classes_to_schedule.append({
                    "type": a.role,
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "lecturer_id": a.lecturer_id,
                    "key": f"{a.role}-{a.id}"
                })

    days  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    times = [
        ("08:00", "10:00"), ("10:00", "12:00"), ("12:00", "14:00"),
        ("14:00", "16:00"), ("16:00", "18:00"), ("18:00", "20:00"),
        ("20:00", "22:00"),
    ]
    rooms = ["Theatre 1", "Theatre 2", "Lab 1", "Lab 2", "Lab 3", "Seminar Room 1", "Seminar Room 2"]

    all_slots = [
        {"day": day, "start": t[0], "end": t[1], "room": room}
        for day in days for t in times for room in rooms
    ]

    rng = random.Random(42)
    rng.shuffle(all_slots)

    allocated       = {}
    busy_rooms      = set()
    busy_lecturers  = set()
    busy_courses    = set()

    for cls in classes_to_schedule:
        lecturer_id = cls["lecturer_id"]
        course_id   = cls["course_id"]
        success     = False

        for slot in all_slots:
            day  = slot["day"]
            time = (slot["start"], slot["end"])
            room = slot["room"]

            if (day, time, room)              in busy_rooms:      continue
            if lecturer_id and (day, time, lecturer_id) in busy_lecturers: continue
            if (day, time, course_id)         in busy_courses:    continue

            allocated[cls["key"]] = slot
            busy_rooms.add((day, time, room))
            if lecturer_id:
                busy_lecturers.add((day, time, lecturer_id))
            busy_courses.add((day, time, course_id))
            success = True
            break

        if not success:
            raise ValueError(
                f"Academic schedule slots are fully booked. "
                f"No clash-free slot available for {cls['type']} of {cls['course_code']}."
            )

    return allocated


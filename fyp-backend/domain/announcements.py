"""Who may see which announcement, and how one is serialised.

The student view and the staff view ran two near-identical 60-line copies of this,
differing only in which role they exclude and how a programme is matched. Two copies of
a visibility rule is two chances for one of them to drift and leak a notice to the wrong
audience.

Targeting is scope x role. Scope decides the audience set (everyone / one programme /
one course); role decides whether students, staff, or both are addressed. "all" on
either axis means unrestricted on that axis.
"""
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.models import Announcement
from utils.timeutil import utcnow

# High first. Anything unrecognised sorts as Medium so a typo cannot bury a notice.
_PRIORITY_WEIGHT = {"High": 3, "Medium": 2, "Low": 1}
_DEFAULT_PRIORITY_WEIGHT = 2


def visible_announcements(db: Session, role: str, prog_codes, course_codes) -> list:
    """Published, in-window announcements addressed to this viewer, best first.

    role: "students" or "staff" — the audience the caller belongs to. An announcement
    aimed at the other audience is excluded; "all" reaches both.
    prog_codes / course_codes: the viewer's programme and course codes, compared
    case-insensitively. A student has one programme; a lecturer can have several.
    """
    now = utcnow()
    other_audience = "staff" if role == "students" else "students"

    # Draft and publication window are filtered in SQL — they are row predicates, and
    # loading every announcement to drop most of them in Python got slower with every
    # notice ever written.
    rows = db.query(Announcement).filter(
        Announcement.is_draft == False,  # noqa: E712
        or_(Announcement.publish_start == None, Announcement.publish_start <= now),  # noqa: E711
        or_(Announcement.publish_end == None, Announcement.publish_end > now),  # noqa: E711
    ).all()

    progs = {p.upper() for p in prog_codes if p}
    courses = {c.upper() for c in course_codes if c}

    def addressed(a) -> bool:
        if (a.target_role or "all") == other_audience:
            return False
        scope = a.target_scope or "all"
        if scope == "all":
            return True
        if scope == "programme":
            return bool(a.target_programme_code) and a.target_programme_code.upper() in progs
        if scope == "course":
            return bool(a.target_course_code) and a.target_course_code.upper() in courses
        return False

    return sorted(
        (a for a in rows if addressed(a)),
        key=lambda a: (_PRIORITY_WEIGHT.get(a.priority, _DEFAULT_PRIORITY_WEIGHT),
                       a.created_at or datetime.min),
        reverse=True,
    )


def announcement_dict(a) -> dict:
    """The wire shape both client apps read. Defined once so a new field cannot appear
    on one screen and be missing on the other."""
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "faculty": a.faculty,
        "department": a.department,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "priority": a.priority,
        "publisher": a.publisher,
        "image_base64": a.image_base64,
        "publish_start": a.publish_start.isoformat() if a.publish_start else None,
        "publish_end": a.publish_end.isoformat() if a.publish_end else None,
        "target_scope": a.target_scope,
        "target_role": a.target_role,
        "target_programme_code": a.target_programme_code,
        "target_course_code": a.target_course_code,
    }

"""Resolve makeup sessions to one original teaching obligation."""

from sqlalchemy.orm import aliased

from db.models import ClassSession


def scheduled_minutes(session):
    start, end = session.scheduled_start, session.scheduled_end
    if start is None or end is None:
        return None
    seconds = (end - start).total_seconds()
    return int(seconds // 60) if seconds > 0 and seconds % 60 == 0 else None


def replacement_root(session, lookup):
    current = session
    seen = set()
    while current.replacement_for_session_id:
        if current.id in seen:
            return None
        seen.add(current.id)
        parent = lookup(current.replacement_for_session_id)
        if (parent is None or parent.course_id != session.course_id
                or parent.class_group != session.class_group or parent.status != "cancelled"):
            return None
        current = parent
    return current


def replacement_descendants(db, root_id):
    tree = db.query(ClassSession.id).filter_by(replacement_for_session_id=root_id).cte(recursive=True)
    child = aliased(ClassSession)
    tree = tree.union(db.query(child.id).join(tree, child.replacement_for_session_id == tree.c.id))
    return db.query(ClassSession).join(tree, ClassSession.id == tree.c.id).populate_existing().all()

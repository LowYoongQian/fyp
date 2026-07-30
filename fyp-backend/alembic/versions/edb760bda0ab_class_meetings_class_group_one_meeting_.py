"""class_meetings.class_group: one meeting row per enrolled group

Revision ID: edb760bda0ab
Revises: 0f375205742a
Create Date: 2026-07-30 19:47:39.388146

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'edb760bda0ab'
down_revision: Union[str, None] = '0f375205742a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Give class_meetings the group dimension it never had.

    Without it there was no way to say "G1's practical is at this time" — so the
    check-in window code fell back to picking whichever tutorial slot the database
    happened to return first, and a student in one group could satisfy the time check
    using another group's slot.

    A lecture stays group-less (NULL = the whole course attends). A tutorial or
    practical needs one row per enrolled group, so existing rows are split: the first
    group keeps the row and its allocated slot, and each further group gets a new row
    with a clash-free slot. Groups come from enrolments — staff assignments carry no
    group column.
    """
    op.add_column("class_meetings", sa.Column("class_group", sa.String(), nullable=True))

    _split_tutorial_rows_by_group()

    # Let the database hold the invariant instead of trusting every write site.
    # Note this says "each tutorial row names its group", NOT "every group has a
    # tutorial" — a group with no practical is legitimate.
    op.create_check_constraint(
        "ck_class_meetings_group",
        "class_meetings",
        "(role = 'Lecture' AND class_group IS NULL) OR "
        "(role IN ('Tutor','Practical') AND class_group IS NOT NULL)",
    )


def _split_tutorial_rows_by_group() -> None:
    """Done in Python, not SQL: the added rows need a clash-free slot, and choosing
    one is application logic that already exists as pick_slot_for_new."""
    from sqlalchemy.orm import Session

    from db.models import ClassMeeting
    from domain.scheduler import groups_for_course, meeting_key_for, pick_slot_for_new

    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        rows = session.query(ClassMeeting).filter(
            ClassMeeting.role.in_(["Tutor", "Practical"])
        ).order_by(ClassMeeting.id).all()

        for row in rows:
            groups = groups_for_course(session, row.course_id)
            if not groups:
                # No enrolments means no group can be named, and the CHECK below would
                # reject the row. Loud failure beats inventing a group.
                raise RuntimeError(
                    f"class_meetings row {row.id} ({row.role}) belongs to course "
                    f"{row.course_id}, which has no enrolments — cannot assign a group."
                )

            first, rest = groups[0], groups[1:]
            row.class_group = first
            row.meeting_key = meeting_key_for(row.role, row.course_id, row.assignment_id, first)
            session.flush()

            for group in rest:
                slot = pick_slot_for_new(session, row.course_id, row.lecturer_id, row.role)
                session.add(ClassMeeting(
                    meeting_key=meeting_key_for(row.role, row.course_id, row.assignment_id, group),
                    course_id=row.course_id, assignment_id=row.assignment_id,
                    role=row.role, lecturer_id=row.lecturer_id, class_group=group,
                    day=slot["day"], start=slot["start"], end=slot["end"], room=slot["room"],
                ))
                session.flush()
        session.commit()
    finally:
        session.close()


def downgrade() -> None:
    """Collapse back to one row per assignment, keeping the alphabetically first
    group's slot. The other groups' allocations are not recoverable."""
    op.drop_constraint("ck_class_meetings_group", "class_meetings", type_="check")
    op.execute(
        """
        DELETE FROM class_meetings
        WHERE  class_group IS NOT NULL
          AND  class_group <> (
                 SELECT min(m2.class_group) FROM class_meetings m2
                 WHERE  m2.assignment_id = class_meetings.assignment_id
               )
        """
    )
    op.execute(
        "UPDATE class_meetings SET meeting_key = role || '-' || assignment_id "
        "WHERE assignment_id IS NOT NULL"
    )
    op.drop_column("class_meetings", "class_group")

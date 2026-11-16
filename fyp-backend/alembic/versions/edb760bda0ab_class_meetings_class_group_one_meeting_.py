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
    """Use historical tables, never ORM fields or schedulers from later revisions."""
    import random
    from uuid import uuid4
    bind = op.get_bind()
    metadata = sa.MetaData()
    meetings = sa.Table("class_meetings", metadata, autoload_with=bind)
    enrolments = sa.Table("enrolments", metadata, autoload_with=bind)
    occupied = list(bind.execute(sa.select(meetings)).mappings())
    rows = sorted((row for row in occupied if row["role"] in ("Tutor", "Practical")), key=lambda row: str(row["id"]))
    # Freeze the original deterministic allocator with this migration.
    slots = [dict(day=day, start=f"{hour:02d}:00", end=f"{hour+2:02d}:00", room=room)
             for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")
             for hour in range(8, 22, 2)
             for room in ("Theatre 1", "Theatre 2", "Lab 1", "Lab 2", "Lab 3", "Seminar Room 1", "Seminar Room 2")]
    random.Random(42).shuffle(slots)
    def minute(value):
        hour, minutes = value.split(":")
        return int(hour) * 60 + int(minutes)

    for row in rows:
        groups = sorted({group for group in bind.scalars(sa.select(enrolments.c.class_group).where(
            enrolments.c.course_id == row["course_id"])) if group})
        if not groups:
            raise RuntimeError(f"class_meetings row {row['id']} ({row['role']}) belongs to course "
                               f"{row['course_id']}, which has no enrolments — cannot assign a group.")
        def key(group):
            return f"{row['role']}-{row['assignment_id']}-{group}"
        bind.execute(meetings.update().where(meetings.c.id == row["id"]).values(
            class_group=groups[0], meeting_key=key(groups[0])))
        for group in groups[1:]:
            slot = next((slot for slot in slots if not any(
                other["day"] == slot["day"]
                and minute(other["start"]) < minute(slot["end"])
                and minute(slot["start"]) < minute(other["end"])
                and (other["room"] == slot["room"] or other["course_id"] == row["course_id"]
                     or (row["lecturer_id"] and other["lecturer_id"] == row["lecturer_id"]))
                for other in occupied)), None)
            if slot is None:
                raise ValueError(f"No clash-free slot available for {row['role']} (course {row['course_id']}).")
            new = dict(id=uuid4(), meeting_key=key(group), course_id=row["course_id"], assignment_id=row["assignment_id"],
                       role=row["role"], lecturer_id=row["lecturer_id"], class_group=group, **slot)
            bind.execute(meetings.insert().values(**new))
            occupied.append(new)


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

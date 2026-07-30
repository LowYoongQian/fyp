"""drop dead Course.schedule_ columns and backfill planned_total_hours

Revision ID: 42c198406814
Revises: edb760bda0ab
Create Date: 2026-07-30 20:09:16.991790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42c198406814'
down_revision: Union[str, None] = 'edb760bda0ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the course-level timetable columns and fill the missing planned hours.

    class_meetings became the timetable's single source of truth, and nothing has read
    courses.schedule_* since — a client sending schedule_day got a 200 back and no
    change, which is worse than a rejection. The columns held one leftover row of
    pre-migration data.

    planned_total_hours is the denominator of the 80% attendance bar, so a NULL makes
    the risk model's certainty gates unevaluable for that course. The value is taken
    from the other course of the same credit_hours rather than a made-up formula.
    """
    op.execute(
        """
        UPDATE courses c
        SET    planned_total_hours = (
                 SELECT max(o.planned_total_hours) FROM courses o
                 WHERE  o.credit_hours = c.credit_hours
                   AND  o.planned_total_hours IS NOT NULL
               )
        WHERE  c.planned_total_hours IS NULL
        """
    )

    op.drop_column("courses", "schedule_day")
    op.drop_column("courses", "schedule_start")
    op.drop_column("courses", "schedule_end")
    op.drop_column("courses", "schedule_room")


def downgrade() -> None:
    """Columns come back empty. Their contents were dead data; the live timetable is
    in class_meetings and is untouched by this revision."""
    op.add_column("courses", sa.Column("schedule_day", sa.String(), nullable=True))
    op.add_column("courses", sa.Column("schedule_start", sa.String(), nullable=True))
    op.add_column("courses", sa.Column("schedule_end", sa.String(), nullable=True))
    op.add_column("courses", sa.Column("schedule_room", sa.String(), nullable=True))

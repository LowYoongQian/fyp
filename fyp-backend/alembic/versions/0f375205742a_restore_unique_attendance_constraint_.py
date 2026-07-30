"""restore unique attendance constraint and the declared-but-missing indexes

Revision ID: 0f375205742a
Revises: e1fd21d5715b
Create Date: 2026-07-30 19:42:24.726728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f375205742a'
down_revision: Union[str, None] = 'e1fd21d5715b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Re-apply two things the models have always declared but the database lost.

    The unique constraint was built and verified once, then dropped again by the UUID
    migration — which left the check-in handler catching an IntegrityError that could
    no longer be raised. Verified 0 duplicate (student_id, session_id) pairs before
    adding it.

    The indexes went missing because the tables predated create_all, and create_all
    does not add indexes to a table that already exists. Nothing here changes
    behaviour; it makes the database match what the models say.
    """
    op.create_unique_constraint(
        "uq_attendance_student_session", "attendance_records", ["student_id", "session_id"]
    )
    op.create_index("ix_attendance_records_session_id", "attendance_records", ["session_id"])
    op.create_index("ix_attendance_records_student_id", "attendance_records", ["student_id"])
    op.create_index("ix_class_sessions_course_id", "class_sessions", ["course_id"])
    op.create_index("ix_enrolments_student_id", "enrolments", ["student_id"])
    op.create_index("ix_enrolments_course_id", "enrolments", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_enrolments_course_id", "enrolments")
    op.drop_index("ix_enrolments_student_id", "enrolments")
    op.drop_index("ix_class_sessions_course_id", "class_sessions")
    op.drop_index("ix_attendance_records_student_id", "attendance_records")
    op.drop_index("ix_attendance_records_session_id", "attendance_records")
    op.drop_constraint("uq_attendance_student_session", "attendance_records", type_="unique")

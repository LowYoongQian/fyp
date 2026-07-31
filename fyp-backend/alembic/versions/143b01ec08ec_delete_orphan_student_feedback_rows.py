"""delete orphan student_feedback rows

Revision ID: 143b01ec08ec
Revises: fdb54b1fa98b
Create Date: 2026-07-31 18:15:11.465029

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '143b01ec08ec'
down_revision: Union[str, None] = 'fdb54b1fa98b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Demo rows (S10023/S10045/S10088) left over from before student_code was
    # normalised to ST+7 digits: student_id is NULL and the codes match no student, so
    # they point at nobody and are outside ck_students_student_code_format. Matched on
    # the orphan condition rather than the three literal codes so this stays correct if
    # the ids differ in another environment.
    op.execute(
        "DELETE FROM student_feedback "
        "WHERE student_id IS NULL "
        "AND student_code NOT IN (SELECT student_code FROM students)"
    )


def downgrade() -> None:
    # The deleted rows are not recoverable. They were unreferenced demo data, so there
    # is nothing to restore and no schema change to undo.
    pass

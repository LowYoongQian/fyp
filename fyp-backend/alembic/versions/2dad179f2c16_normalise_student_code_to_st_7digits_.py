"""normalise student_code to ST+7digits and enforce format

Revision ID: 2dad179f2c16
Revises: 42c198406814
Create Date: 2026-07-31 02:38:53.708470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2dad179f2c16'
down_revision: Union[str, None] = '42c198406814'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing codes were free-form (TP100001, TP000010, and anything an admin typed,
    # since nothing validated the field). Rewrite to the canonical ST + 7 digits by
    # keeping the digits and left-padding, then let the DB refuse anything else so no
    # writer -- web, flutter or a one-off script -- can reintroduce a bad code.
    op.execute(
        "UPDATE students "
        "SET student_code = 'ST' || LPAD(REGEXP_REPLACE(student_code, '\\D', '', 'g'), 7, '0') "
        "WHERE student_code !~ '^ST[0-9]{7}$'"
    )
    op.create_check_constraint(
        "ck_students_student_code_format", "students", "student_code ~ '^ST[0-9]{7}$'"
    )


def downgrade() -> None:
    # Drops the constraint only. The pre-migration codes are not recoverable: the digit
    # padding is lossy, so rolling back leaves the ST codes in place.
    op.drop_constraint("ck_students_student_code_format", "students", type_="check")

"""normalise staff_id to T+6digits and enforce format

Revision ID: fdb54b1fa98b
Revises: 2dad179f2c16
Create Date: 2026-07-31 02:48:12.958354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdb54b1fa98b'
down_revision: Union[str, None] = '2dad179f2c16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same treatment as student_code in 2dad179f2c16: staff_id was free-form (STF01,
    # STF02, plus whatever an admin typed) because nothing validated it. Keep the
    # digits, left-pad to 6, prefix T, then let the DB reject anything else.
    op.execute(
        "UPDATE lecturers "
        "SET staff_id = 'T' || LPAD(REGEXP_REPLACE(staff_id, '\\D', '', 'g'), 6, '0') "
        "WHERE staff_id !~ '^T[0-9]{6}$'"
    )
    op.create_check_constraint(
        "ck_lecturers_staff_id_format", "lecturers", "staff_id ~ '^T[0-9]{6}$'"
    )


def downgrade() -> None:
    # Drops the constraint only; the digit padding is lossy so the original ids are
    # not recoverable and the T ids stay in place.
    op.drop_constraint("ck_lecturers_staff_id_format", "lecturers", type_="check")

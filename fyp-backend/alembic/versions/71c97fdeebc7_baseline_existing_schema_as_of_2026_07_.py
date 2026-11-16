"""baseline: existing schema as of 2026-07-30

Revision ID: 71c97fdeebc7
Revises: 
Create Date: 2026-07-30 19:25:18.929290

"""
from typing import Sequence, Union

from pathlib import Path

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '71c97fdeebc7'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adopt existing tables, or create the frozen legacy structure in an empty DB.

    Existing installations retain their adoption behavior. New databases need
    those same 18 tables, including the shadow columns the next revision
    backfills. The frozen SQL preserves that historical state independently of
    current models; it never copies application data.
    """
    if context.is_offline_mode() or not sa.inspect(op.get_bind()).has_table("users"):
        schema = Path(__file__).resolve().parents[1] / "baseline_schema.sql"
        op.execute(schema.read_text(encoding="utf-8"))


def downgrade() -> None:
    pass

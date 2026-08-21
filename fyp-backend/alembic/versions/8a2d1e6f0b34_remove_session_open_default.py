"""remove class session opened-at default

Revision ID: 8a2d1e6f0b34
Revises: 4f8b8c8d7a10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8a2d1e6f0b34"
down_revision: Union[str, None] = "4f8b8c8d7a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("class_sessions", "opened_at", server_default=None)


def downgrade() -> None:
    op.alter_column(
        "class_sessions",
        "opened_at",
        server_default=sa.text("now()"),
    )

"""add structured AI chat session context

Revision ID: d2e6f8a9b104
Revises: c7d4e9a1b2f0
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d2e6f8a9b104"
down_revision: Union[str, None] = "c7d4e9a1b2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_chat_sessions",
        sa.Column(
            "context_state",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("ai_chat_sessions", "context_state")

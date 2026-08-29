"""add owned AI chat history and vector memory

Revision ID: c7d4e9a1b2f0
Revises: 8a2d1e6f0b34
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d4e9a1b2f0"
down_revision: Union[str, None] = "8a2d1e6f0b34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions")
    op.create_table(
        "ai_chat_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_chat_sessions_user_id", "ai_chat_sessions", ["user_id"])
    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("session_id", sa.UUID(), sa.ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_chat_messages_session_id", "ai_chat_messages", ["session_id"])
    op.create_index("ix_ai_chat_messages_created_at", "ai_chat_messages", ["created_at"])
    # Nemotron returns 2,048 values. pgvector HNSW indexes cap vector at 2,000
    # dimensions but support halfvec up to 4,000, so half precision is required here.
    op.execute("ALTER TABLE ai_chat_messages ADD COLUMN embedding extensions.halfvec(2048)")
    op.execute(
        "CREATE INDEX ix_ai_chat_messages_embedding ON ai_chat_messages "
        "USING hnsw (embedding extensions.halfvec_cosine_ops)"
    )
    op.execute("ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON ai_chat_sessions, ai_chat_messages FROM anon, authenticated")


def downgrade() -> None:
    op.drop_table("ai_chat_messages")
    op.drop_table("ai_chat_sessions")

"""add class lifecycle

Revision ID: 4f8b8c8d7a10
Revises: b3e82f419c20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4f8b8c8d7a10"
down_revision: Union[str, None] = "b3e82f419c20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("class_sessions", sa.Column("meeting_id", sa.UUID(), nullable=True))
    op.add_column("class_sessions", sa.Column("scheduled_start", sa.DateTime(), nullable=True))
    op.add_column("class_sessions", sa.Column("scheduled_end", sa.DateTime(), nullable=True))
    op.add_column("class_sessions", sa.Column("status", sa.String(), nullable=False, server_default="open"))
    op.add_column("class_sessions", sa.Column("room", sa.String(), nullable=True))
    op.add_column("class_sessions", sa.Column("semester", sa.String(), nullable=True))
    op.add_column("class_sessions", sa.Column("opened_by_user_id", sa.UUID(), nullable=True))
    op.add_column("class_sessions", sa.Column("cancelled_by_user_id", sa.UUID(), nullable=True))
    op.add_column("class_sessions", sa.Column("cancelled_at", sa.DateTime(), nullable=True))
    op.add_column("class_sessions", sa.Column("cancel_reason", sa.Text(), nullable=True))
    op.add_column("class_sessions", sa.Column("replacement_for_session_id", sa.UUID(), nullable=True))
    op.execute("UPDATE class_sessions SET status = CASE WHEN is_open THEN 'open' ELSE 'completed' END")
    op.create_foreign_key("fk_class_sessions_meeting", "class_sessions", "class_meetings", ["meeting_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_class_sessions_opened_by", "class_sessions", "users", ["opened_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_class_sessions_cancelled_by", "class_sessions", "users", ["cancelled_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_class_sessions_replacement", "class_sessions", "class_sessions", ["replacement_for_session_id"], ["id"], ondelete="SET NULL")
    op.create_check_constraint("ck_class_sessions_status", "class_sessions", "status IN ('scheduled', 'open', 'completed', 'cancelled', 'needs_attention')")
    op.create_unique_constraint("uq_class_session_meeting_start", "class_sessions", ["meeting_id", "scheduled_start"])
    for column in ("meeting_id", "scheduled_start", "status", "semester", "replacement_for_session_id"):
        op.create_index(f"ix_class_sessions_{column}", "class_sessions", [column])


def downgrade() -> None:
    for column in ("replacement_for_session_id", "semester", "status", "scheduled_start", "meeting_id"):
        op.drop_index(f"ix_class_sessions_{column}", table_name="class_sessions")
    op.drop_constraint("uq_class_session_meeting_start", "class_sessions", type_="unique")
    op.drop_constraint("ck_class_sessions_status", "class_sessions", type_="check")
    for name in ("fk_class_sessions_replacement", "fk_class_sessions_cancelled_by", "fk_class_sessions_opened_by", "fk_class_sessions_meeting"):
        op.drop_constraint(name, "class_sessions", type_="foreignkey")
    for column in ("replacement_for_session_id", "cancel_reason", "cancelled_at", "cancelled_by_user_id", "opened_by_user_id", "semester", "room", "status", "scheduled_end", "scheduled_start", "meeting_id"):
        op.drop_column("class_sessions", column)

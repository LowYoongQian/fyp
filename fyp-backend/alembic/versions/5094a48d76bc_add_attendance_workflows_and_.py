"""add attendance workflows and notifications

Revision ID: 5094a48d76bc
Revises: 9c2d8f7a1b4e
Create Date: 2026-08-13 18:14:22.367795

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5094a48d76bc'
down_revision: Union[str, None] = '9c2d8f7a1b4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=False)
    op.create_table(
        "attendance_requests",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("student_id", uuid, sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", uuid, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", uuid, sa.ForeignKey("class_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("request_type", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("reviewer_user_id", uuid, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("request_type IN ('leave', 'correction')", name="ck_attendance_request_type"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected', 'cancelled')", name="ck_attendance_request_status"),
    )
    op.create_index("ix_attendance_requests_student_created", "attendance_requests", ["student_id", "created_at"])
    op.create_index("ix_attendance_requests_course_status", "attendance_requests", ["course_id", "status"])
    op.create_index("ix_attendance_requests_session_id", "attendance_requests", ["session_id"])
    op.create_index("ix_attendance_requests_reviewer_user_id", "attendance_requests", ["reviewer_user_id"])

    op.create_table(
        "user_notifications",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("dedupe_key", sa.String(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "dedupe_key", name="uq_user_notification_dedupe"),
    )
    op.create_index("ix_user_notifications_inbox", "user_notifications", ["user_id", "read_at", "created_at"])

    # The application uses its own JWT and accesses PostgreSQL only through FastAPI.
    # Keep these tables unavailable through Supabase's public Data API.
    op.execute("ALTER TABLE attendance_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON attendance_requests FROM anon, authenticated")
    op.execute("REVOKE ALL ON user_notifications FROM anon, authenticated")


def downgrade() -> None:
    op.drop_index("ix_user_notifications_inbox", table_name="user_notifications")
    op.drop_table("user_notifications")
    op.drop_index("ix_attendance_requests_reviewer_user_id", table_name="attendance_requests")
    op.drop_index("ix_attendance_requests_session_id", table_name="attendance_requests")
    op.drop_index("ix_attendance_requests_course_status", table_name="attendance_requests")
    op.drop_index("ix_attendance_requests_student_created", table_name="attendance_requests")
    op.drop_table("attendance_requests")

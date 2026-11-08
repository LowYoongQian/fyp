"""Feedback severity belongs to the administrator: record when an admin set it. NULL = not reviewed yet (older rows keep their stored label)."""
from alembic import op
import sqlalchemy as sa

revision = "d8e3b5a1f7c2"
down_revision = "c6e2a9d4f018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("student_feedback", sa.Column("priority_set_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("student_feedback", "priority_set_at")

"""Add complaint priority and private attachment metadata."""
import sqlalchemy as sa

from alembic import op

revision = "e3f7a9b2c105"
down_revision = "d2e6f8a9b104"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("student_feedback", sa.Column("priority", sa.String(), nullable=False, server_default="Medium"))
    for name in ("attachment_path", "attachment_name", "attachment_type"):
        op.add_column("student_feedback", sa.Column(name, sa.String(), nullable=True))


def downgrade():
    for name in ("attachment_type", "attachment_name", "attachment_path", "priority"):
        op.drop_column("student_feedback", name)

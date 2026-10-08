"""Keep student-visible replies separate from existing internal notes."""
import sqlalchemy as sa

from alembic import op

revision = "f4a8b0c3d206"
down_revision = "e3f7a9b2c105"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("student_feedback", sa.Column("student_response", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("student_feedback", "student_response")

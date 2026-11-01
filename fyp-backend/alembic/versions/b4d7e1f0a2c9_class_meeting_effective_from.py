"""When a timetable slot started to exist, so a new or moved class never produces review rows for days before it existed.

Existing slots keep NULL on purpose: their seven-day missed-class recovery stays exactly as it was.
"""
from alembic import op
import sqlalchemy as sa

revision = "b4d7e1f0a2c9"
down_revision = "a9c4e2f7b315"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("class_meetings", sa.Column("effective_from", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("class_meetings", "effective_from")

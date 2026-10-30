"""Truthful delivery state for lecturer warning emails (additive; legacy rows keep NULL = recorded only)."""
from alembic import op
import sqlalchemy as sa

revision = "f2b8d4e6a731"
down_revision = "f1a7c3d9e520"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("alerts", sa.Column("delivery_status", sa.String(16), nullable=True))
    op.add_column("alerts", sa.Column("provider_message_id", sa.String(64), nullable=True))
    op.add_column("alerts", sa.Column("failure_code", sa.String(32), nullable=True))
    op.add_column("alerts", sa.Column("attempted_at", sa.DateTime(), nullable=True))


def downgrade():
    for column in ("attempted_at", "failure_code", "provider_message_id", "delivery_status"):
        op.drop_column("alerts", column)

"""Remember which device and network address each sign-in came from, so one phone or browser is listed once.

Additive only: nullable columns and one index. Older code ignores them, so the backend can run before or after this migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "d7a2c5e9f1b3"
down_revision = "c3f1a9d7e2b4"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("auth_sessions", "auth_login_challenges"):
        op.add_column(table, sa.Column("device_key", sa.String(80), nullable=True))
        op.add_column(table, sa.Column("ip_address", sa.String(64), nullable=True))
    op.create_index("ix_auth_sessions_device_key", "auth_sessions", ["device_key"])


def downgrade():
    op.drop_index("ix_auth_sessions_device_key", table_name="auth_sessions")
    for table in ("auth_login_challenges", "auth_sessions"):
        op.drop_column(table, "ip_address")
        op.drop_column(table, "device_key")

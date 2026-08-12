"""add recovery email and password reset tokens

Revision ID: 9c2d8f7a1b4e
Revises: 143b01ec08ec
"""
from alembic import op
import sqlalchemy as sa

revision = "9c2d8f7a1b4e"
down_revision = "143b01ec08ec"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("recovery_email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("recovery_email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("recovery_code_hash", sa.String(), nullable=True))
    op.add_column("users", sa.Column("recovery_code_expires_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("password_reset_hash", sa.String(), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(), nullable=True))
    op.create_index("uq_users_recovery_email", "users", ["recovery_email"], unique=True)
    op.create_index("ix_users_password_reset_hash", "users", ["password_reset_hash"], unique=False)


def downgrade():
    op.drop_index("ix_users_password_reset_hash", table_name="users")
    op.drop_index("uq_users_recovery_email", table_name="users")
    for name in ("password_reset_expires_at", "password_reset_hash", "recovery_code_expires_at", "recovery_code_hash", "recovery_email_verified", "recovery_email"):
        op.drop_column("users", name)

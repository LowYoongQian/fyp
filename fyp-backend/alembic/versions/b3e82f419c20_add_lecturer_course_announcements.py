"""add lecturer course announcements

Revision ID: b3e82f419c20
Revises: 8a4e39270b6d
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b3e82f419c20"
down_revision: Union[str, None] = "8a4e39270b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("announcements", sa.Column("creator_user_id", sa.UUID(), nullable=True))
    op.add_column("announcements", sa.Column("target_group", sa.String(), nullable=True))
    op.add_column("announcements", sa.Column("attachment_path", sa.String(), nullable=True))
    op.add_column("announcements", sa.Column("attachment_name", sa.String(), nullable=True))
    op.add_column("announcements", sa.Column("attachment_mime_type", sa.String(), nullable=True))
    op.add_column("announcements", sa.Column("attachment_size", sa.Integer(), nullable=True))
    op.add_column("announcements", sa.Column("external_link", sa.String(), nullable=True))
    op.create_foreign_key("fk_announcements_creator_user", "announcements", "users", ["creator_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_announcements_creator_user_id", "announcements", ["creator_user_id"])


def downgrade() -> None:
    op.drop_index("ix_announcements_creator_user_id", table_name="announcements")
    op.drop_constraint("fk_announcements_creator_user", "announcements", type_="foreignkey")
    for column in ("external_link", "attachment_size", "attachment_mime_type", "attachment_name", "attachment_path", "target_group", "creator_user_id"):
        op.drop_column("announcements", column)

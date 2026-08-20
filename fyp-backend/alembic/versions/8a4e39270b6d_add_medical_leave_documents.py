"""add medical leave documents

Revision ID: 8a4e39270b6d
Revises: 5094a48d76bc
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8a4e39270b6d"
down_revision: Union[str, None] = "5094a48d76bc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attendance_requests", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("attendance_requests", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("attendance_requests", sa.Column("proof_path", sa.String(), nullable=True))
    op.add_column("attendance_requests", sa.Column("proof_file_name", sa.String(), nullable=True))
    op.add_column("attendance_requests", sa.Column("proof_mime_type", sa.String(), nullable=True))
    op.add_column("attendance_requests", sa.Column("proof_size", sa.Integer(), nullable=True))
    op.add_column("attendance_requests", sa.Column("ai_verdict", sa.String(), nullable=True))
    op.add_column("attendance_requests", sa.Column("ai_confidence", sa.Float(), nullable=True))
    op.add_column("attendance_requests", sa.Column("ai_summary", sa.Text(), nullable=True))
    op.add_column("attendance_requests", sa.Column("ai_details", sa.Text(), nullable=True))


def downgrade() -> None:
    for column in ("ai_details", "ai_summary", "ai_confidence", "ai_verdict", "proof_size",
                   "proof_mime_type", "proof_file_name", "proof_path", "end_date", "start_date"):
        op.drop_column("attendance_requests", column)

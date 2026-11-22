"""Keep a verified recovery email until its replacement is verified; record each student's group per programme semester.

Additive only: no existing row is rewritten. Older code ignores both, so the backend and web can deploy at different times.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c3f1a9d7e2b4"
down_revision = "ea7416c39b82"
branch_labels = None
depends_on = None


def upgrade():
    # The address waiting for its code. recovery_email stays the verified destination until the code is entered.
    op.add_column("users", sa.Column("recovery_email_pending", sa.String(), nullable=True))
    # A student's tutorial group for one programme semester. Course enrolments keep their own class_group; this is the
    # programme-level group that rollover carries forward and that new course enrolments in the semester default to.
    op.create_table(
        "semester_group_members",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("semester_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("academic_semesters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_group", sa.String(16), nullable=False),
        sa.Column("source", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("semester_id", "student_id", name="uq_semester_group_student"),
        sa.CheckConstraint("source IN ('manual', 'rollover')", name="ck_semester_group_source"),
    )
    op.create_index("ix_semester_group_members_group", "semester_group_members", ["semester_id", "class_group"])
    op.create_index("ix_semester_group_members_student", "semester_group_members", ["student_id"])


def downgrade():
    op.drop_index("ix_semester_group_members_student", table_name="semester_group_members")
    op.drop_index("ix_semester_group_members_group", table_name="semester_group_members")
    op.drop_table("semester_group_members")
    op.drop_column("users", "recovery_email_pending")

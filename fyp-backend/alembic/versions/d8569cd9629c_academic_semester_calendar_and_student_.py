"""academic semester calendar and student credit limits

Revision ID: d8569cd9629c
Revises: c2aeddcb9bf6
Create Date: 2026-10-14 15:09:59.940419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8569cd9629c'
down_revision: Union[str, None] = 'c2aeddcb9bf6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("academic_semesters",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("programme_id", sa.UUID(), sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("max_student_credits", sa.Float(), nullable=False),
        sa.UniqueConstraint("programme_id", "name", name="uq_semester_programme_name"),
        sa.CheckConstraint("end_date >= start_date", name="ck_semester_dates"),
        sa.CheckConstraint("max_student_credits > 0 AND max_student_credits <= 60", name="ck_semester_credit_limit"))
    op.create_index("ix_academic_semesters_programme_id", "academic_semesters", ["programme_id"])
    op.add_column("courses", sa.Column("semester_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_courses_semester", "courses", "academic_semesters", ["semester_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_courses_semester_id", "courses", ["semester_id"])
    op.execute("ALTER TABLE public.academic_semesters ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON public.academic_semesters FROM PUBLIC, anon, authenticated")
    op.execute("CREATE TRIGGER sas_live_change AFTER INSERT OR UPDATE OR DELETE ON public.academic_semesters FOR EACH ROW EXECUTE FUNCTION public.sas_notify_change()")


def downgrade() -> None:
    op.drop_index("ix_courses_semester_id", table_name="courses")
    op.drop_constraint("fk_courses_semester", "courses", type_="foreignkey")
    op.drop_column("courses", "semester_id")
    op.drop_table("academic_semesters")

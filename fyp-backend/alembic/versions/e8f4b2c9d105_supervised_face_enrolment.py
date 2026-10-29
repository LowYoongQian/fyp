"""Supervised face enrolment; preserve existing active identity anchors."""
from alembic import op
import sqlalchemy as sa

revision = "e8f4b2c9d105"
down_revision = "d7e3a1f8b204"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("face_enrolment_requests",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("student_id", sa.UUID(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supervisor_user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("token_hash", sa.String(64), unique=True),
        sa.Column("challenge_issued_at", sa.DateTime()),
        sa.Column("challenge_consumed_at", sa.DateTime()),
        sa.Column("candidate_embedding", sa.LargeBinary()),
        sa.Column("previous_face_hash", sa.String(64)),
        sa.Column("captured_at", sa.DateTime()),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("reviewer_user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewer_note", sa.String(255)),
        sa.Column("reauth_failures", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint("status IN ('authorised', 'pending', 'approved', 'rejected', 'expired')", name="ck_face_enrolment_status"))
    op.create_index("ix_face_enrolment_owner_created", "face_enrolment_requests", ["student_id", "created_at"])
    op.create_index("ix_face_enrolment_expiry", "face_enrolment_requests", ["status", "expires_at"])
    op.create_index("uq_face_enrolment_open", "face_enrolment_requests", ["student_id"], unique=True,
                    postgresql_where=sa.text("status IN ('authorised', 'pending')"))
    for table in ("face_enrolment_requests", "face_embeddings"):
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON public.{table} FROM PUBLIC, anon, authenticated")
    op.execute("CREATE TRIGGER sas_live_change AFTER INSERT OR UPDATE OR DELETE ON public.face_enrolment_requests FOR EACH ROW EXECUTE FUNCTION public.sas_notify_change()")


def downgrade():
    # Do not reopen direct biometric access when reverting the workflow.
    op.drop_table("face_enrolment_requests")

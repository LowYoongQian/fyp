"""Keep support messages accessible only through the role-checked backend."""
from alembic import op

revision = "a6b9d2e4f307"
down_revision = "f4a8b0c3d206"
branch_labels = None
depends_on = None


def upgrade():
    # This app uses its own JWT, not Supabase Auth: auth.uid() cannot scope it.
    # The backend database role bypasses RLS; anon/authenticated must not.
    op.execute("ALTER TABLE public.student_feedback ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON public.student_feedback FROM PUBLIC, anon, authenticated")


def downgrade():
    # Rolling back a feature must not re-expose students' private messages.
    pass

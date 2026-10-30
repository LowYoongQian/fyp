"""Private registration photo reference and owed-delete queue (additive; no backfill)."""
from alembic import op
import sqlalchemy as sa

revision = "f1a7c3d9e520"
down_revision = "d8569cd9629c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("face_embeddings", sa.Column("photo_key", sa.String(255), nullable=True))
    op.create_table("face_photo_cleanups",
        sa.Column("object_key", sa.String(255), primary_key=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
    # face_embeddings already has RLS and no client grants; give the new table the same.
    op.execute("ALTER TABLE public.face_photo_cleanups ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON public.face_photo_cleanups FROM PUBLIC, anon, authenticated")


def downgrade():
    op.drop_table("face_photo_cleanups")
    op.drop_column("face_embeddings", "photo_key")

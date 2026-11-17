"""Separate, quota-limited single-use authority for face self-tests."""
from alembic import op
import sqlalchemy as sa

revision = 'a6c9e2f41083'
down_revision = 'd8e3b5a1f7c2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('face_self_test_challenges',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('student_id', sa.UUID(as_uuid=False), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('auth_session_id', sa.UUID(as_uuid=False), sa.ForeignKey('auth_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('registration_version', sa.String(100), nullable=False),
        sa.Column('issued_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(), nullable=True))
    op.create_index('ix_face_self_test_owner_issued', 'face_self_test_challenges', ['student_id', 'issued_at'])
    # Match the existing auth-session security tables: only the trusted backend
    # may read/consume challenges; Supabase client roles must not bypass its quota.
    op.execute('ALTER TABLE public.face_self_test_challenges ENABLE ROW LEVEL SECURITY')
    op.execute('REVOKE ALL ON public.face_self_test_challenges FROM PUBLIC, anon, authenticated')


def downgrade():
    op.drop_index('ix_face_self_test_owner_issued', table_name='face_self_test_challenges')
    op.drop_table('face_self_test_challenges')

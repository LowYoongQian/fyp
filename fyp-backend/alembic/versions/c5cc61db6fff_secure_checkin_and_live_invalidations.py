"""secure checkin and live invalidations

Revision ID: c5cc61db6fff
Revises: a6b9d2e4f307
Create Date: 2026-10-11 15:24:56.232750

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5cc61db6fff'
down_revision: Union[str, None] = 'a6b9d2e4f307'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('checkin_challenges',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.UUID(), sa.ForeignKey('class_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('issued_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime()))
    for column in ('student_id', 'session_id', 'expires_at'):
        op.create_index('ix_checkin_challenges_' + column, 'checkin_challenges', [column])
    op.execute('ALTER TABLE public.checkin_challenges ENABLE ROW LEVEL SECURITY')
    op.execute('REVOKE ALL ON public.checkin_challenges FROM PUBLIC, anon, authenticated')
    for name, table, columns in PAGE_INDEXES:
        op.create_index(name, table, columns)
    # NOTIFY is delivered after COMMIT only; payloads contain routing IDs, not records.
    op.execute("""
    CREATE FUNCTION public.sas_notify_change() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
    DECLARE row_data jsonb; payload jsonb; owner_id uuid; course_id uuid;
    BEGIN
      FOR row_data IN SELECT value FROM jsonb_array_elements(
        CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW))
             WHEN TG_OP = 'DELETE' THEN jsonb_build_array(to_jsonb(OLD))
             ELSE jsonb_build_array(to_jsonb(NEW)) END) LOOP
      payload := jsonb_build_object('table', TG_TABLE_NAME,
        'student_id', row_data->>'student_id', 'course_id', row_data->>'course_id');
      IF TG_TABLE_NAME IN ('users', 'students', 'lecturers', 'user_notifications') THEN
        payload := payload || jsonb_build_object('user_id',
          CASE WHEN TG_TABLE_NAME = 'users' THEN row_data->>'id' ELSE row_data->>'user_id' END);
      ELSIF TG_TABLE_NAME = 'courses' THEN
        SELECT user_id INTO owner_id FROM public.lecturers WHERE id = (row_data->>'lecturer_id')::uuid;
        payload := payload || jsonb_build_object('course_id', row_data->>'id', 'user_id', owner_id);
      ELSIF TG_TABLE_NAME = 'course_staff_assignments' THEN
        SELECT user_id INTO owner_id FROM public.lecturers WHERE id = (row_data->>'lecturer_id')::uuid;
        payload := payload || jsonb_build_object('user_id', owner_id);
      ELSIF TG_TABLE_NAME = 'attendance_records' THEN
        SELECT s.course_id INTO course_id FROM public.class_sessions s WHERE id = (row_data->>'session_id')::uuid;
        payload := payload || jsonb_build_object('course_id', course_id);
      ELSIF TG_TABLE_NAME = 'announcements' THEN
        SELECT id INTO course_id FROM public.courses WHERE course_code = row_data->>'target_course_code' LIMIT 1;
        payload := payload || jsonb_build_object('course_id', course_id,
          'target_course_code', row_data->>'target_course_code');
      END IF;
      PERFORM pg_notify('sas_live_changes', payload::text);
      END LOOP;
      RETURN NULL;
    END $$;
    REVOKE ALL ON FUNCTION public.sas_notify_change() FROM PUBLIC, anon, authenticated;
    """)
    for table in LIVE_TABLES:
        op.execute(f'CREATE TRIGGER sas_live_change AFTER INSERT OR UPDATE OR DELETE ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.sas_notify_change()')


def downgrade() -> None:
    for table in LIVE_TABLES:
        op.execute(f'DROP TRIGGER IF EXISTS sas_live_change ON public.{table}')
    op.execute('DROP FUNCTION IF EXISTS public.sas_notify_change()')
    for name, table, _ in PAGE_INDEXES:
        op.drop_index(name, table_name=table)
    op.drop_table('checkin_challenges')


PAGE_INDEXES = (
    ('ix_feedback_page', 'student_feedback', ['created_at', 'id']),
    ('ix_feedback_owner_page', 'student_feedback', ['student_id', 'created_at', 'id']),
    ('ix_medical_page', 'attendance_requests', ['created_at', 'id']),
    ('ix_medical_owner_page', 'attendance_requests', ['student_id', 'created_at', 'id']),
    ('ix_attendance_mc_page', 'attendance_records', ['marked_at', 'id']),
)
LIVE_TABLES = ('student_feedback', 'attendance_requests', 'attendance_records', 'class_sessions',
    'class_meetings', 'courses', 'enrolments', 'course_staff_assignments', 'announcements',
    'user_notifications', 'users', 'students', 'lecturers')

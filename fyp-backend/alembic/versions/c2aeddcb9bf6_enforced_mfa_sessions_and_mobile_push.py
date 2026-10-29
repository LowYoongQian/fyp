"""enforced_mfa_sessions_and_mobile_push

Revision ID: c2aeddcb9bf6
Revises: e8f4b2c9d105
Create Date: 2026-10-12 22:02:59.417984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2aeddcb9bf6'
down_revision: Union[str, None] = 'e8f4b2c9d105'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for column in (
        sa.Column('auth_version', sa.Integer(), server_default='0', nullable=False),
        sa.Column('push_quiet_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('push_quiet_start', sa.Integer(), server_default='1320', nullable=False),
        sa.Column('push_quiet_end', sa.Integer(), server_default='420', nullable=False),
        sa.Column('push_timezone', sa.String(64), server_default='Asia/Kuala_Lumpur', nullable=False),
    ):
        op.add_column('users', column)
    def owner(primary=False):
        return sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=primary, nullable=False)
    op.create_table('auth_sessions', sa.Column('id', sa.UUID(), primary_key=True), owner(),
        sa.Column('auth_version', sa.Integer(), nullable=False), sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False), sa.Column('revoked_at', sa.DateTime()),
        sa.Column('device_label', sa.String(120), nullable=False))
    op.create_table('auth_factors', owner(True), sa.Column('secret', sa.Text()),
        sa.Column('pending_secret', sa.Text()), sa.Column('pending_expires_at', sa.DateTime()),
        sa.Column('last_counter', sa.Integer(), nullable=False), sa.Column('recovery_hashes', sa.Text(), nullable=False),
        sa.Column('failures', sa.Integer(), nullable=False), sa.Column('blocked_until', sa.DateTime()))
    op.create_table('auth_login_challenges', sa.Column('token_hash', sa.String(64), primary_key=True), owner(),
        sa.Column('auth_version', sa.Integer(), nullable=False), sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime()), sa.Column('device_label', sa.String(120), nullable=False))
    op.create_table('auth_attempts', sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('failures', sa.Integer(), nullable=False), sa.Column('blocked_until', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('push_devices', sa.Column('id', sa.UUID(), primary_key=True), owner(),
        sa.Column('session_id', sa.UUID(), sa.ForeignKey('auth_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.Text(), unique=True, nullable=False), sa.Column('platform', sa.String(16), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('push_deliveries', sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('notification_id', sa.UUID(), sa.ForeignKey('user_notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('device_id', sa.UUID(), sa.ForeignKey('push_devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(16), nullable=False), sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=False), sa.Column('lease_until', sa.DateTime()),
        sa.Column('expires_at', sa.DateTime(), nullable=False), sa.Column('error_code', sa.String(60)),
        sa.Column('sent_at', sa.DateTime()),
        sa.UniqueConstraint('notification_id', 'device_id', name='uq_push_delivery_notification_device'))
    for table in ('auth_sessions', 'auth_login_challenges', 'push_devices'):
        op.create_index('ix_' + table + '_user_id', table, ['user_id'])
    for table in ('auth_sessions', 'auth_login_challenges'):
        op.create_index('ix_' + table + '_expires_at', table, ['expires_at'])
    op.create_index('ix_push_deliveries_due', 'push_deliveries', ['status', 'next_attempt_at'])
    for table in ('auth_sessions', 'auth_factors', 'auth_login_challenges', 'auth_attempts', 'push_devices', 'push_deliveries'):
        op.execute(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON public.{table} FROM PUBLIC, anon, authenticated')
    # The former flag had no authenticator credential behind it; require real opt-in setup.
    op.execute('UPDATE public.users SET two_factor_enabled = false WHERE two_factor_enabled = true')
    op.execute("""
    CREATE FUNCTION public.sas_auth_version() RETURNS trigger LANGUAGE plpgsql
    SET search_path = pg_catalog, public AS $$ BEGIN
      IF (NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.status IS DISTINCT FROM OLD.status)
          AND NEW.auth_version = OLD.auth_version THEN NEW.auth_version := OLD.auth_version + 1; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER sas_auth_version BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sas_auth_version();
    CREATE FUNCTION public.sas_revoke_sessions() RETURNS trigger LANGUAGE plpgsql
    SET search_path = pg_catalog, public AS $$ BEGIN
      IF NEW.auth_version IS DISTINCT FROM OLD.auth_version THEN
        UPDATE public.auth_sessions SET revoked_at = timezone('UTC', now()) WHERE user_id = NEW.id AND revoked_at IS NULL;
        UPDATE public.push_devices SET enabled = false WHERE user_id = NEW.id;
        UPDATE public.auth_login_challenges SET consumed_at = timezone('UTC', now()) WHERE user_id = NEW.id AND consumed_at IS NULL;
      END IF; RETURN NULL; END $$;
    CREATE TRIGGER sas_revoke_sessions AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sas_revoke_sessions();
    CREATE FUNCTION public.sas_enqueue_push() RETURNS trigger LANGUAGE plpgsql
    SET search_path = pg_catalog, public AS $$ BEGIN
      INSERT INTO public.push_deliveries (id, notification_id, device_id, status, attempts, next_attempt_at, expires_at)
      SELECT gen_random_uuid(), NEW.id, d.id, 'pending', 0, timezone('UTC', now()),
        timezone('UTC', now()) + CASE WHEN NEW.kind = 'class_reminder' THEN interval '15 minutes' ELSE interval '24 hours' END
      FROM public.push_devices d JOIN public.users u ON u.id = d.user_id
      JOIN public.auth_sessions s ON s.id = d.session_id
      WHERE d.user_id = NEW.user_id AND d.enabled AND lower(u.status) = 'active'
        AND u.notifications_enabled AND u.push_notifications AND s.revoked_at IS NULL
        AND s.expires_at > timezone('UTC', now()) AND s.auth_version = u.auth_version
      ON CONFLICT (notification_id, device_id) DO NOTHING;
      RETURN NULL; END $$;
    CREATE TRIGGER sas_enqueue_push AFTER INSERT ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION public.sas_enqueue_push();
    REVOKE ALL ON FUNCTION public.sas_auth_version(), public.sas_revoke_sessions(), public.sas_enqueue_push() FROM PUBLIC, anon, authenticated;
    """)


def downgrade() -> None:
    op.execute('DROP TRIGGER sas_enqueue_push ON public.user_notifications')
    op.execute('DROP TRIGGER sas_revoke_sessions ON public.users')
    op.execute('DROP TRIGGER sas_auth_version ON public.users')
    op.execute('DROP FUNCTION public.sas_enqueue_push(), public.sas_revoke_sessions(), public.sas_auth_version()')
    for table in ('push_deliveries', 'push_devices', 'auth_attempts', 'auth_login_challenges', 'auth_factors', 'auth_sessions'):
        op.drop_table(table)
    op.execute('UPDATE public.users SET two_factor_enabled = false')
    for column in ('push_timezone', 'push_quiet_end', 'push_quiet_start', 'push_quiet_enabled', 'auth_version'):
        op.drop_column('users', column)

"""Durable, leased FCM HTTP v1 delivery; payloads contain no attendance/medical details."""
import asyncio
import logging
import os
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from sqlalchemy import and_, or_

from db.database import SessionLocal
from db.models import AuthSession, PushDelivery, PushDevice, User, UserNotification
from utils.timeutil import utcnow

logger = logging.getLogger(__name__)
_credential_lock = threading.Lock()
_credentials = None


def configured():
    return bool(os.getenv('FCM_PROJECT_ID') and os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))


def quiet_until(user, now):
    if not user.push_quiet_enabled:
        return None
    local = now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(user.push_timezone))
    minute = local.hour * 60 + local.minute
    start, end = user.push_quiet_start, user.push_quiet_end
    quiet = (start <= minute < end) if start < end else (minute >= start or minute < end)
    if not quiet:
        return None
    resume = local.replace(hour=end // 60, minute=end % 60, second=0, microsecond=0)
    if resume <= local:
        resume += timedelta(days=1)
    return resume.astimezone(timezone.utc).replace(tzinfo=None)


def send_message(token, notification_id, expires_at):
    global _credentials
    project = os.environ['FCM_PROJECT_ID']
    with _credential_lock:
        if _credentials is None:
            _credentials = service_account.Credentials.from_service_account_file(
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'],
                scopes=['https://www.googleapis.com/auth/firebase.messaging'])
            if _credentials.project_id != project:
                _credentials = None
                raise ValueError('Firebase project mismatch')
        if not _credentials.valid:
            class BoundedRequest(Request):
                def __call__(self, *args, **kwargs):
                    kwargs['timeout'] = 10
                    return super().__call__(*args, **kwargs)
            _credentials.refresh(BoundedRequest())
        access_token = _credentials.token
    ttl = max(1, int((expires_at - utcnow()).total_seconds()))
    response = httpx.post(f'https://fcm.googleapis.com/v1/projects/{project}/messages:send',
        headers={'Authorization': f'Bearer {access_token}'}, timeout=10,
        json={'message': {'token': token,
            'notification': {'title': 'Smart Attendance', 'body': 'You have a new update. Open the app to view it securely.'},
            'data': {'notification_id': str(notification_id)},
            'android': {'ttl': f'{ttl}s', 'collapse_key': str(notification_id),
                        'notification': {'tag': str(notification_id)}},
            'apns': {'headers': {'apns-collapse-id': str(notification_id),
                'apns-expiration': str(int(expires_at.replace(tzinfo=timezone.utc).timestamp()))}}}})
    if response.is_success:
        return 'sent'
    try:
        details = response.json().get('error', {}).get('details', [])
        if any(item.get('errorCode') == 'UNREGISTERED' for item in details):
            return 'unregistered'
    except (ValueError, AttributeError, TypeError):
        pass
    return 'retry' if response.status_code in (401, 403, 408, 429) or response.status_code >= 500 else 'rejected'


def deliver_one(session_factory=SessionLocal, sender=send_message):
    now = utcnow()
    with session_factory() as db:
        row = db.query(PushDelivery).filter(or_(
            and_(PushDelivery.status == 'pending', PushDelivery.next_attempt_at <= now),
            and_(PushDelivery.status == 'sending', PushDelivery.lease_until <= now)
        )).order_by(PushDelivery.next_attempt_at).with_for_update(skip_locked=True).first()
        if not row:
            return False
        device = db.get(PushDevice, row.device_id)
        notice = db.get(UserNotification, row.notification_id)
        user = db.get(User, device.user_id) if device else None
        session = db.get(AuthSession, device.session_id) if device else None
        allowed = (device and device.enabled and notice and user and session and
            str(notice.user_id) == str(user.id) and str(session.user_id) == str(user.id) and
            (user.status or '').lower() == 'active' and user.notifications_enabled and user.push_notifications and
            not session.revoked_at and session.expires_at > now and session.auth_version == user.auth_version)
        if not allowed or row.expires_at <= now or row.attempts >= 5:
            row.status = 'cancelled'; db.commit(); return True
        resume = quiet_until(user, now)
        if resume:
            row.status, row.next_attempt_at = 'pending', resume
            if resume >= row.expires_at:
                row.status = 'cancelled'
            db.commit(); return True
        row.status, row.lease_until = 'sending', now + timedelta(seconds=60)
        row.attempts += 1
        delivery_id, lease, device_id = row.id, row.lease_until, device.id
        notice_id, device_token, expiry = notice.id, device.token, row.expires_at
        db.commit()  # No database lock or transaction held during network delivery.
    try:
        outcome = sender(device_token, notice_id, expiry)
    except Exception as error:
        logger.warning('Push delivery retry (%s)', type(error).__name__)
        outcome = 'retry'
    with session_factory() as db:
        row = db.query(PushDelivery).filter_by(id=delivery_id, status='sending', lease_until=lease).with_for_update().first()
        if not row:
            return True
        row.lease_until = None
        row.error_code = None if outcome == 'sent' else outcome
        if outcome == 'sent':
            row.status, row.sent_at = 'sent', utcnow()
        elif outcome == 'retry':
            row.status = 'pending'
            row.next_attempt_at = utcnow() + timedelta(seconds=min(900, 30 * 2 ** row.attempts))
        else:
            row.status = 'failed'
            if outcome == 'unregistered':
                # Do not disable a device that was rebound during this send.
                db.query(PushDevice).filter_by(id=device_id, token=device_token).update({'enabled': False})
        db.commit()
    return True


async def push_loop():
    if not configured():
        logger.warning('Mobile push is not configured; in-app notifications remain available.')
        return
    while True:
        try:
            for _ in range(20):
                if not await asyncio.to_thread(deliver_one):
                    break
        except Exception as error:
            logger.warning('Push queue processing failed (%s)', type(error).__name__)
        await asyncio.sleep(10)

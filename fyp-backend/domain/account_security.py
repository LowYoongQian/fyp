"""Server sessions and encrypted TOTP credentials, never client-controlled flags."""
import hashlib
import json
import os
import secrets
from datetime import timedelta
from uuid import UUID

import pyotp
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from db.models import AuthFactor, AuthSession, AuthLoginChallenge, PushDevice, User
from utils.timeutil import utcnow


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def cipher():
    try:
        return Fernet(os.environ['TOTP_ENCRYPTION_KEY'].encode())
    except (KeyError, ValueError):
        raise HTTPException(503, 'Authenticator service is not configured. Contact the administrator.')


def decrypt(value):
    try:
        return cipher().decrypt(value.encode()).decode()
    except InvalidToken:
        raise HTTPException(503, 'Authenticator credentials could not be read. Contact the administrator.')


def active(user):
    if (user.status or '').lower() != 'active':
        raise HTTPException(403, 'This account is suspended or inactive. Contact the administrator.')


def lock_user(db, user_id, require_session=False):
    user = db.query(User).filter_by(id=str(user_id)).populate_existing().with_for_update().first()
    if not user:
        raise HTTPException(401, 'Account is unavailable')
    active(user)
    if require_session:
        # A logout/reset may commit while this request is waiting for the user lock.
        validate_session(db, {'user_id': str(user.id), 'sid': db.info.get('security_session_id')})
    return user


def validate_session(db, claims):
    try:
        user_id, session_id = str(UUID(str(claims.get('user_id')))), str(UUID(str(claims.get('sid'))))
    except (ValueError, TypeError):
        raise HTTPException(401, 'Please sign in again to start a secure session.')
    user = db.get(User, user_id, populate_existing=True)
    if not user:
        raise HTTPException(401, 'Account is unavailable')
    active(user)
    session = db.get(AuthSession, session_id, populate_existing=True)
    if (not session or str(session.user_id) != user_id or session.revoked_at or
            session.expires_at <= utcnow() or session.auth_version != user.auth_version):
        raise HTTPException(401, 'Your session ended. Please sign in again.')
    db.info['security_session_id'] = session_id
    return user


def new_session(db, user, device_label):
    # Preserve the web's one-hour limit and the previous mobile token's 24-hour limit.
    now = utcnow()
    session = AuthSession(user_id=user.id, auth_version=user.auth_version,
        created_at=now, expires_at=now + timedelta(hours=24 if device_label == 'Mobile device' else 1), device_label=device_label[:120])
    db.add(session); db.flush()
    user.last_login_at = now
    return session


def revoke_all(db, user):
    user.auth_version = (user.auth_version or 0) + 1
    db.query(AuthSession).filter_by(user_id=user.id, revoked_at=None).update({'revoked_at': utcnow()})
    db.query(PushDevice).filter_by(user_id=user.id).update({'enabled': False})
    db.query(AuthLoginChallenge).filter_by(user_id=user.id, consumed_at=None).update({'consumed_at': utcnow()})
    db.flush()


def factor_for(db, user_id):
    factor = db.get(AuthFactor, str(user_id))
    if not factor:
        factor = AuthFactor(user_id=user_id)
        db.add(factor); db.flush()
    return factor


def check_factor_limit(factor):
    if factor.blocked_until and factor.blocked_until > utcnow():
        raise HTTPException(429, 'Too many verification attempts. Try again in 15 minutes.')
    if factor.blocked_until:
        factor.failures, factor.blocked_until = 0, None


def factor_failure(db, factor):
    factor.failures += 1
    if factor.failures >= 5:
        factor.blocked_until = utcnow() + timedelta(minutes=15)
    db.commit()  # Persist limits even though the request returns an error.
    raise HTTPException(400, 'Incorrect or already used verification code.')


def verify_factor(db, factor, code, pending=False):
    check_factor_limit(factor)
    secret = factor.pending_secret if pending else factor.secret
    if not secret:
        raise HTTPException(409, 'Set up an authenticator first.')
    clean = code.strip().replace(' ', '')
    totp = pyotp.TOTP(decrypt(secret))
    # utcnow() is naive UTC; timestamp() is host-local on Windows, so use UTC explicitly.
    from datetime import timezone
    counter = int(utcnow().replace(tzinfo=timezone.utc).timestamp() // 30)
    for candidate in (counter - 1, counter, counter + 1):
        if candidate > factor.last_counter and secrets.compare_digest(totp.at(candidate * 30), clean):
            factor.last_counter, factor.failures, factor.blocked_until = candidate, 0, None
            return
    if not pending:
        hashes = json.loads(factor.recovery_hashes)
        digest = token_hash(clean.upper().replace('-', ''))
        if digest in hashes:
            hashes.remove(digest)
            factor.recovery_hashes = json.dumps(hashes)
            factor.failures, factor.blocked_until = 0, None
            return
    factor_failure(db, factor)


def generate_recovery(factor):
    codes = [secrets.token_hex(10).upper() for _ in range(8)]
    factor.recovery_hashes = json.dumps([token_hash(code) for code in codes])
    return ['-'.join(code[index:index+5] for index in range(0, 20, 5)) for code in codes]

"""Owner-scoped security settings and device registration; no raw session credentials in lists."""
import base64
import io
import os
from datetime import timedelta
from typing import Literal

import pyotp
import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AuthSession, PushDevice, User
from domain.account_security import (cipher, lock_user, factor_for, verify_factor, factor_failure,
    check_factor_limit, generate_recovery, revoke_all, validate_session)
from utils.security import get_current_user, verify_password, oauth2_scheme, decode_token
from utils.timeutil import utcnow, iso_utc

router = APIRouter(prefix='/auth', tags=['Account security'])


class Reauthenticate(BaseModel):
    current_password: str = Field(min_length=1, max_length=255)


class FactorCode(BaseModel):
    code: str = Field(min_length=6, max_length=32)


class FactorAction(Reauthenticate, FactorCode):
    pass


def password_check(db, user, password):
    factor = factor_for(db, user.id)
    check_factor_limit(factor)
    if not verify_password(password, user.password_hash):
        factor_failure(db, factor)
    return factor


@router.post('/2fa/setup')
def setup(body: Reauthenticate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    if user.two_factor_enabled:
        raise HTTPException(409, '2FA is already enabled; verify before disabling or replacing it.')
    factor = password_check(db, user, body.current_password)
    secret = pyotp.random_base32()
    factor.pending_secret = cipher().encrypt(secret.encode()).decode()
    factor.pending_expires_at, factor.last_counter = utcnow() + timedelta(minutes=10), -1
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name='Smart Attendance')
    image = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage)
    output = io.BytesIO(); image.save(output)
    db.commit()
    return {'secret': secret, 'qr_data_url': 'data:image/svg+xml;base64,' + base64.b64encode(output.getvalue()).decode(), 'expires_in': 600}


@router.post('/2fa/enable')
def enable(body: FactorCode, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    factor = factor_for(db, user.id)
    if user.two_factor_enabled or not factor.pending_expires_at or factor.pending_expires_at <= utcnow():
        raise HTTPException(409, 'Setup expired or is already enabled. Start setup again.')
    verify_factor(db, factor, body.code, pending=True)
    factor.secret, factor.pending_secret, factor.pending_expires_at = factor.pending_secret, None, None
    codes = generate_recovery(factor)
    user.two_factor_enabled = True
    # Other already-open devices must authenticate with the newly required factor.
    current = db.info.get('security_session_id')
    db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.id != current,
        AuthSession.revoked_at.is_(None)).update({'revoked_at': utcnow()})
    db.commit()
    return {'enabled': True, 'recovery_codes': codes, 'message': 'Save these one-use recovery codes securely; they are shown only once.'}


@router.post('/2fa/disable')
def disable(body: FactorAction, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    factor = password_check(db, user, body.current_password)
    verify_factor(db, factor, body.code)
    user.two_factor_enabled = False
    factor.secret, factor.pending_secret, factor.recovery_hashes = None, None, '[]'
    revoke_all(db, user)
    db.commit()
    return {'message': '2FA disabled. Sign in again.'}


@router.post('/2fa/recovery-codes')
def recovery_codes(body: FactorAction, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    factor = password_check(db, user, body.current_password)
    verify_factor(db, factor, body.code)
    codes = generate_recovery(factor)
    db.commit()
    return {'recovery_codes': codes}


@router.get('/sessions')
def sessions(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    current = decode_token(token).get('sid')
    rows = db.query(AuthSession).filter(AuthSession.user_id == actor.id, AuthSession.revoked_at.is_(None),
        AuthSession.expires_at > utcnow(), AuthSession.auth_version == actor.auth_version).order_by(AuthSession.created_at.desc()).limit(50).all()
    return [{'id': row.id, 'device_label': row.device_label, 'created_at': iso_utc(row.created_at),
             'expires_at': iso_utc(row.expires_at), 'current': str(row.id) == current} for row in rows]


@router.post('/logout')
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    session_id = decode_token(token)['sid']
    db.query(AuthSession).filter_by(id=session_id, user_id=user.id).update({'revoked_at': utcnow()})
    db.query(PushDevice).filter_by(session_id=session_id, user_id=user.id).update({'enabled': False})
    db.commit()
    return {'message': 'Signed out'}


@router.post('/logout-all')
def logout_all(body: Reauthenticate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    user = lock_user(db, actor.id, require_session=True)
    password_check(db, user, body.current_password)
    revoke_all(db, user); db.commit()
    return {'message': 'All devices signed out'}


class DeviceRegistration(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: Literal['android', 'ios']


@router.post('/push/device')
def register_device(body: DeviceRegistration, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    lock_user(db, actor.id, require_session=True)
    validate_session(db, decode_token(token))
    row = db.query(PushDevice).filter_by(token=body.token).with_for_update().first()
    if not row:
        row = PushDevice(token=body.token)
        db.add(row)
    row.user_id, row.session_id = actor.id, decode_token(token)['sid']
    row.platform, row.enabled, row.updated_at = body.platform, True, utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Device registration changed; retry registration.')
    return {'registered': True, 'delivery_configured': bool(os.getenv('FCM_PROJECT_ID') and os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))}


@router.delete('/push/device')
def unregister_device(body: DeviceRegistration, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    db.query(PushDevice).filter_by(token=body.token, user_id=actor.id).update({'enabled': False})
    db.commit()
    return {'message': 'Push device removed'}

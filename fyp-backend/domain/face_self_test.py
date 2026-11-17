"""Independent, single-use self-test authority shared across API workers."""
import hashlib
import secrets
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import update

from db.models import FaceSelfTestChallenge
from utils.timeutil import iso_utc, utcnow


def issue_self_test(db, student_id, session_id, version):
    # Caller holds the student row lock: the quota cannot race across workers.
    now = utcnow()
    recent = db.query(FaceSelfTestChallenge).filter(
        FaceSelfTestChallenge.student_id == student_id,
        FaceSelfTestChallenge.issued_at > now - timedelta(minutes=10)).count()
    if recent >= 5:
        raise HTTPException(429, 'Too many self-tests. Please wait 10 minutes before trying again.')
    db.query(FaceSelfTestChallenge).filter(
        FaceSelfTestChallenge.student_id == student_id,
        FaceSelfTestChallenge.expires_at < now - timedelta(days=1)).delete(synchronize_session=False)
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(seconds=120)
    db.add(FaceSelfTestChallenge(token_hash=hashlib.sha256(token.encode()).hexdigest(),
        student_id=student_id, auth_session_id=session_id, registration_version=version,
        issued_at=now, expires_at=expires))
    db.commit()
    return {'challenge_token': token, 'expires_at': iso_utc(expires)}


def consume_self_test(db, token, student_id, session_id, version):
    now = utcnow()
    issued = db.execute(update(FaceSelfTestChallenge).where(
        FaceSelfTestChallenge.token_hash == hashlib.sha256(token.encode()).hexdigest(),
        FaceSelfTestChallenge.student_id == student_id,
        FaceSelfTestChallenge.auth_session_id == session_id,
        FaceSelfTestChallenge.registration_version == version,
        FaceSelfTestChallenge.expires_at > now,
        FaceSelfTestChallenge.consumed_at.is_(None),
    ).values(consumed_at=now).returning(FaceSelfTestChallenge.issued_at),
        execution_options={'synchronize_session': False}).scalar_one_or_none()
    if issued is None:
        db.rollback()
        raise HTTPException(409, 'This self-test expired, changed or was already used. Start a new scan.')
    # Burn before inference, even on a failed scan, timeout or process crash.
    db.commit()
    if (now - issued).total_seconds() < 0.8:
        raise HTTPException(400, 'Complete the camera movements before submitting a self-test.')

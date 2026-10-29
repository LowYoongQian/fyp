import hashlib
import secrets
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import update

from db.models import CheckinChallenge
from utils.timeutil import iso_utc, utcnow

CHALLENGE_SECONDS = 120


def issue_challenge(db, student_id, session_id):
    now = utcnow()
    db.query(CheckinChallenge).filter(CheckinChallenge.expires_at < now - timedelta(days=1)).delete(synchronize_session=False)
    # One current attempt per student/session; retries get fresh server authority.
    db.query(CheckinChallenge).filter(
        CheckinChallenge.student_id == student_id, CheckinChallenge.session_id == session_id,
    ).delete(synchronize_session=False)
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(seconds=CHALLENGE_SECONDS)
    db.add(CheckinChallenge(token_hash=hashlib.sha256(token.encode()).hexdigest(),
                            student_id=student_id, session_id=session_id,
                            issued_at=now, expires_at=expires))
    db.commit()
    return {"challenge_token": token, "expires_at": iso_utc(expires)}


def consume_challenge(db, token, student_id, session_id):
    now = utcnow()
    issued_at = db.execute(update(CheckinChallenge).where(
        CheckinChallenge.token_hash == hashlib.sha256(token.encode()).hexdigest(),
        CheckinChallenge.student_id == student_id, CheckinChallenge.session_id == session_id,
        CheckinChallenge.expires_at > now, CheckinChallenge.consumed_at.is_(None),
    ).values(consumed_at=now).returning(CheckinChallenge.issued_at),
        execution_options={"synchronize_session": False}).scalar_one_or_none()
    if issued_at is None:
        db.rollback()
        raise HTTPException(409, "This check-in attempt expired or was already used. Please scan again.")
    # Claim before expensive inference: replay/concurrent attempts cannot share one challenge.
    db.commit()
    return max(0, int((now - issued_at).total_seconds() * 1000))

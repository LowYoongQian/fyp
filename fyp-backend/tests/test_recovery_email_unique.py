from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from routers.auth import RecoveryEmailRequest, request_recovery_email


class _FakeQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.result


class _FakeSession:
    def __init__(self, existing=None, commit_error=False):
        self.existing = existing
        self.commit_error = commit_error
        self.committed = False
        self.rolled_back = False

    def query(self, _model):
        return _FakeQuery(self.existing)

    def commit(self):
        if self.commit_error:
            raise IntegrityError("insert", {}, Exception("duplicate"))
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def _student_user():
    return SimpleNamespace(
        id="student-1",
        role="student",
        recovery_email=None,
        recovery_email_verified=False,
        recovery_code_hash=None,
        recovery_code_expires_at=None,
    )


def test_recovery_email_rejects_address_used_by_another_account():
    """One personal Gmail must never be linked to two student accounts."""
    db = _FakeSession(existing=SimpleNamespace(id="student-2"))

    with pytest.raises(HTTPException) as error:
        request_recovery_email(
            RecoveryEmailRequest(recovery_email=" Shared.Email@Gmail.com "),
            user=_student_user(),
            db=db,
        )

    assert error.value.status_code == 409
    assert error.value.detail == "Gmail already in use"
    assert not db.committed


def test_recovery_email_handles_simultaneous_duplicate_request():
    """The database race guard must return a clear conflict instead of a server error."""
    db = _FakeSession(commit_error=True)

    with pytest.raises(HTTPException) as error:
        request_recovery_email(
            RecoveryEmailRequest(recovery_email="same@gmail.com"),
            user=_student_user(),
            db=db,
        )

    assert error.value.status_code == 409
    assert error.value.detail == "Gmail already in use"
    assert db.rolled_back

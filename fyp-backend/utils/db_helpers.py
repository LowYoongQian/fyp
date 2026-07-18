"""Small shared DB/validation helpers for the router layer.

These collapse three patterns that were copy-pasted dozens of times across the
admin/session routers into one place, so a new endpoint can't forget a check or
drift its error wording:

  - get_or_404      : fetch a row by primary key or raise 404
  - ensure_unique   : raise 400 if a value already exists (optionally excluding
                      the row being updated)
  - require_email_domain : enforce an email suffix or raise 400

Behaviour is identical to the inline code they replace; only the wording is now
defined once per entity.
"""
from typing import Optional, Type

from fastapi import HTTPException
from sqlalchemy.orm import Session


def get_or_404(db: Session, model: Type, pk, name: str = "Resource", detail: Optional[str] = None):
    """Return the row of `model` with primary key `pk`, or raise 404.

    `name` builds the default "<name> not found" message; pass `detail` to
    override with an exact custom string.
    """
    row = db.get(model, pk)
    if row is None:
        raise HTTPException(status_code=404, detail=detail or f"{name} not found")
    return row


def ensure_unique(db: Session, model: Type, field, value, exclude_id=None,
                  detail: str = "Value already exists") -> None:
    """Raise 400 if any `model` row has `field == value`. When updating, pass
    `exclude_id` so the row being edited doesn't collide with itself."""
    q = db.query(model).filter(field == value)
    if exclude_id is not None:
        q = q.filter(model.id != exclude_id)
    if q.first() is not None:
        raise HTTPException(status_code=400, detail=detail)


def require_email_domain(email: str, suffix: str, label: str) -> None:
    """Raise 400 unless `email` ends with `suffix`."""
    if not email.endswith(suffix):
        raise HTTPException(status_code=400, detail=f"{label} email must end with {suffix}")


def require_own_profile(db: Session, model: Type, user_id: int, label: str):
    """Return the `model` row owned by `user_id` (via model.user_id), or raise
    404. Used to resolve the current user's Student/Lecturer profile — the
    single most-repeated 404 across the routers."""
    row = db.query(model).filter(model.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"{label} profile not found")
    return row

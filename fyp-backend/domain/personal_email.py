"""A student signs in with the approved school email only; a linked personal email is for notices and password recovery, never for sign-in.

School-style addresses (student.school.edu, staff.school.edu) are identity aliases and may have no mailbox, so nothing is ever delivered
to one and one can never be linked as a personal email. Delivery goes only to a personal address whose owner proved access with a code.
"""
import re
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from db.models import User

SCHOOL_DOMAINS = ("school.edu", "student.school.edu", "staff.school.edu")
STUDENT_DOMAIN = "student.school.edu"
_ATOM = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
# Unquoted local part: atoms joined by single dots, so no leading, trailing or doubled dot.
_ADDRESS = re.compile(rf"{_ATOM}(?:\.{_ATOM})*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{{0,61}}[A-Za-z0-9])?\.)+[A-Za-z]{{2,63}}")


def normalized(address: Optional[str]) -> str:
    return (address or "").strip().lower()


def is_valid_format(address: str) -> bool:
    return len(address) <= 254 and len(address.partition("@")[0]) <= 64 and bool(_ADDRESS.fullmatch(address))


def is_school_identity(address: str) -> bool:
    domain = address.rpartition("@")[2]
    return any(domain == school or domain.endswith("." + school) for school in SCHOOL_DOMAINS)


def is_student_identity(address: Optional[str]) -> bool:
    """True only for a well-formed address on exactly the approved student domain; a typed school-looking suffix is not enough."""
    address = normalized(address)
    return is_valid_format(address) and address.endswith("@" + STUDENT_DOMAIN)


def deliverable_address(user: Optional[User]) -> Optional[str]:
    """The one address a notice or reset link may be sent to for this account, or None.

    It must be linked AND verified, still a valid personal address (never a school alias, never the login address itself)."""
    if user is None or not user.recovery_email_verified:
        return None
    address = normalized(user.recovery_email)
    if not address or not is_valid_format(address) or is_school_identity(address) or address == normalized(user.email):
        return None
    return address


def require_linkable(db: Session, user: User, raw: str) -> str:
    """The lower-cased address if this student may link it, else a short, plain HTTP error. Ownership is proved separately by a code."""
    address = normalized(raw)
    if not is_valid_format(address):
        raise HTTPException(400, "Enter a valid email address.")
    if is_school_identity(address):
        raise HTTPException(400, "Use a personal email, not a school address.")
    taken = db.query(User.id).filter(User.id != user.id, or_(func.lower(User.recovery_email) == address, func.lower(User.email) == address)).first()
    if taken:
        raise HTTPException(409, "That email cannot be used.")   # one answer for "in use" and "someone's login", so it reveals nothing
    return address

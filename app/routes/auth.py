import re

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Profile, User
from ..security import RateLimit, check_password, clear_session, current_user_id, hash_password, set_session

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = RateLimit(limit=30, window_seconds=15 * 60)


def _user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name}


@router.post("/register", status_code=201, dependencies=[Depends(limiter)])
def register(response: Response, body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    name = (body.get("name") or "").strip() or None
    if not re.match(r"^\S+@\S+\.\S+$", email):
        raise HTTPException(400, "A valid email is required")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, password_hash=hash_password(password), name=name)
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, display_name=name, approval_email=email))
    db.commit()
    set_session(response, user.id)
    return {"user": _user_out(user)}


@router.post("/login", dependencies=[Depends(limiter)])
def login(response: Response, body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(body.get("email") or "").strip().lower()))
    if not user or not check_password(str(body.get("password") or ""), user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    set_session(response, user.id)
    return {"user": _user_out(user)}


@router.post("/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@router.get("/me")
def me(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    user = db.get(User, uid)
    if not user:
        raise HTTPException(401, "Account not found")
    p = db.get(Profile, uid)
    return {"user": {**_user_out(user), "onboarded": bool(p and p.onboarded), "account_type": p.account_type if p else None}}

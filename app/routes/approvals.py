"""Public, token-based review endpoints used by the links in approval emails."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Post, Profile
from ..security import RateLimit
from ..services.posts import approve_post, reject_post, request_changes
from ..services.serialize import list_media
from ..worker import kick

router = APIRouter(prefix="/api/approvals", tags=["approvals"], dependencies=[Depends(RateLimit(120, 15 * 60))])


def _by_token(db: Session, token: str) -> Post:
    post = db.scalar(select(Post).where(Post.approval_token == token))
    if not post:
        raise HTTPException(404, "This review link is invalid or has been replaced by a newer revision.")
    return post


def _view(db: Session, p: Post) -> dict:
    owner = db.get(Profile, p.user_id)
    return {
        "id": p.id, "status": p.status, "topic": p.topic, "content": p.content, "media": list_media(db, p.media_ids or []),
        "revision": p.revision, "scheduled_for": p.scheduled_for, "platforms": p.platforms, "error": p.error,
        "feedback_history": p.feedback_history,
        "owner": (owner.company_name if owner.account_type == "company" else owner.display_name) if owner else None,
        "timezone": owner.timezone if owner else "UTC",
    }


@router.get("/{token}")
def view(token: str, db: Session = Depends(get_db)):
    return {"post": _view(db, _by_token(db, token))}


@router.post("/{token}/approve")
def approve(token: str, db: Session = Depends(get_db)):
    post = approve_post(db, _by_token(db, token))
    kick()
    return {"post": _view(db, post)}


@router.post("/{token}/changes")
def changes(token: str, body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    return {"post": _view(db, request_changes(db, _by_token(db, token), body.get("feedback")))}


@router.post("/{token}/reject")
def reject(token: str, db: Session = Depends(get_db)):
    return {"post": _view(db, reject_post(db, _by_token(db, token)))}

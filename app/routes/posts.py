from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..models import Post, Profile, Schedule, User
from ..security import current_user_id
from ..services.notify import send_approval_email
from ..services.posts import approve_post, create_post, reject_post, request_changes, run_generation
from ..services.serialize import list_media, post_dict
from ..worker import kick

router = APIRouter(prefix="/api/posts", tags=["posts"])
BUSY = ("publishing", "published", "generating")


def _load(db: Session, uid: int, pid: int) -> Post:
    p = db.scalar(select(Post).where(Post.id == pid, Post.user_id == uid))
    if not p:
        raise HTTPException(404, "Post not found")
    return p


def _parse_dt(v) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Invalid date")


@router.get("/stats")
def stats(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Post.status, func.count()).where(Post.user_id == uid).group_by(Post.status)).all())
    upcoming = db.scalars(select(Post).where(Post.user_id == uid, Post.status.in_(["pending_approval", "approved", "generating", "changes_requested"]))
                          .order_by(Post.scheduled_for.is_not(None), Post.scheduled_for).limit(8)).all()
    nxt = db.scalar(select(Schedule).where(Schedule.user_id == uid, Schedule.active.is_(True)).order_by(Schedule.next_run_at).limit(1))
    return {
        "counts": counts,
        "upcoming": [{"id": p.id, "topic": p.topic, "status": p.status, "scheduled_for": p.scheduled_for, "platforms": p.platforms or []} for p in upcoming],
        "nextSchedule": {"name": nxt.name, "next_run_at": nxt.next_run_at} if nxt else None,
    }


@router.get("")
def list_posts(status: str | None = None, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    q = select(Post).where(Post.user_id == uid)
    if status:
        q = q.where(Post.status.in_(status.split(",")))
    rows = db.scalars(q.order_by(func.coalesce(Post.scheduled_for, Post.created_at).desc()).limit(200)).all()
    return {"posts": [post_dict(db, p) for p in rows]}


@router.get("/{pid}")
def get_post(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    return {"post": post_dict(db, _load(db, uid, pid))}


@router.post("", status_code=202)
def new_post(body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    """Generate a brand-new post on demand."""
    post = create_post(db, uid, topic_hint=body.get("topic") or None, brief=body.get("brief") or None,
                       connection_ids=[int(c) for c in body.get("connection_ids") or []], media_type=body.get("media_type") or "auto",
                       scheduled_for=_parse_dt(body.get("scheduled_for")), require_approval=body.get("require_approval", True) is not False)
    run_generation(post.id)
    return {"post": post_dict(db, post)}


@router.put("/{pid}")
def edit(pid: int, body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    """Manual edits from the dashboard editor."""
    post = _load(db, uid, pid)
    if post.status in BUSY:
        raise HTTPException(409, f"Post is {post.status}")
    if body.get("content"):
        post.content = dict(body["content"])
    if "scheduled_for" in body:
        post.scheduled_for = _parse_dt(body["scheduled_for"])
    if body.get("connection_ids") is not None:
        post.connection_ids = [int(c) for c in body["connection_ids"]]
    if body.get("topic"):
        post.topic = body["topic"]
    db.commit()
    return {"post": post_dict(db, post)}


@router.post("/{pid}/approve")
def approve(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    post = approve_post(db, _load(db, uid, pid))
    kick()
    return {"post": post_dict(db, post)}


@router.post("/{pid}/regenerate")
def regenerate(pid: int, body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    post = _load(db, uid, pid)
    if body.get("feedback"):
        return {"post": post_dict(db, request_changes(db, post, body["feedback"]))}
    if post.status in BUSY:
        raise HTTPException(409, f"Post is {post.status}")
    post.status = "generating"
    db.commit()
    run_generation(post.id, force_media=bool(body.get("media")))
    return {"post": post_dict(db, post)}


@router.post("/{pid}/publish")
def publish_now(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    post = _load(db, uid, pid)
    if post.status in BUSY:
        raise HTTPException(409, f"Post is {post.status}")
    post.status, post.scheduled_for = "approved", utcnow()
    post.approved_at = post.approved_at or utcnow()
    db.commit()
    kick()
    return {"post": post_dict(db, post)}


@router.post("/{pid}/reject")
def reject(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    return {"post": post_dict(db, reject_post(db, _load(db, uid, pid)))}


@router.post("/{pid}/send-approval")
def resend(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    post = _load(db, uid, pid)
    if not post.approval_token:
        raise HTTPException(409, "This post has no active review link")
    send_approval_email(post, db.get(Profile, uid), db.get(User, uid), list_media(db, post.media_ids or []))
    return {"ok": True}


@router.delete("/{pid}")
def remove(pid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    db.execute(delete(Post).where(Post.id == pid, Post.user_id == uid))
    db.commit()
    return {"ok": True}

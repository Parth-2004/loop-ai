"""Post lifecycle: create → generate (copy + media) → approve / revise / reject → publish."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..ai.content import generate_post, revise_post
from ..ai.gemini import generate_image, generate_video
from ..db import session_scope, utcnow
from ..models import Connection, Media, Post, Profile, User
from ..platforms import PLATFORM_MODULE, PLATFORMS, load_connections
from ..security import random_token
from . import jobs
from .notify import send_approval_email, send_published_email
from .serialize import list_media, media_url
from .targets import select_connections

log = logging.getLogger("loop.posts")


def resolve_targets(db: Session, user_id: int, connection_ids: list[int] | None) -> tuple[list[int], list[str]]:
    conns = db.execute(select(Connection.id, Connection.platform).where(Connection.user_id == user_id)).all()
    chosen = select_connections(conns, connection_ids)
    present = {c.platform for c in chosen}
    # With no accounts connected yet, still draft for every platform so the user can preview.
    return [c.id for c in chosen], [p for p in PLATFORMS if p in present] if present else list(PLATFORMS)


def create_post(db: Session, user_id: int, *, schedule_id=None, connection_ids=None, brief=None, topic_hint=None,
                media_type="auto", scheduled_for=None, require_approval=True) -> Post:
    ids, platforms = resolve_targets(db, user_id, connection_ids)
    post = Post(user_id=user_id, schedule_id=schedule_id, status="generating", brief=brief, topic=topic_hint,
                media_type=media_type if media_type in ("none", "image", "video", "auto") else "auto",
                connection_ids=ids, platforms=platforms, scheduled_for=scheduled_for, require_approval=require_approval,
                content={}, hashtags=[], media_ids=[], feedback_history=[], publish_results={})
    db.add(post)
    db.commit()
    return post


def run_generation(post_id: int, feedback: str | None = None, force_media: bool = False):
    jobs.submit(_generate_safely, post_id, feedback, force_media)


def _generate_safely(post_id: int, feedback, force_media):
    try:
        generate_for_post(post_id, feedback=feedback, force_media=force_media)
    except Exception as e:
        log.exception("generation for post %s failed", post_id)
        with session_scope() as db:
            db.execute(update(Post).where(Post.id == post_id).values(status="failed", error=str(e)))


def generate_for_post(post_id: int, feedback: str | None = None, force_media: bool = False):
    with session_scope() as db:
        post = db.get(Post, post_id)
        if not post:
            raise RuntimeError("Post not found")
        profile = db.get(Profile, post.user_id)
        user = db.get(User, post.user_id)
        platforms = post.platforms or list(PLATFORMS)
        post.status, post.error = "generating", None
        db.commit()

        if feedback:
            draft = revise_post(profile, platforms, post, feedback, post.media_type)
        else:
            recent = db.scalars(select(Post.topic).where(Post.user_id == post.user_id, Post.id != post.id, Post.topic.is_not(None))
                                .order_by(Post.created_at.desc()).limit(15)).all()
            draft = generate_post(profile, platforms, brief=post.brief, topic_hint=post.topic,
                                  media_type=post.media_type, recent_topics=recent)

        # Media: generate on first draft, or when feedback / an explicit request requires it.
        media_ids = list(post.media_ids or [])
        media_error = None
        if draft["media_type"] == "none":
            media_ids = []
        elif not media_ids or force_media or (feedback and draft["regenerate_media"]):
            try:
                vertical = "instagram" in platforms
                style = (profile.brand_voice or {}).get("visual_style") or profile.visual_style or ""
                prompt = draft["media_prompt"]
                if style:
                    prompt += f"\nArt direction: {style}"
                if profile.brand_colors:
                    prompt += f"\nColour palette: {profile.brand_colors}"
                if draft["media_type"] == "video":
                    data, mime = generate_video(prompt, "9:16" if vertical else "16:9")
                else:
                    data, mime = generate_image(prompt, "3:4" if vertical else "1:1")
                mid = str(uuid.uuid4())
                db.add(Media(id=mid, user_id=post.user_id, post_id=post.id, kind=draft["media_type"], mime=mime, size=len(data), data=data))
                media_ids = [mid]
            except Exception as e:
                log.warning("media for post %s failed: %s", post_id, e)
                media_error = str(e)

        db.execute(delete(Media).where(Media.post_id == post.id, Media.id.not_in(media_ids or ["-"])))

        if feedback:
            post.feedback_history = [*(post.feedback_history or []),
                                     {"feedback": feedback, "at": utcnow().isoformat(), "revision": post.revision}]
        post.status = "pending_approval" if post.require_approval else "approved"
        post.approved_at = None if post.require_approval else utcnow()
        post.topic = draft["topic"]
        post.content = draft["content"]
        post.hashtags = draft["hashtags"]
        post.media_prompt = draft["media_prompt"]
        post.media_ids = media_ids
        post.revision = (post.revision or 0) + 1
        post.approval_token = random_token()
        post.error = media_error
        db.commit()

        if post.status == "pending_approval":
            send_approval_email(post, profile, user, list_media(db, media_ids))
        return post


def _conflict(msg: str):
    raise HTTPException(409, msg)


def approve_post(db: Session, post: Post) -> Post:
    if post.status not in ("pending_approval", "draft", "failed", "changes_requested"):
        _conflict(f"Post is {post.status.replace('_', ' ')} and cannot be approved")
    post.status, post.approved_at = "approved", utcnow()
    post.scheduled_for = post.scheduled_for or utcnow()
    db.commit()
    return post


def request_changes(db: Session, post: Post, feedback: str | None) -> Post:
    if not (feedback or "").strip():
        raise HTTPException(400, "Please describe the changes you want")
    if post.status in ("publishing", "published", "generating"):
        _conflict(f"Post is {post.status} and cannot be revised")
    post.status = "changes_requested"
    db.commit()
    run_generation(post.id, feedback=feedback.strip())
    return post


def reject_post(db: Session, post: Post) -> Post:
    if post.status in ("publishing", "published"):
        _conflict("Post was already published")
    post.status, post.approval_token = "rejected", None
    db.commit()
    return post


def publish_post(post_id: int):
    """Publishes to every target account. Retries skip accounts that already succeeded."""
    with session_scope() as db:
        post = db.get(Post, post_id)
        results = dict(post.publish_results or {})
        conns = load_connections(db, post.user_id, post.connection_ids or [])
        if not conns:
            post.status, post.error = "failed", "No connected social accounts selected for this post"
            return

        rows = db.scalars(select(Media).where(Media.id.in_(post.media_ids or ["-"]))).all()
        by_id = {m.id: m for m in rows}
        media = [{"kind": m.kind, "mime": m.mime, "data": m.data, "url": media_url(m.id, m.mime)}
                 for i in (post.media_ids or []) if (m := by_id.get(i))]

        for conn in conns:
            key = str(conn.id)
            if results.get(key, {}).get("ok"):
                continue
            base = {"platform": conn.platform, "account": conn.account_name, "at": utcnow().isoformat()}
            text = (post.content or {}).get(conn.platform)
            if not text:
                results[key] = {**base, "ok": False, "error": f"No {conn.platform} copy in this post"}
                continue
            try:
                if conn.refresh_error:
                    raise RuntimeError(conn.refresh_error)
                r = PLATFORM_MODULE[conn.platform].publish(conn, text, media)
                results[key] = {**base, "ok": True, "id": r.get("id"), "url": r.get("url")}
            except Exception as e:
                log.warning("publish post %s → %s failed: %s", post_id, conn.platform, e)
                results[key] = {**base, "ok": False, "error": str(e)}

        failures = [r for r in results.values() if not r["ok"]]
        post.publish_results = results
        post.status = "failed" if failures else "published"
        post.error = "\n".join(f"{f['platform']}: {f['error']}" for f in failures) or None
        if not failures:
            post.published_at = datetime.now(timezone.utc)
        db.commit()
        try:
            send_published_email(post, db.get(Profile, post.user_id), db.get(User, post.user_id))
        except Exception as e:
            log.warning("published email failed: %s", e)

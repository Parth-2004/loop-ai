"""Model → JSON dicts in the shape the React client expects."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Media, Post, Profile, Schedule
from ..scheduling import describe

EXT = {"image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4"}


def media_url(media_id: str, mime: str) -> str:
    return f"{settings.app_url}/media/{media_id}.{EXT.get(mime, 'bin')}"


def list_media(db: Session, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    rows = {m.id: m for m in db.execute(select(Media.id, Media.kind, Media.mime, Media.size).where(Media.id.in_(ids)))}
    return [{"id": i, "kind": rows[i].kind, "mime": rows[i].mime, "size": rows[i].size, "url": media_url(i, rows[i].mime)}
            for i in ids if i in rows]


def columns(obj, exclude=()) -> dict:
    return {c.key: getattr(obj, c.key) for c in obj.__table__.columns if c.key not in exclude}


def post_dict(db: Session, p: Post) -> dict:
    return {**columns(p), "media": list_media(db, p.media_ids or [])}


def profile_dict(p: Profile, user) -> dict:
    return {**columns(p, exclude=("imap_config",)), "imap_connected": bool(p.imap_config),
            "user_email": user.email, "user_name": user.name}


def schedule_dict(s: Schedule) -> dict:
    return {**columns(s), "label": describe(s)}

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Connection
from ..security import decrypt, encrypt
from . import linkedin, meta, x

# OAuth providers (what the user clicks "Connect" on)
PROVIDERS = {"x": x, "linkedin": linkedin, "meta": meta}
# Publishing targets (what a connection row is)
PLATFORM_MODULE = {"x": x, "linkedin": linkedin, "facebook": meta, "instagram": meta}
PLATFORMS = ["x", "linkedin", "facebook", "instagram"]


@dataclass
class Conn:
    """A connection with decrypted tokens, handed to platform modules."""

    id: int
    platform: str
    account_id: str
    account_name: str | None
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    meta: dict = field(default_factory=dict)
    refresh_error: str | None = None


def save_connections(db: Session, user_id: int, accounts: list[dict]) -> list[Connection]:
    saved = []
    for a in accounts:
        row = db.scalar(select(Connection).where(
            Connection.user_id == user_id, Connection.platform == a["platform"], Connection.account_id == a["account_id"]))
        if row is None:
            row = Connection(user_id=user_id, platform=a["platform"], account_id=a["account_id"], meta={})
            db.add(row)
        row.account_name = a.get("account_name")
        row.access_token = encrypt(a["access_token"])
        if a.get("refresh_token"):
            row.refresh_token = encrypt(a["refresh_token"])
        row.expires_at = a.get("expires_at")
        row.meta = {**(row.meta or {}), **(a.get("meta") or {})}
        saved.append(row)
    db.commit()
    return saved


def load_connections(db: Session, user_id: int, ids: list[int] | None = None) -> list[Conn]:
    """Connections with decrypted tokens; refreshes any that are (nearly) expired."""
    q = select(Connection).where(Connection.user_id == user_id)
    if ids is not None:
        q = q.where(Connection.id.in_(ids or [-1]))
    out = []
    for row in db.scalars(q):
        c = Conn(row.id, row.platform, row.account_id, row.account_name, decrypt(row.access_token),
                 decrypt(row.refresh_token), row.expires_at, dict(row.meta or {}))
        if c.expires_at and c.expires_at - datetime.now(timezone.utc) < timedelta(minutes=5):
            try:
                t = PLATFORM_MODULE[c.platform].refresh(c)
                row.access_token = encrypt(t["access_token"])
                row.refresh_token = encrypt(t.get("refresh_token") or c.refresh_token)
                row.expires_at = t.get("expires_at")
                db.commit()
                c.access_token, c.expires_at = t["access_token"], t.get("expires_at")
                c.refresh_token = t.get("refresh_token") or c.refresh_token
            except Exception as e:
                c.refresh_error = str(e)
        out.append(c)
    return out

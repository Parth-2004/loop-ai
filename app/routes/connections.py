import logging
import re
from urllib.parse import urlencode

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Connection, OAuthState
from ..platforms import PROVIDERS, save_connections
from ..security import current_user_id, pkce_pair, random_token

log = logging.getLogger("loop.oauth")
router = APIRouter(tags=["connections"])


@router.get("/api/connections")
def list_connections(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Connection).where(Connection.user_id == uid).order_by(Connection.platform, Connection.account_name)).all()
    return {
        "connections": [{"id": c.id, "platform": c.platform, "account_id": c.account_id, "account_name": c.account_name,
                         "expires_at": c.expires_at, "meta": c.meta or {}, "created_at": c.created_at} for c in rows],
        "available": {k: p.configured() for k, p in PROVIDERS.items()},
    }


@router.get("/api/connections/{provider}/start")
def start(provider: str, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    mod = PROVIDERS.get(provider)
    if not mod:
        raise HTTPException(404, "Unknown provider")
    if not mod.configured():
        raise HTTPException(400, f"{provider} app credentials are not configured on the server")
    state = random_token(24)
    verifier, challenge = pkce_pair()
    db.add(OAuthState(state=state, user_id=uid, platform=provider, code_verifier=verifier if mod.uses_pkce else None))
    db.commit()
    return {"url": mod.auth_url(state, challenge)}


@router.patch("/api/connections/{conn_id}")
def set_author(conn_id: int, body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    # Only LinkedIn's author URN (person vs organization page) is user-editable.
    urn = body.get("authorUrn")
    if not urn or not re.match(r"^urn:li:(person|organization):[\w-]+$", urn):
        raise HTTPException(400, "Author must look like urn:li:organization:12345")
    c = db.scalar(select(Connection).where(Connection.id == conn_id, Connection.user_id == uid, Connection.platform == "linkedin"))
    if not c:
        raise HTTPException(404, "LinkedIn connection not found")
    c.meta = {**(c.meta or {}), "authorUrn": urn}
    db.commit()
    return {"connection": {"id": c.id, "meta": c.meta}}


@router.delete("/api/connections/{conn_id}")
def remove(conn_id: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    db.execute(delete(Connection).where(Connection.id == conn_id, Connection.user_id == uid))
    db.commit()
    return {"ok": True}


# OAuth callbacks are public (the browser arrives from the provider); the state row identifies the user.
@router.get("/api/oauth/{provider}/callback")
def callback(provider: str, code: str | None = None, state: str | None = None, error: str | None = None,
             error_description: str | None = None, db: Session = Depends(get_db)):
    def back(**params):
        return RedirectResponse(f"/connections?{urlencode(params)}", status_code=302)

    if error:
        return back(error=error_description or error)
    row = db.get(OAuthState, state) if state else None
    if row:
        db.delete(row)
        db.commit()
    if not row or row.platform != provider:
        return back(error="Login session expired, please try again")
    try:
        accounts = PROVIDERS[provider].handle_callback(code, row.code_verifier)
        saved = save_connections(db, row.user_id, accounts)
        return back(connected=", ".join(f"{s.platform}:{s.account_name}" for s in saved))
    except Exception as e:
        log.exception("oauth %s failed", provider)
        return back(error=str(e))

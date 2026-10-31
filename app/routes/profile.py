import json

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Profile, User
from ..security import current_user_id, encrypt
from ..services.brand import analyze_brand
from ..services.serialize import profile_dict
from ..sources import test_imap

router = APIRouter(prefix="/api/profile", tags=["profile"])

EDITABLE = {
    "account_type", "display_name", "company_name", "website", "industry", "audience", "goals", "tone", "topics",
    "avoid", "brand_colors", "visual_style", "sample_posts", "company_notes", "approval_email", "timezone",
    "brand_voice", "onboarded",
}


def _out(db: Session, uid: int) -> dict:
    return {"profile": profile_dict(db.get(Profile, uid), db.get(User, uid))}


@router.get("")
def get_profile(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    return _out(db, uid)


@router.put("")
def update_profile(body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    p = db.get(Profile, uid)
    for k, v in body.items():
        if k in EDITABLE:
            setattr(p, k, v)
    if p.account_type not in ("individual", "company"):
        raise HTTPException(400, "account_type must be individual or company")
    db.commit()
    return _out(db, uid)


@router.post("/imap")
def connect_imap(body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    host, user, password = body.get("host"), body.get("user"), body.get("pass")
    if not (host and user and password):
        raise HTTPException(400, "IMAP host, username and app password are required")
    cfg = {"host": host, "port": int(body.get("port") or 993), "secure": body.get("secure", True) is not False, "user": user, "pass": password}
    try:
        test_imap(cfg)
    except Exception as e:
        raise HTTPException(400, f"Could not connect to your mailbox: {e}")
    db.get(Profile, uid).imap_config = encrypt(json.dumps(cfg))
    db.commit()
    return {"ok": True}


@router.delete("/imap")
def disconnect_imap(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    p = db.get(Profile, uid)
    p.imap_config, p.email_insights = None, None
    db.commit()
    return {"ok": True}


@router.post("/analyze")
def analyze(body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    result = analyze_brand(db, uid, include_email=body.get("includeEmail", True) is not False,
                           include_social=body.get("includeSocial", True) is not False,
                           include_website=body.get("includeWebsite", True) is not False)
    return {**result, **_out(db, uid)}

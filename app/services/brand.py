"""Gathers every available signal and asks Gemini to build the brand voice guide."""
import json
import logging

from sqlalchemy.orm import Session

from ..ai.brand import analyze_emails, analyze_social_history, build_brand_voice, summarize_website
from ..db import utcnow
from ..models import Profile
from ..platforms import PLATFORM_MODULE, load_connections
from ..security import decrypt
from ..sources import fetch_email_samples, fetch_website_text

log = logging.getLogger("loop.brand")


def analyze_brand(db: Session, user_id: int, include_email=True, include_social=True, include_website=True) -> dict:
    p = db.get(Profile, user_id)
    report = {"website": None, "email": None, "social": None}

    if include_website and p.website:
        try:
            p.website_summary = summarize_website(fetch_website_text(p.website))
            report["website"] = "ok"
        except Exception as e:
            report["website"] = str(e)

    if include_email and p.imap_config:
        try:
            emails = fetch_email_samples(json.loads(decrypt(p.imap_config)))
            p.email_insights = analyze_emails(emails, p.account_type)
            report["email"] = f"analysed {len(emails)} emails"
        except Exception as e:
            report["email"] = str(e)

    if include_social:
        by_platform: dict[str, list[str]] = {}
        for conn in load_connections(db, user_id):
            try:
                by_platform.setdefault(conn.platform, []).extend(PLATFORM_MODULE[conn.platform].recent_posts(conn))
            except Exception as e:
                log.warning("could not read %s history: %s", conn.platform, e)
        total = sum(len(v) for v in by_platform.values())
        if total:
            p.social_insights = analyze_social_history(by_platform)
            report["social"] = f"analysed {total} past posts"

    p.brand_voice = build_brand_voice(p)
    p.analyzed_at = utcnow()
    db.commit()
    return {"voice": p.brand_voice, "report": report}

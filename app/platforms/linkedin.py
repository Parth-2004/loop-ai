"""LinkedIn — OpenID Connect sign-in + Posts API (images & video), personal profile or organization page."""
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode

import httpx

from ..config import oauth_redirect, settings
from .http import api

REST = "https://api.linkedin.com/rest"
SCOPES = "openid profile email w_member_social"
uses_pkce = False


def configured() -> bool:
    return bool(settings.linkedin_client_id and settings.linkedin_client_secret)


def _headers(conn, **extra) -> dict:
    return {
        "Authorization": f"Bearer {conn.access_token}",
        "LinkedIn-Version": settings.linkedin_api_version,
        "X-Restli-Protocol-Version": "2.0.0",
        **extra,
    }


def auth_url(state: str, challenge: str | None = None) -> str:
    return "https://www.linkedin.com/oauth/v2/authorization?" + urlencode(
        {"response_type": "code", "client_id": settings.linkedin_client_id, "redirect_uri": oauth_redirect("linkedin"), "state": state, "scope": SCOPES}
    )


def _token(data: dict) -> dict:
    t = api("LinkedIn", "POST", "https://www.linkedin.com/oauth/v2/accessToken",
            data={**data, "client_id": settings.linkedin_client_id, "client_secret": settings.linkedin_client_secret}).json()
    return {
        "access_token": t["access_token"],
        "refresh_token": t.get("refresh_token"),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=t["expires_in"]) if t.get("expires_in") else None,
    }


def handle_callback(code: str, verifier=None) -> list[dict]:
    t = _token({"grant_type": "authorization_code", "code": code, "redirect_uri": oauth_redirect("linkedin")})
    me = api("LinkedIn", "GET", "https://api.linkedin.com/v2/userinfo", headers={"Authorization": f"Bearer {t['access_token']}"}).json()
    # authorUrn can be switched to an organization (urn:li:organization:123) if the app has w_organization_social
    return [{"platform": "linkedin", "account_id": me["sub"], "account_name": me.get("name"), **t,
             "meta": {"authorUrn": f"urn:li:person:{me['sub']}", "picture": me.get("picture")}}]


def refresh(conn) -> dict:
    if not conn.refresh_token:
        raise RuntimeError("LinkedIn token expired; please reconnect LinkedIn")
    t = _token({"grant_type": "refresh_token", "refresh_token": conn.refresh_token})
    t["refresh_token"] = t["refresh_token"] or conn.refresh_token
    return t


def _escape(text: str) -> str:
    # LinkedIn "little text" format reserves these characters.
    return re.sub(r"([\\|{}@\[\]()<>#*_~])", r"\\\1", text)


def _upload_image(conn, owner: str, m) -> str:
    v = api("LinkedIn", "POST", f"{REST}/images?action=initializeUpload", headers=_headers(conn),
            json={"initializeUploadRequest": {"owner": owner}}).json()["value"]
    api("LinkedIn", "PUT", v["uploadUrl"], headers={"Authorization": f"Bearer {conn.access_token}", "Content-Type": m["mime"]}, content=m["data"])
    return v["image"]


def _upload_video(conn, owner: str, m) -> str:
    v = api("LinkedIn", "POST", f"{REST}/videos?action=initializeUpload", headers=_headers(conn),
            json={"initializeUploadRequest": {"owner": owner, "fileSizeBytes": len(m["data"]), "uploadCaptions": False, "uploadThumbnail": False}}).json()["value"]
    part_ids = []
    for part in v["uploadInstructions"]:
        r = httpx.put(part["uploadUrl"], headers={"Content-Type": "application/octet-stream"},
                      content=m["data"][part["firstByte"] : part["lastByte"] + 1], timeout=300)
        r.raise_for_status()
        part_ids.append(r.headers.get("etag"))
    api("LinkedIn", "POST", f"{REST}/videos?action=finalizeUpload", headers=_headers(conn),
        json={"finalizeUploadRequest": {"video": v["video"], "uploadToken": v.get("uploadToken") or "", "uploadedPartIds": part_ids}})
    for _ in range(30):  # wait for processing so the post renders with the video
        status = api("LinkedIn", "GET", f"{REST}/videos/{quote(v['video'], safe='')}", headers=_headers(conn)).json().get("status")
        if status == "AVAILABLE":
            break
        if status == "PROCESSING_FAILED":
            raise RuntimeError("LinkedIn video processing failed")
        time.sleep(5)
    return v["video"]


def publish(conn, text: str, media: list[dict]) -> dict:
    author = (conn.meta or {}).get("authorUrn") or f"urn:li:person:{conn.account_id}"
    post = {
        "author": author,
        "commentary": _escape(text),
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    if media:
        m = media[0]
        post["content"] = {"media": {"id": _upload_video(conn, author, m) if m["kind"] == "video" else _upload_image(conn, author, m)}}
    r = api("LinkedIn", "POST", f"{REST}/posts", headers=_headers(conn), json=post)
    pid = r.headers.get("x-restli-id")
    return {"id": pid, "url": f"https://www.linkedin.com/feed/update/{pid}" if pid else None}


def recent_posts(conn) -> list[str]:
    # Reading a member's own posts needs restricted scopes (r_member_social), so LinkedIn history comes
    # from the sample posts the user pastes during onboarding instead.
    return []

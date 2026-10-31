"""X (Twitter) — OAuth 2.0 with PKCE, v2 media upload and tweets."""
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from ..config import oauth_redirect, settings
from .http import api, body

API = "https://api.x.com/2"
SCOPES = "tweet.read tweet.write users.read offline.access media.write"
uses_pkce = True


def configured() -> bool:
    return bool(settings.x_client_id and settings.x_client_secret)


def auth_url(state: str, challenge: str) -> str:
    return "https://x.com/i/oauth2/authorize?" + urlencode(
        {
            "response_type": "code",
            "client_id": settings.x_client_id,
            "redirect_uri": oauth_redirect("x"),
            "scope": SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )


def _token(params: dict) -> dict:
    b = api(
        "X", "POST", f"{API}/oauth2/token",
        auth=(settings.x_client_id, settings.x_client_secret),
        data={"client_id": settings.x_client_id, **params},
    ).json()
    return {
        "access_token": b["access_token"],
        "refresh_token": b.get("refresh_token"),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=b["expires_in"]) if b.get("expires_in") else None,
    }


def handle_callback(code: str, verifier: str | None) -> list[dict]:
    t = _token({"grant_type": "authorization_code", "code": code, "redirect_uri": oauth_redirect("x"), "code_verifier": verifier})
    me = api("X", "GET", f"{API}/users/me", headers={"Authorization": f"Bearer {t['access_token']}"}).json()["data"]
    return [{"platform": "x", "account_id": me["id"], "account_name": f"@{me['username']}", **t, "meta": {"username": me["username"]}}]


def refresh(conn) -> dict:
    if not conn.refresh_token:
        raise RuntimeError("X connection has no refresh token; please reconnect")
    return _token({"grant_type": "refresh_token", "refresh_token": conn.refresh_token})


def _upload(conn, m) -> str:
    auth = {"Authorization": f"Bearer {conn.access_token}"}
    category = "tweet_video" if m["kind"] == "video" else "tweet_image"
    init = api("X", "POST", f"{API}/media/upload/initialize", headers=auth,
               json={"media_type": m["mime"], "total_bytes": len(m["data"]), "media_category": category}).json()
    media_id = init["data"]["id"]

    chunk = 4 * 1024 * 1024
    for seg, i in enumerate(range(0, len(m["data"]), chunk)):
        api("X", "POST", f"{API}/media/upload/{media_id}/append", headers=auth,
            data={"segment_index": str(seg)}, files={"media": ("blob", m["data"][i : i + chunk], m["mime"])})

    b = body(api("X", "POST", f"{API}/media/upload/{media_id}/finalize", headers=auth))
    info = (b.get("data") or {}).get("processing_info")
    while info and info.get("state") in ("pending", "in_progress"):
        time.sleep(info.get("check_after_secs", 3))
        b = api("X", "GET", f"{API}/media/upload", headers=auth, params={"media_id": media_id, "command": "STATUS"}).json()
        info = (b.get("data") or {}).get("processing_info")
    if info and info.get("state") == "failed":
        raise RuntimeError(f"X media processing failed: {info}")
    return media_id


def publish(conn, text: str, media: list[dict]) -> dict:
    payload: dict = {"text": text}
    if media:
        payload["media"] = {"media_ids": [_upload(conn, m) for m in media[:4]]}
    b = api("X", "POST", f"{API}/tweets", headers={"Authorization": f"Bearer {conn.access_token}"}, json=payload).json()
    tid = b["data"]["id"]
    return {"id": tid, "url": f"https://x.com/{(conn.meta or {}).get('username', 'i')}/status/{tid}"}


def recent_posts(conn) -> list[str]:
    b = api("X", "GET", f"{API}/users/{conn.account_id}/tweets", headers={"Authorization": f"Bearer {conn.access_token}"},
            params={"max_results": 20, "exclude": "retweets,replies"}).json()
    return [t["text"] for t in b.get("data") or []]

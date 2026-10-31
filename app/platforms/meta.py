"""Facebook Pages + Instagram Business/Creator accounts via the Meta Graph API."""
import time
from urllib.parse import urlencode

from ..config import oauth_redirect, settings
from .http import api

SCOPES = ",".join(
    ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "business_management"]
)
uses_pkce = False


def graph() -> str:
    return f"https://graph.facebook.com/{settings.meta_graph_version}"


def configured() -> bool:
    return bool(settings.meta_app_id and settings.meta_app_secret)


def auth_url(state: str, challenge: str | None = None) -> str:
    return f"https://www.facebook.com/{settings.meta_graph_version}/dialog/oauth?" + urlencode(
        {"client_id": settings.meta_app_id, "redirect_uri": oauth_redirect("meta"), "state": state, "scope": SCOPES, "response_type": "code"}
    )


def handle_callback(code: str, verifier=None) -> list[dict]:
    creds = {"client_id": settings.meta_app_id, "client_secret": settings.meta_app_secret}
    short = api("Meta", "GET", f"{graph()}/oauth/access_token", params={**creds, "redirect_uri": oauth_redirect("meta"), "code": code}).json()
    long = api("Meta", "GET", f"{graph()}/oauth/access_token",
               params={**creds, "grant_type": "fb_exchange_token", "fb_exchange_token": short["access_token"]}).json()
    # Page tokens derived from a long-lived user token do not expire.
    pages = api("Meta", "GET", f"{graph()}/me/accounts", params={
        "fields": "id,name,access_token,instagram_business_account{id,username}", "limit": 100, "access_token": long["access_token"]}).json()

    out = []
    for page in pages.get("data") or []:
        out.append({"platform": "facebook", "account_id": page["id"], "account_name": page["name"],
                    "access_token": page["access_token"], "meta": {"pageId": page["id"]}})
        ig = page.get("instagram_business_account")
        if ig:
            out.append({"platform": "instagram", "account_id": ig["id"], "account_name": f"@{ig.get('username') or ig['id']}",
                        "access_token": page["access_token"], "meta": {"pageId": page["id"], "username": ig.get("username")}})
    if not out:
        raise RuntimeError("No Facebook Pages were shared with Loop AI. Re-connect and select at least one Page.")
    return out


def _publish_facebook(conn, text: str, media: list[dict]) -> dict:
    tok = {"access_token": conn.access_token}
    if not media:
        b = api("Facebook", "POST", f"{graph()}/{conn.account_id}/feed", data={"message": text, **tok}).json()
    elif media[0]["kind"] == "video":
        b = api("Facebook", "POST", f"{graph()}/{conn.account_id}/videos", data={"file_url": media[0]["url"], "description": text, **tok}).json()
    else:
        b = api("Facebook", "POST", f"{graph()}/{conn.account_id}/photos", data={"url": media[0]["url"], "caption": text, **tok}).json()
    pid = b.get("post_id") or b.get("id")
    return {"id": pid, "url": f"https://www.facebook.com/{pid}"}


def _publish_instagram(conn, text: str, media: list[dict]) -> dict:
    if not media:
        raise RuntimeError("Instagram posts require an image or video")
    m, tok = media[0], {"access_token": conn.access_token}
    params = ({"media_type": "REELS", "video_url": m["url"], "caption": text, "share_to_feed": "true"}
              if m["kind"] == "video" else {"image_url": m["url"], "caption": text})
    container = api("Instagram", "POST", f"{graph()}/{conn.account_id}/media", data={**params, **tok}).json()

    for _ in range(60):  # wait for Instagram to fetch and process the media
        s = api("Instagram", "GET", f"{graph()}/{container['id']}", params={"fields": "status_code,status", **tok}).json()
        if s.get("status_code") == "FINISHED":
            break
        if s.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram media processing failed: {s.get('status')}")
        time.sleep(10 if m["kind"] == "video" else 3)

    pub = api("Instagram", "POST", f"{graph()}/{conn.account_id}/media_publish", data={"creation_id": container["id"], **tok}).json()
    try:
        link = api("Instagram", "GET", f"{graph()}/{pub['id']}", params={"fields": "permalink", **tok}).json().get("permalink")
    except Exception:
        link = None
    return {"id": pub["id"], "url": link}


def publish(conn, text: str, media: list[dict]) -> dict:
    return _publish_instagram(conn, text, media) if conn.platform == "instagram" else _publish_facebook(conn, text, media)


def recent_posts(conn) -> list[str]:
    tok = {"access_token": conn.access_token, "limit": 20}
    if conn.platform == "instagram":
        b = api("Instagram", "GET", f"{graph()}/{conn.account_id}/media", params={"fields": "caption", **tok}).json()
        return [p["caption"] for p in b.get("data") or [] if p.get("caption")]
    b = api("Facebook", "GET", f"{graph()}/{conn.account_id}/posts", params={"fields": "message", **tok}).json()
    return [p["message"] for p in b.get("data") or [] if p.get("message")]


def refresh(conn):
    raise RuntimeError("Meta token expired; please reconnect Facebook/Instagram")

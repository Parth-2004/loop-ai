"""Approval and publish-result emails."""
import html
from datetime import datetime
from zoneinfo import ZoneInfo

from ..config import settings
from ..emailer import send_email

LABEL = {"x": "X (Twitter)", "linkedin": "LinkedIn", "facebook": "Facebook", "instagram": "Instagram"}


def recipient(profile, user) -> str | None:
    return (profile.approval_email if profile else None) or user.email


def format_when(dt: datetime | None, tz: str | None) -> str:
    if not dt:
        return "as soon as you approve"
    try:
        local = dt.astimezone(ZoneInfo(tz or "UTC"))
    except Exception:
        local = dt
    return local.strftime("%A, %d %B %Y at %H:%M ") + (tz or "UTC")


def _button(href: str, label: str, bg: str) -> str:
    return (f'<a href="{href}" style="display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:10px;'
            f'background:{bg};color:#fff;text-decoration:none;font-weight:600;font-family:Arial,sans-serif">{label}</a>')


def send_approval_email(post, profile, user, media: list[dict]):
    to = recipient(profile, user)
    if not to:
        return
    # Links open a review page (no one-click GET actions, so email link scanners can't approve by accident).
    review = f"{settings.app_url}/approve/{post.approval_token}"
    when = format_when(post.scheduled_for, profile.timezone if profile else None)
    m = media[0] if media else None
    media_html = "" if not m else (
        f'<p><a href="{m["url"]}">▶ Watch the generated video</a></p>' if m["kind"] == "video"
        else f'<img src="{m["url"]}" alt="Generated image" style="max-width:100%;border-radius:12px;margin:8px 0" />'
    )
    sections = "".join(
        f"""<div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:12px 0">
          <div style="font-size:12px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em">{LABEL.get(p, p)}</div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;color:#111827;margin-top:6px">{html.escape(text)}</div>
        </div>"""
        for p, text in (post.content or {}).items() if text
    )
    body = f"""
    <div style="background:#f4f4f7;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
        <div style="font-size:20px;font-weight:800;color:#111827">🔁 Loop AI · Post ready for review</div>
        <p style="color:#4b5563;font-size:14px">Revision {post.revision} · Scheduled for <b>{html.escape(when)}</b></p>
        <h2 style="font-size:18px;color:#111827;margin:16px 0 4px">{html.escape(post.topic or 'New post')}</h2>
        {media_html}{sections}
        <div style="margin-top:20px">
          {_button(review + '?intent=approve', '✓ Approve', '#16a34a')}
          {_button(review + '?intent=changes', '✎ Request changes', '#6d28d9')}
          {_button(review + '?intent=reject', '✕ Reject', '#6b7280')}
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">Nothing is posted until you approve. Use the buttons above to review — replies to this email are not read.</p>
      </div>
    </div>"""
    text = (f"Loop AI — post ready for review: {post.topic}\nScheduled for {when}\n\n"
            + "\n\n".join(f"[{LABEL.get(p, p)}]\n{t}" for p, t in (post.content or {}).items())
            + f"\n\nReview, approve or request changes: {review}")
    send_email(to, f"[Review] {post.topic or 'New post'} — Loop AI", body, text)


def send_published_email(post, profile, user):
    to = recipient(profile, user)
    if not to:
        return
    def row(r: dict) -> str:
        if r.get("ok"):
            link = f' — <a href="{r["url"]}">view</a>' if r.get("url") else ""
            status = f"✅ published{link}"
        else:
            status = f"❌ {html.escape(r.get('error') or '')}"
        return f"<li>{LABEL.get(r['platform'], r['platform'])} ({html.escape(r.get('account') or '')}): {status}</li>"

    rows = "".join(row(r) for r in (post.publish_results or {}).values())
    ok = post.status == "published"
    send_email(
        to,
        f"{'✅ Published' if ok else '⚠️ Publishing issue'}: {post.topic or 'your post'} — Loop AI",
        f'<div style="font-family:Arial,sans-serif"><p><b>{html.escape(post.topic or "")}</b></p><ul>{rows}</ul>'
        f'<p><a href="{settings.app_url}/posts/{post.id}">Open in Loop AI</a></p></div>',
        f"{'Published' if ok else 'Publishing issue'}: {post.topic}\n{settings.app_url}/posts/{post.id}",
    )

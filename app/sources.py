"""External signal sources used to learn the brand: the public website and the owner's mailbox (IMAP)."""
import email
import html as html_lib
import imaplib
import re
from email import policy

import httpx


def fetch_website_text(url: str) -> str:
    if not url:
        return ""
    target = url if re.match(r"^https?://", url, re.I) else f"https://{url}"
    r = httpx.get(target, headers={"User-Agent": "Mozilla/5.0 (compatible; LoopAI/1.0; +brand-analysis)"}, timeout=15, follow_redirects=True)
    r.raise_for_status()
    page = r.text
    meta = "\n".join(
        re.findall(r"<meta[^>]+(?:name|property)=[\"'](?:description|og:description|og:title)[\"'][^>]*content=[\"']([^\"']+)", page, re.I)
    )
    return f"{meta}\n{html_to_text(page)}"[:30000]


def html_to_text(page: str) -> str:
    page = re.sub(r"<(script|style|noscript|svg|iframe)[\s\S]*?</\1>", " ", page, flags=re.I)
    page = re.sub(r"<[^>]+>", " ", page)
    return re.sub(r"\s+", " ", html_lib.unescape(page)).strip()


# ---------- IMAP ----------
def _connect(cfg: dict) -> imaplib.IMAP4:
    port = int(cfg.get("port") or 993)
    m = imaplib.IMAP4_SSL(cfg["host"], port, timeout=30) if cfg.get("secure", True) else imaplib.IMAP4(cfg["host"], port, timeout=30)
    m.login(cfg["user"], cfg["pass"])
    return m


def test_imap(cfg: dict):
    m = _connect(cfg)
    m.logout()


def _find_sent(m: imaplib.IMAP4) -> str | None:
    typ, boxes = m.list()
    names = []
    for raw in boxes or []:
        line = raw.decode(errors="ignore") if isinstance(raw, bytes) else str(raw)
        match = re.match(r'\((?P<flags>[^)]*)\) "?(?P<sep>[^"]*)"? (?P<name>.+)$', line)
        if not match:
            continue
        name = match.group("name").strip()
        if "\\Sent" in match.group("flags"):
            return name
        names.append(name)
    return next((n for n in names if "sent" in n.lower()), None)


def _read_folder(m: imaplib.IMAP4, mailbox: str, limit: int, label: str) -> list[dict]:
    typ, _ = m.select(mailbox if mailbox.startswith('"') else f'"{mailbox}"', readonly=True)
    if typ != "OK":
        return []
    typ, data = m.search(None, "ALL")
    ids = (data[0] or b"").split()[-limit:]
    out = []
    for mid in ids:
        typ, msg_data = m.fetch(mid, "(RFC822)")
        raw = next((part[1] for part in msg_data if isinstance(part, tuple)), None)
        if not raw:
            continue
        msg = email.message_from_bytes(raw, policy=policy.default)
        body = msg.get_body(preferencelist=("plain", "html"))
        text = body.get_content() if body else ""
        if body is not None and body.get_content_type() == "text/html":
            text = html_to_text(text)
        text = re.sub(r"(?m)^>.*$", "", text).strip()  # strip quoted replies
        if text:
            out.append({"folder": label, "subject": str(msg.get("subject", "")), "text": text[:4000]})
    return out


def fetch_email_samples(cfg: dict, sent_limit: int = 25, inbox_limit: int = 25) -> list[dict]:
    """Reads the most recent sent mail (style) and inbox mail (topics)."""
    m = _connect(cfg)
    try:
        emails = []
        sent = _find_sent(m)
        if sent:
            emails += _read_folder(m, sent, sent_limit, "sent")
        emails += _read_folder(m, "INBOX", inbox_limit, "inbox")
        return emails
    finally:
        try:
            m.logout()
        except Exception:
            pass

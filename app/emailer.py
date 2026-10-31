import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr

import httpx

from .config import settings

log = logging.getLogger("loop.email")


def email_configured() -> bool:
    return bool(settings.email.resend_api_key or settings.email.smtp_host)


def send_email(to: str, subject: str, html: str, text: str):
    """Resend HTTP API (preferred on Render, where SMTP may be restricted) → SMTP → console log."""
    cfg = settings.email
    if cfg.resend_api_key:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {cfg.resend_api_key}"},
            json={"from": cfg.sender, "to": [to], "subject": subject, "html": html, "text": text},
            timeout=30,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Resend error {r.status_code}: {r.text}")
        return

    if cfg.smtp_host:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = cfg.sender, to, subject
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
        if cfg.smtp_secure:
            with smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, context=ssl.create_default_context(), timeout=30) as s:
                if cfg.smtp_user:
                    s.login(cfg.smtp_user, cfg.smtp_pass)
                s.send_message(msg, from_addr=parseaddr(cfg.sender)[1] or cfg.smtp_user)
        else:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30) as s:
                s.starttls(context=ssl.create_default_context())
                if cfg.smtp_user:
                    s.login(cfg.smtp_user, cfg.smtp_pass)
                s.send_message(msg, from_addr=parseaddr(cfg.sender)[1] or cfg.smtp_user)
        return

    log.warning("No email provider configured. Would send to %s: %r\n%s", to, subject, text)

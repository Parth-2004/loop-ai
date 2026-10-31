import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default) or default


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v in (None, "") else v.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Gemini:
    api_key: str = _env("GEMINI_API_KEY")
    text_model: str = _env("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
    # Used when the main text model is overloaded (503) or rate-limited
    fallback_model: str = _env("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")
    # Either an Imagen model (imagen-4.0-generate-001) or a Gemini image model (gemini-2.5-flash-image)
    image_model: str = _env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    video_model: str = _env("GEMINI_VIDEO_MODEL", "veo-3.0-fast-generate-001")


@dataclass(frozen=True)
class Email:
    sender: str = _env("EMAIL_FROM", "Loop AI <onboarding@resend.dev>")
    resend_api_key: str = _env("RESEND_API_KEY")
    smtp_host: str = _env("SMTP_HOST")
    smtp_port: int = int(_env("SMTP_PORT", "587"))
    smtp_secure: bool = _bool("SMTP_SECURE", False)
    smtp_user: str = _env("SMTP_USER")
    smtp_pass: str = _env("SMTP_PASS")


def _database_url() -> str:
    url = _env("DATABASE_URL", f"sqlite:///{ROOT / 'loop_ai.db'}")
    # Render/Heroku-style URLs → SQLAlchemy psycopg3 driver
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


@dataclass(frozen=True)
class Settings:
    port: int = int(_env("PORT", "3000"))
    is_prod: bool = _env("ENV", _env("NODE_ENV")) == "production" or bool(os.getenv("RENDER"))
    # Public base URL. Render sets RENDER_EXTERNAL_URL automatically.
    app_url: str = (_env("APP_URL") or _env("RENDER_EXTERNAL_URL") or f"http://localhost:{_env('PORT', '3000')}").rstrip("/")
    database_url: str = field(default_factory=_database_url)
    database_ssl: bool = _bool("DATABASE_SSL", False)
    jwt_secret: str = _env("JWT_SECRET", "dev-only-jwt-secret-change-me")
    encryption_key: str = _env("ENCRYPTION_KEY") or _env("JWT_SECRET") or "dev-only-encryption-key"
    worker_enabled: bool = _bool("WORKER_ENABLED", True)
    worker_interval: int = int(_env("WORKER_INTERVAL_SECONDS", "60"))

    gemini: Gemini = field(default_factory=Gemini)
    email: Email = field(default_factory=Email)

    x_client_id: str = _env("X_CLIENT_ID")
    x_client_secret: str = _env("X_CLIENT_SECRET")
    linkedin_client_id: str = _env("LINKEDIN_CLIENT_ID")
    linkedin_client_secret: str = _env("LINKEDIN_CLIENT_SECRET")
    linkedin_api_version: str = _env("LINKEDIN_API_VERSION", "202601")
    meta_app_id: str = _env("META_APP_ID")
    meta_app_secret: str = _env("META_APP_SECRET")
    meta_graph_version: str = _env("META_GRAPH_VERSION", "v21.0")


settings = Settings()


def oauth_redirect(provider: str) -> str:
    return f"{settings.app_url}/api/oauth/{provider}/callback"

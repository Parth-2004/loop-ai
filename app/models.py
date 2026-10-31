from sqlalchemy import JSON, Boolean, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, UTCDateTime, utcnow

# Lists/dicts are stored as JSON so the same schema works on PostgreSQL and SQLite.
# Always assign new objects to JSON columns (don't mutate in place) so changes are detected.


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    name: Mapped[str | None] = mapped_column(String(200))
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    account_type: Mapped[str] = mapped_column(String(20), default="individual")  # individual | company
    display_name: Mapped[str | None] = mapped_column(Text)
    company_name: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    goals: Mapped[str | None] = mapped_column(Text)
    tone: Mapped[str | None] = mapped_column(Text)
    topics: Mapped[str | None] = mapped_column(Text)
    avoid: Mapped[str | None] = mapped_column(Text)
    brand_colors: Mapped[str | None] = mapped_column(Text)
    visual_style: Mapped[str | None] = mapped_column(Text)
    sample_posts: Mapped[str | None] = mapped_column(Text)
    company_notes: Mapped[str | None] = mapped_column(Text)
    website_summary: Mapped[str | None] = mapped_column(Text)
    email_insights: Mapped[str | None] = mapped_column(Text)
    social_insights: Mapped[str | None] = mapped_column(Text)
    brand_voice = mapped_column(JSON)
    approval_email: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    imap_config: Mapped[str | None] = mapped_column(Text)  # encrypted JSON
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    analyzed_at = mapped_column(UTCDateTime)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (UniqueConstraint("user_id", "platform", "account_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(20))  # x | linkedin | facebook | instagram
    account_id: Mapped[str] = mapped_column(String(100))
    account_name: Mapped[str | None] = mapped_column(Text)
    access_token: Mapped[str] = mapped_column(Text)  # encrypted
    refresh_token: Mapped[str | None] = mapped_column(Text)  # encrypted
    expires_at = mapped_column(UTCDateTime)
    meta = mapped_column(JSON, default=dict)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class OAuthState(Base):
    __tablename__ = "oauth_states"
    state: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(20))
    code_verifier: Mapped[str | None] = mapped_column(Text)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(Text)
    frequency: Mapped[str] = mapped_column(String(20))  # hourly | daily | weekly | custom
    every_hours: Mapped[int] = mapped_column(Integer, default=1)
    time_of_day: Mapped[str] = mapped_column(String(5), default="09:00")
    days_of_week = mapped_column(JSON, default=lambda: [1])  # 0=Sun..6=Sat
    cron: Mapped[str] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    connection_ids = mapped_column(JSON, default=list)
    content_brief: Mapped[str | None] = mapped_column(Text)
    media_type: Mapped[str] = mapped_column(String(10), default="auto")  # none | image | video | auto
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    lead_minutes: Mapped[int] = mapped_column(Integer, default=120)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_run_at = mapped_column(UTCDateTime, index=True)
    last_run_at = mapped_column(UTCDateTime)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (Index("posts_status_due", "status", "scheduled_for"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id", ondelete="SET NULL"))
    # generating | pending_approval | changes_requested | approved | publishing | published | failed | rejected | draft
    status: Mapped[str] = mapped_column(String(20), default="generating")
    topic: Mapped[str | None] = mapped_column(Text)
    brief: Mapped[str | None] = mapped_column(Text)
    content = mapped_column(JSON, default=dict)  # {"x": "...", "linkedin": "..."}
    hashtags = mapped_column(JSON, default=list)
    media_type: Mapped[str] = mapped_column(String(10), default="auto")  # requested: none | image | video | auto
    media_prompt: Mapped[str | None] = mapped_column(Text)
    media_ids = mapped_column(JSON, default=list)
    connection_ids = mapped_column(JSON, default=list)
    platforms = mapped_column(JSON, default=list)
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    scheduled_for = mapped_column(UTCDateTime)
    approval_token: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)
    feedback_history = mapped_column(JSON, default=list)
    publish_results = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    approved_at = mapped_column(UTCDateTime)
    published_at = mapped_column(UTCDateTime)
    created_at = mapped_column(UTCDateTime, default=utcnow)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Media(Base):
    __tablename__ = "media"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # image | video
    mime: Mapped[str] = mapped_column(String(50))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at = mapped_column(UTCDateTime, default=utcnow)

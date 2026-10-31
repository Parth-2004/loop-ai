"""Scheduler loop: drafts upcoming slots, publishes approved posts, recovers interrupted jobs."""
import logging
import threading
from datetime import timedelta

from sqlalchemy import delete, select, update

from .config import settings
from .db import session_scope, utcnow
from .models import OAuthState, Post, Schedule
from .scheduling import next_run
from .services import jobs
from .services.posts import create_post, publish_post, run_generation

log = logging.getLogger("loop.worker")
_lock = threading.Lock()
_stop = threading.Event()


def process_schedules():
    """Creates drafts for schedules whose next slot is within their approval lead time."""
    now = utcnow()
    with session_scope() as db:
        due = [s for s in db.scalars(select(Schedule).where(Schedule.active.is_(True), Schedule.next_run_at.is_not(None)))
               if s.next_run_at - timedelta(minutes=s.lead_minutes or 0) <= now]
        for s in due:
            slot = s.next_run_at
            # If the server slept through several slots, skip ahead and only draft the upcoming one.
            following = next_run(s.cron, s.timezone, max(slot, now))
            # Optimistic claim (a 1s window rather than equality, so differently-formatted stored timestamps still match).
            claimed = db.execute(update(Schedule).where(
                Schedule.id == s.id, Schedule.next_run_at.between(slot - timedelta(seconds=1), slot + timedelta(seconds=1)))
                .values(next_run_at=following, last_run_at=now)).rowcount
            db.commit()
            if not claimed:
                continue  # another instance handled it
            post = create_post(db, s.user_id, schedule_id=s.id, connection_ids=s.connection_ids, brief=s.content_brief,
                               media_type=s.media_type, scheduled_for=max(slot, now), require_approval=s.require_approval)
            log.info("schedule %s → drafting post %s for %s", s.id, post.id, slot.isoformat())
            run_generation(post.id)


def process_publishing():
    """Publishes approved posts whose time has come."""
    now = utcnow()
    with session_scope() as db:
        ids = db.scalars(select(Post.id).where(Post.status == "approved", (Post.scheduled_for.is_(None)) | (Post.scheduled_for <= now))
                         .order_by(Post.scheduled_for).limit(10)).all()
        claimed = []
        for pid in ids:
            # Atomic claim so a post is never published twice.
            if db.execute(update(Post).where(Post.id == pid, Post.status == "approved").values(status="publishing", updated_at=now)).rowcount:
                claimed.append(pid)
        db.commit()
    for pid in claimed:
        try:
            publish_post(pid)
        except Exception as e:
            log.exception("publish %s crashed", pid)
            with session_scope() as db:
                db.execute(update(Post).where(Post.id == pid).values(status="failed", error=str(e)))


def recover_stuck():
    """Generation runs in-process; if the server restarted mid-way a post would stay stuck."""
    now = utcnow()
    with session_scope() as db:
        db.execute(update(Post).where(Post.status.in_(["generating", "changes_requested"]), Post.updated_at < now - timedelta(minutes=20))
                   .values(status="failed", error='Generation was interrupted (server restart). Click "Regenerate" to retry.'))
        db.execute(update(Post).where(Post.status == "publishing", Post.updated_at < now - timedelta(minutes=30))
                   .values(status="failed", error='Publishing was interrupted. Click "Publish now" to retry.'))
        db.execute(delete(OAuthState).where(OAuthState.created_at < now - timedelta(hours=1)))


def tick():
    if not _lock.acquire(blocking=False):
        return
    try:
        process_schedules()
        process_publishing()
        recover_stuck()
    except Exception:
        log.exception("worker tick failed")
    finally:
        _lock.release()


def kick():
    """Run a tick soon (e.g. right after an approval) without blocking the request."""
    jobs.submit(tick)


def _loop():
    _stop.wait(5)
    while not _stop.is_set():
        tick()
        _stop.wait(settings.worker_interval)


def start_worker():
    if not settings.worker_enabled:
        log.info("worker disabled")
        return
    log.info("worker running every %ss", settings.worker_interval)
    threading.Thread(target=_loop, name="loop-worker", daemon=True).start()


def stop_worker():
    _stop.set()

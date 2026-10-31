from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Schedule
from ..scheduling import build_cron, next_run, zone
from ..security import current_user_id
from ..services.posts import create_post, run_generation
from ..services.serialize import post_dict, schedule_dict

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


def _parse(body: dict) -> dict:
    s = {
        "name": (body.get("name") or "").strip() or "My schedule",
        "frequency": body.get("frequency") or "daily",
        "every_hours": int(body.get("every_hours") or 1),
        "time_of_day": body.get("time_of_day") or "09:00",
        "days_of_week": [int(d) for d in (body.get("days_of_week") or [1])],
        "timezone": body.get("timezone") or "UTC",
        "connection_ids": [int(c) for c in (body.get("connection_ids") or [])],
        "content_brief": body.get("content_brief") or None,
        "media_type": body.get("media_type") if body.get("media_type") in ("none", "image", "video", "auto") else "auto",
        "require_approval": body.get("require_approval", True) is not False,
        "lead_minutes": max(0, int(body.get("lead_minutes", 120) or 0)),
        "active": body.get("active", True) is not False,
    }
    try:
        zone(s["timezone"])
        s["cron"] = build_cron(s["frequency"], s["every_hours"], s["time_of_day"], s["days_of_week"], body.get("cron"))
        s["next_run_at"] = next_run(s["cron"], s["timezone"])
    except (ValueError, KeyError) as e:
        raise HTTPException(400, f"Invalid schedule: {e}")
    return s


def _get(db: Session, uid: int, sid: int) -> Schedule:
    s = db.scalar(select(Schedule).where(Schedule.id == sid, Schedule.user_id == uid))
    if not s:
        raise HTTPException(404, "Schedule not found")
    return s


@router.get("")
def list_schedules(uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Schedule).where(Schedule.user_id == uid).order_by(Schedule.created_at)).all()
    return {"schedules": [schedule_dict(s) for s in rows]}


@router.post("", status_code=201)
def create(body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    s = Schedule(user_id=uid, **_parse(body))
    db.add(s)
    db.commit()
    return {"schedule": schedule_dict(s)}


@router.put("/{sid}")
def update(sid: int, body: dict = Body(default_factory=dict), uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    s = _get(db, uid, sid)
    for k, v in _parse(body).items():
        setattr(s, k, v)
    db.commit()
    return {"schedule": schedule_dict(s)}


@router.delete("/{sid}")
def remove(sid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    db.execute(delete(Schedule).where(Schedule.id == sid, Schedule.user_id == uid))
    db.commit()
    return {"ok": True}


@router.post("/{sid}/run", status_code=202)
def run_now(sid: int, uid: int = Depends(current_user_id), db: Session = Depends(get_db)):
    """Draft a post from this schedule right now (still goes through approval if enabled)."""
    s = _get(db, uid, sid)
    post = create_post(db, uid, schedule_id=s.id, connection_ids=s.connection_ids, brief=s.content_brief,
                       media_type=s.media_type, require_approval=s.require_approval)
    run_generation(post.id)
    return {"post": post_dict(db, post)}

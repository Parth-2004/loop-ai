from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from croniter import croniter

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def build_cron(frequency: str, every_hours=1, time_of_day="09:00", days_of_week=None, cron=None) -> str:
    """Turns the UI's friendly frequency fields into a cron expression."""
    try:
        h, m = (int(x or 0) for x in str(time_of_day or "09:00").split(":")[:2])
    except ValueError:
        h, m = 9, 0
    if frequency == "hourly":
        n = min(max(int(every_hours or 1), 1), 23)
        return f"{m} * * * *" if n == 1 else f"{m} */{n} * * *"
    if frequency == "daily":
        return f"{m} {h} * * *"
    if frequency == "weekly":
        days = sorted({int(d) for d in (days_of_week or [1])})
        return f"{m} {h} * * {','.join(map(str, days))}"
    if frequency == "custom":
        validate_cron(cron)
        return cron.strip()
    raise ValueError(f'Unknown frequency "{frequency}"')


def validate_cron(expr):
    if not expr or not isinstance(expr, str) or not croniter.is_valid(expr.strip()):
        raise ValueError("Invalid cron expression")


def zone(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except Exception:
        raise ValueError(f'Unknown timezone "{tz}"')


def next_run(cron: str, tz: str = "UTC", after: datetime | None = None) -> datetime:
    """Next occurrence strictly after `after`, evaluated in the schedule's timezone; returned in UTC."""
    start = (after or datetime.now(timezone.utc)).astimezone(zone(tz))
    return croniter(cron, start).get_next(datetime).astimezone(timezone.utc)


def describe(s) -> str:
    if s.frequency == "hourly":
        return f"Every {s.every_hours} hours" if s.every_hours > 1 else "Every hour"
    if s.frequency == "daily":
        return f"Daily at {s.time_of_day}"
    if s.frequency == "weekly":
        return f"Weekly on {', '.join(DAYS[int(d)] for d in s.days_of_week)} at {s.time_of_day}"
    return f"Cron: {s.cron}"

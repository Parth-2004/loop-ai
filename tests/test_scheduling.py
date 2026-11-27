import pytest
from fastapi import HTTPException

from app.routes.schedules import _parse
from app.scheduling import build_cron


def test_weekly_cron_uses_selected_days():
    assert build_cron("weekly", time_of_day="09:30", days_of_week=[1, 3, 5]) == "30 9 * * 1,3,5"


def test_weekly_cron_rejects_empty_day_selection():
    with pytest.raises(ValueError, match="at least one day"):
        build_cron("weekly", days_of_week=[])


def test_weekly_cron_rejects_out_of_range_day():
    with pytest.raises(ValueError, match="between 0 and 6"):
        build_cron("weekly", days_of_week=[7])


def test_schedule_parse_rejects_empty_weekly_selection():
    with pytest.raises(HTTPException) as exc:
        _parse({"frequency": "weekly", "days_of_week": []})
    assert exc.value.status_code == 400


def test_schedule_parse_defaults_weekly_day_when_omitted():
    schedule = _parse({"frequency": "weekly"})
    assert schedule["days_of_week"] == [1]
    assert schedule["cron"] == "0 9 * * 1"

import pytest

from app.scheduling import build_cron


@pytest.mark.parametrize("time_of_day", ["00:00", "09:30", "23:59"])
def test_daily_schedule_accepts_valid_24_hour_times(time_of_day):
    hour, minute = map(int, time_of_day.split(":"))
    assert build_cron("daily", time_of_day=time_of_day) == f"{minute} {hour} * * *"


@pytest.mark.parametrize("time_of_day", ["24:00", "12:60", "9:00", "09:30:00", " 09:30", "not-a-time"])
def test_daily_schedule_rejects_invalid_time_of_day(time_of_day):
    with pytest.raises(ValueError, match="24-hour HH:MM"):
        build_cron("daily", time_of_day=time_of_day)


def test_missing_time_of_day_keeps_default():
    assert build_cron("daily", time_of_day=None) == "0 9 * * *"

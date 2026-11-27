import pytest

from app.media_ranges import parse_byte_range


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("bytes=2-4", (2, 4)),
        ("bytes=7-", (7, 9)),
        ("bytes=-3", (7, 9)),
        ("bytes=-20", (0, 9)),
        ("bytes=0-99", (0, 9)),
    ],
)
def test_valid_byte_ranges(header, expected):
    assert parse_byte_range(header, 10) == expected


@pytest.mark.parametrize("header", [
    "bytes=10-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=", "items=0-1", "bytes=1-2,4-5"
])
def test_invalid_byte_ranges(header):
    with pytest.raises(ValueError):
        parse_byte_range(header, 10)


def test_ranges_on_empty_file_are_invalid():
    with pytest.raises(ValueError):
        parse_byte_range("bytes=0-", 0)

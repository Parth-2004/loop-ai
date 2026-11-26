"""Helpers for parsing HTTP byte ranges for media responses."""
import re


def parse_byte_range(value: str, size: int) -> tuple[int, int]:
    """Return an inclusive byte range or raise ValueError if unsatisfiable/invalid."""
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
    if not match or size <= 0:
        raise ValueError("Invalid byte range")

    first, last = match.groups()
    if not first and not last:
        raise ValueError("Invalid byte range")
    if not first:  # suffix range: bytes=-N
        suffix_length = int(last)
        if suffix_length <= 0:
            raise ValueError("Invalid byte range")
        return max(size - suffix_length, 0), size - 1

    start = int(first)
    if start >= size:
        raise ValueError("Invalid byte range")
    end = min(int(last), size - 1) if last else size - 1
    if end < start:
        raise ValueError("Invalid byte range")
    return start, end

import json

import httpx


class PlatformError(Exception):
    def __init__(self, platform: str, status: int, body):
        detail = body if isinstance(body, str) else json.dumps(body)
        super().__init__(f"{platform} API error {status}: {detail[:500]}")
        self.status, self.body = status, body


def api(platform: str, method: str, url: str, **kwargs) -> httpx.Response:
    """httpx wrapper that raises PlatformError with the provider's message on non-2xx."""
    kwargs.setdefault("timeout", 120)
    r = httpx.request(method, url, **kwargs)
    if r.status_code >= 400:
        try:
            body = r.json()
        except ValueError:
            body = r.text
        raise PlatformError(platform, r.status_code, body)
    return r


def body(r: httpx.Response) -> dict:
    try:
        return r.json() if r.content else {}
    except ValueError:
        return {}

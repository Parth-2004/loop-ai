import base64
import hashlib
import os
import secrets
import threading
import time
from collections import defaultdict, deque

import bcrypt
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, Request, Response

from .config import settings

COOKIE = "loop_session"
_key = hashlib.sha256(settings.encryption_key.encode()).digest()


# ---------- Encryption (AES-256-GCM; base64(iv | ciphertext+tag)) ----------
def encrypt(plain: str | None) -> str | None:
    if plain is None:
        return None
    iv = os.urandom(12)
    return base64.b64encode(iv + AESGCM(_key).encrypt(iv, str(plain).encode(), None)).decode()


def decrypt(payload: str | None) -> str | None:
    if not payload:
        return None
    raw = base64.b64decode(payload)
    return AESGCM(_key).decrypt(raw[:12], raw[12:], None).decode()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def pkce_pair() -> tuple[str, str]:
    verifier = random_token(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


# ---------- Passwords ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(11)).decode()


def check_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


# ---------- Sessions ----------
def set_session(res: Response, user_id: int):
    token = jwt.encode({"uid": user_id, "exp": int(time.time()) + 30 * 86400}, settings.jwt_secret, algorithm="HS256")
    res.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=settings.is_prod, max_age=30 * 86400)


def clear_session(res: Response):
    res.delete_cookie(COOKIE)


def current_user_id(request: Request) -> int:
    """FastAPI dependency: returns the signed-in user's id or 401."""
    header = request.headers.get("authorization", "")
    token = request.cookies.get(COOKIE) or (header[7:] if header.startswith("Bearer ") else None)
    if not token:
        raise HTTPException(401, "Not signed in")
    try:
        return int(jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["uid"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired")


# ---------- Tiny in-memory rate limiter ----------
class RateLimit:
    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def __call__(self, request: Request):
        key = request.client.host if request.client else "unknown"
        now = time.time()
        with self.lock:
            q = self.hits[key]
            while q and q[0] < now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise HTTPException(429, "Too many requests, please try again later")
            q.append(now)

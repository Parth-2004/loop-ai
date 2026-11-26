"""Loop AI — FastAPI application: API, public media, and the built React dashboard."""
import logging
import re
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import ROOT, settings
from .db import get_db, init_db
from .emailer import email_configured
from .models import Media
from .media_ranges import parse_byte_range
from .routes import approvals, auth, connections, posts, profile, schedules
from .worker import start_worker, stop_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("loop")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log.info("Loop AI ready at %s", settings.app_url)
    if not settings.gemini.api_key:
        log.warning("GEMINI_API_KEY is not set — content generation will fail.")
    start_worker()
    yield
    stop_worker()


app = FastAPI(title="Loop AI", version="2.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")


# Errors are always {"error": "..."} — the React client reads that field.
@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    return JSONResponse({"error": f"Invalid request: {first.get('msg', 'bad input')}"}, status_code=400)


@app.exception_handler(Exception)
async def server_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"error": "Something went wrong" if settings.is_prod else str(exc)}, status_code=500)


@app.get("/api/health")
def health():
    g = settings.gemini
    return {"ok": True, "gemini": bool(g.api_key), "email": email_configured(),
            "models": {"textModel": g.text_model, "imageModel": g.image_model, "videoModel": g.video_model}}


for r in (auth, profile, connections, schedules, posts, approvals):
    app.include_router(r.router)


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(rest: str):
    raise HTTPException(404, "Not found")


# Generated media must be publicly reachable: Instagram/Facebook fetch it by URL when publishing.
@app.get("/media/{file}", include_in_schema=False)
def media(file: str, request: Request, db: Session = Depends(get_db)):
    mid = file.split(".")[0]
    if not re.fullmatch(r"[0-9a-f-]{36}", mid):
        raise HTTPException(404, "Not found")
    m = db.get(Media, mid)
    if not m:
        raise HTTPException(404, "Not found")
    headers = {"Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes"}
    range_header = request.headers.get("range")
    if range_header:  # range support so videos stream in browsers and are fetchable by Meta
        size = len(m.data)
        try:
            start, end = parse_byte_range(range_header, size)
        except ValueError:
            raise HTTPException(416, "Range not satisfiable", headers={"Content-Range": f"bytes */{size}"})
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        headers["Content-Length"] = str(end - start + 1)
        return Response(m.data[start : end + 1], status_code=206, media_type=m.mime, headers=headers)
    return Response(m.data, media_type=m.mime, headers=headers)


# Serve the built React app (client/dist) with SPA fallback.
DIST = ROOT / "client" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        if path and f.is_file() and DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")

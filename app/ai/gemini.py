"""Thin wrapper over the google-genai SDK: structured text, images (Gemini/Imagen) and video (Veo)."""
import io
import json
import logging
import time

import httpx
from google import genai
from google.genai import errors, types
from PIL import Image

from ..config import settings

log = logging.getLogger("loop.gemini")
_client: genai.Client | None = None


def client() -> genai.Client:
    global _client
    if not settings.gemini.api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    if _client is None:
        _client = genai.Client(api_key=settings.gemini.api_key)
    return _client


def _with_retry(fn, attempts: int = 3):
    for i in range(attempts):
        try:
            return fn()
        except errors.APIError as e:
            # Retry only rate limits and server errors — not config/validation errors or exhausted quotas.
            quota_gone = e.code == 429 and ("free_tier" in str(e).lower() or "per day" in str(e).lower())
            if not (e.code == 429 or (e.code or 0) >= 500) or quota_gone or i == attempts - 1:
                raise
        except httpx.TransportError:
            if i == attempts - 1:
                raise
        time.sleep(1.5 * 2**i)


def _friendly(e: Exception, what: str) -> RuntimeError:
    """Turns verbose API errors into a message a user can act on."""
    if isinstance(e, errors.APIError):
        msg = str(getattr(e, "message", "") or e)
        if e.code == 429 and "limit: 0" in msg:
            return RuntimeError(f"{what} is not available on the Gemini free tier. Enable billing for your API key "
                                "in Google AI Studio, then click “New visuals & copy”.")
        if e.code == 429 and "free_tier" in msg.lower():
            return RuntimeError(f"{what}: today's Gemini free-tier quota is used up. It resets daily — or enable "
                                "billing for your API key in Google AI Studio for higher limits.")
        if e.code == 429:
            return RuntimeError(f"{what}: Gemini rate limit reached, please try again in a few minutes.")
        if (e.code or 0) >= 500:
            return RuntimeError(f"{what}: Gemini is temporarily overloaded (error {e.code}). Please try again in a minute.")
        return RuntimeError(f"{what} failed ({e.code}): {msg[:300]}")
    return RuntimeError(f"{what} failed: {e}")


def _text_call(contents: str, config: types.GenerateContentConfig):
    """Text generation with retries; if the main model stays overloaded, falls back to a lighter model."""
    models = [settings.gemini.text_model]
    if settings.gemini.fallback_model and settings.gemini.fallback_model != settings.gemini.text_model:
        models.append(settings.gemini.fallback_model)
    for i, model in enumerate(models):
        try:
            return _with_retry(lambda: client().models.generate_content(model=model, contents=contents, config=config))
        except errors.APIError as e:
            # Each model has its own quota, so a quota error or overload on one is worth retrying on the other.
            unavailable = (e.code or 0) >= 500 or e.code == 429
            if not unavailable or i == len(models) - 1:
                raise _friendly(e, "Text generation") from e
            log.warning("%s unavailable (%s); falling back to %s", model, e.code, models[i + 1])


def generate_json(prompt: str, schema: dict, system: str | None = None, temperature: float = 0.8) -> dict:
    res = _text_call(prompt, types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        response_mime_type="application/json",
        response_schema=schema,
    ))
    if not res.text:
        raise RuntimeError("Gemini returned an empty response")
    return json.loads(res.text)


def generate_text(prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
    res = _text_call(prompt, types.GenerateContentConfig(system_instruction=system, temperature=temperature))
    return (res.text or "").strip()


def _to_jpeg(data: bytes) -> bytes:
    # Instagram only accepts JPEG via image_url, so every image is normalised to JPEG.
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1])
        img = bg
    out = io.BytesIO()
    img.convert("RGB").save(out, "JPEG", quality=90)
    return out.getvalue()


def generate_image(prompt: str, aspect_ratio: str = "1:1") -> tuple[bytes, str]:
    try:
        return _generate_image(prompt, aspect_ratio)
    except errors.APIError as e:
        raise _friendly(e, "Image generation") from e


def _generate_image(prompt: str, aspect_ratio: str) -> tuple[bytes, str]:
    model = settings.gemini.image_model
    if model.startswith("imagen"):
        res = _with_retry(
            lambda: client().models.generate_images(
                model=model,
                prompt=prompt,
                config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio=aspect_ratio),
            )
        )
        imgs = res.generated_images or []
        if not imgs or not imgs[0].image or not imgs[0].image.image_bytes:
            raise RuntimeError("Image model returned no image (it may have been filtered by safety settings)")
        return _to_jpeg(imgs[0].image.image_bytes), "image/jpeg"

    res = _with_retry(
        lambda: client().models.generate_content(
            model=model,
            contents=f"{prompt}\n\nCompose the image for a {aspect_ratio} aspect ratio. Do not render any text unless explicitly requested.",
            config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
        )
    )
    for cand in res.candidates or []:
        for part in (cand.content.parts if cand.content else None) or []:
            if part.inline_data and part.inline_data.data:
                return _to_jpeg(part.inline_data.data), "image/jpeg"
    raise RuntimeError("Image model returned no image (it may have been filtered by safety settings)")


def generate_video(prompt: str, aspect_ratio: str = "9:16") -> tuple[bytes, str]:
    """Veo text-to-video. Long-running: polls until done (max ~10 minutes)."""
    try:
        return _generate_video(prompt, aspect_ratio)
    except errors.APIError as e:
        raise _friendly(e, "Video generation") from e


def _generate_video(prompt: str, aspect_ratio: str) -> tuple[bytes, str]:
    c = client()
    op = _with_retry(
        lambda: c.models.generate_videos(
            model=settings.gemini.video_model,
            prompt=prompt,
            config=types.GenerateVideosConfig(aspect_ratio=aspect_ratio),
        )
    )
    deadline = time.time() + 600
    while not op.done:
        if time.time() > deadline:
            raise RuntimeError("Video generation timed out")
        time.sleep(10)
        op = c.operations.get(op)
    if op.error:
        raise RuntimeError(f"Video generation failed: {op.error}")

    videos = (op.response.generated_videos if op.response else None) or []
    if not videos or not videos[0].video:
        raise RuntimeError("Video model returned no video (it may have been filtered by safety settings)")
    video = videos[0].video
    if video.video_bytes:
        return video.video_bytes, video.mime_type or "video/mp4"
    try:
        data = c.files.download(file=video)
        if data:
            return data, "video/mp4"
    except Exception as e:  # fall back to a direct download
        log.warning("files.download failed (%s); fetching URI directly", e)
    r = httpx.get(video.uri, headers={"x-goog-api-key": settings.gemini.api_key}, follow_redirects=True, timeout=300)
    r.raise_for_status()
    return r.content, "video/mp4"

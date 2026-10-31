"""Post writer: platform-native copy + media prompt, and feedback-driven revisions."""
import re
from datetime import date

from .gemini import generate_json

PLATFORM_RULES = {
    "x": "X (Twitter): max 270 characters INCLUDING hashtags and emoji. Punchy hook, one idea, 0-2 hashtags.",
    "linkedin": "LinkedIn: 600-1300 characters. Strong first line (shown before \"see more\"), short paragraphs with "
    "line breaks, professional insight or story, end with a question or CTA, 3-5 hashtags at the end.",
    "facebook": "Facebook: 80-400 characters, conversational and community-oriented, 0-3 hashtags, clear CTA.",
    "instagram": "Instagram: caption up to 2000 characters. Hook in first line, value in the body, line breaks, emoji "
    "where on-brand, CTA, then 8-15 relevant hashtags at the end. The post MUST have an image or video.",
}

_str = {"type": "STRING"}
POST_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "topic": {"type": "STRING", "description": "Short title of the post idea (max 10 words)"},
        "angle": {"type": "STRING", "description": "Why this post, why now, in one sentence"},
        "x": _str,
        "linkedin": _str,
        "facebook": _str,
        "instagram": _str,
        "hashtags": {"type": "ARRAY", "items": _str},
        "media_type": {"type": "STRING", "description": 'One of "none", "image", "video"'},
        "media_prompt": {
            "type": "STRING",
            "description": "Detailed generation prompt for the image or video: subject, composition, lighting, style, "
            "colours, mood. No text overlays, no logos, no real people.",
        },
        "regenerate_media": {"type": "BOOLEAN", "description": "Only for revisions: true if the feedback requires new media"},
    },
    "required": ["topic", "hashtags", "media_type", "media_prompt"],
}

SYSTEM = """You are Loop AI, an expert social media copywriter and content strategist.
You write native, platform-specific posts in the exact voice of the brand you are given.
Never invent statistics, customer names, quotes, prices or claims that are not supported by the brand context.
Never sound like generic AI copy (no "In today's fast-paced world", "unlock", "delve", "game-changer").
Only fill in the platform fields you are asked for; leave others as empty strings."""


def _j(items) -> str:
    return " | ".join(items or [])


def brand_block(p) -> str:
    v = p.brand_voice or {}
    name = (p.company_name or p.display_name) if p.account_type == "company" else p.display_name
    return f"""BRAND: {name or ''}
Type: {p.account_type}
Summary: {v.get('summary', '')}
Voice: {v.get('voice') or p.tone or ''}
Tone attributes: {', '.join(v.get('tone_attributes') or [])}
Audience: {v.get('audience') or p.audience or ''}
Content pillars: {_j(v.get('content_pillars')) or p.topics or ''}
Do: {_j(v.get('do'))}
Don't: {_j(v.get('dont'))} {f'| Avoid: {p.avoid}' if p.avoid else ''}
Vocabulary: {', '.join(v.get('vocabulary') or [])}
Emoji usage: {v.get('emoji_usage', '')}
Hashtag strategy: {v.get('hashtag_strategy', '')}
CTA style: {v.get('call_to_action_style', '')}
Visual style: {v.get('visual_style') or p.visual_style or ''} {f'(brand colours: {p.brand_colors})' if p.brand_colors else ''}
Example hooks: {_j(v.get('sample_hooks'))}

CONTEXT
Goals: {p.goals or ''}
Website summary: {(p.website_summary or '')[:1500]}
Email insights (recent happenings, customer questions): {(p.email_insights or '')[:2500]}
Past social performance notes: {(p.social_insights or '')[:1500]}
Notes: {(p.company_notes or '')[:2000]}"""


def _media_instruction(media_type: str, platforms: list[str]) -> str:
    if media_type == "none" and "instagram" not in platforms:
        return 'Set media_type to "none".'
    if media_type == "image":
        return 'Set media_type to "image".'
    if media_type == "video":
        return 'Set media_type to "video" (an 8-second vertical clip; describe motion and camera movement).'
    ig = ' Instagram is a target, so media_type must be "image" or "video".' if "instagram" in platforms else ""
    return f'Choose the best media_type for this post; prefer "image", use "video" only if motion clearly adds value.{ig}'


def _rules(platforms) -> str:
    return "\n".join(f"- {PLATFORM_RULES[p]}" for p in platforms)


def generate_post(profile, platforms, brief=None, topic_hint=None, media_type="auto", recent_topics=()) -> dict:
    prompt = f"""{brand_block(profile)}

TASK
Create ONE new social media post for these platforms: {', '.join(platforms)}.
{_rules(platforms)}

{f'Campaign brief from the owner: {brief}' if brief else ''}
{f'Requested topic: {topic_hint}' if topic_hint else 'Pick the most valuable topic from the content pillars and context.'}
Today's date: {date.today():%A %d %B %Y}.
Do NOT repeat these recently used topics: {_j(recent_topics) or 'none yet'}.

{_media_instruction(media_type, platforms)}
Write the media_prompt for an AI {'video' if media_type == 'video' else 'image'} model following the visual style."""
    out = generate_json(prompt, POST_SCHEMA, system=SYSTEM, temperature=0.9)
    return _normalise(out, platforms, media_type)


def revise_post(profile, platforms, post, feedback: str, media_type="auto") -> dict:
    current = "\n\n".join(f"[{p}]\n{(post.content or {}).get(p, '')}" for p in platforms)
    history = "\n".join(f"{i + 1}. {f['feedback']}" for i, f in enumerate(post.feedback_history or [])) or "none"
    media = f"{post.media_type}, prompt: {post.media_prompt}" if post.media_ids else "none"
    prompt = f"""{brand_block(profile)}

TASK
The owner reviewed a draft and requested changes. Rewrite the post applying ALL feedback precisely,
keeping everything they did not complain about. Platforms: {', '.join(platforms)}.
{_rules(platforms)}

CURRENT DRAFT
Topic: {post.topic}
{current}
Media: {media}

PREVIOUS FEEDBACK ROUNDS
{history}

NEW FEEDBACK
{feedback}

Set regenerate_media to true only if the feedback is about the image/video or the topic changed substantially.
{_media_instruction(media_type, platforms)}"""
    out = generate_json(prompt, POST_SCHEMA, system=SYSTEM, temperature=0.7)
    return _normalise(out, platforms, media_type)


def _normalise(out: dict, platforms, requested_media) -> dict:
    content = {}
    for p in platforms:
        text = (out.get(p) or "").strip()
        if p == "x" and len(text) > 280:
            text = re.sub(r"\s+\S*$", "", text[:277]) + "…"
        content[p] = text
    media = out.get("media_type") if out.get("media_type") in ("none", "image", "video") else "image"
    if requested_media in ("image", "video", "none"):
        media = requested_media
    if "instagram" in platforms and media == "none":
        media = "image"
    return {
        "topic": out.get("topic") or "Untitled post",
        "content": content,
        "hashtags": [h.lstrip("#") for h in (out.get("hashtags") or [])][:15],
        "media_type": media,
        "media_prompt": out.get("media_prompt") or "",
        "regenerate_media": out.get("regenerate_media") is not False,
    }

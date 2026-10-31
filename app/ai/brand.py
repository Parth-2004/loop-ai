"""Brand intelligence: website, email and social history → a brand voice guide."""
from .gemini import generate_json, generate_text

SYSTEM = """You are Loop AI's brand strategist. You turn raw information about a person or company
into a precise, actionable brand voice guide that a copywriter could follow to write social posts
that are indistinguishable from the owner's own best work. Be specific; avoid generic marketing filler."""

_str = {"type": "STRING"}
_list = {"type": "ARRAY", "items": {"type": "STRING"}}

BRAND_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING", "description": "Two-sentence description of who this is and what they stand for"},
        "voice": {"type": "STRING", "description": "How they sound, in one paragraph"},
        "tone_attributes": _list,
        "audience": _str,
        "content_pillars": {**_list, "description": "4-7 recurring themes to post about"},
        "do": _list,
        "dont": _list,
        "vocabulary": {**_list, "description": "Characteristic words/phrases"},
        "emoji_usage": _str,
        "hashtag_strategy": _str,
        "call_to_action_style": _str,
        "visual_style": {"type": "STRING", "description": "Art direction for generated images/videos"},
        "sample_hooks": {**_list, "description": "5 opening lines in their voice"},
    },
    "required": ["summary", "voice", "tone_attributes", "audience", "content_pillars", "do", "dont", "visual_style"],
}


def clip(s, n: int) -> str:
    return str(s)[:n] if s else ""


def analyze_emails(emails: list[dict], account_type: str) -> str:
    """Summarises recent emails into style + topic insights. Raw emails are never stored."""
    if not emails:
        return ""
    corpus = "\n\n".join(
        f"--- Email {i + 1} ({e['folder']}) | Subject: {e['subject']}\n{clip(e['text'], 1500)}" for i, e in enumerate(emails)
    )
    return generate_text(
        f"""Analyse these {len(emails)} emails from a {account_type}'s mailbox. Extract ONLY insights useful for
writing their social media posts. Do not include names, email addresses, phone numbers or any other personal
data of third parties.

Report on:
1. Writing style of the owner (sent mail): sentence length, formality, signature phrases, humour, emoji.
2. Recurring topics, projects, products, launches, events and wins worth posting about.
3. Questions/pain points customers or contacts raise (great content ideas).
4. Any upcoming dates or announcements.

Emails:
{clip(corpus, 60000)}""",
        temperature=0.3,
    )


def analyze_social_history(posts_by_platform: dict[str, list[str]]) -> str:
    entries = [(p, posts) for p, posts in posts_by_platform.items() if posts]
    if not entries:
        return ""
    corpus = "\n\n".join(f"## {p}\n" + "\n".join(f"- {clip(x, 600)}" for x in posts) for p, posts in entries)
    return generate_text(
        "These are recent posts from the owner's own social accounts. Describe their posting style per platform "
        "(length, structure, hooks, emoji, hashtags, CTAs), which themes recur, and what seems to perform best. "
        f"Be concise and concrete.\n\n{clip(corpus, 40000)}",
        temperature=0.3,
    )


def summarize_website(text: str) -> str:
    if not text:
        return ""
    return generate_text(
        "Summarise this website for a social media strategist: what the business/person does, offerings, "
        f"differentiators, proof points, tone of the copy, and notable news. Max 250 words.\n\n{clip(text, 30000)}",
        temperature=0.2,
    )


def build_brand_voice(p) -> dict:
    company = p.account_type == "company"
    prompt = f"""Build the brand voice guide for this {'company' if company else 'individual creator/professional'}.

Name: {p.display_name or ''}{f"{chr(10)}Company: {p.company_name or ''}" if company else ''}
Website: {p.website or 'n/a'}
Industry: {p.industry or 'n/a'}
Target audience: {p.audience or 'n/a'}
Goals: {p.goals or 'n/a'}
Desired tone: {p.tone or 'n/a'}
Topics they want to cover: {p.topics or 'n/a'}
Topics/words to avoid: {p.avoid or 'n/a'}
Brand colours: {p.brand_colors or 'n/a'}
Visual style preference: {p.visual_style or 'n/a'}

{'Company / management notes' if company else 'Personal notes'}:
{clip(p.company_notes, 6000) or 'n/a'}

Website summary:
{clip(p.website_summary, 6000) or 'n/a'}

Insights from their email:
{clip(p.email_insights, 8000) or 'n/a'}

Insights from their past social posts:
{clip(p.social_insights, 8000) or 'n/a'}

Example posts they wrote or like:
{clip(p.sample_posts, 8000) or 'n/a'}"""
    return generate_json(prompt, BRAND_SCHEMA, system=SYSTEM, temperature=0.4)

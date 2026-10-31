# Loop AI

**An AI social media agent that drafts posts in your voice and asks before it publishes.**

Loop AI learns how you or your company write, then creates posts with images and short videos for
**X, LinkedIn, Facebook and Instagram** on the schedule you set: hourly, daily, weekly or any cron expression.
Nothing is published until you approve it by email. Reply with changes and the AI rewrites the post and sends you
a new version.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/D-A-R-K-999/loop-ai)

```
 Schedule slot ──> Gemini drafts copy per platform + an image (Gemini / Imagen) or a video (Veo)
                         │
                         v
               Approval email ──> Review page:  Approve | Request changes | Reject
                                                   │            │
                                                   │            └──> AI revises with your feedback ──> new email
                                                   v
                               Published at the scheduled time ──> "Published" summary email with links
```

## Features

- **Brand voice onboarding.** Reads your website, your recent emails (IMAP, read-only) and past posts, then writes a
  voice guide: tone, content pillars, do's and don'ts. Works for an individual or a company.
- **Platform-native drafts.** One topic becomes a separate version for each network, with the right length and hashtags.
- **Images and video.** Gemini Flash Image or Imagen for stills, Veo for short clips, all on-brand.
- **Email approval loop.** Approve in one tap, reject, or request changes. Every revision rotates the review link, so an
  outdated draft can never be approved by mistake, and email scanners can't approve anything.
- **Schedules.** Hourly, daily, weekly or custom cron, in your timezone. Drafts arrive before each slot, leaving time to revise.
- **Dashboard.** Posts, schedules, connected accounts, brand voice and settings, with a landing page and sign-up flow.
- **Resilient AI calls.** Falls back to a lighter Gemini model when the main one is overloaded or rate-limited.

## Tech stack

| Layer     | Tech |
|-----------|------|
| Backend   | Python 3.12, FastAPI, SQLAlchemy 2, an in-process background scheduler |
| Database  | SQLite locally (zero setup), PostgreSQL on Render (psycopg 3) |
| AI engine | `google-genai` SDK: Gemini (text), Gemini Flash Image or Imagen (images), Veo (video) |
| Email     | Resend HTTP API or SMTP; mailbox reading over IMAP |
| Frontend  | React 18 + Vite, built once and served by FastAPI |
| Deploy    | Docker + Render Blueprint (`render.yaml`): web service and managed Postgres |

```
loop-ai/
├── app/
│   ├── main.py            FastAPI app: routers, error format, public /media, the React SPA
│   ├── config.py          Settings from the environment / .env
│   ├── db.py, models.py   SQLAlchemy engine and tables (created on startup)
│   ├── worker.py          Scheduler: drafts due slots, publishes approved posts, recovers stuck jobs
│   ├── scheduling.py      Friendly schedule to cron, next run in the user's timezone
│   ├── security.py        bcrypt, JWT cookie sessions, AES-GCM token encryption, rate limiting
│   ├── emailer.py         Resend / SMTP
│   ├── sources.py         Website reader and IMAP mailbox reader
│   ├── ai/                gemini.py (text, image, video), brand.py (voice guide), content.py (post writer)
│   ├── platforms/         x.py, linkedin.py, meta.py (Facebook + Instagram)
│   ├── services/          posts.py (generate, revise, approve, publish), brand.py, notify.py (emails)
│   └── routes/            auth, profile, connections + OAuth, schedules, posts, approvals
├── client/                React dashboard and landing page (Vite)
├── requirements.txt
├── Dockerfile             Builds the dashboard, then runs uvicorn
└── render.yaml            Render Blueprint
```

Interactive API docs are served at **`/api/docs`**.

## Deploy to Render

1. Click **Deploy to Render** above, or in the Render dashboard choose **New > Blueprint** and pick this repository.
   Render reads `render.yaml` and creates:
   - **loop-ai**, a Docker web service that builds the dashboard and runs FastAPI
   - **loop-ai-db**, a PostgreSQL database, wired in through `DATABASE_URL`
   - a generated `JWT_SECRET` and `ENCRYPTION_KEY`
2. Fill in the secrets Render asks for. Only `GEMINI_API_KEY` is required to start; add `RESEND_API_KEY` and `EMAIL_FROM`
   for approval emails, and the social app keys as you get them. Leave the rest blank.
3. Deploy. The tables are created on first start, and `/api/health` reports whether Gemini and email are configured.
4. Register these OAuth redirect URIs with each platform, using your Render URL:
   - X: `https://YOUR-APP.onrender.com/api/oauth/x/callback`
   - LinkedIn: `https://YOUR-APP.onrender.com/api/oauth/linkedin/callback`
   - Meta: `https://YOUR-APP.onrender.com/api/oauth/meta/callback`

`APP_URL` is detected from Render's `RENDER_EXTERNAL_URL`. If you add a custom domain, set `APP_URL` to it.
Every push to the default branch redeploys automatically.

**Plans and cost.** The blueprint uses the `starter` web plan and the `basic-256mb` database, both paid. The scheduler
runs inside the web process, and free web instances sleep after 15 minutes idle, which would make scheduled posts
late. To try it for free, change `plan: starter` to `plan: free` and the database plan to `free` in `render.yaml`
(Render deletes free databases after 30 days). Keep a single instance, because the scheduler is in-process.

**Email on Render.** Render may block outbound SMTP, so use **Resend**. Verify your sending domain there and set
`EMAIL_FROM` to an address on it. Without an email provider, approval emails, including the review link, are
written to the service log.

## Run locally

```bash
python -m venv .venv
```
```bash
.venv\Scripts\activate
```
(macOS / Linux: `source .venv/bin/activate`)
```bash
pip install -r requirements.txt
```
```bash
cd client && npm ci && npm run build && cd ..
```
```bash
uvicorn app.main:app --reload --port 3000
```

Open <http://localhost:3000>. Copy `.env.example` to `.env` and set at least `GEMINI_API_KEY`.

With no `DATABASE_URL`, a SQLite file is created and the tables are built on startup. To use Postgres, set
`DATABASE_URL` to any `postgresql://` URL (Neon, Supabase, Render), and `DATABASE_SSL=true` if the host requires SSL.

For hot reload on the UI, run `npm run dev` inside `client/` (port 5173, proxying `/api` to port 3000).

> Instagram and Facebook fetch media by URL, so `APP_URL` must be publicly reachable to publish there.
> Locally, use a tunnel such as ngrok, or test those platforms on Render.

## Setting up each platform

### Gemini
Create a key at <https://aistudio.google.com/apikey>. Text works on the free tier. Image generation (Gemini Flash
Image or Imagen) and Veo video need billing enabled on the key; the free tier has no quota for them. Without billing,
posts are still created, and a message explains how to enable images. Once billing is on, click
**New visuals & copy** on any post.

### X (Twitter)
developer.x.com > Project > App > **User authentication settings**: OAuth 2.0, type *Web App*, the callback URL above,
permissions *Read and write*. Copy the OAuth 2.0 Client ID and Secret. Posting needs an API tier that allows writes.

### LinkedIn
linkedin.com/developers > create an app linked to a Company Page > **Products**: add *Sign In with LinkedIn using
OpenID Connect* and *Share on LinkedIn*. Add the redirect URL under **Auth**. To post as a company page, the app also
needs the *Community Management API*; then set the author to `urn:li:organization:<id>` on the Accounts page. If
LinkedIn rejects the API version, set `LINKEDIN_API_VERSION` (format `YYYYMM`).

### Facebook and Instagram (Meta)
developers.facebook.com > create a *Business* app > add **Facebook Login for Business** and the redirect URI.
Permissions: `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish,
business_management`. Instagram must be a Business or Creator account linked to a Facebook Page. Until App Review,
only people with a role on the app can connect.

### Mailbox (for tailoring)
In onboarding or Settings, connect over IMAP with an **app password** (Gmail: Google Account > Security > 2-Step
Verification > App passwords). Loop AI reads the 25 latest sent and inbox emails when it builds the brand voice, and
stores only an AI summary.

## How scheduling works

- Each schedule stores a cron expression and a timezone; `next_run_at` is the next posting slot.
- Every minute the worker drafts posts whose slot falls within `lead_minutes`, sets `scheduled_for` to the slot, and
  sends the approval email.
- Approved posts publish once `scheduled_for` passes. A post approved late publishes immediately.
- Revisions rotate the review link, so links in older emails stop working.
- Publishing is per account, and retries skip accounts that already succeeded.

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/logout`; GET `/me` | Auth (httpOnly cookie) |
| GET/PUT | `/api/profile`; POST `/api/profile/analyze`; POST/DELETE `/api/profile/imap` | Profile, brand voice, mailbox |
| GET | `/api/connections`, `/api/connections/{provider}/start`, `/api/oauth/{provider}/callback` | Social accounts |
| CRUD | `/api/schedules`; POST `/api/schedules/{id}/run` | Schedules |
| CRUD | `/api/posts`; POST `/{id}/approve`, `/regenerate`, `/publish`, `/reject`, `/send-approval` | Posts |
| GET/POST | `/api/approvals/{token}`, `/approve`, `/changes`, `/reject` | Public email review |
| GET | `/media/{id}.jpg`, `/media/{id}.mp4` | Public generated media |
| GET | `/api/health` | Health check (Render uses it) |

## Security notes

- `.env` and local databases are git-ignored; secrets live only in Render's environment.
- Passwords are hashed with bcrypt; social tokens and mailbox passwords are encrypted with AES-GCM.
- Sessions are httpOnly cookies, marked `Secure` in production.

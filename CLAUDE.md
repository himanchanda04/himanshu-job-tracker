# Himanshu Job Tracker — Claude Context

## What this project is
A full-stack job application tracker PWA. Users log in, track job applications through a Kanban-style pipeline, and use AI to optimize resumes and generate cover letters.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS, Lucide icons, Recharts |
| Backend | Node.js 20, Express 5 (ESM modules) |
| Database | PostgreSQL via `pg` pool |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| AI | Anthropic Claude API (`claude-sonnet-4-6`), streaming SSE |
| File parsing | `multer` (upload), `pdf-parse` v1.1.4 (PDF), `mammoth` (DOCX) |
| File generation | `jspdf` (PDF download), `docx` (DOCX download) — client-side |
| PWA | `vite-plugin-pwa` |

---

## Deployed URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | Auto-deploys from `main` branch |
| Backend (Render) | `https://himanshu-job-tracker.onrender.com` |

- **Vercel** builds from `vercel.json` (root) → `cd client && npm install && npm run build`
- **Render** builds from `render.yaml` (root) → `rootDir: server`, `node index.js`
- Pushing to `main` triggers auto-deploy on both platforms

---

## Local development

The frontend at `localhost:5173` proxies `/api` to `localhost:3001` via `vite.config.js`.
**But there is no local PostgreSQL.** Instead, `client/.env.local` points the frontend at Render:

```
VITE_API_URL=https://himanshu-job-tracker.onrender.com
```

When `VITE_API_URL` is set, the full URL bypasses Vite's proxy and goes directly to Render.
To run the server locally you would need `DATABASE_URL` pointing to a real PostgreSQL instance.

**Start local dev:**
```bash
cd client && npm run dev   # frontend only, hits Render backend
```

---

## Project structure

```
himanshu-job-tracker/
├── client/                        # React/Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Stats, charts
│   │   │   ├── Applications.jsx   # Job application list + add/edit
│   │   │   ├── Resume.jsx         # AI resume optimizer (streaming SSE)
│   │   │   ├── CoverLetter.jsx    # AI cover letter generator (streaming SSE)
│   │   │   ├── Settings.jsx       # Profile, password, preferences
│   │   │   ├── Discarded.jsx      # Auto-discarded applications
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── components/
│   │   │   └── layout/AppShell.jsx  # Sidebar nav (includes Resume + Cover Letter links)
│   │   └── api/applications.js     # Axios instance with JWT header
│   ├── .env.local                  # VITE_API_URL=https://himanshu-job-tracker.onrender.com
│   └── .env.production             # Same as .env.local (committed to repo for Vercel)
│
├── server/                        # Express backend
│   ├── index.js                   # App entry: mounts all routers, starts server
│   ├── routes/
│   │   ├── auth.js                # /api/auth — login, register, /me (GET + PATCH)
│   │   ├── applications.js        # /api/applications — CRUD
│   │   ├── ai.js                  # /api/ai — /parse, /resume, /cover-letter
│   │   └── export.js              # /api/export — CSV/Excel download
│   ├── db/database.js             # pg Pool, initDB() runs schema migrations on startup
│   └── middleware/
│       ├── auth.js                # JWT authenticate middleware
│       └── autoDiscard.js         # Cron job to auto-discard old applications
│
├── render.yaml                    # Render Blueprint (env vars set manually on dashboard)
├── vercel.json                    # Vercel build config + SPA rewrite rule
└── CLAUDE.md                      # This file
```

---

## Environment variables

### Render (set manually in dashboard, NOT in render.yaml)
| Key | Value |
|---|---|
| `DATABASE_URL` | External PostgreSQL connection string (from Render Postgres service) |
| `JWT_SECRET` | Random secret string |
| `ANTHROPIC_API_KEY` | `sk-ant-...` key from console.anthropic.com |
| `NODE_VERSION` | `20` |

### Vercel
No env vars needed — `VITE_API_URL` is committed in `client/.env.production`.

---

## Database schema (PostgreSQL)

**users**
```sql
id            SERIAL PRIMARY KEY
name          TEXT NOT NULL
email         TEXT NOT NULL UNIQUE
password_hash TEXT NOT NULL
last_resume   TEXT DEFAULT ''        -- auto-saved resume text, shared by Resume + CoverLetter pages
created_at    TIMESTAMPTZ
```

**applications**
```sql
id, user_id, company, role, location, portal, job_url, job_description,
recruiter_name, recruiter_email, salary_min, salary_max, salary_currency,
status (Applied|Interview|Offer|Rejected|No Response|Discarded),
applied_date, interview_date, last_updated, created_at,
discard_after_days, auto_discarded, remarks
```

Schema migrations run via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `database.js` on every server startup.

---

## AI features (server/routes/ai.js)

### Critical pattern — lazy Anthropic client
```js
function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
```
**Never instantiate `Anthropic` at module load time.** If `ANTHROPIC_API_KEY` is undefined at startup, `new Anthropic()` throws and crashes the server. Always call `getClient()` inside request handlers only.

### Endpoints (all require JWT auth)
| Route | Method | Purpose |
|---|---|---|
| `/api/ai/parse` | POST multipart | Upload PDF/DOCX → extract text → return `{ text }` |
| `/api/ai/resume` | POST JSON | Stream optimized resume via SSE |
| `/api/ai/cover-letter` | POST JSON | Stream cover letter via SSE |

### SSE streaming pattern
```js
res.setHeader('Content-Type', 'text/event-stream');
stream.on('text', (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`));
stream.on('end',  ()     => { res.write('data: [DONE]\n\n'); res.end(); });
```

---

## Resume / Cover Letter pages (client)

Both pages share identical structure:
- **UploadButton** — multipart POST to `/api/ai/parse`, populates textarea
- **DownloadMenu** — dropdown: PDF (jspdf), DOCX (docx library), TXT
- **Auto-load** — on mount, loads `last_resume` from `GET /api/auth/me`
- **Auto-save** — on generate, saves resume to `PATCH /api/auth/me { last_resume }`
- **Streaming** — `ReadableStream` reader decodes SSE chunks, accumulates into state

---

## Known issues and fixes applied

| Issue | Root cause | Fix |
|---|---|---|
| PDF upload: "Unexpected token '<'" | `pdf-parse` v2 changed API (no default export), crashed server on startup → Render returned HTML 502 | Downgraded to `pdf-parse` v1.1.4 |
| Server crash on startup | `new Anthropic()` at module level throws if key undefined | Wrapped in `getClient()` function |
| ANTHROPIC_API_KEY not found | User had entered the Anthropic key in the `JWT_SECRET` field on Render dashboard | Correct fields: JWT_SECRET = random string, ANTHROPIC_API_KEY = sk-ant-... |
| ENOTFOUND postgres hostname | `DATABASE_URL` on Render was stale/wrong | Set manually in Render → Environment tab to external connection string |
| Client calling localhost (CORS) | `VITE_API_URL` not set | Created `client/.env.local` and `client/.env.production` pointing to Render |

---

## Auth API (server/routes/auth.js)

```
POST /api/auth/register   { name, email, password }
POST /api/auth/login      { email, password } → { token, user }
GET  /api/auth/me         → { user: { id, name, email, last_resume } }
PATCH /api/auth/me        { last_resume } → { ok: true }
```

---

## Deployment checklist (after code changes)

1. `git push origin main` — triggers Vercel (frontend) + Render (backend) auto-deploy
2. Render free tier cold-starts after inactivity (~30s delay on first request)
3. If Render deploy fails: check logs in Render dashboard → Events tab
4. If AI not working: verify `ANTHROPIC_API_KEY` exists as its own env var in Render dashboard (not mixed with JWT_SECRET)

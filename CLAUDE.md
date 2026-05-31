# Himanshu Job Tracker — Claude Context

## What this project is
A full-stack job application tracker PWA. Users log in, track job applications through a Kanban-style pipeline, and use AI to score job matches, optimize resumes, and generate cover letters.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS, Lucide icons, Recharts |
| Backend | Node.js 20, Express 5 (ESM modules) |
| Database | PostgreSQL via `pg` pool |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| AI | Anthropic Claude API (`claude-sonnet-4-6` for generation, `claude-haiku-4-5-20251001` for scoring/scraping), streaming SSE |
| File parsing | `multer` (upload), `pdf-parse` v1.1.4 (PDF), `mammoth` (DOCX) |
| File generation | `jspdf` (PDF download), `docx` (DOCX download) — client-side |
| PWA | `vite-plugin-pwa` |

---

## Deployed URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | Auto-deploys from `main` branch |
| Backend (Render) | `https://himanshu-job-tracker.onrender.com` |

---

## Local development

```
cd client
echo "VITE_API_URL=https://himanshu-job-tracker.onrender.com" > .env.local
npm install && npm run dev
```

Opens at `http://localhost:5173`. All `/api` calls go to Render backend (no local DB needed).

---

## Database schema (key fields)

```sql
users (
  id, name, email, password_hash, created_at,
  last_resume TEXT,        -- last AI-generated resume (auto-saved)
  original_resume TEXT     -- user's base resume uploaded in Settings (never overwritten by AI)
)
```

Migration runs automatically via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `server/db/database.js`.

---

## Auth API (server/routes/auth.js)

```
POST /api/auth/register   { name, email, password }
POST /api/auth/login      { email, password } → { token, user }
GET  /api/auth/me         → { user: { id, name, email, last_resume, original_resume } }
PATCH /api/auth/me        { last_resume?, original_resume? } → { ok: true }
POST /api/auth/change-password { currentPassword, newPassword }
```

---

## AI API (server/routes/ai.js)

All endpoints require JWT auth (`authenticate` middleware).

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/parse` | POST multipart | Upload PDF/DOCX → extract text → return `{ text }` |
| `/api/ai/scrape-jd` | POST JSON `{ url }` | Fetch job posting URL → extract JD text |
| `/api/ai/resume` | POST JSON | Stream ATS-optimized resume via SSE (Canada standards) |
| `/api/ai/cover-letter` | POST JSON | Stream cover letter via SSE (no brackets) |
| `/api/ai/interview-prep` | POST JSON | Stream interview prep guide via SSE |
| `/api/ai/job-match` | POST JSON `{ jobDescription, generateFull }` | Score match + optional full generation (resume + CL) |

### `/api/ai/job-match` flow (cost-optimised)
1. Pulls `original_resume` from DB for the authenticated user
2. **Step 1** (always): Haiku scores match → returns JSON `{ score, category, matched_keywords, missing_keywords, top_strength, top_gap }` as SSE `{ type: 'score', data: {...} }`
3. **Step 2** (only if `generateFull: true`): Sonnet streams tailored resume then cover letter
   - Resume chunks: `{ type: 'resume_chunk', text }`
   - Resume done: `{ type: 'resume_done' }`
   - CL chunks: `{ type: 'cl_chunk', text }`
   - CL done: `{ type: 'cl_done' }`

### Score categories
| Score | Category | Label |
|---|---|---|
| < 60 | `not_for_you` | Not For You |
| 60–74 | `consider` | Consider Carefully |
| 75–79 | `good_for_you` | Good For You |
| ≥ 80 | `perfect` | This Is Perfect For You |

### Resume/cover letter standards
- Canada ATS: single column, no tables/columns/graphics, ALL CAPS section headers
- No photos, no DOB, no gender, no SIN
- Canadian spelling, consistent date format
- Cover letter: no square brackets, company/role extracted from JD directly

---

## Client pages

| Route | File | Purpose |
|---|---|---|
| `/` | Dashboard.jsx | Stats overview |
| `/applications` | Applications.jsx | Kanban-style tracker |
| `/discarded` | Discarded.jsx | Discarded applications |
| `/ai-tools` | AITools.jsx | 5 tabs: Job Description, Job Match, Resume, Cover Letter, Interview Prep |
| `/settings` | Settings.jsx | Base resume upload, preferences, password |

### AITools tabs
0. **Job Description** — URL fetch or paste JD, quick generate
1. **Job Match** — paste/fetch JD → score against saved `original_resume` → generate tailored resume + CL
2. **Resume** — standalone resume optimizer
3. **Cover Letter** — standalone cover letter generator
4. **Interview Prep** — STAR-method prep guide

---

## Known issues and fixes

| Issue | Fix |
|---|---|
| PDF upload crash | Downgraded `pdf-parse` to v1.1.4 |
| Server crash on startup | Wrapped `new Anthropic()` in `getClient()` inside request handlers |
| ANTHROPIC_API_KEY not found | Separate env var from JWT_SECRET in Render dashboard |
| Client calling localhost (CORS) | `client/.env.local` sets `VITE_API_URL` to Render URL |

---

## Deployment checklist

1. `git push origin main` → triggers Vercel (frontend) + Render (backend) auto-deploy
2. Render free tier cold-starts after inactivity (~30s first request)
3. If AI not working: verify `ANTHROPIC_API_KEY` in Render → Environment tab

# Himanshu Job Application Tracker — Claude Code Instructions

## What to Build
A full-stack, mobile-first Progressive Web App (PWA) named **"Himanshu Job Application Tracker"**.
The user tracks every job application they submit online: company, role, location, portal, recruiter,
salary range, and remarks. A dashboard shows live KPIs. Applications with no response after a
configurable number of days automatically move to a "Discarded" section. All data can be exported
to a colour-coded Excel file.

---

## Project Layout

```
himanshu-job-tracker/
├── SKILL.md                          ← You are reading this
├── .env.example                      ← Copy to .env and fill in values
├── .gitignore
├── vercel.json                       ← Vercel deploys the React frontend
│
├── client/                           ← React 18 + Vite + Tailwind CSS frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx                  ← React entry point
│       ├── App.jsx                   ← Router + routes
│       ├── index.css                 ← Tailwind directives + global styles
│       ├── design/
│       │   └── colors.js             ← Single source of truth for all colours
│       ├── api/
│       │   └── applications.js       ← All Axios API calls to the backend
│       ├── hooks/
│       │   └── useApplications.js    ← Data-fetching React hook
│       ├── components/
│       │   ├── layout/
│       │   │   └── AppShell.jsx      ← Sidebar + mobile hamburger menu
│       │   ├── dashboard/
│       │   │   └── StatCard.jsx      ← KPI stat card
│       │   └── applications/
│       │       ├── StatusBadge.jsx   ← Colour-coded status pill
│       │       └── ApplicationForm.jsx  ← Add / Edit modal form
│       └── pages/
│           ├── Dashboard.jsx         ← KPIs + donut chart + 30-day line chart
│           ├── Applications.jsx      ← Full list with search + filter
│           ├── Discarded.jsx         ← Auto-discarded applications
│           └── Settings.jsx          ← Configurable auto-discard days
│
└── server/                           ← Node.js + Express 5 backend
    ├── package.json
    ├── index.js                      ← Express entry + CORS + routes
    ├── db/
    │   ├── schema.sql                ← SQLite table + indexes
    │   └── database.js               ← better-sqlite3 singleton
    ├── routes/
    │   ├── applications.js           ← CRUD + stats endpoints
    │   └── export.js                 ← Excel download endpoint
    └── middleware/
        └── autoDiscard.js            ← Daily cron: move stale apps to Discarded
```

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Frontend framework | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Charts | Recharts |
| HTTP client | Axios |
| Date utilities | date-fns |
| PWA | vite-plugin-pwa |
| Backend | Node.js 20 + Express 5 (ESM) |
| Database | SQLite via better-sqlite3 |
| Excel export | ExcelJS |
| Scheduled job | node-cron |

---

## Quick Start (Local Development)

```bash
# 1. Install server dependencies
cd server && npm install

# 2. Install client dependencies
cd ../client && npm install

# 3. Start the backend (Terminal 1)
cd ../server && npm run dev
# API available at http://localhost:3001

# 4. Start the frontend (Terminal 2)
cd ../client && npm run dev
# App available at http://localhost:5173
```

---

## Environment Variables

Copy `.env.example` to `.env` in the **server/** directory before running.

```
server/.env          ← local backend config
client/.env.local    ← local frontend config (VITE_API_URL empty = use proxy)
```

For **Vercel** deployment, set `VITE_API_URL` in the Vercel project's environment variables
to point to your deployed backend URL (e.g. Railway).

---

## Deployment

### Frontend → Vercel (free)
1. Push this repo to GitHub.
2. Import the GitHub repo in Vercel.
3. Vercel auto-detects `vercel.json` and builds `client/dist`.
4. Add environment variable: `VITE_API_URL = https://your-backend.railway.app`
5. Done — the app is live and accessible from your phone.

### Backend → Railway (free tier)
1. Go to https://railway.app → New Project → Deploy from GitHub.
2. Select this repo, set **Root Directory** to `server/`.
3. Set environment variable: `PORT = 3001` (Railway assigns its own port automatically).
4. Copy the Railway URL into Vercel's `VITE_API_URL`.

---

## How to Customise

### Add a new data column
1. `server/db/schema.sql` — add the column to the `CREATE TABLE` statement.
2. `server/routes/applications.js` — add the column name to the `allowed` array in `PATCH` and to the `INSERT` in `POST`.
3. `client/src/components/applications/ApplicationForm.jsx` — add a `field(...)` call.
4. `client/src/pages/Applications.jsx` — add a `<th>` / `<td>` in the table and a line in the mobile card.
5. `server/routes/export.js` — add a column definition to `ws.columns`.

### Add a new status
1. `server/db/schema.sql` — extend the `CHECK(status IN (...))` constraint.
2. `client/src/design/colors.js` — add an entry to `STATUS_STYLES` and `EXCEL_STATUS_COLORS`.
3. `client/src/pages/Applications.jsx` — add the value to the `STATUSES` array.

### Change auto-discard days globally
Edit `discard_after_days` default value in `server/db/schema.sql` (column default) and in
`client/src/components/applications/ApplicationForm.jsx` (`defaultForm.discard_after_days`).
Per-application override is already supported in the form.

---

## API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/applications | List (supports ?status=, ?search=, ?page=, ?limit=) |
| GET | /api/applications/stats | Dashboard KPIs + portal breakdown + 30-day series |
| GET | /api/applications/:id | Single record |
| POST | /api/applications | Create |
| PATCH | /api/applications/:id | Partial update (any allowed fields) |
| DELETE | /api/applications/:id | Delete |
| GET | /api/export/excel | Download colour-coded Excel file |
| GET | /api/health | Health check |

---

## Design Rules (do not change without updating colors.js)
- Navy `#1E3A5F` — sidebar, headers, primary buttons
- Teal `#00BFA5` — accent, active nav, CTA buttons, links
- Slate background `#F1F5F9` — page background
- White `#FFFFFF` — cards
- Muted `#64748B` — secondary text, icons
- All spacing uses Tailwind's 8 px grid (p-2 = 8 px, p-4 = 16 px, etc.)
- Every page must render correctly at 375 px width (mobile-first)

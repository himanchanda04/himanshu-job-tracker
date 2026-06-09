# Job Scout — Setup Instructions

## 1. New .env variables (add to both local .env and Render dashboard)

```
# Apify (your existing account — grab token from https://console.apify.com/account/integrations)
APIFY_API_TOKEN=your_apify_token_here

# Adzuna (free — register at https://developer.adzuna.com)
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key

# Jooble (free — register at https://jooble.org/api/about)
JOOBLE_API_KEY=your_jooble_key

# Resend (free — https://resend.com → create account → API Keys)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=scout@yourdomain.com   # must be a verified domain in Resend

# Deploy hooks (copy from dashboards — see Step 3)
VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxx?key=yyy

# Cron security token (make up any random string, 32+ chars)
CRON_SECRET_TOKEN=your_random_secret_here

# Budget caps (optional — these are the defaults)
APIFY_MONTHLY_BUDGET=5.00
CLAUDE_MONTHLY_BUDGET=2.00

# Frontend URL (used in email digest links)
FRONTEND_URL=https://your-app.vercel.app
```

## 2. Register server/routes/scout.js in your main server file

In your `server/index.js` (or `server/app.js`), add:

```js
import scoutRouter from './routes/scout.js';
// ...after your other routes:
app.use('/api/scout', scoutRouter);
```

## 3. Get your deploy hook URLs

**Vercel:**
→ vercel.com → Your Project → Settings → Git → Deploy Hooks
→ Create hook named "Job Scout" on branch `main`
→ Copy the URL → paste into VERCEL_DEPLOY_HOOK

**Render:**
→ render.com → Your Service → Settings → Deploy Hook
→ Copy the URL → paste into RENDER_DEPLOY_HOOK

## 4. Set up cron-job.org (free)

1. Go to https://cron-job.org → create free account
2. Create new cron job:
   - URL: https://your-render-url.onrender.com/api/scout/run/auto
   - Method: POST
   - Header: `x-cron-token: your_random_secret_here`   (matches CRON_SECRET_TOKEN)
   - Schedule: Every 24 hours (e.g. 08:00 UTC daily)
3. Save

## 5. Add ScoutSettingsSection to your existing Settings.jsx

```jsx
import ScoutSettingsSection from '../components/JobScout/ScoutSettingsSection';

// Inside your Settings component JSX, add wherever you want:
<ScoutSettingsSection />
```

## 6. Add JobScout to your router

In your React router config (App.jsx or wherever routes are defined):

```jsx
import JobScout from './pages/JobScout';

// Add route:
<Route path="/job-scout" element={<JobScout />} />
```

Also add a nav link with a badge (use the new_count from /api/scout/results).

## 7. Verify Apify actor IDs

The actor IDs used may differ from what's available in your Apify console.
Check and update these in jobFetcher.js if needed:
- LinkedIn: `apify~linkedin-jobs-scraper`  → verify at console.apify.com/actors
- Indeed:   `misceres~indeed-scraper`      → verify at console.apify.com/actors

## Files delivered

**Backend (7 new files):**
- server/db/scout_migration.js
- server/services/apifyBudgetGuard.js
- server/services/claudeBudgetGuard.js
- server/services/qualityFilter.js
- server/services/jobDeduplicator.js
- server/services/jobFetcher.js
- server/services/jobScorer.js
- server/services/emailDigest.js
- server/routes/scout.js

**Frontend (4 new files):**
- client/src/pages/JobScout.jsx
- client/src/components/JobScout/ScoutCard.jsx
- client/src/components/JobScout/ScoutRunStatus.jsx
- client/src/components/JobScout/ScoutSettingsSection.jsx

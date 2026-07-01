import { checkApifyBudget, recordApifyCost } from './apifyBudgetGuard.js';

const TIMEOUT_MS       = 90_000; // 90 seconds — Apify actors need time to run
const APIFY_TIMEOUT_S  = 80;     // Apify-side timeout in seconds (passed in URL)

// ─── Fetch with hard timeout ──────────────────────────────────────────────────
async function timedFetch(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Source: Adzuna ───────────────────────────────────────────────────────────
async function fetchAdzuna(targetTitle, industry) {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error('Adzuna credentials missing');

  const q   = encodeURIComponent(`${targetTitle || 'marketing'} ${industry || ''}`.trim());
  const url = `https://api.adzuna.com/v1/api/jobs/ca/search/1`
            + `?app_id=${appId}&app_key=${appKey}`
            + `&results_per_page=25&what=${q}&where=Winnipeg`
            + `&max_days_old=1&content-type=application/json`;

  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const data = await res.json();

  return (data.results || []).map(j => ({
    title:     j.title,
    company:   j.company?.display_name || '',
    location:  j.location?.display_name || 'Winnipeg, MB',
    url:       j.redirect_url,
    description: j.description || '',
    posted_at: j.created ? new Date(j.created) : new Date(),
    source:    'Adzuna',
  }));
}

// ─── Source: Canada Job Bank ──────────────────────────────────────────────────
async function fetchJobBank(targetTitle) {
  const q = encodeURIComponent(targetTitle || 'marketing');
  // Official Job Bank search API — Winnipeg, MB
  const url = `https://jobs.gc.ca/api/jobs?keywords=${q}&locationId=9219044&distance=25&date=1&lang=en&pageSize=25`;

  const res = await timedFetch(url, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; JobScout/1.0)',
    },
  });
  if (!res.ok) throw new Error(`Job Bank ${res.status}`);
  const data = await res.json();
  const list = data.data || data.jobs || data.results || [];

  return list.map(j => ({
    title:       j.title || j.jobTitle || '',
    company:     j.employer || j.company || '',
    location:    'Winnipeg, MB',
    url:         j.applyUrl || j.url || `https://jobs.gc.ca/job/${j.jobId || ''}`,
    description: j.description || j.duties || '',
    posted_at:   j.datePosted ? new Date(j.datePosted) : new Date(),
    source:      'Canada Job Bank',
  }));
}

// ─── Source: Jooble ───────────────────────────────────────────────────────────
async function fetchJooble(targetTitle, industry) {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) throw new Error('Jooble API key missing');

  const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];
  const res = await timedFetch(`https://jooble.org/api/${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords:        `${targetTitle || 'marketing'} ${industry || ''}`.trim(),
      location:        'Winnipeg, Manitoba',
      datecreatedfrom: yesterday,
    }),
  });
  if (!res.ok) throw new Error(`Jooble ${res.status}`);
  const data = await res.json();

  return (data.jobs || []).map(j => ({
    title:       j.title || '',
    company:     j.company || '',
    location:    j.location || 'Winnipeg, MB',
    url:         j.link || '',
    description: j.snippet || '',
    posted_at:   j.updated ? new Date(j.updated) : new Date(),
    source:      'Jooble',
  }));
}

// ─── Source: Apify LinkedIn ───────────────────────────────────────────────────
async function fetchLinkedIn(targetTitle, userId) {
  const budget = await checkApifyBudget(userId);
  if (!budget.allowed) throw new Error('APIFY_BUDGET_CAP');

  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('Apify token missing');

  // Using the most reliable LinkedIn jobs scraper actor on Apify
  const res = await timedFetch(
    `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${token}&timeout=${APIFY_TIMEOUT_S}&memory=512`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries:    [`${targetTitle || 'marketing'} Winnipeg`],
        location:   'Winnipeg, Manitoba, Canada',
        maxResults: 20,
        datePosted: 'Past 24 hours',
      }),
    }
  );
  if (!res.ok) throw new Error(`Apify LinkedIn ${res.status}`);
  const data = await res.json();

  await recordApifyCost(userId, 0.04, null).catch(() => {});

  return (Array.isArray(data) ? data : []).map(j => ({
    title:       j.title || j.jobTitle || '',
    company:     j.companyName || j.company || '',
    location:    j.location || 'Winnipeg, MB',
    url:         j.jobUrl || j.url || '',
    description: j.description || j.descriptionText || '',
    posted_at:   j.postedAt ? new Date(j.postedAt) : new Date(),
    source:      'LinkedIn',
  }));
}

// ─── Source: Apify Indeed ─────────────────────────────────────────────────────
async function fetchIndeed(targetTitle, userId) {
  const budget = await checkApifyBudget(userId);
  if (!budget.allowed) throw new Error('APIFY_BUDGET_CAP');

  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('Apify token missing');

  const res = await timedFetch(
    `https://api.apify.com/v2/acts/misceres~indeed-scraper/run-sync-get-dataset-items?token=${token}&timeout=${APIFY_TIMEOUT_S}&memory=512`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position:  targetTitle || 'marketing coordinator',
        country:   'CA',
        location:  'Winnipeg, MB',
        maxItems:  20,
        startUrls: [],
      }),
    }
  );
  if (!res.ok) throw new Error(`Apify Indeed ${res.status}`);
  const data = await res.json();

  await recordApifyCost(userId, 0.03, null).catch(() => {});

  return (Array.isArray(data) ? data : []).map(j => ({
    title:       j.positionName || j.title || '',
    company:     j.company || '',
    location:    j.location || 'Winnipeg, MB',
    url:         j.url || j.externalApplyLink || '',
    description: j.description || '',
    posted_at:   j.postedAt ? new Date(j.postedAt) : new Date(),
    source:      'Indeed',
  }));
}


// ─── Main export: all sources in parallel ─────────────────────────────────────
export async function fetchAllSources(targetTitle, industry, userId) {
  const sources = [
    { name: 'Adzuna',           fn: () => fetchAdzuna(targetTitle, industry) },
    { name: 'Canada Job Bank',  fn: () => fetchJobBank(targetTitle) },
    { name: 'Jooble',           fn: () => fetchJooble(targetTitle, industry) },
    { name: 'LinkedIn (Apify)', fn: () => fetchLinkedIn(targetTitle, userId) },
    { name: 'Indeed (Apify)',   fn: () => fetchIndeed(targetTitle, userId) },
  ];

  const settled = await Promise.allSettled(sources.map(s => s.fn()));

  const allJobs      = [];
  const sourcesUsed  = [];
  const sourcesFailed = [];

  settled.forEach((result, i) => {
    const name = sources[i].name;
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
      sourcesUsed.push(name);
      console.log(`[Scout] ✅ ${name}: ${result.value.length} jobs`);
    } else {
      const msg = result.reason?.message || 'unknown';
      if (msg !== 'APIFY_BUDGET_CAP') {
        sourcesFailed.push(name);
        console.warn(`[Scout] ❌ ${name}: ${msg}`);
      } else {
        console.log(`[Scout] ⏸  ${name}: Apify budget cap — skipped`);
      }
    }
  });

  return { allJobs, sourcesUsed, sourcesFailed };
}

// ─── Career Page Scraper ──────────────────────────────────────────────────────
// Scrapes major Winnipeg employer career pages directly.
// No API cost — pure HTML fetch. Zero fake jobs (direct employer source).

const TIMEOUT_MS = 20_000;

async function timedFetch(url, options = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobScout/1.0)',
        'Accept':     'text/html,application/xhtml+xml,application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Canada Life ──────────────────────────────────────────────────────────────
async function scrapeCanadaLife(targetTitle) {
  const q   = encodeURIComponent(targetTitle || 'marketing');
  const url = `https://careers.canadalife.com/search/?q=${q}&locationsearch=winnipeg`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Canada Life ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /<article[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const block   = match[1];
    const title   = (block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    const href    = (block.match(/href="([^"]*job[^"]*)"/i)?.[1] || '');
    const jobUrl  = href.startsWith('http') ? href : `https://careers.canadalife.com${href}`;
    if (title) jobs.push({
      title,
      company:     'Canada Life',
      location:    'Winnipeg, MB',
      url:         jobUrl,
      description: `${title} position at Canada Life in Winnipeg. Financial services, insurance, and investment management.`,
      posted_at:   new Date(),
      source:      'Canada Life Careers',
    });
  }
  return jobs;
}

// ─── Wawanesa Insurance ───────────────────────────────────────────────────────
async function scrapeWawanesa(targetTitle) {
  const url = `https://careers.wawanesa.com/search/?q=${encodeURIComponent(targetTitle || 'marketing')}&locationsearch=winnipeg`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Wawanesa ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /href="(\/job\/[^"]+)">[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const title  = match[2].replace(/<[^>]+>/g, '').trim();
    const jobUrl = `https://careers.wawanesa.com${match[1]}`;
    if (title) jobs.push({
      title,
      company:     'Wawanesa Insurance',
      location:    'Winnipeg, MB',
      url:         jobUrl,
      description: `${title} at Wawanesa Insurance, one of Canada's largest mutual insurance companies, headquartered in Winnipeg.`,
      posted_at:   new Date(),
      source:      'Wawanesa Careers',
    });
  }
  return jobs;
}

// ─── Manitoba Public Insurance (MPI) ─────────────────────────────────────────
async function scrapeMPI() {
  const url = 'https://www.mpi.mb.ca/about-mpi/careers/';
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`MPI ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /<a[^>]*href="([^"]*career[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const title  = match[2].replace(/<[^>]+>/g, '').trim();
    const href   = match[1];
    const jobUrl = href.startsWith('http') ? href : `https://www.mpi.mb.ca${href}`;
    if (title && title.length > 5 && title.length < 100) {
      jobs.push({
        title,
        company:     'Manitoba Public Insurance',
        location:    'Winnipeg, MB',
        url:         jobUrl,
        description: `${title} at Manitoba Public Insurance (MPI), a provincial Crown corporation providing auto insurance in Manitoba.`,
        posted_at:   new Date(),
        source:      'MPI Careers',
      });
    }
  }
  return jobs.slice(0, 10);
}

// ─── City of Winnipeg ─────────────────────────────────────────────────────────
async function scrapeCityOfWinnipeg(targetTitle) {
  const q   = encodeURIComponent(targetTitle || 'marketing');
  const url = `https://winnipeg.ca/hr/careers/search.stm?search=${q}`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`City of Winnipeg ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /<td[^>]*class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const inner  = match[1];
    const title  = inner.replace(/<[^>]+>/g, '').trim();
    const href   = (inner.match(/href="([^"]+)"/i)?.[1] || '');
    const jobUrl = href.startsWith('http') ? href : `https://winnipeg.ca${href}`;
    if (title && title.length > 3) {
      jobs.push({
        title,
        company:     'City of Winnipeg',
        location:    'Winnipeg, MB',
        url:         jobUrl || 'https://winnipeg.ca/hr/careers',
        description: `${title} — City of Winnipeg municipal government position.`,
        posted_at:   new Date(),
        source:      'City of Winnipeg Careers',
      });
    }
  }
  return jobs.slice(0, 10);
}

// ─── Manitoba Government Jobs ─────────────────────────────────────────────────
async function scrapeManitobGov(targetTitle) {
  const q   = encodeURIComponent(targetTitle || 'marketing');
  const url = `https://www.gov.mb.ca/csc/jobs/index.html?search=${q}`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Manitoba Gov ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /<a[^>]*href="([^"]*position[^"]*|[^"]*job[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const title  = match[2].replace(/<[^>]+>/g, '').trim();
    const href   = match[1];
    const jobUrl = href.startsWith('http') ? href : `https://www.gov.mb.ca${href}`;
    if (title && title.length > 5 && title.length < 120) {
      jobs.push({
        title,
        company:     'Government of Manitoba',
        location:    'Winnipeg, MB',
        url:         jobUrl,
        description: `${title} — Manitoba Provincial Government position. Eligible for Manitoba PNP.`,
        posted_at:   new Date(),
        source:      'Manitoba Gov Jobs',
      });
    }
  }
  return jobs.slice(0, 10);
}

// ─── RBC Royal Bank ───────────────────────────────────────────────────────────
async function scrapeRBC(targetTitle) {
  const url = `https://jobs.rbc.com/ca/en/search-results?keywords=${encodeURIComponent(targetTitle || 'marketing')}&location=Winnipeg%2C+Manitoba`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`RBC ${res.status}`);
  const html = await res.text();

  const jobs = [];
  const regex = /"jobTitle":"([^"]+)","jobId":"([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    jobs.push({
      title:       match[1],
      company:     'RBC Royal Bank',
      location:    'Winnipeg, MB',
      url:         `https://jobs.rbc.com/ca/en/job/${match[2]}`,
      description: `${match[1]} at RBC Royal Bank, Winnipeg. One of Canada's largest financial institutions.`,
      posted_at:   new Date(),
      source:      'RBC Careers',
    });
  }
  return jobs.slice(0, 5);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function fetchCareerPages(targetTitle) {
  const sources = [
    { name: 'Canada Life',         fn: () => scrapeCanadaLife(targetTitle)   },
    { name: 'Wawanesa',            fn: () => scrapeWawanesa(targetTitle)     },
    { name: 'MPI',                 fn: () => scrapeMPI()                     },
    { name: 'City of Winnipeg',    fn: () => scrapeCityOfWinnipeg(targetTitle) },
    { name: 'Manitoba Gov',        fn: () => scrapeManitobGov(targetTitle)   },
    { name: 'RBC',                 fn: () => scrapeRBC(targetTitle)          },
  ];

  const results = await Promise.allSettled(sources.map(s => s.fn()));
  const allJobs = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[Scout] ✅ ${sources[i].name}: ${r.value.length} jobs`);
      allJobs.push(...r.value);
    } else {
      console.log(`[Scout] ❌ ${sources[i].name}: ${r.reason?.message || 'failed'}`);
    }
  });

  return allJobs;
}

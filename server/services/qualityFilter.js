// ─── Staffing agency blocklist ────────────────────────────────────────────────
const AGENCY_BLOCKLIST = new Set([
  'robert half', 'manpower', 'randstad', 'adecco', 'kelly services', 'kelly',
  'hays', 'staffmark', 'spherion', 'volt', 'express employment', 'labour ready',
  'labor ready', 'temp agency', 'staffing solutions', 'recruitment solutions',
  'talent inc', 'talent solutions', 'procom', 'compustaff', 'nexus systems',
  'talentworld', 'fuze hr', 'fusion connect', 'quantum management', 'vaco',
  'aerotek', 'insight global', 'michael baker', 'workforce staffing',
  'jobware', 'the staffing edge', 'people first', 'workterra',
]);

const MIN_DESC_WORDS = 100;

// ─── Gate helpers ─────────────────────────────────────────────────────────────
export function isStaffingAgency(companyName) {
  if (!companyName) return false;
  const n = companyName.toLowerCase().trim();
  for (const agency of AGENCY_BLOCKLIST) {
    if (n.includes(agency)) return true;
  }
  return false;
}

// ─── Fake job signal detection ────────────────────────────────────────────────
// Each function below checks ONE signal. A job is auto-rejected if 2+ signals
// fire. This runs BEFORE Haiku scoring so fake jobs never cost an AI call.
const SCAM_TITLE_PATTERNS = [
  /work[\s-]?from[\s-]?home/i,
  /earn\s*\$[\d,]+/i,
  /be your own boss/i,
  /no experience.{0,15}\$[\d,]+/i,
  /unlimited earning/i,
];

const FREE_EMAIL_DOMAINS = /@(gmail|yahoo|hotmail|outlook|aol)\.com/i;

function countFakeSignals(job) {
  let count = 0;
  const reasons = [];

  const wordCount = (job.description || '').split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_DESC_WORDS) { count++; reasons.push('short_description'); }

  if (!job.company?.trim()) { count++; reasons.push('no_company'); }

  if (!job.url?.startsWith('http')) { count++; reasons.push('invalid_url'); }

  if (isStaffingAgency(job.company)) { count++; reasons.push('staffing_agency'); }

  if (SCAM_TITLE_PATTERNS.some(p => p.test(job.title || ''))) {
    count++; reasons.push('scam_title_pattern');
  }

  if (FREE_EMAIL_DOMAINS.test(job.description || '') || FREE_EMAIL_DOMAINS.test(job.url || '')) {
    count++; reasons.push('free_email_contact');
  }

  // Absurdly wide salary range (e.g. "$20,000 - $120,000") is a bot-generated signal
  const salaryMatches = (job.description || '').match(/\$[\d,]+(?:\.\d+)?/g);
  if (salaryMatches && salaryMatches.length >= 2) {
    const nums = salaryMatches
      .map(s => parseFloat(s.replace(/[$,]/g, '')))
      .filter(n => !isNaN(n) && n > 0);
    if (nums.length >= 2) {
      const spread = Math.max(...nums) - Math.min(...nums);
      if (spread > 80000) { count++; reasons.push('absurd_salary_range'); }
    }
  }

  return { count, reasons };
}

/**
 * Returns { isFake: boolean, signalCount: number, reasons: string[] }
 * isFake = true when 2 or more fake-job signals are present.
 */
export function detectFakeJob(job) {
  const { count, reasons } = countFakeSignals(job);
  return { isFake: count >= 2, signalCount: count, reasons };
}

export function passesQualityGates(job) {
  // Gate 1 — Recency: posted within last 24 hours
  if (job.posted_at) {
    const ageHrs = (Date.now() - new Date(job.posted_at).getTime()) / 36e5;
    if (ageHrs > 24) return { pass: false, reason: 'stale' };
  }

  // Gate 2 — Content quality
  const wordCount = (job.description || '').split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_DESC_WORDS)       return { pass: false, reason: 'short_description' };
  if (!job.company?.trim())             return { pass: false, reason: 'no_company' };
  if (!job.url?.startsWith('http'))     return { pass: false, reason: 'no_url' };

  // Gate 3 — Agency block
  if (isStaffingAgency(job.company))    return { pass: false, reason: 'staffing_agency' };

  // Gate 4 — Fake job signal count (2+ signals = reject)
  const fake = detectFakeJob(job);
  if (fake.isFake) return { pass: false, reason: `fake_job:${fake.reasons.join(',')}` };

  return { pass: true, reason: null, fakeSignalCount: fake.signalCount };
}

// ─── Keyword extraction ───────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one',
  'our','out','day','get','has','him','his','how','its','may','new','now','old',
  'see','two','use','way','who','did','work','also','back','from','they','that',
  'have','with','this','will','been','able','each','into','said','than','them',
  'then','time','very','when','your','more','would','about','after','could',
  'other','their','there','these','which','while','first','large','often',
  'must','should','such','both','some','what','make','like','just','good',
  'well','here','know','over','team','role','join','help','using','strong',
]);

export function extractKeywordsFromResume(resumeText, targetTitle = '', industry = '') {
  if (!resumeText) return [];

  const text = `${resumeText} ${targetTitle} ${industry}`.toLowerCase();
  const tokens = text.match(/\b[a-z][a-z0-9+#.\-]{2,}\b/g) || [];

  const freq = {};
  for (const t of tokens) {
    if (!STOPWORDS.has(t) && t.length > 3) freq[t] = (freq[t] || 0) + 1;
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 60)
    .map(([w]) => w);
}

// ─── Keyword pre-filter (Gate 4) ─────────────────────────────────────────────
export function keywordPreFilter(job, keywords) {
  if (!keywords?.length) return { pass: true, matchCount: 0, matchedKeywords: [] };

  const haystack = `${job.title} ${job.description} ${job.company}`.toLowerCase();
  const matches  = keywords.filter(kw => haystack.includes(kw));

  return {
    pass:            matches.length >= 3,
    matchCount:      matches.length,
    matchedKeywords: matches.slice(0, 12),
  };
}

// ─── Ghost job detection ──────────────────────────────────────────────────────
export function detectGhostJob(job, existingRows) {
  const co    = job.company.toLowerCase();
  const word0 = job.title.toLowerCase().split(/\s+/)[0];
  return existingRows.filter(r =>
    r.company?.toLowerCase() === co &&
    r.title?.toLowerCase().includes(word0)
  ).length >= 3;
}

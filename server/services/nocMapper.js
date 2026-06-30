// ─── NOC 2021 / Manitoba MPNP In-Demand Occupation Reference ─────────────────
// Used to validate which jobs are PR-eligible (TEER 0/1/2) for Express Entry /
// MPNP purposes, and to classify jobs into broad categories for the
// secondary "Also Worth a Look" digest.
//
// This table is NOT exhaustive of all NOC codes — it only covers the
// occupations relevant to Himanshu's target roles (marketing, business
// development, finance, data/analytics, admin, IT) plus common adjacent
// categories. Extend as needed.

// ─── Core target NOCs (primary job search focus) ─────────────────────────────
export const CORE_NOCS = new Set(['11202', '10022']);

// ─── Full TEER reference table ────────────────────────────────────────────────
// teer: 0 (manager) | 1 (professional) | 2 (technician) | 3/4/5 (not PR-priority)
// category: used for secondary email bucket matching
export const NOC_TABLE = {
  // ── TEER 0 — Managers ──────────────────────────────────────────────────────
  '10010': { title: 'Financial managers',                          teer: 0, category: 'finance',  clb: 7 },
  '10019': { title: 'Other administrative services managers',      teer: 0, category: 'admin',    clb: 7 },
  '10020': { title: 'Insurance, real estate, financial brokerage managers', teer: 0, category: 'finance', clb: 7 },
  '10021': { title: 'Banking, credit and investment managers',     teer: 0, category: 'finance',  clb: 7 },
  '10022': { title: 'Advertising, marketing and PR managers',      teer: 0, category: 'marketing', clb: 7 }, // CORE
  '11200': { title: 'Human resources managers',                    teer: 0, category: 'hr',       clb: 7 },
  '20012': { title: 'Computer and information systems managers',   teer: 0, category: 'data_analytics', clb: 7 },

  // ── TEER 1 — Professionals ─────────────────────────────────────────────────
  '11100': { title: 'Financial auditors and accountants',          teer: 1, category: 'finance',  clb: 7 },
  '11101': { title: 'Financial and investment analysts',           teer: 1, category: 'data_analytics', clb: 5 },
  '11102': { title: 'Other financial officers',                    teer: 1, category: 'finance',  clb: 5 },
  '11109': { title: 'Financial officers — other',                  teer: 1, category: 'finance',  clb: 5 },
  '11201': { title: 'Human resources professionals',               teer: 1, category: 'hr',       clb: 7 },
  '11202': { title: 'Business development and marketing professionals (incl. advertising, PR, market research)', teer: 1, category: 'marketing', clb: 7 }, // CORE
  '21220': { title: 'Cybersecurity specialists',                   teer: 1, category: 'data_analytics', clb: 5 },
  '21221': { title: 'Business systems specialists',                teer: 1, category: 'data_analytics', clb: 5 },
  '21222': { title: 'Information systems specialists / data analysts', teer: 1, category: 'data_analytics', clb: 5 },
  '21223': { title: 'Database analysts and data administrators',   teer: 1, category: 'data_analytics', clb: 5 },
  '21233': { title: 'Web designers and developers',                teer: 1, category: 'digital', clb: 5 },
  '21300': { title: 'Civil engineers',                              teer: 1, category: 'engineering', clb: 7 },
  '21301': { title: 'Mechanical engineers',                         teer: 1, category: 'engineering', clb: 7 },

  // ── TEER 2 — Technicians ───────────────────────────────────────────────────
  '12200': { title: 'Accounting technicians and bookkeepers',      teer: 2, category: 'finance',  clb: 5 },
  '13100': { title: 'Administrative officers',                    teer: 2, category: 'admin',    clb: 5 },
  '13110': { title: 'HR and recruitment officers',                teer: 2, category: 'hr',       clb: 5 },
  '13111': { title: 'Employment insurance, immigration and revenue officers', teer: 2, category: 'admin', clb: 5 },
  '72200': { title: 'Electricians (except industrial)',            teer: 2, category: 'trades',  clb: 6 },
  '72201': { title: 'Industrial electricians',                     teer: 2, category: 'trades',  clb: 6 },
  '72400': { title: 'Construction millwrights and industrial mechanics', teer: 2, category: 'trades', clb: 5 },
  '72401': { title: 'Heavy-duty equipment mechanics',              teer: 2, category: 'trades',  clb: 5 },

  // ── TEER 3+ — Lower PR priority (still logged, not filtered to primary) ────
  '64100': { title: 'Retail sales supervisors',                    teer: 3, category: 'sales',   clb: 4 },
  '14100': { title: 'General office support workers',              teer: 4, category: 'admin',   clb: 4 },
  '65100': { title: 'Retail salespersons',                         teer: 4, category: 'sales',   clb: 4 },
};

// ─── Category keyword fallback (when Haiku doesn't return a clean NOC) ───────
// Used only as a backstop for the broad Bucket-A category match in the
// secondary digest — never used to override an explicit NOC/TEER from scoring.
export const CATEGORY_KEYWORDS = {
  marketing:      ['marketing', 'brand', 'advertising', 'public relations', 'pr ', 'social media', 'content strategist', 'communications'],
  data_analytics: ['data analyst', 'data scientist', 'business analyst', 'bi analyst', 'analytics', 'reporting analyst', 'data engineer'],
  digital:        ['digital marketing', 'seo', 'sem', 'web design', 'ux', 'ui designer', 'growth marketing', 'paid media'],
  finance:        ['accountant', 'financial analyst', 'bookkeeper', 'finance officer', 'investment analyst', 'audit'],
  admin:          ['administrative', 'office coordinator', 'admin assistant', 'operations coordinator'],
  hr:             ['human resources', 'recruiter', 'talent acquisition', 'hr generalist'],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up TEER level and category for a given NOC code.
 * Returns null if the code isn't in our reference table (treated as
 * "unknown" — not auto-rejected, just not auto-confirmed PR-eligible).
 */
export function lookupNoc(nocCode) {
  if (!nocCode) return null;
  return NOC_TABLE[nocCode] || null;
}

/**
 * Determine PR eligibility tier from a NOC code.
 * Returns { pr_eligible: boolean, pr_tier: 'high' | 'valid' | null }
 */
export function getPrTier(nocCode, score) {
  const entry = lookupNoc(nocCode);
  if (!entry) return { pr_eligible: false, pr_tier: null };

  if (entry.teer === 0 || entry.teer === 1) {
    return { pr_eligible: true, pr_tier: score >= 85 ? 'high' : 'valid' };
  }
  if (entry.teer === 2) {
    return { pr_eligible: true, pr_tier: 'valid' };
  }
  return { pr_eligible: false, pr_tier: null };
}

/**
 * Fallback category classifier from job title/description text.
 * Only used if Haiku's returned category is missing or "other".
 */
export function classifyByKeyword(job) {
  const haystack = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => haystack.includes(kw))) return category;
  }
  return 'other';
}

/**
 * Is this NOC one of the two core target roles (11202 / 10022)?
 */
export function isCoreNoc(nocCode) {
  return CORE_NOCS.has(nocCode);
}

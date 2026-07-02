import { isCoreNoc } from './nocMapper.js';

// ─── Job Curator ───────────────────────────────────────────────────────────────
// Confirmed logic (per conversation):
//
// PRIMARY ("Top 10 Matches"):
//   - Jobs scoring >= 60 against the CORE NOC roles (11202, 10022)
//   - Score wins over TEER here — a 60%+ core-NOC match goes to primary
//     even if its TEER is 3+ (not formally PR-eligible)
//   - Take the top 10 by score
//
// SECONDARY ("Also Worth a Look"):
//   - Bucket A: jobs broadly in marketing/data_analytics/digital category
//     (any NOC, any TEER) scoring 40-59%
//   - Bucket B: overflow from the primary candidate pool — core-NOC jobs
//     that scored >= 60 but ranked 11th-20th (didn't make the top 10)
//   - Combine both buckets, sort by score, take top 10
//
// A job never appears in both sections — primary picks are removed from the
// secondary pool entirely (Bucket B intentionally re-includes the 11-20
// overflow, which by definition isn't in the top-10 primary picks).

const PRIMARY_SCORE_THRESHOLD   = 60;
const SECONDARY_SCORE_MIN       = 40;
const SECONDARY_SCORE_MAX       = 100;
const PRIMARY_TOP_N             = 10;
const SECONDARY_TOP_N           = 10;

const SECONDARY_CATEGORIES = new Set(['marketing', 'analytics', 'digital', 'finance', 'admin', 'sales', 'other']);

function isCoreNocJob(job) {
  return isCoreNoc(job.noc_code);
}

/**
 * Build the two email sections from a flat list of scored jobs.
 * Each job is expected to already have: score, noc_code, noc_teer,
 * pr_eligible, pr_tier, category, title_match.
 *
 * Returns { primary: Job[], secondary: Job[] }
 */
export function curateDigest(scoredJobs) {
  // Hard reject before anything else — never enters either email.
  const eligible = scoredJobs.filter(job => {
    if (job.title_match === 'mismatch') return false;
    if (job.fake_signal_count >= 2)      return false;
    if (!job.score || job.score < SECONDARY_SCORE_MIN) return false;
    return true;
  });

  // ─── Build PRIMARY candidate pool ──────────────────────────────────────────
  // Core NOC jobs scoring >= 60. Score wins over TEER per confirmed rule.
  const primaryPool = eligible
    .filter(job => isCoreNocJob(job) && job.score >= PRIMARY_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const primary  = primaryPool.slice(0, PRIMARY_TOP_N);
  const overflow = primaryPool.slice(PRIMARY_TOP_N, 20); // 11th–20th place

  const primaryIds = new Set(primary.map(j => j.job_hash || j.url));

  // ─── Build SECONDARY candidate pool ────────────────────────────────────────
  // Bucket A: broad category match, 40-59%, any NOC/TEER
  const bucketA = eligible.filter(job =>
    !primaryIds.has(job.job_hash || job.url) &&
    SECONDARY_CATEGORIES.has(job.category) &&
    job.score >= SECONDARY_SCORE_MIN &&
    job.score <= SECONDARY_SCORE_MAX
  );

  // Bucket B: overflow from primary pool (already score >= 60, core NOC,
  // just didn't make top 10)
  const bucketB = overflow.filter(job => !primaryIds.has(job.job_hash || job.url));

  const secondaryPool = [...bucketA, ...bucketB]
    // de-dup in case a job somehow qualifies for both buckets
    .filter((job, idx, arr) => arr.findIndex(j => (j.job_hash || j.url) === (job.job_hash || job.url)) === idx)
    .sort((a, b) => b.score - a.score);

  const secondary = secondaryPool.slice(0, SECONDARY_TOP_N);

  return {
    primary,
    secondary,
    stats: {
      totalEligible:   eligible.length,
      primaryPoolSize: primaryPool.length,
      bucketASize:     bucketA.length,
      bucketBSize:     bucketB.length,
    },
  };
}

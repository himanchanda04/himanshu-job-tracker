import express from 'express';
import pool                                    from '../db/database.js';
import { runScoutMigration }                   from '../db/scout_migration.js';
import { runScoutMigrationV2 }                 from '../db/scout_migration_v2.js';
import { fetchAllSources }                     from '../services/jobFetcher.js';
import { deduplicateJobs, generateJobHash }    from '../services/jobDeduplicator.js';
import {
  passesQualityGates, keywordPreFilter,
  extractKeywordsFromResume, detectGhostJob, detectFakeJob,
} from '../services/qualityFilter.js';
import { scoreJobs }          from '../services/jobScorer.js';
import { curateDigest }       from '../services/jobCurator.js';
import { sendScoutDigest }    from '../services/emailDigest.js';
import { checkApifyBudget }   from '../services/apifyBudgetGuard.js';
import { checkClaudeBudget }  from '../services/claudeBudgetGuard.js';
import { authenticate }       from '../middleware/auth.js';

const router = express.Router();

// ─── Auth guard ───────────────────────────────────────────────────────────────
// userAuth = [authenticate, requireAuth] applied per-route to every
// human-facing endpoint below. /run/auto and /deploy are intentionally
// excluded — they're called by external services (cron-job.org, deploy
// webhooks) with no user JWT, and authenticate via their own header checks.
function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
const userAuth = [authenticate, requireAuth];

// ─── GET /api/scout/settings ──────────────────────────────────────────────────
router.get('/settings', userAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM scout_settings WHERE user_id = $1', [req.user.id]
    );
    res.json(rows[0] || { target_title: '', industry: '', min_score: 75, is_active: true, email_notify: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/scout/settings ────────────────────────────────────────────────
router.patch('/settings', userAuth, async (req, res) => {
  const { target_title = '', industry = '', min_score = 75, is_active = true, email_notify = true } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO scout_settings (user_id, target_title, industry, min_score, is_active, email_notify, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         target_title=$2, industry=$3, min_score=$4,
         is_active=$5, email_notify=$6, updated_at=NOW()
       RETURNING *`,
      [req.user.id, target_title, industry, min_score, is_active, email_notify]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scout/results ───────────────────────────────────────────────────
router.get('/results', userAuth, async (req, res) => {
  const { min_score = 0, status, limit = 60, offset = 0 } = req.query;
  try {
    let q      = `SELECT * FROM scout_results WHERE user_id=$1 AND status != 'dismissed' AND (score >= $2 OR score IS NULL)`;
    const params = [req.user.id, parseInt(min_score)];
    let   pi   = 3;

    if (status) { q += ` AND status=$${pi++}`; params.push(status); }
    q += ` ORDER BY COALESCE(score,0) DESC, last_seen_at DESC LIMIT $${pi++} OFFSET $${pi++}`;
    params.push(parseInt(limit), parseInt(offset));

    const [results, newCount] = await Promise.all([
      pool.query(q, params),
      pool.query(`SELECT COUNT(*) FROM scout_results WHERE user_id=$1 AND status='new'`, [req.user.id]),
    ]);

    res.json({ jobs: results.rows, new_count: parseInt(newCount.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scout/results/seen — mark all new as seen ─────────────────────
router.post('/results/seen', userAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE scout_results SET status='seen' WHERE user_id=$1 AND status='new'`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/scout/results/:hash — update status ──────────────────────────
router.patch('/results/:hash', userAuth, async (req, res) => {
  const { status } = req.body;
  if (!['seen','saved','dismissed','added_to_tracker'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await pool.query(
      `UPDATE scout_results SET status=$1 WHERE user_id=$2 AND job_hash=$3`,
      [status, req.user.id, req.params.hash]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scout/budget ────────────────────────────────────────────────────
router.get('/budget', userAuth, async (req, res) => {
  try {
    const [apify, claude] = await Promise.all([
      checkApifyBudget(req.user.id),
      checkClaudeBudget(req.user.id),
    ]);
    res.json({ apify, claude });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scout/runs ──────────────────────────────────────────────────────
router.get('/runs', userAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM scout_runs WHERE user_id=$1 ORDER BY started_at DESC LIMIT 10`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Core run engine ──────────────────────────────────────────────────────────
async function runScout(userId, triggeredBy = 'manual') {
  // Load user + settings in one query
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.original_resume,
            COALESCE(ss.target_title,'')  AS target_title,
            COALESCE(ss.industry,'')      AS industry,
            COALESCE(ss.min_score, 75)    AS min_score,
            COALESCE(ss.email_notify,true) AS email_notify
       FROM users u
  LEFT JOIN scout_settings ss ON ss.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  if (!rows.length) throw new Error('User not found');
  const user = rows[0];

  if (!user.original_resume || user.original_resume.trim().length < 100) {
    throw new Error('Upload your resume in Settings before running Job Scout');
  }

  // Create run record
  const runRow = await pool.query(
    `INSERT INTO scout_runs (user_id, triggered_by, status) VALUES ($1,$2,'running') RETURNING id`,
    [userId, triggeredBy]
  );
  const runId = runRow.rows[0].id;

  try {
    // 1 — Fetch
    console.log(`[Scout] Run ${runId} | triggered_by=${triggeredBy}`);
    const { allJobs, sourcesUsed, sourcesFailed } = await fetchAllSources(
      user.target_title, user.industry, userId
    );
    console.log(`[Scout] Fetched ${allJobs.length} raw | sources: ${sourcesUsed.join(', ')}`);

    // 2 — Deduplicate
    const deduped = deduplicateJobs(allJobs);
    console.log(`[Scout] After dedup: ${deduped.length}`);

    // 3 — Quality + keyword gates
    const keywords = extractKeywordsFromResume(user.original_resume, user.target_title, user.industry);
    const filtered = deduped.filter(job => {
      const q = passesQualityGates(job);
      if (!q.pass) return false;
      return keywordPreFilter(job, keywords).pass;
    });
    console.log(`[Scout] After quality filter: ${filtered.length}`);

    if (!filtered.length) {
      await pool.query(
        `UPDATE scout_runs SET completed_at=NOW(), status='completed',
          jobs_fetched=$1, jobs_matched=0, sources_used=$2, sources_failed=$3 WHERE id=$4`,
        [allJobs.length, sourcesUsed, sourcesFailed, runId]
      );
      return { runId, jobsFound: 0, sourcesUsed, sourcesFailed };
    }

    // 4 — Score (AI or keyword fallback) — now includes NOC/TEER/category/title_match
    const { scoredJobs, totalClaudeCost } = await scoreJobs(
      filtered, user.original_resume, user.target_title, user.industry, userId, runId
    );

    // 5 — Ghost detection + fake-signal count (informational, already filtered above)
    const existing = await pool.query(
      `SELECT company, title FROM scout_results WHERE user_id=$1`, [userId]
    );
    const annotated = scoredJobs.map(j => ({
      ...j,
      is_ghost_job:      detectGhostJob(j, existing.rows),
      fake_signal_count: detectFakeJob(j).signalCount,
      job_hash:          j.hash || generateJobHash(j),
    }));

    // 6 — Curate into primary ("Top 10 Matches") + secondary ("Also Worth a Look")
    const { primary, secondary, stats } = curateDigest(annotated);
    const digestJobs = [...primary, ...secondary];
    console.log(
      `[Scout] Curated: ${primary.length} primary, ${secondary.length} secondary ` +
      `(eligible pool: ${stats.totalEligible}, bucketA: ${stats.bucketASize}, bucketB: ${stats.bucketBSize})`
    );

    // 7 — Upsert ALL scored jobs (not just digest picks) so the app shows
    // everything, while digest_bucket marks which section (if any) a job
    // landed in for today's email.
    let newCount = 0;
    const primaryIds   = new Set(primary.map(j => j.job_hash));
    const secondaryIds = new Set(secondary.map(j => j.job_hash));

    for (const job of annotated) {
      const hash = job.job_hash;
      const bucket = primaryIds.has(hash) ? 'primary'
                    : secondaryIds.has(hash) ? 'secondary'
                    : null;

      const ins = await pool.query(
        `INSERT INTO scout_results (
           user_id, job_hash, title, company, location, url, description,
           sources, posted_at, score, category,
           matched_keywords, missing_keywords,
           is_ghost_job, scoring_mode, status, last_seen_at,
           noc_code, noc_teer, pr_eligible, pr_tier, title_match,
           job_category, fake_signal_count, digest_bucket
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'new',NOW(),
           $16,$17,$18,$19,$20,$21,$22,$23
         )
         ON CONFLICT (user_id, job_hash) DO UPDATE SET
           last_seen_at=NOW(), score=EXCLUDED.score, sources=EXCLUDED.sources,
           noc_code=EXCLUDED.noc_code, noc_teer=EXCLUDED.noc_teer,
           pr_eligible=EXCLUDED.pr_eligible, pr_tier=EXCLUDED.pr_tier,
           title_match=EXCLUDED.title_match, job_category=EXCLUDED.job_category,
           digest_bucket=EXCLUDED.digest_bucket
         RETURNING (xmax=0) AS is_new`,
        [
          userId, hash, job.title, job.company,
          job.location || 'Winnipeg, MB', job.url,
          (job.description || '').slice(0, 2500),
          job.sources || [job.source],
          job.posted_at || new Date(),
          job.score, job.match_tier,
          job.matched_keywords || [],
          job.missing_keywords || [],
          job.is_ghost_job || false,
          job.scoring_mode || 'keyword',
          job.noc_code || null,
          job.noc_teer ?? null,
          job.pr_eligible || false,
          job.pr_tier || null,
          job.title_match || 'unknown',
          job.category || 'other',
          job.fake_signal_count || 0,
          bucket,
        ]
      );
      if (ins.rows[0]?.is_new) newCount++;
    }

    // 8 — Auto-expire seen jobs older than 30 days
    await pool.query(
      `DELETE FROM scout_results WHERE user_id=$1 AND status='seen' AND last_seen_at < NOW()-INTERVAL '30 days'`,
      [userId]
    );

    // 9 — Update run record
    await pool.query(
      `UPDATE scout_runs SET completed_at=NOW(), status='completed',
         jobs_fetched=$1, jobs_matched=$2,
         sources_used=$3, sources_failed=$4, claude_cost_usd=$5
       WHERE id=$6`,
      [allJobs.length, digestJobs.length, sourcesUsed, sourcesFailed, totalClaudeCost, runId]
    );

    // 10 — Email if there's anything to show + opted in
    // Note: sends even if newCount is 0 but digest has content, since "new"
    // here means "new to the DB" — a job seen yesterday but still posted
    // within 24h should still appear in today's digest.
    if ((primary.length || secondary.length) && user.email_notify) {
      sendScoutDigest(user.email, user.name, { primary, secondary }, { sourcesUsed })
        .catch(e => console.warn('[Scout] Email failed (non-fatal):', e.message));
    }

    return {
      runId, jobsFound: newCount,
      totalMatched: digestJobs.length,
      primaryCount: primary.length,
      secondaryCount: secondary.length,
      sourcesUsed, sourcesFailed,
    };

  } catch (err) {
    await pool.query(
      `UPDATE scout_runs SET status='failed', completed_at=NOW() WHERE id=$1`, [runId]
    );
    throw err;
  }
}

// ─── POST /api/scout/run — manual trigger ─────────────────────────────────────
router.post('/run', userAuth, async (req, res) => {
  try {
    const result = await runScout(req.user.id, 'manual');
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Scout] Manual run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scout/run/auto — called by cron-job.org ───────────────────────
// Secured by CRON_SECRET_TOKEN header — no user auth here
router.post('/run/auto', async (req, res) => {
  if (req.headers['x-cron-token'] !== process.env.CRON_SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Respond immediately with a tiny payload so cron-job.org never
  // hits its response-size or timeout limit. The actual scout pipeline
  // runs in the background after the HTTP response is already sent.
  res.json({ ok: true, message: 'Scout started' });

  // Background execution — errors logged to Render, never sent to cron-job.org
  setImmediate(async () => {
    try {
      const { rows } = await pool.query(
        `SELECT u.id FROM users u
         INNER JOIN scout_settings ss ON ss.user_id = u.id
         WHERE ss.is_active = true LIMIT 1`
      );
      if (!rows.length) {
        console.log('[Scout] No active scout users — skipping run');
        return;
      }
      const result = await runScout(rows[0].id, 'auto');
      console.log(`[Scout] Auto run complete — ${result.primaryCount} primary, ${result.secondaryCount} secondary, ${result.jobsFound} new`);
    } catch (err) {
      console.error('[Scout] Auto run error:', err.message);
    }
  });
});

// ─── POST /api/scout/deploy — trigger Vercel + Render hooks ──────────────────
router.post('/deploy', async (req, res) => {
  const out = { vercel: 'not_configured', render: 'not_configured' };

  if (process.env.VERCEL_DEPLOY_HOOK) {
    try {
      const r = await fetch(process.env.VERCEL_DEPLOY_HOOK, { method: 'POST' });
      out.vercel = r.ok ? 'triggered' : `failed_${r.status}`;
    } catch (e) { out.vercel = `error: ${e.message}`; }
  }

  if (process.env.RENDER_DEPLOY_HOOK) {
    try {
      const r = await fetch(process.env.RENDER_DEPLOY_HOOK, { method: 'POST' });
      out.render = r.ok ? 'triggered' : `failed_${r.status}`;
    } catch (e) { out.render = `error: ${e.message}`; }
  }

  res.json({ ok: true, ...out, timestamp: new Date().toISOString() });
});

// Run migrations on startup (idempotent)
runScoutMigration().then(() => runScoutMigrationV2()).catch(console.error);

export default router;

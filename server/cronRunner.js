// ─── Render Native Cron Job Runner ───────────────────────────────────────────
// This script is executed directly by Render's cron job service (not via HTTP).
// It runs the full Job Scout pipeline for all active users and exits cleanly.
// Schedule: 0 14 * * * (8:00 AM America/Winnipeg = 14:00 UTC)

import pool                                  from './db/database.js';
import { initDB }                            from './db/database.js';
import { runScoutMigration }                 from './db/scout_migration.js';
import { runScoutMigrationV2 }               from './db/scout_migration_v2.js';
import { fetchAllSources }                   from './services/jobFetcher.js';
import { deduplicateJobs, generateJobHash }  from './services/jobDeduplicator.js';
import {
  passesQualityGates,
  detectGhostJob,
  detectFakeJob,
} from './services/qualityFilter.js';
import { scoreJobs }        from './services/jobScorer.js';
import { curateDigest }     from './services/jobCurator.js';
import { sendScoutDigest }  from './services/emailDigest.js';

async function main() {
  console.log('[CronRunner] Starting Job Scout daily run...');

  // Initialize DB schema (creates all tables including users.original_resume)
  await initDB();
  await runScoutMigration();
  await runScoutMigrationV2();

  // Find all active scout users — resume is stored on users table directly
  const { rows: users } = await pool.query(`
    SELECT
      u.id, u.name, u.email,
      u.original_resume,
      ss.target_title, ss.industry, ss.email_notify
    FROM users u
    INNER JOIN scout_settings ss ON ss.user_id = u.id
    WHERE ss.is_active = true
  `);

  if (!users.length) {
    console.log('[CronRunner] No active scout users found — exiting.');
    process.exit(0);
  }

  console.log(`[CronRunner] Running scout for ${users.length} user(s)...`);

  for (const user of users) {
    try {
      console.log(`[CronRunner] Processing user ${user.id} (${user.email})...`);

      if (!user.original_resume) {
        console.log(`[CronRunner] User ${user.id} has no resume — skipping.`);
        continue;
      }

      // Create run record
      const { rows: [run] } = await pool.query(
        `INSERT INTO scout_runs (user_id, triggered_by, status, started_at)
         VALUES ($1, 'cron', 'running', NOW()) RETURNING id`,
        [user.id]
      );
      const runId = run.id;

      // Fetch from all sources (budget check happens inside fetchAllSources)
      const { allJobs, sourcesUsed, sourcesFailed } = await fetchAllSources(
        user.target_title || 'Marketing',
        user.industry || '',
        user.id
      );

      console.log(`[CronRunner] Fetched ${allJobs.length} raw jobs from ${sourcesUsed.length} sources`);

      // Deduplicate
      const unique = deduplicateJobs(allJobs);
      console.log(`[CronRunner] After dedup: ${unique.length} unique jobs`);

      // Quality filter
      const filtered = unique.filter(j => {
        const { pass } = passesQualityGates(j);
        return pass;
      });
      console.log(`[CronRunner] After quality filter: ${filtered.length} jobs`);

      if (!filtered.length) {
        await pool.query(
          `UPDATE scout_runs SET status='completed', completed_at=NOW(),
           jobs_fetched=$1, jobs_matched=0, sources_used=$2, sources_failed=$3
           WHERE id=$4`,
          [allJobs.length, sourcesUsed, sourcesFailed, runId]
        );
        console.log(`[CronRunner] No jobs passed quality filter for user ${user.id}`);
        continue;
      }

      // Score with Claude Haiku (NOC/TEER/category/title_match)
      const { scoredJobs, totalClaudeCost } = await scoreJobs(
        filtered,
        user.original_resume,
        user.target_title,
        user.industry,
        user.id,
        runId
      );

      // Ghost detection + fake signal count
      const { rows: existing } = await pool.query(
        `SELECT company, title FROM scout_results WHERE user_id=$1`, [user.id]
      );
      const annotated = scoredJobs.map(j => ({
        ...j,
        is_ghost_job:      detectGhostJob(j, existing),
        fake_signal_count: detectFakeJob(j).signalCount,
        job_hash:          j.hash || generateJobHash(j),
      }));

      // Curate into primary + secondary buckets
      const { primary, secondary, stats } = curateDigest(annotated);
      console.log(`[CronRunner] Curated: ${primary.length} primary, ${secondary.length} secondary (pool: ${stats.totalEligible})`);

      // Upsert all scored jobs to DB
      const primaryIds   = new Set(primary.map(j => j.job_hash));
      const secondaryIds = new Set(secondary.map(j => j.job_hash));
      let newCount = 0;

      for (const job of annotated) {
        const bucket = primaryIds.has(job.job_hash) ? 'primary'
                     : secondaryIds.has(job.job_hash) ? 'secondary'
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
            user.id, job.job_hash, job.title, job.company,
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

      // Clean up old seen jobs
      await pool.query(
        `DELETE FROM scout_results WHERE user_id=$1 AND status='seen'
         AND last_seen_at < NOW()-INTERVAL '30 days'`,
        [user.id]
      );

      // Update run record
      await pool.query(
        `UPDATE scout_runs SET completed_at=NOW(), status='completed',
           jobs_fetched=$1, jobs_matched=$2,
           sources_used=$3, sources_failed=$4, claude_cost_usd=$5
         WHERE id=$6`,
        [allJobs.length, primary.length + secondary.length,
         sourcesUsed, sourcesFailed, totalClaudeCost, runId]
      );

      // Send email
      if ((primary.length || secondary.length) && user.email_notify) {
        await sendScoutDigest(
          user.email, user.name,
          { primary, secondary },
          { sourcesUsed }
        );
        console.log(`[CronRunner] ✅ Email sent to ${user.email} — ${primary.length} primary, ${secondary.length} secondary`);
      } else {
        console.log(`[CronRunner] No jobs to email for user ${user.id}`);
      }

    } catch (err) {
      console.error(`[CronRunner] ❌ Failed for user ${user.id}:`, err.message);
    }
  }

  console.log('[CronRunner] All users processed. Exiting.');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[CronRunner] Fatal error:', err);
  process.exit(1);
});

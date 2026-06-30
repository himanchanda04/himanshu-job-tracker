import pool from './database.js';

// ─── Migration V2 — NOC / TEER / PR-eligibility + secondary digest support ───
export async function runScoutMigrationV2() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS noc_code     TEXT`);
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS noc_teer     INTEGER`);
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS pr_eligible  BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS pr_tier      TEXT`); // 'high' | 'valid' | null
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS title_match  TEXT`); // 'exact' | 'close' | 'mismatch' | 'unknown'
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS job_category TEXT`); // marketing | data_analytics | digital | finance | admin | hr | other
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS source_type  TEXT`); // career_page | aggregator | api | gov
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS digest_bucket TEXT`); // 'primary' | 'secondary' | null (not emailed)
    await client.query(`ALTER TABLE scout_results ADD COLUMN IF NOT EXISTS fake_signal_count INTEGER DEFAULT 0`);

    // Index for the curator's two-bucket query pattern
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scout_results_pr_score
      ON scout_results(user_id, pr_eligible, score DESC NULLS LAST)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scout_results_category
      ON scout_results(user_id, job_category)
    `);

    await client.query('COMMIT');
    console.log('[Scout] ✅ Migration V2 complete (NOC/TEER/digest columns)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Scout] ❌ Migration V2 failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

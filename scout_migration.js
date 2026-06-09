import pool from './database.js';

export async function runScoutMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS scout_settings (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        target_title  TEXT    DEFAULT '',
        industry      TEXT    DEFAULT '',
        min_score     INTEGER DEFAULT 75,
        is_active     BOOLEAN DEFAULT true,
        email_notify  BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scout_results (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_hash         TEXT    NOT NULL,
        title            TEXT    NOT NULL,
        company          TEXT    NOT NULL,
        location         TEXT    DEFAULT 'Winnipeg, MB',
        url              TEXT    NOT NULL,
        description      TEXT    DEFAULT '',
        sources          TEXT[]  DEFAULT '{}',
        posted_at        TIMESTAMP,
        score            INTEGER,
        category         TEXT,
        matched_keywords TEXT[]  DEFAULT '{}',
        missing_keywords TEXT[]  DEFAULT '{}',
        is_ghost_job     BOOLEAN DEFAULT false,
        scoring_mode     TEXT    DEFAULT 'ai',
        status           TEXT    DEFAULT 'new',
        first_seen_at    TIMESTAMP DEFAULT NOW(),
        last_seen_at     TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, job_hash)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scout_runs (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        triggered_by    TEXT    DEFAULT 'auto',
        started_at      TIMESTAMP DEFAULT NOW(),
        completed_at    TIMESTAMP,
        jobs_fetched    INTEGER DEFAULT 0,
        jobs_matched    INTEGER DEFAULT 0,
        sources_used    TEXT[]  DEFAULT '{}',
        sources_failed  TEXT[]  DEFAULT '{}',
        apify_cost_usd  DECIMAL(10,6) DEFAULT 0,
        claude_cost_usd DECIMAL(10,6) DEFAULT 0,
        status          TEXT    DEFAULT 'running'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_tracking (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        service     TEXT    NOT NULL,
        cost_usd    DECIMAL(10,6) NOT NULL,
        month_year  TEXT    NOT NULL,
        run_id      INTEGER REFERENCES scout_runs(id),
        recorded_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scout_results_user_status  ON scout_results(user_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scout_results_score        ON scout_results(user_id, score DESC NULLS LAST)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scout_runs_user            ON scout_runs(user_id, started_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budget_tracking_month      ON budget_tracking(user_id, service, month_year)`);

    await client.query('COMMIT');
    console.log('[Scout] ✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Scout] ❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

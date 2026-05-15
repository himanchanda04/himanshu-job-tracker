import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// ─── Initialize schema on startup ───────────────────────────────────────────
export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          TEXT    NOT NULL,
        email         TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id                 SERIAL PRIMARY KEY,
        user_id            INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),

        company            TEXT    NOT NULL,
        role               TEXT    NOT NULL,
        location           TEXT,
        portal             TEXT,
        job_url            TEXT,
        job_description    TEXT,

        recruiter_name     TEXT,
        recruiter_email    TEXT,

        salary_min         INTEGER,
        salary_max         INTEGER,
        salary_currency    TEXT    DEFAULT 'CAD',

        status             TEXT    DEFAULT 'Applied'
                           CHECK(status IN ('Applied','Interview','Offer','Rejected','No Response','Discarded')),
        applied_date       TEXT    NOT NULL,
        interview_date     TEXT,
        last_updated       TEXT    NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        created_at         TIMESTAMPTZ DEFAULT NOW(),

        discard_after_days INTEGER DEFAULT 20,
        auto_discarded     INTEGER DEFAULT 0,

        remarks            TEXT
      );
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_status       ON applications(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_applied_date ON applications(applied_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_company      ON applications(company)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_id      ON applications(user_id)');

    console.log('[DB] PostgreSQL schema initialized.');
  } finally {
    client.release();
  }
}

export default pool;

-- Himanshu Job Application Tracker — SQLite Schema
-- To add a column: add it here, then update routes/applications.js (allowed array + INSERT)
-- and client/src/components/applications/ApplicationForm.jsx

CREATE TABLE IF NOT EXISTS applications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),

  -- Core info
  company            TEXT    NOT NULL,
  role               TEXT    NOT NULL,
  location           TEXT,
  portal             TEXT,                 -- LinkedIn, Indeed, Glassdoor, etc.
  job_url            TEXT,
  job_description    TEXT,

  -- Recruiter
  recruiter_name     TEXT,
  recruiter_email    TEXT,

  -- Salary
  salary_min         INTEGER,
  salary_max         INTEGER,
  salary_currency    TEXT    DEFAULT 'CAD',

  -- Status lifecycle
  status             TEXT    DEFAULT 'Applied'
                     CHECK(status IN ('Applied','Interview','Offer','Rejected','No Response','Discarded')),
  applied_date       TEXT    NOT NULL,     -- ISO 8601: YYYY-MM-DD
  interview_date     TEXT,
  last_updated       TEXT    NOT NULL,
  created_at         TEXT    DEFAULT (datetime('now')),

  -- Auto-discard
  discard_after_days INTEGER DEFAULT 20,
  auto_discarded     INTEGER DEFAULT 0,    -- 0 = false, 1 = true

  -- Free-form notes
  remarks            TEXT
);

CREATE INDEX IF NOT EXISTS idx_status       ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applied_date ON applications(applied_date);
CREATE INDEX IF NOT EXISTS idx_company      ON applications(company);
CREATE INDEX IF NOT EXISTS idx_user_id      ON applications(user_id);

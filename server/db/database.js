import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(join(__dirname, 'tracker.db'));

// WAL mode: faster writes, safe concurrent reads
db.pragma('journal_mode = WAL');

// Create users table first (needed before applications references it)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    DEFAULT (datetime('now'))
  );
`);

// Migration: add user_id to applications if table exists but column doesn't
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='applications'").get();
if (tableExists) {
  const cols = db.prepare("PRAGMA table_info(applications)").all().map(c => c.name);
  if (!cols.includes('user_id')) {
    db.exec("ALTER TABLE applications ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0");
  }
}

// Now enable foreign keys and run full schema
db.pragma('foreign_keys = ON');
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

export default db;

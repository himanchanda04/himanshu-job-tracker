import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(join(__dirname, 'tracker.db'));

// WAL mode: faster writes, safe concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema on startup — CREATE TABLE IF NOT EXISTS is idempotent
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

export default db;

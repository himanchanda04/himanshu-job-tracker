import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Fields that callers are allowed to set / update.
// To add a new column: add its name here AND update the INSERT below.
const ALLOWED = [
  'company', 'role', 'location', 'portal', 'job_url', 'job_description',
  'recruiter_name', 'recruiter_email',
  'salary_min', 'salary_max', 'salary_currency',
  'status', 'remarks', 'applied_date', 'interview_date',
  'discard_after_days', 'auto_discarded',
];

// ─── GET /api/applications ───────────────────────────────────────────────────
// Query params: status, search, page (default 1), limit (default 50)
router.get('/', (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'user_id = ?';
  const positional = [req.user.id];

  if (status && status !== 'All') {
    where += ' AND status = ?';
    positional.push(status);
  }
  if (search) {
    where += ' AND (company LIKE ? OR role LIKE ? OR recruiter_name LIKE ?)';
    const q = `%${search}%`;
    positional.push(q, q, q);
  }

  const total = db.prepare(`SELECT COUNT(*) AS count FROM applications WHERE ${where}`)
    .get(...positional).count;

  const data = db.prepare(
    `SELECT * FROM applications WHERE ${where}
     ORDER BY applied_date DESC, id DESC
     LIMIT ? OFFSET ?`
  ).all(...positional, Number(limit), offset);

  res.json({ total, page: Number(page), limit: Number(limit), data });
});

// ─── GET /api/applications/stats ─────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const uid = req.user.id;

  const stats = db.prepare(`
    SELECT
      COUNT(*)                                                AS total,
      SUM(CASE WHEN status = 'Applied'      THEN 1 ELSE 0 END) AS applied,
      SUM(CASE WHEN status = 'Interview'    THEN 1 ELSE 0 END) AS interview,
      SUM(CASE WHEN status = 'Offer'        THEN 1 ELSE 0 END) AS offer,
      SUM(CASE WHEN status = 'Rejected'     THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'No Response'  THEN 1 ELSE 0 END) AS no_response,
      SUM(CASE WHEN status = 'Discarded'    THEN 1 ELSE 0 END) AS discarded
    FROM applications WHERE user_id = ?
  `).get(uid);

  const byPortal = db.prepare(`
    SELECT portal, COUNT(*) AS count
    FROM applications
    WHERE user_id = ? AND portal IS NOT NULL AND portal != ''
    GROUP BY portal
    ORDER BY count DESC
  `).all(uid);

  const last30Days = db.prepare(`
    SELECT DATE(applied_date) AS date, COUNT(*) AS count
    FROM applications
    WHERE user_id = ? AND applied_date >= DATE('now', '-30 days')
    GROUP BY DATE(applied_date)
    ORDER BY date ASC
  `).all(uid);

  res.json({ stats, byPortal, last30Days });
});

// ─── GET /api/applications/:id ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ─── POST /api/applications ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    company, role, location, portal, job_url, job_description,
    recruiter_name, recruiter_email,
    salary_min, salary_max, salary_currency = 'CAD',
    status = 'Applied', remarks,
    applied_date, interview_date,
    discard_after_days = 20,
  } = req.body;

  if (!company?.trim() || !role?.trim() || !applied_date) {
    return res.status(400).json({ error: 'company, role, and applied_date are required.' });
  }

  const stmt = db.prepare(`
    INSERT INTO applications
      (user_id, company, role, location, portal, job_url, job_description,
       recruiter_name, recruiter_email,
       salary_min, salary_max, salary_currency,
       status, remarks, applied_date, interview_date,
       last_updated, discard_after_days)
    VALUES
      (@user_id, @company, @role, @location, @portal, @job_url, @job_description,
       @recruiter_name, @recruiter_email,
       @salary_min, @salary_max, @salary_currency,
       @status, @remarks, @applied_date, @interview_date,
       datetime('now'), @discard_after_days)
  `);

  const result = stmt.run({
    user_id: req.user.id,
    company, role,
    location:          location          ?? null,
    portal:            portal            ?? null,
    job_url:           job_url           ?? null,
    job_description:   job_description   ?? null,
    recruiter_name:    recruiter_name    ?? null,
    recruiter_email:   recruiter_email   ?? null,
    salary_min:        salary_min        ?? null,
    salary_max:        salary_max        ?? null,
    salary_currency,
    status, remarks: remarks ?? null,
    applied_date,
    interview_date:    interview_date    ?? null,
    discard_after_days: Number(discard_after_days),
  });

  const created = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// ─── PATCH /api/applications/:id ─────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM applications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = { last_updated: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const setClause = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE applications SET ${setClause} WHERE id = @_id AND user_id = @_uid`)
    .run({ ...updates, _id: req.params.id, _uid: req.user.id });

  const updated = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  res.json(updated);
});

// ─── DELETE /api/applications/:id ─────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

export default router;

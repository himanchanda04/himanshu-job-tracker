import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

const ALLOWED = [
  'company', 'role', 'location', 'portal', 'job_url', 'job_description',
  'recruiter_name', 'recruiter_email',
  'salary_min', 'salary_max', 'salary_currency',
  'status', 'remarks', 'applied_date', 'interview_date',
  'discard_after_days', 'auto_discarded',
];

// ─── GET /api/applications ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'user_id = $1';
  const params = [req.user.id];
  let idx = 2;

  if (status && status !== 'All') {
    where += ` AND status = $${idx++}`;
    params.push(status);
  }
  if (search) {
    where += ` AND (company ILIKE $${idx} OR role ILIKE $${idx} OR recruiter_name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM applications WHERE ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
    `SELECT * FROM applications WHERE ${where}
     ORDER BY applied_date DESC, id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, Number(limit), offset]
  );

  res.json({ total, page: Number(page), limit: Number(limit), data: dataResult.rows });
});

// ─── GET /api/applications/stats ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const uid = req.user.id;

  const statsResult = await pool.query(`
    SELECT
      COUNT(*)::int                                                    AS total,
      SUM(CASE WHEN status = 'Applied'      THEN 1 ELSE 0 END)::int AS applied,
      SUM(CASE WHEN status = 'Interview'    THEN 1 ELSE 0 END)::int AS interview,
      SUM(CASE WHEN status = 'Offer'        THEN 1 ELSE 0 END)::int AS offer,
      SUM(CASE WHEN status = 'Rejected'     THEN 1 ELSE 0 END)::int AS rejected,
      SUM(CASE WHEN status = 'No Response'  THEN 1 ELSE 0 END)::int AS no_response,
      SUM(CASE WHEN status = 'Discarded'    THEN 1 ELSE 0 END)::int AS discarded
    FROM applications WHERE user_id = $1
  `, [uid]);

  const byPortalResult = await pool.query(`
    SELECT portal, COUNT(*)::int AS count
    FROM applications
    WHERE user_id = $1 AND portal IS NOT NULL AND portal != ''
    GROUP BY portal
    ORDER BY count DESC
  `, [uid]);

  const last30Result = await pool.query(`
    SELECT applied_date AS date, COUNT(*)::int AS count
    FROM applications
    WHERE user_id = $1 AND applied_date >= (CURRENT_DATE - INTERVAL '30 days')::text
    GROUP BY applied_date
    ORDER BY date ASC
  `, [uid]);

  res.json({
    stats: statsResult.rows[0],
    byPortal: byPortalResult.rows,
    last30Days: last30Result.rows,
  });
});

// ─── GET /api/applications/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// ─── POST /api/applications ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
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

  const result = await pool.query(`
    INSERT INTO applications
      (user_id, company, role, location, portal, job_url, job_description,
       recruiter_name, recruiter_email,
       salary_min, salary_max, salary_currency,
       status, remarks, applied_date, interview_date,
       last_updated, discard_after_days)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7,
       $8, $9,
       $10, $11, $12,
       $13, $14, $15, $16,
       NOW(), $17)
    RETURNING *
  `, [
    req.user.id, company, role,
    location ?? null, portal ?? null, job_url ?? null, job_description ?? null,
    recruiter_name ?? null, recruiter_email ?? null,
    salary_min ?? null, salary_max ?? null, salary_currency,
    status, remarks ?? null, applied_date, interview_date ?? null,
    Number(discard_after_days),
  ]);

  res.status(201).json(result.rows[0]);
});

// ─── PATCH /api/applications/:id ─────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const check = await pool.query(
    'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const keys = Object.keys(updates);
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  setClauses.push(`last_updated = NOW()`);
  const values = keys.map((k) => updates[k]);

  const result = await pool.query(
    `UPDATE applications SET ${setClauses.join(', ')}
     WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}
     RETURNING *`,
    [...values, req.params.id, req.user.id]
  );

  res.json(result.rows[0]);
});

// ─── DELETE /api/applications/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM applications WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

export default router;

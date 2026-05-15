import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/database.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name.trim(), email.trim().toLowerCase(), password_hash]
  );

  const user = result.rows[0];
  const token = signToken(user);

  res.status(201).json({ user, token });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  const token = signToken(user);

  res.json({ user, token });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1', [req.user.id]
  );
  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

  res.json({ message: 'Password changed successfully.' });
});

export default router;

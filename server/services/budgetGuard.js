// ─── Unified $5/month Budget Guard ───────────────────────────────────────────
// Single cap across ALL API services: Apify + Claude combined.
// Set MONTHLY_API_BUDGET env var to override (default $5.00).

import pool from '../db/database.js';

const TOTAL_BUDGET = parseFloat(process.env.MONTHLY_API_BUDGET || '5.00');
const WARN_AT      = 0.80; // warn at 80% ($4.00)

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function getTotalMonthlySpend(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total
     FROM budget_tracking
     WHERE user_id = $1 AND month_year = $2`,
    [userId, currentMonth()]
  );
  return parseFloat(rows[0].total);
}

export async function checkTotalBudget(userId) {
  const spent     = await getTotalMonthlySpend(userId);
  const remaining = Math.max(0, TOTAL_BUDGET - spent);
  const pct       = Math.min(100, (spent / TOTAL_BUDGET) * 100);
  return {
    allowed:    spent < TOTAL_BUDGET,
    spent,
    remaining,
    percentage: pct,
    warning:    pct >= WARN_AT * 100,
    budget:     TOTAL_BUDGET,
  };
}

export async function recordCost(userId, service, costUsd, runId) {
  if (!costUsd || costUsd <= 0) return;
  await pool.query(
    `INSERT INTO budget_tracking (user_id, service, cost_usd, month_year, run_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, service, costUsd, currentMonth(), runId || null]
  );
}

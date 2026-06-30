import pool from '../db/database.js';

const BUDGET     = parseFloat(process.env.APIFY_MONTHLY_BUDGET || '5.00');
const WARN_AT    = 0.80; // warn at 80% ($4)

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export async function getApifyMonthlySpend(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total
       FROM budget_tracking
      WHERE user_id = $1 AND service = 'apify' AND month_year = $2`,
    [userId, currentMonth()]
  );
  return parseFloat(rows[0].total);
}

export async function checkApifyBudget(userId) {
  const spent      = await getApifyMonthlySpend(userId);
  const remaining  = Math.max(0, BUDGET - spent);
  const pct        = Math.min(100, (spent / BUDGET) * 100);
  return {
    allowed:   spent < BUDGET,
    spent,
    remaining,
    percentage: pct,
    warning:   pct >= WARN_AT * 100,
    budget:    BUDGET,
  };
}

export async function recordApifyCost(userId, costUsd, runId) {
  await pool.query(
    `INSERT INTO budget_tracking (user_id, service, cost_usd, month_year, run_id)
     VALUES ($1, 'apify', $2, $3, $4)`,
    [userId, costUsd, currentMonth(), runId]
  );
}

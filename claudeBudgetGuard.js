import pool from '../db/database.js';

const BUDGET  = parseFloat(process.env.CLAUDE_MONTHLY_BUDGET || '2.00');
const WARN_AT = 0.75; // warn at 75% ($1.50)

// claude-haiku-4-5 pricing per 1M tokens
const INPUT_COST_PER_M  = 0.80;
const OUTPUT_COST_PER_M = 4.00;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function calculateHaikuCost(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * INPUT_COST_PER_M
       + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;
}

export async function getClaudeMonthlySpend(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total
       FROM budget_tracking
      WHERE user_id = $1 AND service = 'claude' AND month_year = $2`,
    [userId, currentMonth()]
  );
  return parseFloat(rows[0].total);
}

export async function checkClaudeBudget(userId) {
  const spent     = await getClaudeMonthlySpend(userId);
  const remaining = Math.max(0, BUDGET - spent);
  const pct       = Math.min(100, (spent / BUDGET) * 100);
  return {
    allowed:   spent < BUDGET,
    mode:      spent >= BUDGET ? 'keyword' : 'ai',
    spent,
    remaining,
    percentage: pct,
    warning:   pct >= WARN_AT * 100,
    budget:    BUDGET,
  };
}

export async function recordClaudeCost(userId, inputTokens, outputTokens, runId) {
  const cost = calculateHaikuCost(inputTokens, outputTokens);
  await pool.query(
    `INSERT INTO budget_tracking (user_id, service, cost_usd, month_year, run_id)
     VALUES ($1, 'claude', $2, $3, $4)`,
    [userId, cost, currentMonth(), runId]
  );
  return cost;
}

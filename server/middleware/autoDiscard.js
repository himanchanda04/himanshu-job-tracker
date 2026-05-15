import cron from 'node-cron';
import pool from '../db/database.js';

/**
 * Runs every night at midnight.
 * Moves any application in "Applied" or "No Response" status to "Discarded"
 * when the number of days since applied_date >= discard_after_days.
 */
export function startAutoDiscardJob() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const result = await pool.query(`
        UPDATE applications
        SET
          status         = 'Discarded',
          auto_discarded = 1,
          last_updated   = NOW()
        WHERE
          status IN ('Applied', 'No Response')
          AND auto_discarded = 0
          AND (CURRENT_DATE - applied_date::date) >= discard_after_days
      `);

      if (result.rowCount > 0) {
        console.log(`[AutoDiscard] ${result.rowCount} application(s) moved to Discarded.`);
      }
    } catch (err) {
      console.error('[AutoDiscard] Error:', err.message);
    }
  });

  console.log('[AutoDiscard] Nightly job scheduled (midnight).');
}

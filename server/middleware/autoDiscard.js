import cron from 'node-cron';
import db from '../db/database.js';

/**
 * Runs every night at midnight.
 * Moves any application in "Applied" or "No Response" status to "Discarded"
 * when the number of days since applied_date >= discard_after_days.
 */
export function startAutoDiscardJob() {
  cron.schedule('0 0 * * *', () => {
    const result = db.prepare(`
      UPDATE applications
      SET
        status        = 'Discarded',
        auto_discarded = 1,
        last_updated  = datetime('now')
      WHERE
        status IN ('Applied', 'No Response')
        AND auto_discarded = 0
        AND julianday('now') - julianday(applied_date) >= discard_after_days
    `).run();

    if (result.changes > 0) {
      console.log(`[AutoDiscard] ${result.changes} application(s) moved to Discarded.`);
    }
  });

  console.log('[AutoDiscard] Nightly job scheduled (midnight).');
}

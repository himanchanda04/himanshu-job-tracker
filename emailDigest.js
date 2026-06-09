const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL || 'scout@jobtracker.app';
const FRONTEND_URL = process.env.FRONTEND_URL      || 'https://your-app.vercel.app';

function timeAgo(date) {
  if (!date) return 'recently';
  const hrs = Math.round((Date.now() - new Date(date).getTime()) / 36e5);
  if (hrs < 1)  return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return 'today';
}

function scoreColor(score) {
  if (!score)    return '#6b7280';
  if (score >= 90) return '#059669';
  if (score >= 80) return '#2563eb';
  return '#d97706';
}

function jobCard(job) {
  const color   = scoreColor(job.score);
  const scoreStr = job.scoring_mode === 'keyword'
    ? '~'
    : `${job.score}%`;
  const chips = (job.matched_keywords || []).slice(0, 4)
    .map(k => `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px;">${k}</span>`)
    .join('');

  return `
<div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:12px;background:#fff;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
    <div style="flex:1;">
      <div style="font-size:16px;font-weight:600;color:#111827;line-height:1.3;">${job.title}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:3px;">${job.company}</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:2px;">
        ${(job.sources || [job.source]).join(' + ')} · ${timeAgo(job.posted_at)}
        ${job.is_ghost_job ? ' · 👻 Posted before' : ''}
      </div>
    </div>
    <div style="background:${color};color:white;padding:6px 12px;border-radius:20px;font-weight:700;font-size:15px;white-space:nowrap;">
      ${scoreStr}
    </div>
  </div>
  ${chips ? `<div style="margin-top:10px;">${chips}</div>` : ''}
  <a href="${job.url}" style="display:inline-block;margin-top:12px;background:#111827;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">
    View &amp; Apply →
  </a>
</div>`;
}

export async function sendScoutDigest(userEmail, userName, jobs, runStats) {
  if (!RESEND_KEY) {
    console.warn('[Scout] Resend key not set — email skipped');
    return;
  }
  if (!jobs?.length) return;

  const perfect  = jobs.filter(j => j.category === 'perfect').length;
  const good     = jobs.filter(j => j.category === 'good').length;
  const consider = jobs.filter(j => j.category === 'consider').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#111827;border-radius:12px 12px 0 0;padding:20px 24px;">
    <div style="font-size:20px;font-weight:700;color:#fff;">🎯 Job Scout</div>
    <div style="color:#9ca3af;font-size:13px;margin-top:2px;">Hi ${userName || 'there'} — your Winnipeg matches (last 24h)</div>
  </div>

  <!-- Stats bar -->
  <div style="background:#1f2937;padding:12px 24px;display:flex;gap:0;">
    <div style="flex:1;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#34d399;">${perfect}</div>
      <div style="font-size:11px;color:#6b7280;">Perfect 90%+</div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#60a5fa;">${good}</div>
      <div style="font-size:11px;color:#6b7280;">Good 80–89%</div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#fbbf24;">${consider}</div>
      <div style="font-size:11px;color:#6b7280;">Consider 75–79%</div>
    </div>
  </div>

  <!-- Job cards -->
  <div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;">
    ${jobs.slice(0, 10).map(jobCard).join('')}
  </div>

  <!-- CTA -->
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px;text-align:center;">
    <a href="${FRONTEND_URL}/job-scout"
       style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
      Open Job Scout →
    </a>
    <div style="color:#9ca3af;font-size:11px;margin-top:12px;">
      Sources: ${(runStats?.sourcesUsed || []).join(', ')} · Next scan in ~24h
    </div>
  </div>

</div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [userEmail],
      subject: `🎯 ${jobs.length} job match${jobs.length !== 1 ? 'es' : ''} — ${perfect} perfect fit${perfect !== 1 ? 's' : ''}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }

  console.log(`[Scout] ✅ Email sent → ${userEmail} (${jobs.length} jobs)`);
}

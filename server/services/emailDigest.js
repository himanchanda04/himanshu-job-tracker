import nodemailer from 'nodemailer';

const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASSWORD;
const FRONTEND_URL   = process.env.FRONTEND_URL || 'https://your-app.vercel.app';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

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
  if (score >= 60) return '#d97706';
  return '#9ca3af';
}

const CATEGORY_LABELS = {
  marketing:      'Marketing',
  data_analytics: 'Data / Analytics',
  analytics:      'Analytics',
  digital:        'Digital',
  finance:        'Finance',
  admin:          'Admin',
  hr:             'HR',
  engineering:    'Engineering',
  sales:          'Sales',
  trades:         'Trades',
  other:          'Other',
};

function nocBadge(job) {
  if (!job.noc_code) return '';
  const tierLabel = job.pr_eligible
    ? `<span style="color:#059669;">✅ PR Eligible</span>`
    : `<span style="color:#9ca3af;">PR n/a</span>`;
  return `
    <div style="margin-top:6px;font-size:11px;color:#6b7280;">
      NOC ${job.noc_code}${job.noc_teer != null ? ` · TEER ${job.noc_teer}` : ''} · ${tierLabel}
    </div>`;
}

function jobCard(job) {
  const color    = scoreColor(job.score);
  const scoreStr = job.scoring_mode === 'keyword' ? '~' : `${job.score}%`;
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
      ${nocBadge(job)}
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

/**
 * sendScoutDigest — sends ONE email with two sections:
 *   1. "Top 10 Matches" — primary jobs (core NOC, score >= 60)
 *   2. "Also Worth a Look" — secondary jobs (broad category 40-59% +
 *      11th-20th overflow from the primary pool)
 *
 * @param {string} userEmail
 * @param {string} userName
 * @param {object} digest - { primary: Job[], secondary: Job[] }
 * @param {object} runStats - { sourcesUsed: string[] }
 */
export async function sendScoutDigest(userEmail, userName, digest, runStats) {
  if (!GMAIL_USER || !GMAIL_APP_PASS) {
    console.warn('[Scout] Gmail credentials not set — email skipped');
    return;
  }

  const { primary = [], secondary = [] } = digest;
  if (!primary.length && !secondary.length) return;

  const perfect  = primary.filter(j => j.score >= 90).length;
  const good     = primary.filter(j => j.score >= 80 && j.score < 90).length;
  const consider = primary.filter(j => j.score >= 60 && j.score < 80).length;

  const dateStr = new Date().toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const secondaryCategoryTags = [...new Set(secondary.map(j => CATEGORY_LABELS[j.category] || j.category))]
    .slice(0, 4).join(', ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#111827;border-radius:12px 12px 0 0;padding:20px 24px;">
    <div style="font-size:20px;font-weight:700;color:#fff;">☀️ Job Scout — ${dateStr}</div>
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
      <div style="font-size:11px;color:#6b7280;">Consider 60–79%</div>
    </div>
  </div>

  <!-- SECTION 1 — Top 10 Matches -->
  ${primary.length ? `
  <div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;">
    <div style="font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
      🎯 Top ${primary.length} Matches — Marketing / Business Dev (NOC 11202 / 10022)
    </div>
    ${primary.map(jobCard).join('')}
  </div>` : `
  <div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;text-align:center;color:#9ca3af;font-size:13px;">
    No strong core-role matches today.
  </div>`}

  <!-- SECTION 2 — Also Worth a Look -->
  ${secondary.length ? `
  <div style="background:#fffbeb;padding:16px;border:1px solid #e5e7eb;border-top:none;">
    <div style="font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
      🔎 Also Worth a Look — ${secondaryCategoryTags || 'Related Roles'}
    </div>
    <div style="font-size:12px;color:#92400e;margin-bottom:10px;">
      Broader matches (40–59%) and near-misses from your core search — worth a glance, not a priority.
    </div>
    ${secondary.map(jobCard).join('')}
  </div>` : ''}

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

  const totalCount = primary.length + secondary.length;
  const subject = `☀️ ${primary.length} top match${primary.length !== 1 ? 'es' : ''} + ${secondary.length} worth a look — ${dateStr}`;

  try {
    await transporter.sendMail({
      from:    `"Job Scout" <${GMAIL_USER}>`,
      to:      userEmail,
      subject,
      html,
    });
  } catch (err) {
    throw new Error(`Gmail send error: ${err.message}`);
  }

  console.log(`[Scout] ✅ Email sent → ${userEmail} (${totalCount} jobs: ${primary.length} primary, ${secondary.length} secondary)`);
}

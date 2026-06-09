import Anthropic from '@anthropic-ai/sdk';
import { checkClaudeBudget, recordClaudeCost } from './claudeBudgetGuard.js';
import { extractKeywordsFromResume, keywordPreFilter } from './qualityFilter.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 6;

function getCategory(score) {
  if (score >= 90) return 'perfect';
  if (score >= 80) return 'good';
  if (score >= 75) return 'consider';
  return 'below_threshold';
}

// ─── Keyword-only scoring (no API cost) ──────────────────────────────────────
function scoreByKeyword(job, keywords) {
  const { matchCount, matchedKeywords } = keywordPreFilter(job, keywords);
  const score = Math.min(74, 40 + matchCount * 4);
  return {
    score,
    category:         getCategory(score),
    matched_keywords: matchedKeywords,
    missing_keywords: [],
    scoring_mode:     'keyword',
  };
}

// ─── AI batch scoring ─────────────────────────────────────────────────────────
async function scoreAiBatch(batch, resumeText, targetTitle, industry, userId, runId) {
  const summaries = batch.map((job, i) =>
    `JOB ${i + 1}\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${(job.description || '').slice(0, 350)}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert ATS and job-matching engine for Canada. Score each job strictly against this candidate.

CANDIDATE
Target role: ${targetTitle || 'Marketing / Digital Marketing'}
Industry: ${industry || 'Marketing'}
Resume (first 700 chars): ${(resumeText || '').slice(0, 700)}

JOBS
${summaries}

Rules:
- Be realistic and strict. Only award 90+ if it is a genuine strong match.
- matched_keywords: up to 8 specific skills/tools actually present in both resume and job.
- missing_keywords: up to 5 hard requirements the candidate clearly lacks.

Return ONLY a valid JSON array — no preamble, no markdown fences.
[{"job_index":1,"score":82,"matched_keywords":["GA4","SEO"],"missing_keywords":["Salesforce"]}]`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages:   [{ role: 'user', content: prompt }],
  });

  const cost = await recordClaudeCost(
    userId,
    response.usage.input_tokens,
    response.usage.output_tokens,
    runId
  );

  const raw    = (response.content[0]?.text || '[]').replace(/```json|```/g, '').trim();
  const scores = JSON.parse(raw);

  return { scores, cost };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function scoreJobs(jobs, resumeText, targetTitle, industry, userId, runId) {
  const keywords        = extractKeywordsFromResume(resumeText, targetTitle, industry);
  const budget          = await checkClaudeBudget(userId);
  const scoredJobs      = [];
  let   totalClaudeCost = 0;
  let   mode            = budget.mode; // 'ai' or 'keyword'

  if (mode === 'keyword') {
    console.log('[Scout] Claude budget cap — keyword scoring for all jobs');
    return {
      scoredJobs: jobs.map(j => ({ ...j, ...scoreByKeyword(j, keywords) })),
      totalClaudeCost: 0,
      mode,
    };
  }

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    // Re-check budget before every batch (it may have been crossed mid-run)
    const current = await checkClaudeBudget(userId);
    if (!current.allowed) {
      console.log('[Scout] Claude cap hit mid-run — keyword fallback for remainder');
      mode = 'keyword';
      batch.forEach(j => scoredJobs.push({ ...j, ...scoreByKeyword(j, keywords) }));
      continue;
    }

    try {
      const { scores, cost } = await scoreAiBatch(batch, resumeText, targetTitle, industry, userId, runId);
      totalClaudeCost += cost;

      batch.forEach((job, idx) => {
        const s = scores.find(r => r.job_index === idx + 1);
        if (s) {
          scoredJobs.push({
            ...job,
            score:            s.score,
            category:         getCategory(s.score),
            matched_keywords: s.matched_keywords || [],
            missing_keywords: s.missing_keywords || [],
            scoring_mode:     'ai',
          });
        } else {
          scoredJobs.push({ ...job, ...scoreByKeyword(job, keywords) });
        }
      });
    } catch (err) {
      console.error(`[Scout] Haiku batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${err.message}`);
      batch.forEach(j => scoredJobs.push({ ...j, ...scoreByKeyword(j, keywords) }));
    }
  }

  return { scoredJobs, totalClaudeCost, mode };
}

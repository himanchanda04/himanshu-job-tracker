import Anthropic from '@anthropic-ai/sdk';
import { checkClaudeBudget, recordClaudeCost } from './claudeBudgetGuard.js';
import { extractKeywordsFromResume, keywordPreFilter } from './qualityFilter.js';
import { lookupNoc, getPrTier, classifyByKeyword } from './nocMapper.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 6;

function getMatchTier(score) {
  if (score >= 90) return 'perfect';
  if (score >= 80) return 'good';
  if (score >= 75) return 'consider';
  return 'below_threshold';
}

/**
 * Attach NOC/TEER/PR-eligibility/category fields derived from a noc_code.
 * Falls back to keyword-based category classification if Haiku didn't
 * return a usable NOC code (e.g. keyword-only scoring mode).
 */
function attachNocFields(job, nocCode, score, category, titleMatch) {
  const nocEntry = lookupNoc(nocCode);
  const { pr_eligible, pr_tier } = getPrTier(nocCode, score);

  return {
    noc_code:    nocCode || null,
    noc_teer:    nocEntry ? nocEntry.teer : null,
    pr_eligible,
    pr_tier,
    category:    category && category !== 'other' ? category : classifyByKeyword(job),
    title_match: titleMatch || 'unknown',
  };
}

// ─── Keyword-only scoring (no API cost) ──────────────────────────────────────
// No NOC/TEER assignment possible without AI — flagged as not PR-confirmed,
// still shown in the app, but never makes either email since pr_eligible
// defaults to false and title_match is 'unknown'.
function scoreByKeyword(job, keywords) {
  const { matchCount, matchedKeywords } = keywordPreFilter(job, keywords);
  const score = Math.min(74, 40 + matchCount * 4);
  return {
    score,
    match_tier:       getMatchTier(score),
    matched_keywords: matchedKeywords,
    missing_keywords: [],
    scoring_mode:     'keyword',
    ...attachNocFields(job, null, score, null, 'unknown'),
  };
}

// ─── AI batch scoring ─────────────────────────────────────────────────────────
async function scoreAiBatch(batch, resumeText, targetTitle, industry, userId, runId) {
  const summaries = batch.map((job, i) =>
    `JOB ${i + 1}\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${(job.description || '').slice(0, 350)}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert ATS, job-matching, and Canadian NOC classification engine. Score each job strictly against this candidate AND classify it for Canadian immigration purposes.

CANDIDATE
Target role: ${targetTitle || 'Marketing / Digital Marketing'}
Industry: ${industry || 'Marketing'}
Resume (first 700 chars): ${(resumeText || '').slice(0, 700)}

JOBS
${summaries}

For each job, return ALL of the following fields:
- score: 0-100 match strength against the candidate's resume.
  EXPERIENCE LEVEL RULE: The candidate wants entry-level/junior roles, not management roles.
  - Jobs asking for internship, 0-1 years, or 1-3 years of experience should score in the 80-100 range IF the required skills reasonably align (see skill list below), even if the candidate does not have an exact skills match for every requirement.
  - Jobs requiring 5+ years of experience, or titled '''Manager''', '''Director''', '''Senior''', or '''Head of''' should score low (below 50) regardless of skill overlap, since the candidate is not targeting management-level roles.
  - Relevant skills to weigh positively: SQL, Python (as an asset/nice-to-have is fine, not required), MS Excel, Google Data Analytics, GA4, Google Ads, marketing strategy, graphic design, Canva.
- matched_keywords: up to 8 specific skills/tools actually present in both resume and job.
- missing_keywords: up to 5 hard requirements the candidate clearly lacks.
- noc_code: the single best-matching Canada NOC 2021 5-digit code for this job's actual title and duties (e.g. "11202" for marketing/business development professional, "10022" for marketing manager, "11101" for financial/data analyst, "21222" for data analyst/information systems specialist, "13100" for administrative officer). If you cannot confidently determine a NOC code, return null.
- category: one of "marketing", "analytics", "digital", "finance", "admin", "hr", "engineering", "sales", "trades", "other" — pick the single best fit based on the actual job duties described.
- title_match: "exact" if the job title accurately reflects the duties described, "close" if there's a minor mismatch (e.g. duties are more junior/senior than the title suggests), "mismatch" if the title is clearly misleading relative to the actual duties (e.g. titled "Marketing Manager" but duties are data entry, or vague/scammy duties with no real specifics).

Be strict on title_match — if the description is vague, generic, or doesn't clearly support the stated title, mark it "mismatch" rather than guessing favorably.

Return ONLY a valid JSON array — no preamble, no markdown fences.
[{"job_index":1,"score":82,"matched_keywords":["GA4","SEO"],"missing_keywords":["Salesforce"],"noc_code":"11202","category":"marketing","title_match":"exact"}]`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1200,
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
            match_tier:       getMatchTier(s.score),
            matched_keywords: s.matched_keywords || [],
            missing_keywords: s.missing_keywords || [],
            scoring_mode:     'ai',
            ...attachNocFields(job, s.noc_code, s.score, s.category, s.title_match),
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

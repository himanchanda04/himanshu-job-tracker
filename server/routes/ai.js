import { Router }    from 'express';
import Anthropic      from '@anthropic-ai/sdk';

const router = Router();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const RECRUITER_SYSTEM = `You are a senior technical recruiter and hiring manager with 15+ years of experience at top companies (Google, Amazon, Microsoft, top startups). You have reviewed tens of thousands of resumes and have deep expertise in ATS systems, keyword optimization, and what makes hiring managers immediately shortlist a candidate. You are direct, precise, and output only what is asked — no preamble, no commentary.`;

function sseStream(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  return {
    send: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
    done: ()     => { res.write('data: [DONE]\n\n'); res.end(); },
    error:(msg)  => { res.write(`data: ${JSON.stringify({ error: msg })}\n\n`); res.end(); },
  };
}

// POST /api/ai/resume
router.post('/resume', async (req, res) => {
  const { resume, jobDescription } = req.body || {};
  if (!resume?.trim() || !jobDescription?.trim()) {
    return res.status(400).json({ error: 'Both resume and jobDescription are required.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  const sse = sseStream(res);

  try {
    const stream = getClient().messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Rewrite and optimize the candidate's resume for the job description below.

Your goals:
1. Maximize ATS keyword match — extract every key skill, tool, and requirement from the JD and weave them naturally into the resume.
2. Reorder sections and bullet points so the most relevant experience appears first.
3. Replace weak verbs with strong action verbs. Quantify every achievement possible (add realistic estimates where numbers are missing but plausible).
4. Remove anything irrelevant to this role.
5. Keep formatting ATS-safe: plain text, no tables, no columns, no graphics. Use standard section headers (Summary, Experience, Education, Skills, etc.).
6. Add a tight 3-sentence professional summary at the top tailored to this specific role.

Output ONLY the complete optimized resume — no explanations, no commentary, no markdown code fences.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── CURRENT RESUME ─────────────────────────────────────────────
${resume.trim()}`,
      }],
    });

    stream.on('text',   (text) => sse.send(text));
    stream.on('end',    ()     => sse.done());
    stream.on('error',  (err)  => sse.error(err.message));
  } catch (err) {
    sse.error(err.message);
  }
});

// POST /api/ai/cover-letter
router.post('/cover-letter', async (req, res) => {
  const { resume, jobDescription } = req.body || {};
  if (!resume?.trim() || !jobDescription?.trim()) {
    return res.status(400).json({ error: 'Both resume and jobDescription are required.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  const sse = sseStream(res);

  try {
    const stream = getClient().messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Write a compelling, ATS-friendly cover letter for this candidate.

Requirements:
1. Opening line must be specific and strong — never start with "I am writing to apply for…" or "I am excited to apply…"
2. Paragraph 1 (2-3 sentences): Who the candidate is and why they are the right fit — reference a specific achievement from the resume that directly maps to the JD.
3. Paragraph 2 (3-4 sentences): 2-3 concrete examples of relevant skills or accomplishments that address the top requirements in the JD.
4. Paragraph 3 (2 sentences): Genuine interest in this specific company/role + confident call to action.
5. Total length: under 300 words. Formal but human tone. No filler phrases.
6. Include placeholder [Hiring Manager Name] and [Company Name] where appropriate.

Output ONLY the cover letter — no explanations, no commentary, no markdown code fences.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── RESUME ─────────────────────────────────────────────────────
${resume.trim()}`,
      }],
    });

    stream.on('text',   (text) => sse.send(text));
    stream.on('end',    ()     => sse.done());
    stream.on('error',  (err)  => sse.error(err.message));
  } catch (err) {
    sse.error(err.message);
  }
});

export default router;

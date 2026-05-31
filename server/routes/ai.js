import { Router }    from 'express';
import Anthropic      from '@anthropic-ai/sdk';
import multer         from 'multer';
import pdfParse       from 'pdf-parse/lib/pdf-parse.js';
import mammoth        from 'mammoth';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/ai/parse  — extract text from uploaded PDF or DOCX
router.post('/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const { mimetype, buffer, originalname } = req.file;
  try {
    let text = '';
    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString('utf8');
    }
    res.json({ text: text.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const RECRUITER_SYSTEM = `You are a senior Canadian recruiter and ATS specialist with 15+ years of experience hiring at top companies including RBC, TD Bank, Shopify, Bell, Rogers, City of Winnipeg, Government of Canada, and Fortune 500 firms operating in Canada. You have reviewed over 50,000 resumes and know exactly what passes Workday, Taleo, iCIMS, and Greenhouse ATS systems used by Canadian employers. You produce only what is asked — no preamble, no meta-commentary, no markdown fences.`;

const CANADA_RESUME_RULES = `
CANADA ATS RESUME RULES — FOLLOW ALL OF THESE WITHOUT EXCEPTION:

FORMATTING (ATS-critical):
- Single column layout only. No tables, no text boxes, no columns, no headers/footers.
- Section headers in ALL CAPS on their own line: PROFESSIONAL SUMMARY, CORE COMPETENCIES, PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS
- Each bullet starts with a strong action verb. One line per bullet ideally (max 2 lines).
- Consistent date format: Month YYYY – Month YYYY (e.g. September 2022 – Present)
- No photos, no DOB, no gender, no SIN, no marital status (illegal to request in Canada).
- No graphics, no icons, no colour formatting — plain text only.
- Spacing: one blank line between sections, no extra blank lines within sections.
- Phone: Canadian format (204-xxx-xxxx or +1-204-xxx-xxxx). City, Province only (no full address).

CONTENT (interview-call quality):
- Professional summary: 3 sentences. Sentence 1 = who you are + years of experience. Sentence 2 = 2-3 top skills that match the JD. Sentence 3 = what you deliver for employers.
- Bullets: every bullet must have a metric or outcome. If no number exists, add a realistic qualifier (e.g. "streamlined process reducing manual effort by ~40%").
- Mirror exact keywords from the JD — ATS scores keyword matches. Do not paraphrase keywords.
- Skills section: list tools/technologies/certifications as comma-separated values, grouped by category.
- Remove any role or experience that is completely irrelevant to this job.
- Canadian spelling: "programme", "colour", "analyse", "organization" — match standard Canadian English.
`;

function sseStream(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  return {
    send:  (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
    done:  ()     => { res.write('data: [DONE]\n\n'); res.end(); },
    error: (msg)  => { res.write(`data: ${JSON.stringify({ error: msg })}\n\n`); res.end(); },
  };
}

// POST /api/ai/resume
router.post('/resume', authenticate, async (req, res) => {
  const { resume, jobDescription } = req.body || {};
  if (!resume?.trim() || !jobDescription?.trim())
    return res.status(400).json({ error: 'Both resume and jobDescription are required.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });

  const sse = sseStream(res);
  try {
    const stream = getClient().messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Rewrite and fully optimize this resume for the job description below. This resume must be good enough to get the candidate an interview call at a Canadian company.

${CANADA_RESUME_RULES}

Output ONLY the complete optimized resume text. No explanations. No commentary. No markdown code fences. No placeholders.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── CURRENT RESUME ─────────────────────────────────────────────
${resume.trim()}`,
      }],
    });
    stream.on('text',  (text) => sse.send(text));
    stream.on('end',   ()     => sse.done());
    stream.on('error', (err)  => sse.error(err.message));
  } catch (err) { sse.error(err.message); }
});

// POST /api/ai/cover-letter
router.post('/cover-letter', authenticate, async (req, res) => {
  const { resume, jobDescription } = req.body || {};
  if (!resume?.trim() || !jobDescription?.trim())
    return res.status(400).json({ error: 'Both resume and jobDescription are required.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });

  const sse = sseStream(res);
  try {
    const stream = getClient().messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Write a compelling, professional cover letter for a Canadian job application. Extract the hiring manager name and company name directly from the job description — never use placeholders like [Company Name] or [Hiring Manager].

RULES:
1. Extract company name and job title from the JD and use them explicitly in the letter.
2. If no hiring manager name is found, address it to "Hiring Manager" — not a placeholder.
3. Opening line: specific and confident — never "I am writing to apply" or "I am excited to apply".
4. Paragraph 1 (2-3 sentences): Who the candidate is + one standout achievement from their resume that maps directly to the JD.
5. Paragraph 2 (3-4 sentences): 2-3 concrete skills or results that address the top requirements in the JD.
6. Paragraph 3 (2 sentences): Genuine interest in this role/company + confident call to action.
7. Closing: "Sincerely," then the candidate's name (extracted from resume).
8. Total: under 300 words. Formal Canadian professional tone. No filler phrases. No hollow enthusiasm.
9. Do NOT use any square brackets anywhere in the letter. Every field must be filled from the resume and JD.

Output ONLY the cover letter. No explanations. No commentary. No markdown fences.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── RESUME ─────────────────────────────────────────────────────
${resume.trim()}`,
      }],
    });
    stream.on('text',  (text) => sse.send(text));
    stream.on('end',   ()     => sse.done());
    stream.on('error', (err)  => sse.error(err.message));
  } catch (err) { sse.error(err.message); }
});

// POST /api/ai/scrape-jd  — fetch a job posting URL and extract the JD text
router.post('/scrape-jd', authenticate, async (req, res) => {
  const { url } = req.body || {};
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol))
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured.' });

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const pageRes = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeout);
    if (!pageRes.ok)
      return res.status(400).json({ error: `Could not load page (HTTP ${pageRes.status}). This site may require login or block automated access — try copying the text manually.` });

    const html = await pageRes.text();
    const client = getClient();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the job description from this HTML page. Return ONLY the job posting content: job title, company name, location, salary (if shown), responsibilities, requirements, and qualifications. No HTML tags, no navigation, no headers, no footers, no ads. Plain text only.\n\nIf this page does not contain a job posting, reply with exactly: NONE\n\nHTML:\n${html.slice(0, 80000)}`,
      }],
    });
    const text = msg.content[0].text.trim();
    if (text === 'NONE')
      return res.status(400).json({ error: 'No job description found on this page. The site may require login or this URL shows a list of jobs. Try copying the text manually.' });

    res.json({ text });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError')
      return res.status(408).json({ error: 'Request timed out — the site took too long to respond.' });
    res.status(500).json({ error: 'Failed to fetch URL: ' + err.message });
  }
});

// POST /api/ai/job-match — score + tailored resume + cover letter in one call
// Cost-optimised: score check first, full generation only if user confirms
router.post('/job-match', authenticate, async (req, res) => {
  const { jobDescription, generateFull } = req.body || {};
  if (!jobDescription?.trim())
    return res.status(400).json({ error: 'jobDescription is required.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured.' });

  // Pull original_resume from DB
  const pool = (await import('../db/database.js')).default;
  const result = await pool.query('SELECT original_resume FROM users WHERE id = $1', [req.user.id]);
  const originalResume = result.rows[0]?.original_resume?.trim();

  if (!originalResume)
    return res.status(400).json({ error: 'No base resume found. Please upload your resume in Settings → My Resume first.' });

  const sse = sseStream(res);

  try {
    const client = getClient();

    // ── Step 1: Score (cheap — Haiku) ──────────────────────────────────────
    const scoreMsg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:     'You are a precise ATS matching engine. Respond ONLY with valid JSON. No prose.',
      messages: [{
        role: 'user',
        content: `Analyse how well this resume matches the job description. Return ONLY this JSON — nothing else:

{
  "score": <integer 0-100>,
  "category": "<one of: not_for_you | consider | good_for_you | perfect>",
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword1", "keyword2"],
  "top_strength": "<one sentence>",
  "top_gap": "<one sentence>"
}

Category rules:
- score < 60  → "not_for_you"
- score 60-74 → "consider"
- score 75-79 → "good_for_you"
- score >= 80  → "perfect"

─── JOB DESCRIPTION ───
${jobDescription.trim().slice(0, 6000)}

─── RESUME ─────────────
${originalResume.slice(0, 4000)}`,
      }],
    });

    let scoreData;
    try {
      const raw = scoreMsg.content[0].text.trim();
      scoreData = JSON.parse(raw);
    } catch {
      return sse.error('Score parsing failed — please try again.');
    }

    // Send score immediately so UI can render it
    sse.send(JSON.stringify({ type: 'score', data: scoreData }));

    // ── Step 2: Full generation (Sonnet) only if requested ─────────────────
    if (!generateFull) {
      return sse.done();
    }

    // Resume stream
    sse.send(JSON.stringify({ type: 'status', text: 'Generating resume…' }));
    const resumeStream = client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Rewrite and fully optimize this resume for the job description below. This resume must be good enough to get the candidate an interview call at a Canadian company.

${CANADA_RESUME_RULES}

Output ONLY the complete optimized resume text. No explanations. No commentary. No markdown code fences. No placeholders.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── CURRENT RESUME ─────────────────────────────────────────────
${originalResume}`,
      }],
    });

    let resumeText = '';
    for await (const event of resumeStream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        resumeText += event.delta.text;
        sse.send(JSON.stringify({ type: 'resume_chunk', text: event.delta.text }));
      }
    }
    sse.send(JSON.stringify({ type: 'resume_done' }));

    // Cover letter stream
    sse.send(JSON.stringify({ type: 'status', text: 'Generating cover letter…' }));
    const clStream = client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Write a compelling, professional cover letter for a Canadian job application. Extract the hiring manager name and company name directly from the job description — never use placeholders like [Company Name] or [Hiring Manager].

RULES:
1. Extract company name and job title from the JD and use them explicitly in the letter.
2. If no hiring manager name is found, address it to "Hiring Manager" — not a placeholder.
3. Opening line: specific and confident — never "I am writing to apply" or "I am excited to apply".
4. Paragraph 1 (2-3 sentences): Who the candidate is + one standout achievement that maps directly to the JD.
5. Paragraph 2 (3-4 sentences): 2-3 concrete skills or results addressing the top JD requirements.
6. Paragraph 3 (2 sentences): Genuine interest + confident call to action.
7. Closing: "Sincerely," then the candidate's name (from resume).
8. Under 300 words. Formal Canadian professional tone. No hollow phrases.
9. Do NOT use square brackets anywhere. Every field filled from resume and JD.

Output ONLY the cover letter. No explanations. No markdown fences.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── RESUME ─────────────────────────────────────────────────────
${originalResume}`,
      }],
    });

    for await (const event of clStream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        sse.send(JSON.stringify({ type: 'cl_chunk', text: event.delta.text }));
      }
    }
    sse.send(JSON.stringify({ type: 'cl_done' }));
    sse.done();

  } catch (err) { sse.error(err.message); }
});

// POST /api/ai/interview-prep
router.post('/interview-prep', authenticate, async (req, res) => {
  const { resume, jobDescription } = req.body || {};
  if (!resume?.trim() || !jobDescription?.trim())
    return res.status(400).json({ error: 'Both resume and jobDescription are required.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });

  const sse = sseStream(res);
  try {
    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Create a focused interview preparation guide for this candidate applying to this role.

## BEHAVIORAL QUESTIONS (5 questions)
For each: write the question, then "Talking Point:" — a 2-3 sentence STAR-method answer using real details from the candidate's resume.

## TECHNICAL / ROLE-SPECIFIC QUESTIONS (5 questions)
For each: write the question, then "Key Points:" — the 2-3 most important things to cover, grounded in the JD requirements.

## QUESTIONS TO ASK THE INTERVIEWER (3 questions)
Smart, specific questions that show genuine research into this role and company.

Be specific — reference actual details from the resume and job description. No generic advice.
Output ONLY the guide — no preamble, no commentary.

─── JOB DESCRIPTION ───────────────────────────────────────────
${jobDescription.trim()}

─── RESUME ─────────────────────────────────────────────────────
${resume.trim()}`,
      }],
    });
    stream.on('text',  (text) => sse.send(text));
    stream.on('end',   ()     => sse.done());
    stream.on('error', (err)  => sse.error(err.message));
  } catch (err) { sse.error(err.message); }
});

export default router;

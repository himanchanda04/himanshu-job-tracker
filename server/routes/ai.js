import { Router }    from 'express';
import Anthropic      from '@anthropic-ai/sdk';
import multer         from 'multer';
import pdfParse       from 'pdf-parse/lib/pdf-parse.js';
import mammoth        from 'mammoth';
import { authenticate } from '../middleware/auth.js';
import pool           from '../db/database.js';

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

const RECRUITER_SYSTEM = `You are a senior Canadian ATS recruiter. You produce only what is asked — no preamble, no commentary, no markdown fences.`;

const CANADA_RESUME_RULES = `
CANADA ATS RULES:
- Single column, plain text only. No tables, boxes, graphics, headers/footers.
- Section headers ALL CAPS: PROFESSIONAL SUMMARY, CORE COMPETENCIES, PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS
- Bullets start with action verb, include metric or outcome.
- Dates: Month YYYY – Month YYYY. City, Province only. No photos/DOB/SIN/gender.
- Summary: 3 sentences (who you are + experience | top skills matching JD | value delivered).
- Mirror exact JD keywords. Skills: comma-separated by category. Canadian spelling.
`;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sseStream(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  return {
    send:  (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
    typed: (obj)  => res.write(`data: ${JSON.stringify(obj)}\n\n`),
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
        content: `Rewrite this resume for the job below. Output ONLY the complete resume text.

${CANADA_RESUME_RULES}

JOB:
${jobDescription.trim()}

RESUME:
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
        content: `Write a professional Canadian cover letter. No placeholders — extract company, role, and candidate name directly from the inputs.

RULES: Confident opening (not "I am writing to apply"). Para 1: who candidate is + one achievement matching JD. Para 2: 2-3 skills/results for top JD requirements. Para 3: interest + call to action. Close: "Sincerely," + candidate name. Under 300 words. No square brackets anywhere.

Output ONLY the cover letter.

JOB:
${jobDescription.trim()}

RESUME:
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
    const pageText = stripHtml(html);
    const client = getClient();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the job description from this page. Return ONLY the job posting content: job title, company name, location, salary (if shown), responsibilities, requirements, and qualifications. Plain text only.\n\nIf this page does not contain a job posting, reply with exactly: NONE\n\nPAGE TEXT:\n${pageText.slice(0, 30000)}`,
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
  const result = await pool.query('SELECT original_resume FROM users WHERE id = $1', [req.user.id]);
  const originalResume = result.rows[0]?.original_resume?.trim();

  if (!originalResume)
    return res.status(400).json({ error: 'No base resume found. Please upload your resume in Settings → My Resume first.' });

  const sse = sseStream(res);
  sse.typed({ type: 'status', text: 'Analysing match…' });

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
    sse.typed({ type: 'score', data: scoreData });

    // ── Step 2: Full generation (Sonnet) only if requested ─────────────────
    if (!generateFull) {
      return sse.done();
    }

    // Resume stream
    sse.typed({ type: 'status', text: 'Generating resume…' });
    const resumeStream = client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Rewrite this resume for the job below. Output ONLY the complete resume text.

${CANADA_RESUME_RULES}

JOB:
${jobDescription.trim()}

RESUME:
${originalResume}`,
      }],
    });

    let resumeText = '';
    for await (const event of resumeStream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        resumeText += event.delta.text;
        sse.typed({ type: 'resume_chunk', text: event.delta.text });
      }
    }
    sse.typed({ type: 'resume_done' });

    // Cover letter stream
    sse.typed({ type: 'status', text: 'Generating cover letter…' });
    const clStream = client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     RECRUITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Write a professional Canadian cover letter. No placeholders — extract company, role, and candidate name directly from the inputs.

RULES: Confident opening (not "I am writing to apply"). Para 1: who candidate is + one achievement matching JD. Para 2: 2-3 skills/results for top JD requirements. Para 3: interest + call to action. Close: "Sincerely," + candidate name. Under 300 words. No square brackets anywhere.

Output ONLY the cover letter.

JOB:
${jobDescription.trim()}

RESUME:
${originalResume}`,
      }],
    });

    for await (const event of clStream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        sse.typed({ type: 'cl_chunk', text: event.delta.text });
      }
    }
    sse.typed({ type: 'cl_done' });
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
        content: `Create an interview prep guide. Output ONLY the guide — no preamble.

## BEHAVIORAL QUESTIONS (5)
Each: question + "Talking Point:" (2-3 sentence STAR answer using resume details).

## TECHNICAL QUESTIONS (5)
Each: question + "Key Points:" (2-3 things to cover from the JD).

## QUESTIONS TO ASK (3)
Specific, research-based questions about this role/company.

JOB:
${jobDescription.trim()}

RESUME:
${resume.trim()}`,
      }],
    });
    stream.on('text',  (text) => sse.send(text));
    stream.on('end',   ()     => sse.done());
    stream.on('error', (err)  => sse.error(err.message));
  } catch (err) { sse.error(err.message); }
});

export default router;

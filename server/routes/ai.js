import { Router }    from 'express';
import Anthropic      from '@anthropic-ai/sdk';
import multer         from 'multer';
import pdfParse       from 'pdf-parse/lib/pdf-parse.js';
import mammoth        from 'mammoth';

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

// POST /api/ai/scrape-jd  — fetch a job posting URL and extract the JD text
router.post('/scrape-jd', async (req, res) => {
  const { url } = req.body || {};
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
  }

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

    if (!pageRes.ok) {
      return res.status(400).json({ error: `Could not load page (HTTP ${pageRes.status}). This site may require login or block automated access — try copying the text manually.` });
    }

    const html = await pageRes.text();
    const client = getClient();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the job description from this HTML page. Return ONLY the job posting content: job title, company name, location, salary (if shown), responsibilities, requirements, and qualifications. No HTML tags, no navigation, no headers, no footers, no ads. Plain text only.\n\nIf this page does not contain a job posting (e.g. login wall, error page, or a list of jobs), reply with exactly: NONE\n\nHTML:\n${html.slice(0, 80000)}`,
      }],
    });

    const text = msg.content[0].text.trim();
    if (text === 'NONE') {
      return res.status(400).json({ error: 'No job description found on this page. The site may require login (LinkedIn blocks scraping) or this URL shows a list of jobs. Try copying the text manually.' });
    }

    res.json({ text });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timed out — the site took too long to respond.' });
    }
    res.status(500).json({ error: 'Failed to fetch URL: ' + err.message });
  }
});

// POST /api/ai/interview-prep
router.post('/interview-prep', async (req, res) => {
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
  } catch (err) {
    sse.error(err.message);
  }
});

export default router;

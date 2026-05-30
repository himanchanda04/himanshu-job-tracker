import { useState, useRef, useEffect } from 'react';
import {
  Briefcase, FileText, Mail, Sparkles, Copy, Check,
  RotateCcw, AlertCircle, Upload, Download, ChevronDown, ExternalLink,
} from 'lucide-react';
import { api } from '../api/applications';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const BASE = import.meta.env.VITE_API_URL || '';

const PORTALS = [
  { name: 'LinkedIn',    url: 'https://www.linkedin.com/jobs/' },
  { name: 'Indeed',      url: 'https://ca.indeed.com/' },
  { name: 'Glassdoor',   url: 'https://www.glassdoor.ca/Job/index.htm' },
  { name: 'Google Jobs', url: 'https://www.google.com/search?q=software+jobs+near+me&ibp=htl;jobs' },
  { name: 'Workopolis',  url: 'https://www.workopolis.com/' },
  { name: 'Monster',     url: 'https://www.monster.ca/' },
  { name: 'ZipRecruiter',url: 'https://www.ziprecruiter.com/' },
];

async function parseFile(file) {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/api/ai/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.text;
}

function UploadButton({ onText }) {
  const ref = useRef();
  const [parsing, setParsing] = useState(false);
  async function handle(e) {
    const file = e.target.files[0]; if (!file) return;
    setParsing(true);
    try { onText(await parseFile(file)); } catch (err) { alert(err.message); }
    finally { setParsing(false); e.target.value = ''; }
  }
  return (
    <>
      <input ref={ref} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handle} />
      <button onClick={() => ref.current.click()} disabled={parsing}
        className="flex items-center gap-1 text-xs text-teal hover:text-teal/80 disabled:opacity-50 transition-colors">
        <Upload size={12} />{parsing ? 'Parsing…' : 'Upload PDF/DOCX'}
      </button>
    </>
  );
}

function DownloadMenu({ text, filename }) {
  const [open, setOpen] = useState(false);

  function asPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const lines = doc.splitTextToSize(text, 530);
    let y = 40;
    for (const line of lines) {
      if (y > 760) { doc.addPage(); y = 40; }
      doc.setFontSize(10.5); doc.text(line, 40, y); y += 15;
    }
    doc.save(`${filename}.pdf`); setOpen(false);
  }

  async function asDocx() {
    const paragraphs = text.split('\n').map(line =>
      new Paragraph({ children: [new TextRun({ text: line, size: 22 })] })
    );
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = new Blob([await Packer.toBlob(doc)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${filename}.docx`; a.click(); URL.revokeObjectURL(a.href); setOpen(false);
  }

  function asTxt() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `${filename}.txt`; a.click(); URL.revokeObjectURL(a.href); setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors">
        <Download size={13} />Download<ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-card-hover z-20 min-w-[110px]">
          {[['PDF', asPdf], ['DOCX', asDocx], ['TXT', asTxt]].map(([label, fn]) => (
            <button key={label} onClick={fn}
              className="block w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg">
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 13, uploadable = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-navy uppercase tracking-wide">{label}</label>
        {uploadable && <UploadButton onText={onChange} />}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-slate-700
                   placeholder:text-muted resize-y focus:outline-none focus:ring-2 focus:ring-teal/40
                   focus:border-teal transition-colors font-mono leading-relaxed" />
    </div>
  );
}

function OutputCard({ title, output, loading, error, copied, onCopy, onReset, abortRef, filename }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {!loading ? (null) : (
          <button onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">
            Stop
          </button>
        )}
        {(output || error) && (
          <button onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-navy hover:border-navy transition-colors">
            <RotateCcw size={14} />Reset
          </button>
        )}
        {loading && <span className="text-sm text-muted animate-pulse">Writing with AI…</span>}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {(output || loading) && (
        <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Sparkles size={15} className="text-teal" />{title}
              {loading && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse rounded-sm ml-1" />}
            </h2>
            {output && !loading && (
              <div className="flex items-center gap-2">
                <button onClick={onCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                  {copied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <DownloadMenu text={output} filename={filename} />
              </div>
            )}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed bg-slate-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            {output || ' '}
          </pre>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { label: 'Job Description', icon: Briefcase },
  { label: 'Resume',          icon: FileText  },
  { label: 'Cover Letter',    icon: Mail      },
];

export default function AITools() {
  const [tab, setTab]       = useState(0);
  const [resume, setResume] = useState('');
  const [jd, setJd]         = useState('');

  // Resume tab
  const [resumeOut,     setResumeOut]     = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError,   setResumeError]   = useState('');
  const [resumeCopied,  setResumeCopied]  = useState(false);
  const resumeAbort = useRef(null);

  // Cover Letter tab
  const [clOut,     setClOut]     = useState('');
  const [clLoading, setClLoading] = useState(false);
  const [clError,   setClError]   = useState('');
  const [clCopied,  setClCopied]  = useState(false);
  const clAbort = useRef(null);

  useEffect(() => {
    api.get('/auth/me')
      .then(r => { if (r.data.user.last_resume) setResume(r.data.user.last_resume); })
      .catch(() => {});
    const saved = localStorage.getItem('last_jd');
    if (saved) setJd(saved);
  }, []);

  function saveJd(val) {
    setJd(val);
    localStorage.setItem('last_jd', val);
  }

  async function runStream(endpoint, setOut, setLoading, setError, abortRef) {
    setError(''); setOut(''); setLoading(true);
    api.patch('/auth/me', { last_resume: resume }).catch(() => {});
    localStorage.setItem('last_jd', jd);
    const token = localStorage.getItem('token');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resume, jobDescription: jd }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Error ${res.status}`); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const p = line.slice(6).trim(); if (p === '[DONE]') break;
          try {
            const { text, error: e } = JSON.parse(p);
            if (e) throw new Error(e);
            if (text) setOut(x => x + text);
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setLoading(false); abortRef.current = null; }
  }

  const canGenerate = resume.trim().length > 50 && jd.trim().length > 50;

  async function copyText(text, setCopied) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Sparkles size={22} className="text-teal" />AI Career Tools
        </h1>
        <p className="text-sm text-muted mt-1">
          Find jobs → paste description → optimize your resume and cover letter.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ label, icon: Icon }, i) => (
          <button key={label} onClick={() => setTab(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === i ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Job Description ─────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-navy">Open a Job Portal</h2>
              <p className="text-xs text-muted mt-0.5">Click a portal below, find a job, copy the description, then paste it in the box below.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PORTALS.map(({ name, url }) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-slate-50
                             text-xs font-medium text-slate-700 hover:border-teal hover:text-teal hover:bg-teal/5 transition-colors">
                  <ExternalLink size={12} />{name}
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card p-5">
            <Textarea
              label="Job Description"
              placeholder="Paste the job description here after copying from the portal…"
              value={jd}
              onChange={saveJd}
              rows={18}
              uploadable
            />
            {jd.trim().length > 50 && (
              <p className="text-xs text-teal mt-2">
                ✓ Job description saved — switch to Resume or Cover Letter tab to generate.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 1: Resume ──────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-card p-5">
              <Textarea
                label="Your Current Resume"
                placeholder="Paste your resume or upload PDF/DOCX…"
                value={resume}
                onChange={setResume}
                uploadable
              />
            </div>
            <div className="bg-white rounded-xl shadow-card p-5">
              <Textarea
                label="Job Description"
                placeholder="Add from Job Description tab, or paste directly…"
                value={jd}
                onChange={saveJd}
                uploadable
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!resumeLoading ? (
              <button
                onClick={() => runStream('/api/ai/resume', setResumeOut, setResumeLoading, setResumeError, resumeAbort)}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold
                           shadow-sm hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Sparkles size={16} />Optimize Resume
              </button>
            ) : (
              <button onClick={() => resumeAbort.current?.abort()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">
                Stop
              </button>
            )}
            {(resumeOut || resumeError) && (
              <button onClick={() => { resumeAbort.current?.abort(); setResumeOut(''); setResumeError(''); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                <RotateCcw size={14} />Reset
              </button>
            )}
            {resumeLoading && <span className="text-sm text-muted animate-pulse">Optimizing with AI…</span>}
          </div>

          {resumeError && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{resumeError}</p>
            </div>
          )}

          {(resumeOut || resumeLoading) && (
            <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                  <Sparkles size={15} className="text-teal" />Optimized Resume
                  {resumeLoading && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse rounded-sm ml-1" />}
                </h2>
                {resumeOut && !resumeLoading && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyText(resumeOut, setResumeCopied)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                      {resumeCopied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                      {resumeCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <DownloadMenu text={resumeOut} filename="optimized-resume" />
                  </div>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed bg-slate-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                {resumeOut || ' '}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Cover Letter ────────────────────────────────────────────── */}
      {tab === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-card p-5">
              <Textarea
                label="Your Resume"
                placeholder="Paste your resume or upload PDF/DOCX…"
                value={resume}
                onChange={setResume}
                uploadable
              />
            </div>
            <div className="bg-white rounded-xl shadow-card p-5">
              <Textarea
                label="Job Description"
                placeholder="Add from Job Description tab, or paste directly…"
                value={jd}
                onChange={saveJd}
                uploadable
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!clLoading ? (
              <button
                onClick={() => runStream('/api/ai/cover-letter', setClOut, setClLoading, setClError, clAbort)}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold
                           shadow-sm hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Sparkles size={16} />Generate Cover Letter
              </button>
            ) : (
              <button onClick={() => clAbort.current?.abort()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">
                Stop
              </button>
            )}
            {(clOut || clError) && (
              <button onClick={() => { clAbort.current?.abort(); setClOut(''); setClError(''); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                <RotateCcw size={14} />Reset
              </button>
            )}
            {clLoading && <span className="text-sm text-muted animate-pulse">Writing with AI…</span>}
          </div>

          {clError && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{clError}</p>
            </div>
          )}

          {(clOut || clLoading) && (
            <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                  <Sparkles size={15} className="text-teal" />Your Cover Letter
                  {clLoading && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse rounded-sm ml-1" />}
                </h2>
                {clOut && !clLoading && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyText(clOut, setClCopied)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                      {clCopied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                      {clCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <DownloadMenu text={clOut} filename="cover-letter" />
                  </div>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                {clOut || ' '}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { FileText, Sparkles, Copy, Check, RotateCcw, AlertCircle, Upload, Download, ChevronDown } from 'lucide-react';
import { api } from '../api/applications';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const BASE = import.meta.env.VITE_API_URL || '';

async function parseFile(file) {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/api/ai/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Parse failed');
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
    doc.save(`${filename}.pdf`);
    setOpen(false);
  }

  async function asDocx() {
    const paragraphs = text.split('\n').map(line =>
      new Paragraph({ children: [new TextRun({ text: line, size: 22 })] })
    );
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = new Blob([await Packer.toBlob(doc)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${filename}.docx`; a.click(); URL.revokeObjectURL(a.href);
    setOpen(false);
  }

  function asTxt() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `${filename}.txt`; a.click(); URL.revokeObjectURL(a.href);
    setOpen(false);
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

function Textarea({ label, value, onChange, placeholder, rows = 14 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-navy uppercase tracking-wide">{label}</label>
        <UploadButton onText={onChange} />
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-slate-700
                   placeholder:text-muted resize-y focus:outline-none focus:ring-2 focus:ring-teal/40
                   focus:border-teal transition-colors font-mono leading-relaxed" />
    </div>
  );
}

export default function Resume() {
  const [resume, setResume]   = useState('');
  const [jd, setJd]           = useState('');
  const [output, setOutput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');
  const abortRef              = useRef(null);

  useEffect(() => {
    api.get('/auth/me').then(r => { if (r.data.user.last_resume) setResume(r.data.user.last_resume); }).catch(() => {});
  }, []);

  const canGenerate = resume.trim().length > 50 && jd.trim().length > 50 && !loading;

  async function generate() {
    setError(''); setOutput(''); setLoading(true);
    api.patch('/auth/me', { last_resume: resume }).catch(() => {});
    const token = localStorage.getItem('token');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetch(`${BASE}/api/ai/resume`, {
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
          try { const { text, error: e } = JSON.parse(p); if (e) throw new Error(e); if (text) setOutput(x => x + text); } catch { /* skip */ }
        }
      }
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setLoading(false); abortRef.current = null; }
  }

  async function copy() { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function reset() { abortRef.current?.abort(); setOutput(''); setError(''); setLoading(false); }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2"><FileText size={22} className="text-teal" />Resume Optimizer</h1>
        <p className="text-sm text-muted mt-1">Upload or paste your resume + job description. Your resume is auto-saved.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-card p-5">
          <Textarea label="Your Current Resume" placeholder="Paste your resume or upload PDF/DOCX…" value={resume} onChange={setResume} />
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <Textarea label="Job Description" placeholder="Paste the job description or upload…" value={jd} onChange={setJd} />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!loading ? (
          <button onClick={generate} disabled={!canGenerate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold
                       shadow-sm hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            <Sparkles size={16} />Optimize Resume
          </button>
        ) : (
          <button onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">
            Stop
          </button>
        )}
        {(output || error) && <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-navy hover:border-navy transition-colors"><RotateCcw size={14} />Reset</button>}
        {loading && <span className="text-sm text-muted animate-pulse">Optimizing with AI…</span>}
      </div>

      {error && <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3"><AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" /><p className="text-sm text-rose-700">{error}</p></div>}

      {(output || loading) && (
        <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Sparkles size={15} className="text-teal" />Optimized Resume
              {loading && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse rounded-sm ml-1" />}
            </h2>
            {output && !loading && (
              <div className="flex items-center gap-2">
                <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors">
                  {copied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}{copied ? 'Copied!' : 'Copy'}
                </button>
                <DownloadMenu text={output} filename="optimized-resume" />
              </div>
            )}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed bg-slate-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">{output || ' '}</pre>
        </div>
      )}
    </div>
  );
}

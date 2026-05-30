import { useState, useRef } from 'react';
import { FileText, Sparkles, Copy, Check, RotateCcw, AlertCircle } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '';

function Textarea({ label, placeholder, value, onChange, rows = 10 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-navy uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm
                   text-slate-700 placeholder:text-muted resize-y
                   focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal
                   transition-colors font-mono leading-relaxed"
      />
    </div>
  );
}

export default function Resume() {
  const [resume, setResume]     = useState('');
  const [jd, setJd]             = useState('');
  const [output, setOutput]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const abortRef                = useRef(null);

  const canGenerate = resume.trim().length > 50 && jd.trim().length > 50 && !loading;

  async function generate() {
    setError('');
    setOutput('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${BASE}/api/ai/resume`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body:   JSON.stringify({ resume, jobDescription: jd }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const { text, error: err } = JSON.parse(payload);
            if (err) throw new Error(err);
            if (text) setOutput((prev) => prev + text);
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    abortRef.current?.abort();
    setOutput('');
    setError('');
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <FileText size={22} className="text-teal" />
          Resume Optimizer
        </h1>
        <p className="text-sm text-muted mt-1">
          Paste your resume and the job description — get an ATS-optimized resume tailored to that role.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-card p-5">
          <Textarea
            label="Your Current Resume"
            placeholder="Paste your full resume here…"
            value={resume}
            onChange={setResume}
            rows={14}
          />
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <Textarea
            label="Job Description"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={setJd}
            rows={14}
          />
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-3">
        {!loading ? (
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal text-white
                       text-sm font-semibold shadow-sm hover:bg-teal/90
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles size={16} />
            Optimize Resume
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white
                       text-sm font-semibold shadow-sm hover:bg-rose-600 transition-all"
          >
            Stop
          </button>
        )}
        {(output || error) && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
                       text-sm font-medium text-muted hover:text-navy hover:border-navy transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}
        {loading && (
          <span className="text-sm text-muted animate-pulse">Optimizing with AI…</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Output */}
      {(output || loading) && (
        <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Sparkles size={15} className="text-teal" />
              Optimized Resume
              {loading && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse rounded-sm ml-1" />}
            </h2>
            {output && !loading && (
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                           text-xs font-medium text-muted hover:text-navy hover:border-navy transition-colors"
              >
                {copied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed
                          bg-slate-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            {output || ' '}
          </pre>
        </div>
      )}
    </div>
  );
}

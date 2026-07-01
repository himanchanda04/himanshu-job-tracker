import { useState, useEffect } from 'react';
import { Calendar, Briefcase, ExternalLink, ChevronDown, ChevronRight, Star, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

function ScoreBadge({ score }) {
  if (!score) return null;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#2563eb' : score >= 60 ? '#d97706' : '#9ca3af';
  return (
    <span style={{ background: color }} className="text-white text-xs font-bold px-2 py-0.5 rounded-full">
      {score}%
    </span>
  );
}

function PRBadge({ prEligible, nocCode, nocTeer }) {
  if (!nocCode) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prEligible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      NOC {nocCode} · TEER {nocTeer} {prEligible ? '✅' : ''}
    </span>
  );
}

function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-teal transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.digest_bucket === 'primary' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {job.digest_bucket === 'primary' ? '⭐ Top Match' : '🔎 Worth a Look'}
            </span>
            <ScoreBadge score={job.score} />
            <PRBadge prEligible={job.pr_eligible} nocCode={job.noc_code} nocTeer={job.noc_teer} />
          </div>
          <h3 className="font-semibold text-gray-900 mt-1 text-sm leading-tight">{job.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{job.company} · {job.location}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {(job.sources || [job.source_type]).filter(Boolean).join(', ')}
            {job.posted_at && ` · ${new Date(job.posted_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`}
          </p>
          {job.matched_keywords?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {job.matched_keywords.slice(0, 4).map(k => (
                <span key={k} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{k}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <a href={job.url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 bg-navy text-white text-xs px-3 py-1.5 rounded-lg hover:bg-navy/80 transition-colors whitespace-nowrap">
            Apply <ExternalLink size={11} />
          </a>
          {job.description && (
            <button onClick={() => setExpanded(e => !e)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      </div>
      {expanded && job.description && (
        <p className="mt-3 text-xs text-gray-600 leading-relaxed border-t pt-3 line-clamp-6">
          {job.description.slice(0, 500)}{job.description.length > 500 ? '...' : ''}
        </p>
      )}
    </div>
  );
}

function DateGroup({ date, jobs, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const primary   = jobs.filter(j => j.digest_bucket === 'primary').length;
  const secondary = jobs.filter(j => j.digest_bucket === 'secondary').length;

  const label = (() => {
    const d     = new Date(date);
    const today = new Date();
    const diff  = Math.floor((today - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  })();

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Calendar size={16} className="text-teal" />
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-white/60 text-xs">{date}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full">⭐ {primary} top</span>
          <span className="bg-yellow-500 text-white px-2 py-0.5 rounded-full">🔎 {secondary} more</span>
          <span className="text-white/60">{jobs.length} total</span>
        </div>
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-2">
          {jobs.map(job => <JobCard key={job.job_hash || job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}

export default function DailyJobs() {
  const { token } = useAuth();
  const [grouped, setGrouped]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [totalJobs, setTotal]   = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/scout/results?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load job postings');
        const data = await res.json();
        const jobs = data.jobs || data.results || data || [];
        setTotal(jobs.length);

        // Group by date (YYYY-MM-DD based on last_seen_at or posted_at)
        const groups = {};
        jobs.forEach(job => {
          if (!job.digest_bucket) return; // only show jobs that made a digest
          const raw  = job.last_seen_at || job.posted_at || new Date().toISOString();
          const date = raw.split('T')[0];
          if (!groups[date]) groups[date] = [];
          groups[date].push(job);
        });

        // Sort jobs within each group: primary first, then by score desc
        Object.keys(groups).forEach(date => {
          groups[date].sort((a, b) => {
            if (a.digest_bucket === 'primary' && b.digest_bucket !== 'primary') return -1;
            if (b.digest_bucket === 'primary' && a.digest_bucket !== 'primary') return 1;
            return (b.score || 0) - (a.score || 0);
          });
        });

        setGrouped(groups);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const dates = Object.keys(grouped).sort().reverse(); // newest first

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="text-teal" size={24} />
            Daily Job Postings
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {totalJobs} jobs across {dates.length} day{dates.length !== 1 ? 's' : ''} · Updated daily at 8:00 AM
          </p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div className="flex items-center gap-2 justify-end mb-1">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">⭐ Top Match</span>
            <span>= score ≥60%, core NOC</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">🔎 Worth a Look</span>
            <span>= broader matches</span>
          </div>
        </div>
      </div>

      {dates.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No job postings yet</p>
          <p className="text-gray-400 text-sm mt-1">Your first digest will appear here after the agent runs at 8:00 AM on a weekday.</p>
        </div>
      ) : (
        dates.map((date, i) => (
          <DateGroup key={date} date={date} jobs={grouped[date]} defaultOpen={i === 0} />
        ))
      )}
    </div>
  );
}

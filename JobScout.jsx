import { useState, useEffect, useCallback } from 'react';
import ScoutCard      from '../components/JobScout/ScoutCard';
import ScoutRunStatus from '../components/JobScout/ScoutRunStatus';

const API = import.meta.env.VITE_API_URL || '';

function getToken() { return localStorage.getItem('token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3.5 mb-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-[52px] h-[52px] bg-gray-700 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-700/60 rounded w-1/2 mb-3" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-gray-700/50 rounded-md" />
            <div className="h-5 w-20 bg-gray-700/50 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

const SCORE_FILTERS = [
  { label: 'All',   value: 0  },
  { label: '75+',   value: 75 },
  { label: '80+',   value: 80 },
  { label: '90+',   value: 90 },
];

const SOURCE_OPTIONS = ['All', 'LinkedIn', 'Indeed', 'Adzuna', 'Canada Job Bank', 'Jooble'];

export default function JobScout() {
  const [jobs,       setJobs]       = useState([]);
  const [newCount,   setNewCount]   = useState(0);
  const [lastRun,    setLastRun]    = useState(null);
  const [isRunning,  setIsRunning]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [scoreFilter,setScoreFilter]= useState(0);
  const [srcFilter,  setSrcFilter]  = useState('All');
  const [activeTab,  setActiveTab]  = useState('new'); // new | saved | all
  const [error,      setError]      = useState('');

  // ── Fetch results ─────────────────────────────────────────────────────────
  const loadResults = useCallback(async () => {
    try {
      const params = new URLSearchParams({ min_score: scoreFilter, limit: 80 });
      if (activeTab === 'saved') params.set('status', 'saved');
      const res  = await fetch(`${API}/api/scout/results?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let filtered = data.jobs || [];
      if (srcFilter !== 'All') {
        filtered = filtered.filter(j => (j.sources || []).some(s => s.includes(srcFilter)));
      }
      if (activeTab === 'new') {
        filtered = filtered.filter(j => j.status === 'new' || j.status === 'seen');
      }

      setJobs(filtered);
      setNewCount(data.new_count || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [scoreFilter, srcFilter, activeTab]);

  // ── Fetch last run ────────────────────────────────────────────────────────
  const loadLastRun = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/scout/runs?limit=1`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.length) setLastRun(data[0]);
    } catch {}
  }, []);

  // ── Mark new as seen on tab open ─────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/scout/results/seen`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  }, []);

  useEffect(() => { loadResults(); },  [loadResults]);
  useEffect(() => { loadLastRun(); },  [loadLastRun]);

  // ── Manual scan ───────────────────────────────────────────────────────────
  async function handleManualRun() {
    if (isRunning) return;
    setIsRunning(true);
    setError('');
    try {
      const res  = await fetch(`${API}/api/scout/run`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await Promise.all([loadResults(), loadLastRun()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRunning(false);
    }
  }

  // ── Card action (add/save/dismiss) ────────────────────────────────────────
  async function handleAction(jobHash, status) {
    try {
      await fetch(`${API}/api/scout/results/${jobHash}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({ status }),
      });
      if (status === 'dismissed') {
        setJobs(prev => prev.filter(j => j.job_hash !== jobHash));
      } else {
        setJobs(prev => prev.map(j => j.job_hash === jobHash ? { ...j, status } : j));
      }
    } catch (e) {
      console.error('Action failed:', e.message);
    }
  }

  const visibleJobs = jobs;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Job Scout</h1>
              <p className="text-xs text-gray-500">Winnipeg · Last 24 hours</p>
            </div>
            {newCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {newCount} new
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-800">
            {[
              { id: 'new',   label: 'Active' },
              { id: 'saved', label: 'Saved' },
              { id: 'all',   label: 'All' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Score + Source filter bar */}
          <div className="flex gap-2 py-3 overflow-x-auto scrollbar-hide">
            {SCORE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setScoreFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
                  scoreFilter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px bg-gray-700 flex-shrink-0" />
            {SOURCE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSrcFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
                  srcFilter === s
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-28">
        {/* Last run status */}
        <ScoutRunStatus lastRun={lastRun} isRunning={isRunning} />

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div>
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Jobs */}
        {!loading && visibleJobs.length > 0 && visibleJobs.map(job => (
          <ScoutCard key={job.job_hash} job={job} onAction={handleAction} />
        ))}

        {/* Empty state */}
        {!loading && visibleJobs.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-base font-semibold text-white mb-1">
              {activeTab === 'saved' ? 'No saved jobs yet' : 'No matches right now'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              {activeTab === 'saved'
                ? 'Jobs you save from Active will appear here.'
                : 'Tap Scan Now to search all sources, or wait for the next auto-scan.'}
            </p>
            {activeTab !== 'saved' && (
              <button
                onClick={handleManualRun}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Scan Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── FAB: Manual scan trigger ── */}
      <div className="fixed bottom-6 right-4 z-40">
        <button
          onClick={handleManualRun}
          disabled={isRunning}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all
            ${isRunning
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 active:scale-95'}`}
          title="Scan for new jobs"
        >
          {isRunning ? (
            <svg className="w-6 h-6 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

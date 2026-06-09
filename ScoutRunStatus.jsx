import { useState, useEffect } from 'react';

function useCountdown(targetHours = 24, lastRunAt) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function calc() {
      if (!lastRunAt) { setRemaining(''); return; }
      const next    = new Date(lastRunAt).getTime() + targetHours * 36e5;
      const diff    = next - Date.now();
      if (diff <= 0) { setRemaining('Due now'); return; }
      const h = Math.floor(diff / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4);
      setRemaining(`${h}h ${m}m`);
    }
    calc();
    const t = setInterval(calc, 30_000);
    return () => clearInterval(t);
  }, [lastRunAt, targetHours]);

  return remaining;
}

export default function ScoutRunStatus({ lastRun, onManualRun, isRunning }) {
  const nextIn = useCountdown(24, lastRun?.completed_at);

  if (!lastRun && !isRunning) return null;

  if (isRunning) {
    return (
      <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        <p className="text-sm text-blue-300 font-medium">Scanning all sources…</p>
        <div className="ml-auto flex gap-1">
          {['Adzuna','Job Bank','Jooble','LinkedIn','Indeed'].map(s => (
            <span key={s} className="text-xs bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded animate-pulse">
              {s.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const { jobs_fetched, jobs_matched, sources_used, sources_failed, triggered_by, completed_at } = lastRun;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          <span className="text-xs text-gray-400 font-medium">
            Last scan {triggered_by === 'auto' ? '(auto)' : '(manual)'}
          </span>
        </div>
        {nextIn && (
          <span className="text-xs text-gray-500">Next in <span className="text-gray-300">{nextIn}</span></span>
        )}
      </div>

      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <div className="text-center">
          <p className="text-sm font-bold text-white">{jobs_matched}</p>
          <p className="text-xs text-gray-500">matched</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-400">{jobs_fetched}</p>
          <p className="text-xs text-gray-500">fetched</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(sources_used || []).map(s => (
            <span key={s} className="text-xs bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded">
              ✓ {s.split(' ')[0]}
            </span>
          ))}
          {(sources_failed || []).map(s => (
            <span key={s} className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">
              ✕ {s.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

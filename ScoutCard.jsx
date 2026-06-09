import { useState } from 'react';

const SCORE_CONFIG = {
  perfect:         { color: '#059669', bg: 'bg-emerald-900/30', label: 'Perfect Match',      ring: '#059669' },
  good:            { color: '#2563eb', bg: 'bg-blue-900/30',    label: 'Good Match',          ring: '#2563eb' },
  consider:        { color: '#d97706', bg: 'bg-amber-900/30',   label: 'Worth Considering',   ring: '#d97706' },
  below_threshold: { color: '#6b7280', bg: 'bg-gray-800',       label: 'Weak Match',          ring: '#6b7280' },
  keyword:         { color: '#6b7280', bg: 'bg-gray-800',       label: 'Keyword Match',       ring: '#6b7280' },
};

function ScoreDial({ score, mode }) {
  const r      = 20;
  const circ   = 2 * Math.PI * r;
  const pct    = score ? Math.min(100, score) : 0;
  const offset = circ - (pct / 100) * circ;
  const cfg    = mode === 'keyword'
    ? SCORE_CONFIG.keyword
    : (score >= 90 ? SCORE_CONFIG.perfect
       : score >= 80 ? SCORE_CONFIG.good
       : score >= 75 ? SCORE_CONFIG.consider
       : SCORE_CONFIG.below_threshold);

  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="#374151" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={cfg.ring} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold leading-none" style={{ color: cfg.ring }}>
          {mode === 'keyword' ? '~' : score}
        </span>
        {mode !== 'keyword' && <span className="text-gray-500" style={{ fontSize: 8 }}>%</span>}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'recently';
  const hrs = Math.round((Date.now() - new Date(dateStr).getTime()) / 36e5);
  if (hrs < 1)  return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return 'today';
}

const SOURCE_COLORS = {
  'LinkedIn':         'bg-blue-900/50 text-blue-300',
  'Indeed':           'bg-violet-900/50 text-violet-300',
  'Adzuna':           'bg-cyan-900/50 text-cyan-300',
  'Canada Job Bank':  'bg-red-900/50 text-red-300',
  'Jooble':           'bg-orange-900/50 text-orange-300',
};

export default function ScoutCard({ job, onAction }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const cfg = SCORE_CONFIG[job.category] || SCORE_CONFIG.below_threshold;

  const sources  = job.sources || (job.source ? [job.source] : ['Unknown']);
  const topChips = (job.matched_keywords || []).slice(0, 3);

  function handleAction(status) {
    setSheetOpen(false);
    onAction(job.job_hash, status);
  }

  return (
    <>
      {/* ── Card ── */}
      <div
        onClick={() => setSheetOpen(true)}
        className={`${cfg.bg} border border-gray-700/60 rounded-xl p-3.5 mb-3 cursor-pointer
                    active:scale-[0.98] transition-transform select-none`}
      >
        <div className="flex items-start gap-3">
          <ScoreDial score={job.score} mode={job.scoring_mode} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2 flex-1">
                {job.title}
              </p>
              {job.is_ghost_job && (
                <span title="Posted multiple times — may be a ghost job" className="text-base flex-shrink-0">👻</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{job.company}</p>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {sources.map(s => (
                <span key={s} className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${SOURCE_COLORS[s] || 'bg-gray-700 text-gray-300'}`}>
                  {s}
                </span>
              ))}
              <span className="text-xs text-gray-500">{timeAgo(job.posted_at)}</span>
              {job.scoring_mode === 'keyword' && (
                <span className="text-xs bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded-md">Budget mode</span>
              )}
            </div>

            {topChips.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {topChips.map(kw => (
                  <span key={kw} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
                {(job.matched_keywords || []).length > 3 && (
                  <span className="text-xs text-gray-500">+{job.matched_keywords.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Sheet ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setSheetOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-start gap-4 mt-3 mb-4">
                <ScoreDial score={job.score} mode={job.scoring_mode} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white leading-snug">{job.title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{job.company}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{job.location} · {timeAgo(job.posted_at)}</p>
                </div>
              </div>

              {/* Score category badge */}
              <div className="mb-4">
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: cfg.ring + '25', color: cfg.ring, border: `1px solid ${cfg.ring}40` }}
                >
                  {cfg.label}{job.scoring_mode === 'keyword' ? ' (keyword mode)' : ''}
                </span>
                {job.is_ghost_job && (
                  <span className="ml-2 text-xs bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full border border-yellow-700/40">
                    👻 Reposted role
                  </span>
                )}
              </div>

              {/* Keywords */}
              {(job.matched_keywords?.length > 0 || job.missing_keywords?.length > 0) && (
                <div className="bg-gray-800/60 rounded-xl p-3.5 mb-4">
                  {job.matched_keywords?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">✅ Matched</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.matched_keywords.map(kw => (
                          <span key={kw} className="text-xs bg-emerald-900/40 text-emerald-400 px-2.5 py-1 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.missing_keywords?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">❌ Gaps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.missing_keywords.map(kw => (
                          <span key={kw} className="text-xs bg-red-900/30 text-red-400 px-2.5 py-1 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {job.description && (
                <div className="mb-5">
                  <p className="text-xs text-gray-500 font-medium mb-1.5">About the role</p>
                  <p className="text-sm text-gray-300 leading-relaxed line-clamp-6">
                    {job.description}
                  </p>
                </div>
              )}

              {/* Sources */}
              <div className="flex gap-1.5 mb-5 flex-wrap">
                {sources.map(s => (
                  <span key={s} className={`text-xs px-2 py-1 rounded-lg ${SOURCE_COLORS[s] || 'bg-gray-700 text-gray-300'}`}>
                    {s}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 gap-2.5">
                <a
                  href={job.url} target="_blank" rel="noopener noreferrer"
                  onClick={() => handleAction('seen')}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl text-center transition-colors"
                >
                  View & Apply →
                </a>
                <button
                  onClick={() => handleAction('added_to_tracker')}
                  className="w-full py-3 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-400 text-sm font-medium rounded-xl transition-colors border border-emerald-800/50"
                >
                  + Add to Tracker
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleAction('saved')}
                    className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
                  >
                    ♡ Save
                  </button>
                  <button
                    onClick={() => handleAction('dismissed')}
                    className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm font-medium rounded-xl transition-colors"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

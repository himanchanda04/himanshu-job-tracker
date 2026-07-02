import { useState, useEffect } from 'react';
import { Briefcase, ExternalLink, BookOpen, ChevronDown } from 'lucide-react';

function formatDateHeader(dateStr) {
  const jobDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(jobDate, today)) return 'Today';
  if (isSameDay(jobDate, yesterday)) return 'Yesterday';

  return jobDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function groupByDate(jobs) {
  const groups = {};
  for (const job of jobs) {
    const dateKey = new Date(job.first_seen_at).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(job);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => new Date(b) - new Date(a))
    .map(([dateKey, jobs]) => ({
      dateKey,
      label: formatDateHeader(jobs[0].first_seen_at),
      jobs,
    }));
}

function JobCard({ job }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {job.digest_bucket && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.digest_bucket === 'primary' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {job.digest_bucket === 'primary' ? '⭐ Top Match' : '🔎 Worth a Look'}
              </span>
            )}
            {job.score && <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{job.score}%</span>}
            {job.noc_code && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">NOC {job.noc_code} ✅</span>}
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{job.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{job.company} · {job.location}</p>
          {job.matched_keywords?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {job.matched_keywords.slice(0, 4).map(k => (
                <span key={k} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{k}</span>
              ))}
            </div>
          )}
        </div>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
           className="shrink-0 flex items-center gap-1 bg-navy text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-80">
          Apply <ExternalLink size={11}/>
        </a>
      </div>
    </div>
  );
}

function DateGroup({ group, isOpen, onToggle }) {
  const primary = group.jobs.filter(j => j.digest_bucket === 'primary');
  const secondary = group.jobs.filter(j => j.digest_bucket === 'secondary');
  const more = group.jobs.filter(j => !j.digest_bucket);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-200 text-left"
      >
        <h2 className="text-lg font-bold text-gray-800">
          {group.label} <span className="text-sm font-normal text-gray-400">({group.jobs.length})</span>
        </h2>
        <ChevronDown
          size={20}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div>
          {primary.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">⭐ Top Matches ({primary.length})</h3>
              <div className="space-y-3">
                {primary.map(job => <JobCard key={job.job_hash} job={job} />)}
              </div>
            </div>
          )}

          {secondary.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">🔎 Also Worth a Look ({secondary.length})</h3>
              <div className="space-y-3">
                {secondary.map(job => <JobCard key={job.job_hash} job={job} />)}
              </div>
            </div>
          )}

          {more.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">📋 More Results ({more.length})</h3>
              <div className="space-y-3">
                {more.map(job => <JobCard key={job.job_hash} job={job} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDates, setOpenDates] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not logged in. Please sign out and sign back in.');
      setLoading(false);
      return;
    }
    fetch('https://himanshu-job-tracker.onrender.com/api/scout/results?limit=200', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => {
        const all = data.jobs || [];
        setJobs(all);

        const grouped = groupByDate(all);
        const initialOpen = {};
        grouped.forEach((g, i) => { initialOpen[g.dateKey] = i === 0; });
        setOpenDates(initialOpen);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal"/></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">Error: {error}</div>;

  const grouped = groupByDate(jobs);

  const toggleDate = (dateKey) => {
    setOpenDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <Briefcase className="text-teal" size={24}/>Daily Job Postings
      </h1>
      <p className="text-gray-500 text-sm mb-6">{jobs.length} jobs · Updated weekdays at 8:00 AM</p>

      {jobs.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500 font-medium">No job postings yet</p>
          <p className="text-gray-400 text-sm mt-1">Jobs appear here after the agent runs at 8:00 AM on a weekday.</p>
        </div>
      ) : (
        grouped.map(group => (
          <DateGroup
            key={group.dateKey}
            group={group}
            isOpen={!!openDates[group.dateKey]}
            onToggle={() => toggleDate(group.dateKey)}
          />
        ))
      )}
    </div>
  );
}

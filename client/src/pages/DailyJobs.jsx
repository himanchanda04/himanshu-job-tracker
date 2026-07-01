import { useState, useEffect } from 'react';
import { Briefcase, ExternalLink, BookOpen } from 'lucide-react';

export default function DailyJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const all = (data.jobs || []).filter(j => j.digest_bucket);
        setJobs(all);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal"/></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">Error: {error}</div>;

  const primary = jobs.filter(j => j.digest_bucket === 'primary');
  const secondary = jobs.filter(j => j.digest_bucket === 'secondary');

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
        <>
          {primary.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">⭐ Top Matches ({primary.length})</h2>
              <div className="space-y-3">
                {primary.map(job => (
                  <div key={job.job_hash} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                ))}
              </div>
            </div>
          )}

          {secondary.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">🔎 Also Worth a Look ({secondary.length})</h2>
              <div className="space-y-3">
                {secondary.map(job => (
                  <div key={job.job_hash} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {job.score && <span className="bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">{job.score}%</span>}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">{job.title}</h3>
                        <p className="text-gray-500 text-xs mt-0.5">{job.company} · {job.location}</p>
                      </div>
                      <a href={job.url} target="_blank" rel="noopener noreferrer"
                         className="shrink-0 flex items-center gap-1 bg-navy text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-80">
                        Apply <ExternalLink size={11}/>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// Tue 30 Jun 2026 23:12:12 CDT
// cache bust Tue 30 Jun 2026 23:13:42 CDT

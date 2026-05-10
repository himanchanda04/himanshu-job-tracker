import { useState } from 'react';
import { Plus, Search, ExternalLink, Edit2, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import StatusSelect      from '../components/applications/StatusSelect';
import ApplicationForm   from '../components/applications/ApplicationForm';
import { useApplications } from '../hooks/useApplications';
import { deleteApplication, updateApplication, exportExcel } from '../api/applications';

const STATUSES = ['All', 'Applied', 'Interview', 'Offer', 'Rejected', 'No Response', 'Discarded'];

function fmtSalary(app) {
  if (!app.salary_min && !app.salary_max) return '—';
  const min = app.salary_min?.toLocaleString() ?? '?';
  const max = app.salary_max?.toLocaleString() ?? '?';
  return `${app.salary_currency} ${min} – ${max}`;
}

export default function Applications() {
  const [status,   setStatus]   = useState('All');
  const [search,   setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);

  const filters = {};
  if (status !== 'All') filters.status = status;
  if (search)           filters.search = search;

  const { data, loading, refetch } = useApplications(filters);

  const openAdd  = () => { setEditing(null);  setShowForm(true); };
  const openEdit = (app) => { setEditing(app); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleStatusChange = async (id, newStatus) => {
    await updateApplication(id, { status: newStatus });
    refetch();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this application? This cannot be undone.')) return;
    await deleteApplication(id);
    refetch();
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Applications</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportExcel(status !== 'All' ? status : undefined)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                       text-sm text-muted hover:bg-white transition-colors"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal text-white
                       text-sm font-semibold hover:bg-teal/90 transition-colors"
          >
            <Plus size={16} /> Add Application
          </button>
        </div>
      </div>

      {/* ── Search + status filter ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search company, role, recruiter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm
                       focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${status === s
                  ? 'bg-navy text-white'
                  : 'bg-white border border-border text-muted hover:border-navy hover:text-navy'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block bg-white rounded-xl shadow-card">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-bg border-b border-border text-xs text-muted font-semibold uppercase tracking-wide">
                <th className="text-left px-4 py-3">Company / Role</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Portal</th>
                <th className="text-left px-4 py-3">Salary</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Applied</th>
                <th className="text-left px-4 py-3">Recruiter</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted">Loading…</td>
                </tr>
              )}
              {!loading && data.data.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted">
                    No applications found.{status === 'All' ? ' Add your first one!' : ''}
                  </td>
                </tr>
              )}
              {data.data.map((app) => (
                <tr key={app.id} className="hover:bg-slate-bg/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{app.company}</p>
                    <p className="text-muted text-xs mt-0.5">{app.role}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-sm">{app.location || '—'}</td>
                  <td className="px-4 py-3 text-muted text-sm">{app.portal || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{fmtSalary(app)}</td>
                  <td className="px-4 py-3">
                  <StatusSelect
                    value={app.status}
                    onChange={(s) => handleStatusChange(app.id, s)}
                    compact
                  />
                </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{app.recruiter_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noreferrer"
                          className="text-muted hover:text-navy transition-colors" title="View posting">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => openEdit(app)}
                        className="text-muted hover:text-navy transition-colors" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(app.id)}
                        className="text-muted hover:text-rose-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted">
          Showing {data.data.length} of {data.total} applications
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden space-y-3">
        {loading && (
          <p className="text-center py-12 text-muted text-sm">Loading…</p>
        )}
        {!loading && data.data.length === 0 && (
          <p className="text-center py-16 text-muted text-sm">
            No applications yet — tap "Add Application" to get started.
          </p>
        )}
        {data.data.map((app) => (
          <div key={app.id} className="bg-white rounded-xl shadow-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{app.company}</p>
                <p className="text-muted text-sm truncate">{app.role}</p>
              </div>
              <StatusSelect
                value={app.status}
                onChange={(s) => handleStatusChange(app.id, s)}
                compact
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-muted">
              <span>📍 {app.location || '—'}</span>
              <span>🌐 {app.portal   || '—'}</span>
              <span>📅 {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : '—'}</span>
              <span>👤 {app.recruiter_name || '—'}</span>
              {(app.salary_min || app.salary_max) && (
                <span className="col-span-2">💰 {fmtSalary(app)}</span>
              )}
            </div>
            {app.remarks && (
              <p className="mt-2 text-xs text-muted italic line-clamp-2">"{app.remarks}"</p>
            )}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              {app.job_url && (
                <a href={app.job_url} target="_blank" rel="noreferrer"
                  className="text-xs text-teal font-medium flex items-center gap-1">
                  <ExternalLink size={12} /> View Job
                </a>
              )}
              <button onClick={() => openEdit(app)}
                className="text-xs text-muted hover:text-navy flex items-center gap-1">
                <Edit2 size={12} /> Edit
              </button>
              <button onClick={() => handleDelete(app.id)}
                className="text-xs text-muted hover:text-rose-500 flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <ApplicationForm
          initial={editing}
          onClose={closeForm}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

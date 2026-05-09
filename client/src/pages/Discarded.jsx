import { format, differenceInDays } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import StatusBadge         from '../components/applications/StatusBadge';
import { useApplications } from '../hooks/useApplications';
import { updateApplication } from '../api/applications';

export default function Discarded() {
  const { data, loading, refetch } = useApplications({ status: 'Discarded' });

  const restore = async (app) => {
    await updateApplication(app.id, { status: 'Applied', auto_discarded: 0 });
    refetch();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Discarded Applications</h1>
        <p className="text-sm text-muted mt-0.5">
          {data.total} application{data.total !== 1 ? 's' : ''} moved here automatically
          after receiving no response. You can restore any of them.
        </p>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted text-sm">Loading…</div>
        ) : data.data.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            No discarded applications — great job staying on top of things!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-bg border-b border-border text-xs text-muted font-semibold uppercase tracking-wide">
                <th className="text-left px-4 py-3">Company / Role</th>
                <th className="text-left px-4 py-3">Portal</th>
                <th className="text-left px-4 py-3">Applied</th>
                <th className="text-left px-4 py-3">Days Since Applied</th>
                <th className="text-left px-4 py-3">How Discarded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((app) => (
                <tr key={app.id} className="hover:bg-slate-bg/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-700">{app.company}</p>
                    <p className="text-xs text-muted">{app.role}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-sm">{app.portal || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {app.applied_date
                      ? `${differenceInDays(new Date(), new Date(app.applied_date))} days`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${app.auto_discarded ? 'text-amber-600' : 'text-muted'}`}>
                      {app.auto_discarded ? 'Auto (no response)' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => restore(app)}
                      className="flex items-center gap-1.5 text-xs text-teal font-medium hover:underline"
                    >
                      <RotateCcw size={13} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden space-y-3">
        {loading && <p className="text-center py-12 text-muted text-sm">Loading…</p>}
        {!loading && data.data.length === 0 && (
          <p className="text-center py-16 text-muted text-sm">No discarded applications yet.</p>
        )}
        {data.data.map((app) => (
          <div key={app.id} className="bg-white rounded-xl shadow-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700 truncate">{app.company}</p>
                <p className="text-xs text-muted truncate">{app.role}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <div className="mt-2 text-xs text-muted space-y-1">
              <p>Applied: {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : '—'}</p>
              <p>
                {app.applied_date
                  ? `${differenceInDays(new Date(), new Date(app.applied_date))} days ago`
                  : ''}
              </p>
              {app.auto_discarded ? (
                <p className="text-amber-600">Auto-discarded (no response)</p>
              ) : (
                <p>Manually discarded</p>
              )}
            </div>
            <button
              onClick={() => restore(app)}
              className="mt-3 flex items-center gap-1.5 text-xs text-teal font-medium"
            >
              <RotateCcw size={13} /> Restore to Applied
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

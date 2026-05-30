import { Link } from 'react-router-dom';
import {
  Send, PhoneCall, Trophy, XCircle, Clock, Trash2, TrendingUp, Download, Bell,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import StatCard         from '../components/dashboard/StatCard';
import { useApplications } from '../hooks/useApplications';
import { exportExcel }  from '../api/applications';
import { STAT_CARD_COLORS, STATUS_STYLES } from '../design/colors';

const FOLLOWUP_DAYS = 7;

const PIE_ORDER = ['total', 'interview', 'offer', 'rejected', 'no_response', 'discarded'];

export default function Dashboard() {
  const { stats, data, loading } = useApplications();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Loading dashboard…
      </div>
    );
  }

  const s = stats?.stats || {};

  const kpis = [
    { key: 'total',       label: 'Total Applied',  value: s.total,       icon: Send      },
    { key: 'interview',   label: 'Interviews',      value: s.interview,   icon: PhoneCall },
    { key: 'offer',       label: 'Offers',          value: s.offer,       icon: Trophy    },
    { key: 'rejected',    label: 'Rejected',        value: s.rejected,    icon: XCircle   },
    { key: 'no_response', label: 'No Response',     value: s.no_response, icon: Clock     },
    { key: 'discarded',   label: 'Discarded',       value: s.discarded,   icon: Trash2    },
  ];

  const pieData = kpis
    .filter((k) => k.value > 0)
    .map((k) => ({
      name:  k.label,
      value: k.value,
      color: Object.values(STATUS_STYLES)[PIE_ORDER.indexOf(k.key)]?.hex ?? '#94A3B8',
    }));

  const responseRate = s.total
    ? Math.round(((s.interview + s.offer + s.rejected) / s.total) * 100)
    : 0;

  const now = Date.now();
  const followUpApps = (data?.data || [])
    .filter(app => {
      if (app.status !== 'Applied' && app.status !== 'No Response') return false;
      if (app.auto_discarded) return false;
      const lastUpdated = new Date(app.last_updated || app.applied_date || app.created_at).getTime();
      return Math.floor((now - lastUpdated) / 86400000) >= FOLLOWUP_DAYS;
    })
    .sort((a, b) => new Date(a.last_updated || a.applied_date) - new Date(b.last_updated || b.applied_date));

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">Your job search at a glance</p>
        </div>
        <button
          onClick={() => exportExcel()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white
                     text-sm font-medium hover:bg-navy/90 transition-colors"
        >
          <Download size={16} />
          Export Excel
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <StatCard
            key={k.key}
            label={k.label}
            value={k.value}
            icon={k.icon}
            color={STAT_CARD_COLORS[k.key]}
          />
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut — status breakdown */}
        <div className="bg-white rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-navy mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal" />
            Status Breakdown
          </h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {pieData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted text-sm">
              No applications yet — add your first one!
            </div>
          )}
        </div>

        {/* Line — last 30 days */}
        <div className="bg-white rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-navy mb-4">Applications — Last 30 Days</h2>
          {stats?.last30Days?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={stats.last30Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#00BFA5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Applications"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted text-sm">
              No applications in the last 30 days
            </div>
          )}
        </div>
      </div>

      {/* ── Response rate bar ── */}
      <div className="bg-white rounded-xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-navy">Response Rate</h2>
          <span className="text-lg font-bold text-teal">{responseRate}%</span>
        </div>
        <div className="w-full bg-slate-bg rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-teal h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${responseRate}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-2">
          {(s.interview ?? 0) + (s.offer ?? 0) + (s.rejected ?? 0)} responses out of {s.total ?? 0} applications
        </p>
      </div>

      {/* ── Follow-up reminders ── */}
      {followUpApps.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-card border-l-4 border-amber-400">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-navy flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              Follow-up Needed
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {followUpApps.length}
              </span>
            </h2>
            <Link to="/applications" className="text-xs text-teal hover:text-teal/80 font-medium transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {followUpApps.slice(0, 5).map(app => {
              const lastUpdated = new Date(app.last_updated || app.applied_date || app.created_at);
              const days = Math.floor((now - lastUpdated.getTime()) / 86400000);
              return (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{app.company}</p>
                    <p className="text-xs text-muted truncate">{app.role}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${app.status === 'Applied' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-amber-600 font-medium whitespace-nowrap">{days}d ago</span>
                  </div>
                </div>
              );
            })}
            {followUpApps.length > 5 && (
              <p className="text-xs text-muted pt-1">+{followUpApps.length - 5} more — <Link to="/applications" className="text-teal hover:underline">view all</Link></p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

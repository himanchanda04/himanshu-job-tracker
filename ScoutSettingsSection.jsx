/**
 * ─────────────────────────────────────────────────────────────────────────────
 * JOB SCOUT SETTINGS SECTION
 * Drop this file into your Settings.jsx imports and render <ScoutSettingsSection />
 * anywhere inside your existing Settings page component.
 *
 * Required: src/pages/Settings.jsx must import it like:
 *   import ScoutSettingsSection from '../components/JobScout/ScoutSettingsSection';
 * Then add <ScoutSettingsSection /> inside your existing Settings JSX.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

function BudgetBar({ label, spent, budget, color }) {
  const pct = Math.min(100, (spent / budget) * 100);
  const warn = pct >= 80;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-medium ${warn ? 'text-amber-400' : 'text-gray-400'}`}>
          ${spent.toFixed(3)} / ${budget.toFixed(2)}
          {pct >= 100 && <span className="ml-1 text-red-400">⚠ CAP</span>}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color,
          }}
        />
      </div>
    </div>
  );
}

export default function ScoutSettingsSection() {
  const [settings, setSettings] = useState({
    target_title: '', industry: '', min_score: 75,
    is_active: true, email_notify: true,
  });
  const [budget,  setBudget]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`${API}/api/scout/settings`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setSettings(s => ({ ...s, ...d }))).catch(() => {});

    fetch(`${API}/api/scout/budget`, { headers: authHeaders() })
      .then(r => r.json()).then(setBudget).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch(`${API}/api/scout/settings`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, id, placeholder, value, onChange }) {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 font-medium" htmlFor={id}>{label}</label>
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-900/50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Job Scout</h3>
            <p className="text-xs text-gray-500">Auto-finds Winnipeg jobs every 24h</p>
          </div>
        </div>
        {/* Active toggle */}
        <button
          onClick={() => setSettings(s => ({ ...s, is_active: !s.is_active }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${settings.is_active ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.is_active ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        <Field
          label="Target Job Title"
          id="scout-title"
          placeholder="e.g. Marketing Coordinator"
          value={settings.target_title}
          onChange={v => setSettings(s => ({ ...s, target_title: v }))}
        />
        <Field
          label="Industry / Sector"
          id="scout-industry"
          placeholder="e.g. Marketing, Digital, Hospitality"
          value={settings.industry}
          onChange={v => setSettings(s => ({ ...s, industry: v }))}
        />

        {/* Min score slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-gray-400 font-medium">Minimum Score</label>
            <span className="text-sm font-bold text-blue-400">{settings.min_score}%</span>
          </div>
          <input
            type="range" min="60" max="90" step="5"
            value={settings.min_score}
            onChange={e => setSettings(s => ({ ...s, min_score: parseInt(e.target.value) }))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>60% (broad)</span><span>75% (recommended)</span><span>90% (strict)</span>
          </div>
        </div>

        {/* Email notify toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-white">Email digest</p>
            <p className="text-xs text-gray-500">Get top matches by email after each scan</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, email_notify: !s.email_notify }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.email_notify ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.email_notify ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Budget meters */}
        {budget && (
          <div className="bg-gray-800/60 rounded-xl p-4 mt-2">
            <p className="text-xs text-gray-400 font-medium mb-3">Monthly Budget Usage</p>
            <BudgetBar
              label="Apify (LinkedIn + Indeed)"
              spent={budget.apify?.spent || 0}
              budget={budget.apify?.budget || 5}
              color="#3b82f6"
            />
            <BudgetBar
              label="Claude AI Scoring"
              spent={budget.claude?.spent || 0}
              budget={budget.claude?.budget || 2}
              color="#8b5cf6"
            />
            {budget.claude?.mode === 'keyword' && (
              <p className="text-xs text-amber-400 mt-2">
                ⚡ Claude cap reached — showing keyword-only scores until next month
              </p>
            )}
          </div>
        )}

        {/* Save button */}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-700 text-emerald-200'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Scout Settings'}
        </button>
      </div>
    </div>
  );
}

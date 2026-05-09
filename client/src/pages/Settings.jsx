import { useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [discardDays, setDiscardDays] = useState(
    () => localStorage.getItem('defaultDiscardDays') ?? '20'
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const days = Math.min(90, Math.max(1, Number(discardDays)));
    localStorage.setItem('defaultDiscardDays', String(days));
    setDiscardDays(String(days));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Customize your tracker preferences</p>
      </div>

      <div className="bg-white rounded-xl shadow-card p-6 space-y-6">

        {/* Auto-discard days */}
        <div>
          <h3 className="text-sm font-semibold text-navy mb-1">Auto-Discard After</h3>
          <p className="text-xs text-muted mb-3">
            Applications in <strong>Applied</strong> or <strong>No Response</strong> status
            automatically move to <strong>Discarded</strong> after this many days of silence.
            The server runs this check every night at midnight.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={90}
              value={discardDays}
              onChange={(e) => setDiscardDays(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-border text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <span className="text-sm text-muted">days</span>
          </div>
        </div>

        {/* How to extend */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-navy mb-2">How to Make Changes</h3>
          <ul className="text-xs text-muted space-y-2 list-disc list-inside">
            <li>
              <strong>Add a new column</strong> — edit <code>server/db/schema.sql</code>, then
              <code> server/routes/applications.js</code>, then
              <code> client/src/components/applications/ApplicationForm.jsx</code> and the table
              in <code>Applications.jsx</code>.
            </li>
            <li>
              <strong>Add a new status</strong> — update <code>schema.sql</code> CHECK constraint,
              then <code>client/src/design/colors.js</code> STATUS_STYLES, then the STATUSES array
              in <code>Applications.jsx</code>.
            </li>
            <li>
              <strong>Change colours</strong> — edit <code>client/src/design/colors.js</code>.
              All components and the Excel export read from that single file.
            </li>
            <li>
              <strong>Deploy to Vercel</strong> — push to GitHub, import repo in Vercel, set
              <code> VITE_API_URL</code> to your Railway backend URL.
            </li>
          </ul>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white
                     text-sm font-semibold hover:bg-navy/90 transition-colors"
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

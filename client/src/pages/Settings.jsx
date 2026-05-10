import { useState } from 'react';
import {
  Save, CheckCircle, User, Bell, Shield, Clock, Palette, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/applications';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <h3 className="flex items-center gap-2 text-sm font-bold text-navy mb-4">
        <Icon size={16} className="text-teal" />
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();

  const [discardDays, setDiscardDays] = useState(
    () => localStorage.getItem('defaultDiscardDays') ?? '20'
  );
  const [currency, setCurrency] = useState(
    () => localStorage.getItem('defaultCurrency') ?? 'CAD'
  );
  const [portal, setPortal] = useState(
    () => localStorage.getItem('defaultPortal') ?? 'LinkedIn'
  );

  const [saved, setSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg]         = useState({ text: '', ok: false });
  const [pwLoading, setPwLoading] = useState(false);

  const handleSave = () => {
    const days = Math.min(90, Math.max(1, Number(discardDays)));
    localStorage.setItem('defaultDiscardDays', String(days));
    localStorage.setItem('defaultCurrency', currency);
    localStorage.setItem('defaultPortal', portal);
    setDiscardDays(String(days));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePasswordChange = async () => {
    setPwMsg({ text: '', ok: false });
    if (newPw.length < 6) {
      setPwMsg({ text: 'New password must be at least 6 characters.', ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'New passwords do not match.', ok: false });
      return;
    }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwMsg({ text: 'Password changed successfully!', ok: true });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ text: err.response?.data?.error || 'Failed to change password.', ok: false });
    } finally {
      setPwLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your account and preferences</p>
      </div>

      {/* ── Profile ── */}
      <Section icon={User} title="Profile">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-sm text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          To update your name or email, contact the administrator.
        </p>
      </Section>

      {/* ── Preferences ── */}
      <Section icon={Palette} title="Preferences">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Default Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              {['CAD', 'USD', 'GBP', 'EUR', 'AUD', 'INR'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Default Portal</label>
            <select value={portal} onChange={(e) => setPortal(e.target.value)} className={inputCls}>
              {['LinkedIn', 'Indeed', 'Glassdoor', 'Company Website', 'Workday', 'Greenhouse', 'Lever', 'ZipRecruiter', 'Other'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ── Auto-Discard ── */}
      <Section icon={Clock} title="Auto-Discard">
        <p className="text-xs text-muted mb-3">
          Applications in <strong>Applied</strong> or <strong>No Response</strong> status
          will automatically move to <strong>Discarded</strong> after this many days with no update.
          This check runs every night at midnight.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={90}
            value={discardDays}
            onChange={(e) => setDiscardDays(e.target.value)}
            className="w-24 px-3 py-2.5 rounded-lg border border-border text-sm
                       focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <span className="text-sm text-muted">days</span>
        </div>
      </Section>

      {/* Save Preferences */}
      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal text-white
                   text-sm font-semibold hover:bg-teal/90 transition-colors"
      >
        {saved ? <CheckCircle size={15} /> : <Save size={15} />}
        {saved ? 'Saved!' : 'Save Preferences'}
      </button>

      {/* ── Change Password ── */}
      <Section icon={Shield} title="Change Password">
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Current Password</label>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
              className={inputCls} placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">New Password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              className={inputCls} placeholder="Min 6 characters" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className={inputCls} placeholder="Repeat new password" />
          </div>
          {pwMsg.text && (
            <p className={`text-xs ${pwMsg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            onClick={handlePasswordChange}
            disabled={pwLoading || !currentPw || !newPw}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white
                       text-sm font-semibold hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            <Shield size={14} />
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <div className="bg-white rounded-xl shadow-card p-6 border border-rose-200">
        <h3 className="flex items-center gap-2 text-sm font-bold text-rose-600 mb-2">
          <LogOut size={16} />
          Sign Out
        </h3>
        <p className="text-xs text-muted mb-4">
          Sign out of your account on this device. Your data will remain safe.
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-300 text-rose-600
                     text-sm font-semibold hover:bg-rose-50 transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

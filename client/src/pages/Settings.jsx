import { useState, useEffect, useRef } from 'react';
import {
  Save, CheckCircle, User, Shield, Clock, Palette, LogOut,
  FileText, Upload, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/applications';

const BASE = import.meta.env.VITE_API_URL || '';

async function parseFile(file) {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/api/ai/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  return (await res.json()).text;
}

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
  const fileRef = useRef();

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

  // Base resume state
  const [originalResume, setOriginalResume]     = useState('');
  const [resumeSaving,   setResumeSaving]       = useState(false);
  const [resumeSaved,    setResumeSaved]        = useState(false);
  const [resumeMsg,      setResumeMsg]          = useState({ text: '', ok: false });
  const [resumeParsing,  setResumeParsing]      = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(r => {
      if (r.data.user.original_resume) setOriginalResume(r.data.user.original_resume);
    }).catch(() => {});
  }, []);

  async function handleResumeFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setResumeParsing(true); setResumeMsg({ text: '', ok: false });
    try {
      const text = await parseFile(file);
      setOriginalResume(text);
      setResumeMsg({ text: 'File parsed — click Save Resume to store it.', ok: true });
    } catch (err) {
      setResumeMsg({ text: err.message, ok: false });
    } finally { setResumeParsing(false); e.target.value = ''; }
  }

  async function saveOriginalResume() {
    setResumeSaving(true); setResumeMsg({ text: '', ok: false });
    try {
      await api.patch('/auth/me', { original_resume: originalResume });
      setResumeSaved(true);
      setResumeMsg({ text: 'Base resume saved! Job Match will now use this.', ok: true });
      setTimeout(() => setResumeSaved(false), 3000);
    } catch {
      setResumeMsg({ text: 'Failed to save. Please try again.', ok: false });
    } finally { setResumeSaving(false); }
  }

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
    if (newPw.length < 6) { setPwMsg({ text: 'New password must be at least 6 characters.', ok: false }); return; }
    if (newPw !== confirmPw) { setPwMsg({ text: 'New passwords do not match.', ok: false }); return; }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ text: 'Password changed successfully!', ok: true });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ text: err.response?.data?.error || 'Failed to change password.', ok: false });
    } finally { setPwLoading(false); }
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
        <p className="text-xs text-muted">To update your name or email, contact the administrator.</p>
      </Section>

      {/* ── My Base Resume ── */}
      <Section icon={FileText} title="My Resume (Base)">
        <p className="text-xs text-muted mb-3">
          Upload your resume <strong>once</strong>. The <strong>Job Match</strong> tab will always score jobs against this resume and generate tailored versions from it — without you re-uploading every time.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleResumeFile} />
            <button onClick={() => fileRef.current.click()} disabled={resumeParsing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-slate-700
                         hover:border-teal hover:text-teal disabled:opacity-50 transition-colors">
              <Upload size={14} />{resumeParsing ? 'Parsing…' : 'Upload PDF/DOCX'}
            </button>
            {originalResume && (
              <button onClick={() => { setOriginalResume(''); setResumeMsg({ text: '', ok: false }); }}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 transition-colors">
                <Trash2 size={13} />Clear
              </button>
            )}
            <span className="text-xs text-muted">
              {originalResume ? `${Math.round(originalResume.length / 5)} words loaded` : 'No resume saved yet'}
            </span>
          </div>

          <textarea
            value={originalResume}
            onChange={e => setOriginalResume(e.target.value)}
            placeholder="Or paste your resume text directly here…"
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-slate-700
                       placeholder:text-muted resize-y focus:outline-none focus:ring-2 focus:ring-teal/40
                       focus:border-teal transition-colors font-mono leading-relaxed"
          />

          {resumeMsg.text && (
            <p className={`text-xs ${resumeMsg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{resumeMsg.text}</p>
          )}

          <button onClick={saveOriginalResume}
            disabled={resumeSaving || !originalResume.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold
                       hover:bg-teal/90 disabled:opacity-50 transition-colors">
            {resumeSaved ? <CheckCircle size={15} /> : <Save size={15} />}
            {resumeSaving ? 'Saving…' : resumeSaved ? 'Saved!' : 'Save Resume'}
          </button>
        </div>
      </Section>

      {/* ── Preferences ── */}
      <Section icon={Palette} title="Preferences">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Default Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              {['CAD', 'USD', 'GBP', 'EUR', 'AUD', 'INR'].map((c) => (<option key={c}>{c}</option>))}
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
          Applications in <strong>Applied</strong> or <strong>No Response</strong> status will automatically move to <strong>Discarded</strong> after this many days with no update.
        </p>
        <div className="flex items-center gap-3">
          <input type="number" min={1} max={90} value={discardDays}
            onChange={(e) => setDiscardDays(e.target.value)}
            className="w-24 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          <span className="text-sm text-muted">days</span>
        </div>
      </Section>

      <button onClick={handleSave}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/90 transition-colors">
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
            <p className={`text-xs ${pwMsg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{pwMsg.text}</p>
          )}
          <button onClick={handlePasswordChange} disabled={pwLoading || !currentPw || !newPw}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold
                       hover:bg-navy/90 disabled:opacity-50 transition-colors">
            <Shield size={14} />{pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* ── Sign Out ── */}
      <div className="bg-white rounded-xl shadow-card p-6 border border-rose-200">
        <h3 className="flex items-center gap-2 text-sm font-bold text-rose-600 mb-2">
          <LogOut size={16} />Sign Out
        </h3>
        <p className="text-xs text-muted mb-4">Sign out of your account on this device. Your data will remain safe.</p>
        <button onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-300 text-rose-600
                     text-sm font-semibold hover:bg-rose-50 transition-colors">
          <LogOut size={14} />Sign Out
        </button>
      </div>
    </div>
  );
}

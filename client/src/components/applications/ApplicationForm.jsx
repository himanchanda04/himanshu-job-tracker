import { useState } from 'react';
import { X } from 'lucide-react';
import { createApplication, updateApplication } from '../../api/applications';
import StatusSelect from './StatusSelect';

// ─── Dropdown options ─────────────────────────────────────────────────────────
const PORTALS    = ['LinkedIn', 'Indeed', 'Glassdoor', 'Company Website', 'Workday', 'Greenhouse', 'Lever', 'ZipRecruiter', 'Other'];
const CURRENCIES = ['CAD', 'USD', 'GBP', 'EUR', 'AUD', 'INR'];

const DEFAULT_FORM = {
  company:           '',
  role:              '',
  location:          '',
  portal:            'LinkedIn',
  job_url:           '',
  job_description:   '',
  recruiter_name:    '',
  recruiter_email:   '',
  salary_min:        '',
  salary_max:        '',
  salary_currency:   'CAD',
  status:            'Applied',
  remarks:           '',
  applied_date:      new Date().toISOString().slice(0, 10),
  interview_date:    '',
  discard_after_days: 20,
};

// ─── Reusable field renderer ──────────────────────────────────────────────────
function Field({ label, error, full, children }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-muted mb-1">{label}</label>
      {children}
      {error && <p className="text-rose-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputCls = (err) =>
  `w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal
   ${err ? 'border-rose-400' : 'border-border'}`;

export default function ApplicationForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form,   setForm]   = useState(initial ? { ...DEFAULT_FORM, ...initial } : DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.company.trim())  errs.company      = 'Required';
    if (!form.role.trim())     errs.role         = 'Required';
    if (!form.applied_date)    errs.applied_date = 'Required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        salary_min:         form.salary_min        ? Number(form.salary_min)        : null,
        salary_max:         form.salary_max        ? Number(form.salary_max)        : null,
        discard_after_days: Number(form.discard_after_days),
        interview_date:     form.interview_date || null,
      };
      const res = isEdit
        ? await updateApplication(initial.id, payload)
        : await createApplication(payload);
      onSaved(res.data);
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit application' : 'Add application'}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-navy">
            {isEdit ? 'Edit Application' : 'Add New Application'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">

            {/* ── Core fields ── */}
            <Field label="Company *" error={errors.company}>
              <input type="text" value={form.company} onChange={set('company')} className={inputCls(errors.company)} placeholder="e.g. Google" />
            </Field>

            <Field label="Role / Position *" error={errors.role}>
              <input type="text" value={form.role} onChange={set('role')} className={inputCls(errors.role)} placeholder="e.g. Software Engineer" />
            </Field>

            <Field label="Location">
              <input type="text" value={form.location} onChange={set('location')} className={inputCls()} placeholder="e.g. Toronto, ON (Remote)" />
            </Field>

            <Field label="Portal / Source">
              <select value={form.portal} onChange={set('portal')} className={inputCls()}>
                {PORTALS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>

            {/* ── Status + Dates ── */}
            <Field label="Status">
              <StatusSelect
                value={form.status}
                onChange={(val) => setForm((f) => ({ ...f, status: val }))}
              />
            </Field>

            <Field label="Applied Date *" error={errors.applied_date}>
              <input type="date" value={form.applied_date} onChange={set('applied_date')} className={inputCls(errors.applied_date)} />
            </Field>

            <Field label="Interview Date">
              <input type="date" value={form.interview_date} onChange={set('interview_date')} className={inputCls()} />
            </Field>

            <Field label="Auto-Discard After (days)">
              <input type="number" min={1} max={90} value={form.discard_after_days} onChange={set('discard_after_days')} className={inputCls()} />
            </Field>

            {/* ── Salary ── */}
            <Field label="Salary Min">
              <input type="number" value={form.salary_min} onChange={set('salary_min')} className={inputCls()} placeholder="e.g. 65000" />
            </Field>

            <Field label="Salary Max">
              <input type="number" value={form.salary_max} onChange={set('salary_max')} className={inputCls()} placeholder="e.g. 85000" />
            </Field>

            <Field label="Currency">
              <select value={form.salary_currency} onChange={set('salary_currency')} className={inputCls()}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>

            {/* ── Recruiter ── */}
            <Field label="Recruiter Name">
              <input type="text" value={form.recruiter_name} onChange={set('recruiter_name')} className={inputCls()} placeholder="e.g. Jane Smith" />
            </Field>

            <Field label="Recruiter Email" full>
              <input type="email" value={form.recruiter_email} onChange={set('recruiter_email')} className={inputCls()} placeholder="recruiter@company.com" />
            </Field>

            {/* ── URLs + Long text ── */}
            <Field label="Job Posting URL" full>
              <input type="url" value={form.job_url} onChange={set('job_url')} className={inputCls()} placeholder="https://..." />
            </Field>

            <Field label="Job Description" full>
              <textarea value={form.job_description} onChange={set('job_description')} rows={4}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal resize-y" />
            </Field>

            <Field label="Remarks / Notes" full>
              <textarea value={form.remarks} onChange={set('remarks')} rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal resize-y"
                placeholder="Any notes — referral contact, follow-up needed, etc." />
            </Field>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-slate-bg rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-navy text-white text-sm font-semibold
                       hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Application'}
          </button>
        </div>

      </div>
    </div>
  );
}

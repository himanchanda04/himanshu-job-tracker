import axios from 'axios';

// In development: VITE_API_URL is empty → Vite proxy routes /api → localhost:3001
// In production (Vercel): VITE_API_URL = https://your-app.railway.app
const BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: `${BASE}/api` });

// ─── Applications CRUD ────────────────────────────────────────────────────────

export const getApplications = (params) =>
  api.get('/applications', { params });

export const getStats = () =>
  api.get('/applications/stats');

export const getApplication = (id) =>
  api.get(`/applications/${id}`);

export const createApplication = (data) =>
  api.post('/applications', data);

export const updateApplication = (id, data) =>
  api.patch(`/applications/${id}`, data);

export const deleteApplication = (id) =>
  api.delete(`/applications/${id}`);

// ─── Export ───────────────────────────────────────────────────────────────────

// Opens the Excel download in a new browser tab.
// Pass a status string to filter, or nothing for all records.
export const exportExcel = (status) => {
  const qs = status && status !== 'All'
    ? `?status=${encodeURIComponent(status)}`
    : '';
  window.open(`${BASE}/api/export/excel${qs}`, '_blank');
};

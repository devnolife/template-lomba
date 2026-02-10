import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/api/dashboard/login', { username, password }).then((r) => r.data);

// ─── GitHub OAuth ────────────────────────────────────────────────────────────
export const getGithubAuthConfig = () =>
  api.get('/api/auth/github/config').then((r) => r.data);

export const getGithubAuthUrl = () =>
  api.get('/api/auth/github').then((r) => r.data);

export const exchangeGithubCode = (code) =>
  api.post('/api/auth/github/callback', { code }).then((r) => r.data);

export const fetchCurrentUser = () =>
  api.get('/api/auth/me').then((r) => r.data);

// ─── Participants ────────────────────────────────────────────────────────────
export const fetchParticipants = (params = {}) =>
  api.get('/api/dashboard/participants', { params }).then((r) => r.data);

export const fetchParticipant = (id) =>
  api.get(`/api/dashboard/participant/${id}`).then((r) => r.data);

// ─── Analytics ───────────────────────────────────────────────────────────────
export const fetchSuspicious = () =>
  api.get('/api/dashboard/analytics/suspicious').then((r) => r.data);

export const fetchOverview = () =>
  api.get('/api/dashboard/analytics/overview').then((r) => r.data);

// ─── GitHub ──────────────────────────────────────────────────────────────────
export const fetchGithubAnalysis = (participantId) =>
  api.get(`/api/github/participant/${participantId}/analysis`).then((r) => r.data);

export const fetchGithubCommits = (participantId) =>
  api.get(`/api/github/participant/${participantId}/commits`).then((r) => r.data);

export const fetchGithubOverview = () =>
  api.get('/api/github/overview').then((r) => r.data);

export const compareRepos = (participantId1, participantId2) =>
  api.post('/api/github/compare', { participantId1, participantId2 }).then((r) => r.data);

export const triggerGithubSync = (participantId) =>
  api.post(`/api/github/sync/${participantId}`).then((r) => r.data);

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const sendAlert = (data) =>
  api.post('/api/alerts', data).then((r) => r.data);

// ─── Export helpers ──────────────────────────────────────────────────────────
export function downloadCSV(rows, filename = 'export.csv') {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default api;

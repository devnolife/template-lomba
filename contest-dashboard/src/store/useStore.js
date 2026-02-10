import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ─── Auth ────────────────────────────────────────────
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },

  isAuthenticated: () => !!get().token,

  // ─── Theme ───────────────────────────────────────────
  darkMode: localStorage.getItem('darkMode') === 'true',

  toggleDarkMode: () => {
    const next = !get().darkMode;
    localStorage.setItem('darkMode', String(next));
    set({ darkMode: next });
  },

  // ─── Real-time alerts (in-memory ring buffer, max 100) ───
  liveAlerts: [],

  addLiveAlert: (alert) => {
    set((s) => ({
      liveAlerts: [alert, ...s.liveAlerts].slice(0, 100),
    }));
  },

  clearLiveAlerts: () => set({ liveAlerts: [] }),

  // ─── Sidebar ─────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

export default useStore;

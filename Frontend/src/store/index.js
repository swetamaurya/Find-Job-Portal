import { create } from 'zustand';

let toastId = 0;

export const useStore = create((set) => ({
  // Toasts
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // Logs
  logs: [],
  addLog: (msg) => set((s) => ({ logs: [...s.logs.slice(-200), msg] })),
  clearLogs: () => set({ logs: [] }),

  // Browser status: 'stopped' | 'running' | 'login-required' | 'logged-in'
  browserStatus: 'stopped',
  setBrowserStatus: (status) => set({ browserStatus: status }),

  // Search progress
  searchProgress: { running: false },
  setSearchProgress: (update) =>
    set((s) => ({
      searchProgress: typeof update === 'function' ? update(s.searchProgress) : { ...s.searchProgress, ...update },
    })),

  // Email progress
  emailProgress: { running: false },
  setEmailProgress: (update) =>
    set((s) => ({
      emailProgress: typeof update === 'function' ? update(s.emailProgress) : { ...s.emailProgress, ...update },
    })),

  // DM progress
  dmProgress: { running: false },
  setDMProgress: (update) =>
    set((s) => ({
      dmProgress: typeof update === 'function' ? update(s.dmProgress) : { ...s.dmProgress, ...update },
    })),

  // Naukri progress
  naukriProgress: { running: false },
  setNaukriProgress: (update) =>
    set((s) => ({
      naukriProgress: typeof update === 'function' ? update(s.naukriProgress) : { ...s.naukriProgress, ...update },
    })),
}));

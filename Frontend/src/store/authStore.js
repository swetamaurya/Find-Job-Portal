import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  // True while an admin is impersonating another user (an admin session is stashed).
  impersonating: !!localStorage.getItem('adminToken'),

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  // Merge fresh fields (e.g. isAdmin, lastLogin) into the stored user without touching the token.
  setUser: (updates) => set((state) => {
    if (!state.user) return {};
    const user = { ...state.user, ...updates };
    localStorage.setItem('user', JSON.stringify(user));
    return { user };
  }),

  // Stash the current (admin) session and switch to the target user's session.
  startImpersonation: (token, user) => {
    const state = get();
    if (!state.impersonating) {
      localStorage.setItem('adminToken', state.token);
      localStorage.setItem('adminUser', JSON.stringify(state.user));
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, impersonating: true });
  },

  // Restore the stashed admin session.
  stopImpersonation: () => {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
    if (!adminToken) return;
    localStorage.setItem('token', adminToken);
    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    set({ token: adminToken, user: adminUser, impersonating: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    set({ token: null, user: null, impersonating: false });
  },
}));

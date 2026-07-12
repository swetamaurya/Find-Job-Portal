import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Eye } from 'lucide-react';
import Sidebar from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStore } from '../../store';
import { useAuthStore } from '../../store/authStore';
import { reconnect } from '../../lib/websocket';
import api from '../../lib/api';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const impersonating = useAuthStore((s) => s.impersonating);
  const authUser = useAuthStore((s) => s.user);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  useWebSocket();

  const exitImpersonation = () => {
    stopImpersonation();
    reconnect();
    navigate('/users');
  };

  // Refresh the stored user from the server once on mount, so fields added
  // after an existing login (e.g. isAdmin) are picked up without re-logging in.
  useEffect(() => {
    api.get('/auth/me')
      .then((r) => setUser({ role: r.data.role, isAdmin: r.data.isAdmin, lastLogin: r.data.lastLogin, loginCount: r.data.loginCount }))
      .catch(() => {});
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Periodic status sync from server (catches missed WebSocket events)
  useEffect(() => {
    const syncStatus = () => {
      api.get('/dashboard/stats').then((r) => {
        const store = useStore.getState();
        store.setBrowserStatus(r.data.browserRunning ? 'running' : 'stopped');
        if (!r.data.searchRunning && store.searchProgress.running) {
          store.setSearchProgress({ running: false });
        }
        if (!r.data.emailSending && store.emailProgress.running) {
          store.setEmailProgress({ running: false });
        }
        if (!r.data.dmSending && store.dmProgress.running) {
          store.setDMProgress({ running: false });
        }
      }).catch(() => {});
    };
    const timer = setInterval(syncStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-md text-white flex items-center gap-3 px-4 py-3 md:hidden border-b border-white/10">
        <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
        <h1 className="text-sm font-bold tracking-tight">LinkedIn Dashboard</h1>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 pt-16 md:p-8 md:pt-8 overflow-auto">
        {impersonating && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-amber-800 animate-fade-in">
            <span className="text-sm flex items-center gap-2">
              <Eye size={16} className="shrink-0" /> Viewing as <strong>{authUser?.name}</strong>
              <span className="hidden sm:inline text-amber-600">({authUser?.email})</span>
            </span>
            <button onClick={exitImpersonation} className="text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 self-start sm:self-auto transition-colors">
              Return to admin
            </button>
          </div>
        )}
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStore } from '../../store';
import api from '../../lib/api';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useWebSocket();

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
      <div className="fixed top-0 left-0 right-0 z-30 bg-gray-900 text-white flex items-center gap-3 px-4 py-3 md:hidden">
        <button onClick={() => setSidebarOpen(true)} className="text-gray-300 hover:text-white">
          <Menu size={22} />
        </button>
        <h1 className="text-sm font-bold">LinkedIn Dashboard</h1>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 pt-16 md:p-8 md:pt-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

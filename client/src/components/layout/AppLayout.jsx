import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStore } from '../../store';
import api from '../../lib/api';

export default function AppLayout() {
  useWebSocket();

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
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

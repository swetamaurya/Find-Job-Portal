import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Monitor, Play, Send, Square, UserPlus } from 'lucide-react';
import api from '../lib/api';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';

export default function DashboardPage() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const browserStatus = useStore((s) => s.browserStatus);
  const searchProgress = useStore((s) => s.searchProgress);
  const emailProgress = useStore((s) => s.emailProgress);
  const dmProgress = useStore((s) => s.dmProgress);
  const addToast = useStore((s) => s.addToast);

  const fetchStats = () => {
    api.get('/dashboard/stats').then((r) => {
      setStats(r.data);
      // Sync all statuses from server (fixes stale UI)
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

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 10000);
    return () => clearInterval(timer);
  }, []);

  // Refresh stats immediately when search/email/DM completes
  useEffect(() => {
    if (!searchProgress.running && searchProgress.completed) fetchStats();
  }, [searchProgress.running]);

  useEffect(() => {
    if (!emailProgress.running && emailProgress.sent > 0) fetchStats();
  }, [emailProgress.running]);

  useEffect(() => {
    if (!dmProgress.running && (dmProgress.dmSent > 0 || dmProgress.connectSent > 0)) fetchStats();
  }, [dmProgress.running]);

  const launchBrowser = async () => {
    setLoading(true);
    try {
      await api.post('/browser/launch');
      addToast('Browser launched');
      await api.post('/browser/navigate');
      fetchStats();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to launch browser', 'error');
    }
    setLoading(false);
  };

  const runPipeline = async () => {
    try {
      await api.post('/dashboard/run-pipeline');
      addToast('Pipeline started', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Pipeline failed to start', 'error');
    }
  };

  const closeBrowser = async () => {
    try {
      await api.post('/browser/close');
      useStore.getState().setBrowserStatus('stopped');
      addToast('Browser closed');
      fetchStats();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to close browser', 'error');
    }
  };

  const sendUnsent = async () => {
    try {
      await api.post('/emails/send-all');
      addToast('Sending unsent emails...', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to send emails', 'error');
    }
  };

  const sendAll = async () => {
    try {
      const r = await api.post('/dashboard/send-all');
      addToast(r.data.message || 'Sending emails + DMs...', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to start', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Browser:</span>
          <StatusBadge status={browserStatus} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Send} label="Emails Sent" value={stats.sentEmailsCount || 0} color="green" />
        <StatCard icon={MessageSquare} label="DMs Sent" value={stats.dmSentCount || 0} color="purple" />
        <StatCard icon={UserPlus} label="Connections Sent" value={stats.connectSentCount || 0} color="blue" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={browserStatus === 'stopped' ? launchBrowser : runPipeline}
          disabled={loading || searchProgress.running || emailProgress.running}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-3 sm:px-6 sm:py-4 font-medium transition-colors text-sm sm:text-base"
        >
          {browserStatus === 'stopped' ? (
            <><Monitor size={18} /> Launch Browser</>
          ) : (
            <><Play size={18} /> Run Full Pipeline</>
          )}
        </button>
        <button
          onClick={sendAll}
          disabled={emailProgress.running || dmProgress.running}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-3 sm:px-6 sm:py-4 font-medium transition-colors text-sm sm:text-base"
        >
          <Send size={18} /> Send Emails + DMs
        </button>
        <button
          onClick={sendUnsent}
          disabled={emailProgress.running}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-3 sm:px-6 sm:py-4 font-medium transition-colors text-sm sm:text-base"
        >
          <Send size={18} /> Send Emails Only
        </button>
        <button
          onClick={closeBrowser}
          disabled={browserStatus === 'stopped' || searchProgress.running || emailProgress.running}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-3 sm:px-6 sm:py-4 font-medium transition-colors text-sm sm:text-base"
        >
          <Square size={18} /> Stop Browser
        </button>
      </div>

      <LiveLog maxHeight="400px" />
    </div>
  );
}

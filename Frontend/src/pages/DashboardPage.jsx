import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Monitor, Play, Send, Square, UserPlus, Target, Zap, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';
import { useAuthStore } from '../store/authStore';

// Validated categorical colors (dataviz palette slots aqua/violet/blue — CVD ΔE 16.6).
const CHANNELS = [
  { key: 'emails', label: 'Emails', color: '#1baf7a' },
  { key: 'dms', label: 'DMs', color: '#4a3aa7' },
  { key: 'connects', label: 'Connections', color: '#2a78d6' },
];

// Horizontal bar breakdown — each bar carries a direct value label (relief for contrast).
function OutreachBreakdown({ emails, dms, connects }) {
  const data = [
    { ...CHANNELS[0], value: emails },
    { ...CHANNELS[1], value: dms },
    { ...CHANNELS[2], value: connects },
  ];
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = emails + dms + connects;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <BarChart3 size={16} className="text-blue-600" /> Outreach Breakdown
        </h3>
        <span className="text-xs text-gray-400">{total.toLocaleString('en-IN')} total</span>
      </div>
      <div className="space-y-4">
        {data.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.label}
              </span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{d.value.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(d.value / max) * 100}%`, background: d.color, minWidth: d.value > 0 ? '0.5rem' : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const browserStatus = useStore((s) => s.browserStatus);
  const searchProgress = useStore((s) => s.searchProgress);
  const emailProgress = useStore((s) => s.emailProgress);
  const dmProgress = useStore((s) => s.dmProgress);
  const addToast = useStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

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

  const actionBtn = 'flex items-center justify-center gap-2 text-white rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-medium transition-all text-sm sm:text-base shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed';

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 p-6 sm:p-7 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-24 bottom-0 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300 mb-1">{today}</p>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Welcome back, {firstName} 👋</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">Here's how your outreach is performing.</p>
          </div>
          <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-full pl-3 pr-1.5 py-1.5 border border-white/10 self-start">
            <span className="text-sm text-slate-200">Browser</span>
            <StatusBadge status={browserStatus} />
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Send} label="Emails Sent" value={(stats.sentEmailsCount || 0).toLocaleString('en-IN')} color="green" />
        <StatCard icon={MessageSquare} label="DMs Sent" value={(stats.dmSentCount || 0).toLocaleString('en-IN')} color="purple" />
        <StatCard icon={UserPlus} label="Connections" value={(stats.connectSentCount || 0).toLocaleString('en-IN')} color="blue" />
        <StatCard icon={Target} label="Leads Found" value={((stats.totalEmails || 0) + (stats.totalProfiles || 0)).toLocaleString('en-IN')} color="orange" />
      </div>

      {/* Chart + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <OutreachBreakdown
            emails={stats.sentEmailsCount || 0}
            dms={stats.dmSentCount || 0}
            connects={stats.connectSentCount || 0}
          />
        </div>
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm mb-4">
            <Zap size={16} className="text-blue-600" /> Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={browserStatus === 'stopped' ? launchBrowser : runPipeline}
              disabled={loading || searchProgress.running || emailProgress.running}
              className={`${actionBtn} bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25 !py-3`}
            >
              {browserStatus === 'stopped' ? <><Monitor size={18} /> Launch Browser</> : <><Play size={18} /> Run Full Pipeline</>}
            </button>
            <button
              onClick={sendAll}
              disabled={emailProgress.running || dmProgress.running}
              className={`${actionBtn} bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-emerald-500/25 !py-3`}
            >
              <Send size={18} /> Send Emails + DMs
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={sendUnsent}
                disabled={emailProgress.running}
                className={`${actionBtn} bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 shadow-purple-500/25 !py-3 text-xs sm:text-sm`}
              >
                <Send size={16} /> Emails Only
              </button>
              <button
                onClick={closeBrowser}
                disabled={browserStatus === 'stopped' || searchProgress.running || emailProgress.running}
                className={`${actionBtn} bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-rose-500/25 !py-3 text-xs sm:text-sm`}
              >
                <Square size={16} /> Stop
              </button>
            </div>
          </div>
        </div>
      </div>

      <LiveLog maxHeight="400px" />
    </div>
  );
}

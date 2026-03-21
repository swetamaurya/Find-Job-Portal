import { useEffect, useState } from 'react';
import { MessageSquare, Square, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import ProgressBar from '../components/common/ProgressBar';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';



export default function DMsPage() {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({});
  const dmProgress = useStore((s) => s.dmProgress);
  const browserStatus = useStore((s) => s.browserStatus);
  const addToast = useStore((s) => s.addToast);

  const fetchProfiles = () => {
    api.get('/dms/profiles').then((r) => setProfiles(r.data.profiles || [])).catch(() => {});
  };

  useEffect(() => {
    fetchProfiles();
    api.get('/config').then((r) => setConfig(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dmProgress.running && (dmProgress.dmSent > 0 || dmProgress.connectSent > 0 || dmProgress.failed > 0)) fetchProfiles();
  }, [dmProgress.running]);

  const startDMs = async () => {
    const newProfiles = profiles.filter((p) => p.dmStatus === 'new');
    if (newProfiles.length === 0) {
      addToast('No new profiles to DM', 'error');
      return;
    }
    if (browserStatus === 'stopped') {
      addToast('Launching browser...', 'info');
      try {
        await api.post('/browser/launch');
        await api.post('/browser/navigate');
      } catch (err) {
        addToast('Failed to launch browser: ' + (err.response?.data?.error || err.message), 'error');
        return;
      }
    }
    try {
      await api.post('/dms/send', { profiles: newProfiles });
      addToast(`DM sending started for ${newProfiles.length} profiles`, 'info');
    } catch (err) {
      addToast('Failed: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const stopDMs = () => {
    api.post('/dms/stop').then(() => {
      addToast('DM sending stopped');
    }).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop DMs', 'error');
    });
  };

  const updateConfig = (updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    api.put('/config', updates).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to save config', 'error');
    });
  };

  const columns = [
    { key: 'posterName', label: 'Name', render: (v) => v || 'Unknown' },
    { key: 'headline', label: 'Headline', render: (v) => <span className="text-xs text-gray-500 line-clamp-1">{v || '-'}</span> },
    {
      key: 'profileUrl', label: 'Profile',
      render: (v) => (
        <a href={v} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
          View
        </a>
      ),
    },
    { key: 'dmStatus', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">LinkedIn DMs ({profiles.length})</h2>
        <div className="flex gap-3">
          <button onClick={fetchProfiles} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          {dmProgress.running ? (
            <button onClick={stopDMs} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <Square size={16} /> Stop
            </button>
          ) : (
            <button onClick={startDMs} disabled={profiles.filter((p) => p.dmStatus === 'new').length === 0} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <MessageSquare size={16} /> Send DMs ({profiles.filter((p) => p.dmStatus === 'new').length} new)
            </button>
          )}
        </div>
      </div>

      {dmProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Sending DMs...</h3>
            <span className="text-sm text-gray-500">
              DMs: <strong className="text-green-600">{dmProgress.dmSent || 0}</strong> |
              Connects: <strong className="text-blue-600">{dmProgress.connectSent || 0}</strong> |
              Failed: <strong className="text-red-600">{dmProgress.failed || 0}</strong>
            </span>
          </div>
          <ProgressBar
            current={(dmProgress.dmSent || 0) + (dmProgress.connectSent || 0) + (dmProgress.failed || 0)}
            total={dmProgress.total || 1}
            label={dmProgress.currentName ? `Processing: ${dmProgress.currentName}` : ''}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">DM Message</h3>
          <textarea
            value={config.dmMessage || ''}
            onChange={(e) => updateConfig({ dmMessage: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Connection Note</h3>
          <textarea
            value={config.connectionNote || ''}
            onChange={(e) => updateConfig({ connectionNote: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Max 300 characters</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex-1">
          <label className="text-sm text-gray-600">Max DMs per session</label>
          <input
            type="number"
            value={config.maxDMsPerSession || 50}
            onChange={(e) => updateConfig({ maxDMsPerSession: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex-1">
          <label className="text-sm text-gray-600">Min delay (ms)</label>
          <input
            type="number"
            value={config.dmDelayMin || 10000}
            onChange={(e) => updateConfig({ dmDelayMin: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex-1">
          <label className="text-sm text-gray-600">Max delay (ms)</label>
          <input
            type="number"
            value={config.dmDelayMax || 20000}
            onChange={(e) => updateConfig({ dmDelayMax: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <DataTable columns={columns} data={profiles} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Live Log</h3>
        <LiveLog />
      </div>
    </div>
  );
}

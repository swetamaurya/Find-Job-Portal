import { useEffect, useState } from 'react';
import { Square, RefreshCw, Send, ChevronDown, ChevronRight, Search } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/common/StatusBadge';
import ProgressBar from '../components/common/ProgressBar';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';

export default function DMsPage() {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const dmProgress = useStore((s) => s.dmProgress);
  const setDMProgress = useStore((s) => s.setDMProgress);
  const searchProgress = useStore((s) => s.searchProgress);
  const browserStatus = useStore((s) => s.browserStatus);
  const addToast = useStore((s) => s.addToast);

  const fetchProfiles = () => {
    api.get('/dms/profiles').then((r) => setProfiles(r.data.profiles || [])).catch(() => {});
  };

  useEffect(() => {
    fetchProfiles();
    api.get('/config').then((r) => setConfig(r.data)).catch(() => {});
    if (!dmProgress.running) {
      setDMProgress({ running: false });
    }
  }, []);

  useEffect(() => {
    if (!dmProgress.running && (dmProgress.dmSent > 0 || dmProgress.connectSent > 0 || dmProgress.failed > 0)) fetchProfiles();
  }, [dmProgress.running]);

  useEffect(() => {
    if (!searchProgress.running && searchProgress.completed) fetchProfiles();
  }, [searchProgress.running]);

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
    api.post('/dms/stop').then(() => addToast('DM sending stopped')).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop DMs', 'error');
    });
  };

  const updateConfig = (updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    api.put('/config', updates).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to save config', 'error');
    });
  };

  const counts = {
    total: profiles.length,
    new: profiles.filter((p) => p.dmStatus === 'new').length,
    dmSent: profiles.filter((p) => p.dmStatus === 'dm sent').length,
    connected: profiles.filter((p) => p.dmStatus === 'connected').length,
    failed: profiles.filter((p) => ['failed', 'timeout', 'no msg btn', 'no connect btn'].includes(p.dmStatus)).length,
  };

  const filteredProfiles = profiles.filter((p) => {
    if (filter === 'new' && p.dmStatus !== 'new') return false;
    if (filter === 'dm_sent' && p.dmStatus !== 'dm sent') return false;
    if (filter === 'connected' && p.dmStatus !== 'connected') return false;
    if (filter === 'failed' && !['failed', 'timeout', 'no msg btn', 'no connect btn'].includes(p.dmStatus)) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (p.posterName || '').toLowerCase().includes(q) || (p.headline || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">LinkedIn DMs</h2>
        <div className="flex gap-2">
          <button onClick={fetchProfiles} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm px-2 py-1.5">
            <RefreshCw size={14} />
          </button>
          {dmProgress.running ? (
            <button onClick={stopDMs} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 sm:px-4 py-2 text-sm font-medium">
              <Square size={16} /> Stop
            </button>
          ) : (
            <button onClick={startDMs} disabled={counts.new === 0} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-3 sm:px-4 py-2 text-sm font-medium">
              <Send size={16} /> Send DMs ({counts.new})
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {dmProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Sending DMs...</h3>
            <span className="text-xs sm:text-sm text-gray-500">
              <strong className="text-green-600">{dmProgress.dmSent || 0}</strong> DMs | <strong className="text-purple-600">{dmProgress.connectSent || 0}</strong> Connects | <strong className="text-red-500">{dmProgress.failed || 0}</strong> Failed
            </span>
          </div>
          <ProgressBar
            current={(dmProgress.dmSent || 0) + (dmProgress.connectSent || 0) + (dmProgress.failed || 0)}
            total={dmProgress.total || 1}
            label={dmProgress.currentName ? `Processing: ${dmProgress.currentName}` : ''}
          />
        </div>
      )}

      {/* Completion Summary */}
      {!dmProgress.running && (dmProgress.dmSent > 0 || dmProgress.connectSent > 0) && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 flex items-center justify-between">
          <p className="text-sm text-green-800">
            DM session complete: <strong>{dmProgress.dmSent || 0}</strong> DMs sent, <strong>{dmProgress.connectSent || 0}</strong> connections, <strong>{dmProgress.failed || 0}</strong> failed
          </p>
        </div>
      )}

      {/* DM Settings - Collapsible */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center justify-between p-4 text-left">
          <h3 className="font-semibold text-gray-800">DM Settings</h3>
          {showSettings ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        </button>
        {showSettings && (
          <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">DM Message</label>
                <textarea value={config.dmMessage || ''} onChange={(e) => updateConfig({ dmMessage: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Connection Note <span className="text-gray-400">(max 300)</span></label>
                <textarea value={config.connectionNote || ''} onChange={(e) => updateConfig({ connectionNote: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Max DMs/session</label>
                <input type="number" value={config.maxDMsPerSession || 50} onChange={(e) => updateConfig({ maxDMsPerSession: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Min delay (ms)</label>
                <input type="number" value={config.dmDelayMin || 10000} onChange={(e) => updateConfig({ dmDelayMin: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Max delay (ms)</label>
                <input type="number" value={config.dmDelayMax || 20000} onChange={(e) => updateConfig({ dmDelayMax: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search name or headline..." className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'All', count: counts.total },
            { key: 'new', label: 'New', count: counts.new },
            { key: 'dm_sent', label: 'DM Sent', count: counts.dmSent },
            { key: 'connected', label: 'Connected', count: counts.connected },
            { key: 'failed', label: 'Failed', count: counts.failed },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-3 sm:px-4 text-left text-gray-600 font-medium w-8">#</th>
              <th className="py-3 px-3 sm:px-4 text-left text-gray-600 font-medium">Profile</th>
              <th className="py-3 px-3 sm:px-4 text-left text-gray-600 font-medium hidden md:table-cell">Headline</th>
              <th className="py-3 px-3 sm:px-4 text-left text-gray-600 font-medium">Status</th>
              <th className="py-3 px-3 sm:px-4 text-left text-gray-600 font-medium w-16">Link</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-gray-400">No profiles found</td></tr>
            )}
            {filteredProfiles.map((p, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(p.posterName || '?')[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800 truncate">{p.posterName || 'Unknown'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className="text-xs text-gray-500 line-clamp-1">{p.headline || '-'}</span>
                </td>
                <td className="py-3 px-4"><StatusBadge status={p.dmStatus} /></td>
                <td className="py-3 px-4">
                  <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-medium">View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Live Log */}
      <LiveLog />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Play, Square, Plus, X, MapPin, Search, Filter, SlidersHorizontal, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import ProgressBar from '../components/common/ProgressBar';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';

const CITIES = [
  { name: 'Delhi', geoId: '102890719' },
  { name: 'Noida', geoId: '106290293' },
  { name: 'Gurugram', geoId: '115884833' },
  { name: 'Bengaluru', geoId: '105214831' },
  { name: 'Pune', geoId: '103671728' },
  { name: 'Mumbai', geoId: '106164952' },
  { name: 'Remote', geoId: 'remote' },
];

export default function SearchPage() {
  const [config, setConfig] = useState(null);
  const [newQuery, setNewQuery] = useState('');
  const [newSkip, setNewSkip] = useState('');
  const searchProgress = useStore((s) => s.searchProgress);
  const setSearchProgress = useStore((s) => s.setSearchProgress);
  const browserStatus = useStore((s) => s.browserStatus);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    api.get('/config').then((r) => setConfig(r.data)).catch(() => {});
    if (!searchProgress.running) {
      setSearchProgress({ running: false });
    }
  }, []);

  const saveConfig = (updates) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    api.put('/config', updates).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to save config', 'error');
    });
  };

  const addQuery = () => {
    if (!newQuery.trim()) return;
    const queries = [...(config.searchQueries || []), newQuery.trim()];
    saveConfig({ searchQueries: queries });
    setNewQuery('');
  };

  const removeQuery = (index) => {
    const queries = config.searchQueries.filter((_, i) => i !== index);
    saveConfig({ searchQueries: queries });
  };

  const addSkipKeyword = () => {
    if (!newSkip.trim()) return;
    const keywords = [...(config.skipKeywords || []), newSkip.trim().toLowerCase()];
    saveConfig({ skipKeywords: keywords });
    setNewSkip('');
  };

  const removeSkipKeyword = (index) => {
    const keywords = config.skipKeywords.filter((_, i) => i !== index);
    saveConfig({ skipKeywords: keywords });
  };

  const startSearch = async () => {
    try {
      if (browserStatus === 'stopped') {
        addToast('Launching browser...', 'info');
        await api.post('/browser/launch');
        await api.post('/browser/navigate');
      }
      await api.post('/search/start');
      addToast('Search started', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to start search', 'error');
    }
  };

  const stopSearch = () => {
    api.post('/search/stop').then(() => addToast('Search stopped')).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop search', 'error');
    });
  };

  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Search size={22} className="text-blue-600" /> LinkedIn Search
          </h2>
          <button onClick={() => api.get('/config').then((r) => setConfig(r.data)).catch(() => {})} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm px-2 py-1.5">
            <RefreshCw size={14} />
          </button>
        </div>
        {!searchProgress.running ? (
          <button onClick={startSearch} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm">
            <Play size={16} /> Start Search
          </button>
        ) : (
          <button onClick={stopSearch} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm">
            <Square size={16} /> Stop
          </button>
        )}
      </div>

      {/* Progress */}
      {searchProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Search Progress
            </h3>
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Running</span>
          </div>
          <ProgressBar current={searchProgress.current + 1} total={searchProgress.total} label={`Query: "${searchProgress.query || ''}"`} />
          {searchProgress.scroll && (
            <ProgressBar current={searchProgress.scroll} total={searchProgress.scrollTotal} label="Scrolling..." />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2 sm:gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-gray-500">Emails:</span>
              <strong className="text-blue-600">{searchProgress.totalEmails || 0}</strong>
              <span className="text-green-600 text-xs">{searchProgress.newEmails || 0} new</span>
              <span className="text-gray-400 text-xs">{searchProgress.alreadySentEmails || 0} sent</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-gray-500">Profiles:</span>
              <strong className="text-purple-600">{searchProgress.totalProfiles || 0}</strong>
              <span className="text-green-600 text-xs">{searchProgress.newProfiles || 0} new</span>
              <span className="text-gray-400 text-xs">{searchProgress.alreadyDMedProfiles || 0} DMed</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!searchProgress.running && searchProgress.completed && (
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4 sm:p-5">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Search Complete</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {[
              { label: 'Emails', value: searchProgress.totalEmails || 0, bg: 'bg-blue-50', text: 'text-blue-700', sub: 'text-blue-500' },
              { label: 'New Emails', value: searchProgress.newEmails || 0, bg: 'bg-green-50', text: 'text-green-700', sub: 'text-green-500' },
              { label: 'Already Sent', value: searchProgress.alreadySentEmails || 0, bg: 'bg-gray-50', text: 'text-gray-700', sub: 'text-gray-500' },
              { label: 'Posts', value: searchProgress.totalPosts || 0, bg: 'bg-orange-50', text: 'text-orange-700', sub: 'text-orange-500' },
              { label: 'Profiles', value: searchProgress.totalProfiles || 0, bg: 'bg-purple-50', text: 'text-purple-700', sub: 'text-purple-500' },
              { label: 'New Profiles', value: searchProgress.newProfiles || 0, bg: 'bg-green-50', text: 'text-green-700', sub: 'text-green-500' },
              { label: 'Already DMed', value: searchProgress.alreadyDMedProfiles || 0, bg: 'bg-gray-50', text: 'text-gray-700', sub: 'text-gray-500' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-lg p-3 text-center`}>
                <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                <p className={`text-[10px] ${s.sub} mt-0.5`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queries + Skip Keywords - 2 column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Search Queries */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Search Queries</h3>
            <span className="text-xs text-gray-400">{(config.searchQueries || []).length} queries</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newQuery} onChange={(e) => setNewQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuery()} placeholder="Add search query..." className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={addQuery} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {(config.searchQueries || []).map((q, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 group">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>{q}
                </span>
                <button onClick={() => removeQuery(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Skip Keywords */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 text-sm">Skip Keywords</h3>
            <span className="text-xs text-gray-400">{(config.skipKeywords || []).length} keywords</span>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">Posts with these keywords will be skipped</p>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newSkip} onChange={(e) => setNewSkip(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSkipKeyword()} placeholder="Add skip keyword..." className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            <button onClick={addSkipKeyword} className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-2.5 py-1.5">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
            {(config.skipKeywords || []).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 rounded-full px-2.5 py-0.5 text-xs group">
                {kw}
                <button onClick={() => removeSkipKeyword(i)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-4">
          <SlidersHorizontal size={16} className="text-gray-500" /> Search Filters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Date Filter */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date Filter</label>
            <select value={config.dateFilter} onChange={(e) => saveConfig({ dateFilter: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="past-24h">Past 24 Hours</option>
              <option value="past-week">Past Week</option>
              <option value="past-month">Past Month</option>
            </select>
          </div>

          {/* Scroll Count */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Scroll Count — <strong>{config.scrollCount}</strong></label>
            <input type="range" min="5" max="50" value={config.scrollCount} onChange={(e) => saveConfig({ scrollCount: parseInt(e.target.value) })} className="w-full mt-1" />
          </div>

          {/* Max Experience */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Max Experience — <strong>{config.maxExperience || 5} yrs</strong></label>
            <input type="range" min="1" max="15" value={config.maxExperience || 5} onChange={(e) => saveConfig({ maxExperience: parseInt(e.target.value) })} className="w-full mt-1" />
          </div>

          {/* Location Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-600 flex items-center gap-1"><MapPin size={14} className="text-blue-500" /> Location</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={config.locationFilter} onChange={(e) => {
                  const updates = { locationFilter: e.target.checked };
                  if (e.target.checked && (!config.geoIds || config.geoIds.length === 0)) {
                    updates.geoIds = CITIES.map((c) => c.geoId);
                  }
                  saveConfig(updates);
                }} className="rounded" />
                Enable
              </label>
            </div>
            {config.locationFilter && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CITIES.map((city) => {
                  const isSelected = (config.geoIds || []).includes(city.geoId);
                  return (
                    <button key={city.geoId} onClick={() => {
                      const current = config.geoIds || [];
                      const updated = isSelected ? current.filter((id) => id !== city.geoId) : [...current, city.geoId];
                      saveConfig({ geoIds: updated });
                    }} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                      {city.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Log */}
      <LiveLog />
    </div>
  );
}

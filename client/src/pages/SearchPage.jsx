import { useEffect, useState } from 'react';
import { Play, Square, Plus, X, Monitor, MapPin } from 'lucide-react';
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
];

export default function SearchPage() {
  const [config, setConfig] = useState(null);
  const [newQuery, setNewQuery] = useState('');
  const [newSkip, setNewSkip] = useState('');
  const searchProgress = useStore((s) => s.searchProgress);
  const browserStatus = useStore((s) => s.browserStatus);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    api.get('/config').then((r) => setConfig(r.data)).catch(() => {});
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
    addToast('Search query added');
  };

  const removeQuery = (index) => {
    const queries = config.searchQueries.filter((_, i) => i !== index);
    saveConfig({ searchQueries: queries });
    addToast('Search query removed');
  };

  const addSkipKeyword = () => {
    if (!newSkip.trim()) return;
    const keywords = [...(config.skipKeywords || []), newSkip.trim().toLowerCase()];
    saveConfig({ skipKeywords: keywords });
    setNewSkip('');
    addToast('Skip keyword added');
  };

  const removeSkipKeyword = (index) => {
    const keywords = config.skipKeywords.filter((_, i) => i !== index);
    saveConfig({ skipKeywords: keywords });
    addToast('Skip keyword removed');
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
    api.post('/search/stop').then(() => {
      addToast('Search stopped');
    }).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop search', 'error');
    });
  };

  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">LinkedIn Search</h2>
        <div className="flex gap-3">
          {!searchProgress.running ? (
            <button onClick={startSearch} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <Play size={16} /> Start Search
            </button>
          ) : (
            <button onClick={stopSearch} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <Square size={16} /> Stop
            </button>
          )}
        </div>
      </div>

      {searchProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Search Progress</h3>
            <span className="text-sm text-blue-600 font-medium">Running...</span>
          </div>
          <ProgressBar current={searchProgress.current + 1} total={searchProgress.total} label={`Query: "${searchProgress.query || ''}"`} />
          {searchProgress.scroll && (
            <ProgressBar current={searchProgress.scroll} total={searchProgress.scrollTotal} label="Scrolling..." />
          )}
          <div className="flex gap-6 text-sm text-gray-600">
            <span>Emails found: <strong>{searchProgress.totalEmails || 0}</strong></span>
            <span>Profiles found: <strong>{searchProgress.totalProfiles || 0}</strong></span>
          </div>
        </div>
      )}

      {!searchProgress.running && searchProgress.completed && (
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Search Results Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{searchProgress.totalEmails || 0}</p>
              <p className="text-xs text-blue-500 mt-1">Total Emails</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{searchProgress.newEmails || 0}</p>
              <p className="text-xs text-green-500 mt-1">New (unsent)</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-500">{searchProgress.alreadySentEmails || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Already Sent</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-700">{searchProgress.totalPosts || 0}</p>
              <p className="text-xs text-orange-500 mt-1">Job Posts</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{searchProgress.totalProfiles || 0}</p>
              <p className="text-xs text-purple-500 mt-1">Total Profiles</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{searchProgress.newProfiles || 0}</p>
              <p className="text-xs text-green-500 mt-1">New (not DMed)</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-500">{searchProgress.alreadyDMedProfiles || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Already DMed</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Search Queries</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuery()}
            placeholder="Add new search query..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={addQuery} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2">
            <Plus size={16} />
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-auto">
          {(config.searchQueries || []).map((q, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
              <span className="text-sm text-gray-700">{q}</span>
              <button onClick={() => removeQuery(i)} className="text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Skip Keywords</h3>
        <p className="text-xs text-gray-400 mb-4">Posts with these keywords will be skipped (e.g. java, php roles)</p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSkip}
            onChange={(e) => setNewSkip(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkipKeyword()}
            placeholder="Add skip keyword..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={addSkipKeyword} className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-2">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
          {(config.skipKeywords || []).map((kw, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs">
              {kw}
              <button onClick={() => removeSkipKeyword(i)} className="text-red-400 hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Date Filter</h3>
          <select
            value={config.dateFilter}
            onChange={(e) => saveConfig({ dateFilter: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="past-24h">Past 24 Hours</option>
            <option value="past-week">Past Week</option>
            <option value="past-month">Past Month</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Scroll Count</h3>
          <input
            type="range"
            min="5"
            max="50"
            value={config.scrollCount}
            onChange={(e) => saveConfig({ scrollCount: parseInt(e.target.value) })}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">{config.scrollCount} scrolls per query</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Location Filter</h3>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.locationFilter}
              onChange={(e) => {
                const updates = { locationFilter: e.target.checked };
                if (e.target.checked && (!config.geoIds || config.geoIds.length === 0)) {
                  updates.geoIds = CITIES.map((c) => c.geoId);
                }
                saveConfig(updates);
              }}
              className="rounded"
            />
            Enable
          </label>
        </div>
        {config.locationFilter && (
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => {
              const isSelected = (config.geoIds || []).includes(city.geoId);
              return (
                <button
                  key={city.geoId}
                  onClick={() => {
                    const current = config.geoIds || [];
                    const updated = isSelected
                      ? current.filter((id) => id !== city.geoId)
                      : [...current, city.geoId];
                    saveConfig({ geoIds: updated });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {city.name}
                </button>
              );
            })}
          </div>
        )}
        {config.locationFilter && (
          <p className="text-xs text-gray-400 mt-3">
            {(config.geoIds || []).length} city selected — search results will be filtered by these locations
          </p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Live Log</h3>
        <LiveLog />
      </div>
    </div>
  );
}

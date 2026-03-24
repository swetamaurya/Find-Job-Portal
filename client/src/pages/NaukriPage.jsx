import { useEffect, useState } from 'react';
import { Play, Square, Plus, X, Briefcase, RefreshCw, CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react';
import api from '../lib/api';
import ProgressBar from '../components/common/ProgressBar';
import LiveLog from '../components/common/LiveLog';
import { useStore } from '../store';

const LOCATIONS = [
  'Delhi', 'Noida', 'Gurugram', 'Bengaluru', 'Pune', 'Mumbai',
  'Hyderabad', 'Chennai', 'Kolkata', 'Remote',
];

const STATUS_STYLES = {
  found: 'bg-gray-100 text-gray-700',
  applied: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-yellow-100 text-yellow-700',
  external: 'bg-blue-100 text-blue-700',
};

export default function NaukriPage() {
  const [config, setConfig] = useState(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [jobs, setJobs] = useState([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({});
  const naukriProgress = useStore((s) => s.naukriProgress);
  const browserStatus = useStore((s) => s.browserStatus);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    api.get('/config').then((r) => setConfig(r.data)).catch(() => {});
    fetchJobs();
    fetchStats();
  }, []);

  useEffect(() => {
    if (!naukriProgress.running && naukriProgress.completed) {
      fetchJobs(statusFilter);
      fetchStats();
    }
  }, [naukriProgress.running]);

  const fetchJobs = (filter) => {
    const params = filter ? `?status=${filter}` : '';
    api.get(`/naukri/jobs${params}`).then((r) => {
      setJobs(r.data.jobs || []);
      setJobsTotal(r.data.total || 0);
    }).catch(() => {});
  };

  const fetchStats = () => {
    api.get('/naukri/stats').then((r) => setStats(r.data)).catch(() => {});
  };

  const saveConfig = (updates) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    api.put('/config', updates).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to save config', 'error');
    });
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const keywords = [...(config.naukriKeywords || []), newKeyword.trim()];
    saveConfig({ naukriKeywords: keywords });
    setNewKeyword('');
  };

  const removeKeyword = (index) => {
    const keywords = (config.naukriKeywords || []).filter((_, i) => i !== index);
    saveConfig({ naukriKeywords: keywords });
  };

  const toggleLocation = (loc) => {
    const current = config.naukriLocations || [];
    const updated = current.includes(loc) ? current.filter((l) => l !== loc) : [...current, loc];
    saveConfig({ naukriLocations: updated });
  };

  const startSearch = async () => {
    try {
      if (browserStatus === 'stopped') {
        addToast('Launching browser...', 'info');
        await api.post('/browser/launch');
        await api.post('/browser/navigate');
      }
      const r = await api.post('/naukri/search/start');
      addToast(r.data.message || 'Naukri search started', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to start', 'error');
    }
  };

  const stopSearch = () => {
    api.post('/naukri/search/stop').then(() => addToast('Naukri search stopped')).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop', 'error');
    });
  };

  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={22} className="text-orange-600" /> Naukri Job Search
          </h2>
          <button onClick={() => { fetchJobs(statusFilter); fetchStats(); api.get('/config').then((r) => setConfig(r.data)).catch(() => {}); }} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm px-2 py-1.5">
            <RefreshCw size={14} />
          </button>
        </div>
        {!naukriProgress.running ? (
          <button onClick={startSearch} className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm">
            <Play size={16} /> Start Search & Apply
          </button>
        ) : (
          <button onClick={stopSearch} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm">
            <Square size={16} /> Stop
          </button>
        )}
      </div>

      {/* Progress */}
      {naukriProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">
            {naukriProgress.phase === 'searching' ? 'Searching Jobs...' : 'Applying to Jobs...'}
          </h3>
          {naukriProgress.phase === 'applying' && naukriProgress.total > 0 && (
            <ProgressBar current={(naukriProgress.current || 0) + 1} total={naukriProgress.total} label={`${naukriProgress.currentJob || ''} @ ${naukriProgress.currentCompany || ''}`} />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-lg font-bold text-blue-700">{naukriProgress.totalFound || 0}</p>
              <p className="text-xs text-blue-500">Found</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-700">{naukriProgress.applied || 0}</p>
              <p className="text-xs text-green-500">Applied</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-lg font-bold text-red-700">{naukriProgress.failed || 0}</p>
              <p className="text-xs text-red-500">Failed</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2">
              <p className="text-lg font-bold text-yellow-700">{naukriProgress.skipped || 0}</p>
              <p className="text-xs text-yellow-500">Skipped</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats (when not running) */}
      {!naukriProgress.running && (stats.total > 0 || naukriProgress.completed) && (
        <div className="bg-white rounded-xl shadow-sm border border-green-100 p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xl font-bold text-blue-700">{stats.total || 0}</p>
              <p className="text-xs text-blue-500">Total Found</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xl font-bold text-green-700">{stats.applied || 0}</p>
              <p className="text-xs text-green-500">Applied</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xl font-bold text-red-700">{stats.failed || 0}</p>
              <p className="text-xs text-red-500">Failed</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xl font-bold text-yellow-700">{stats.skipped || 0}</p>
              <p className="text-xs text-yellow-500">Skipped</p>
            </div>
          </div>
        </div>
      )}

      {/* Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Keywords */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Search Keywords <span className="text-gray-400 font-normal">{(config.naukriKeywords || []).length} keywords</span></h3>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKeyword()} placeholder="e.g. Node.js Developer" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <button onClick={addKeyword} className="bg-orange-600 text-white rounded-lg px-3 py-1.5 hover:bg-orange-700"><Plus size={16} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(config.naukriKeywords || []).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 px-2.5 py-1 rounded-full text-xs font-medium">
                {kw}
                <button onClick={() => removeKeyword(i)} className="hover:text-red-600"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Locations + Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Locations</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {LOCATIONS.map((loc) => {
              const isSelected = (config.naukriLocations || []).includes(loc);
              return (
                <button key={loc} onClick={() => toggleLocation(loc)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-orange-300'}`}>
                  {loc}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Experience — <strong>{config.naukriMaxExp || 5}</strong></label>
              <input type="range" min="1" max="15" value={config.naukriMaxExp || 5} onChange={(e) => saveConfig({ naukriMaxExp: parseInt(e.target.value), naukriMinExp: 0 })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min Salary (LPA)</label>
              <input type="number" min="0" step="1" value={config.naukriMinSalary || ''} onChange={(e) => saveConfig({ naukriMinSalary: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. 5" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Max Apply / Session</label>
              <input type="number" min="1" max="100" value={config.naukriMaxApply || 20} onChange={(e) => saveConfig({ naukriMaxApply: parseInt(e.target.value) || 20 })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">Jobs <span className="text-gray-400 font-normal">{jobsTotal} total</span></h3>
          <div className="flex gap-1">
            {['', 'found', 'applied', 'failed', 'external'].map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); fetchJobs(s); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-orange-300'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {jobs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No jobs found yet. Start a search!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Job</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">Location</th>
                  <th className="pb-2 font-medium hidden md:table-cell">Exp</th>
                  <th className="pb-2 font-medium hidden md:table-cell">Salary</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-3">
                      <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                        {job.title} <ExternalLink size={12} />
                      </a>
                      <p className="text-gray-500 text-xs">{job.company}</p>
                      {job.skills && job.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {job.skills.slice(0, 5).map((s, i) => (
                            <span key={i} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-600 hidden sm:table-cell">{job.location}</td>
                    <td className="py-2.5 text-gray-600 hidden md:table-cell">{job.experience}</td>
                    <td className="py-2.5 text-gray-600 hidden md:table-cell">{job.salary}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-700'}`}>
                        {job.status === 'applied' && <CheckCircle size={12} />}
                        {job.status === 'failed' && <XCircle size={12} />}
                        {job.status === 'found' && <Clock size={12} />}
                        {job.status === 'external' && <ExternalLink size={12} />}
                        {job.status}
                      </span>
                      {job.failReason && <p className="text-gray-400 text-[10px] mt-0.5">{job.failReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Log */}
      <LiveLog />
    </div>
  );
}

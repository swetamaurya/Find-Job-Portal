import { useEffect, useState } from 'react';
import { Upload, Eye, FileText, FileUp, Save, User } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store';

export default function ResumePage() {
  const [config, setConfig] = useState(null);
  const [profile, setProfile] = useState({ role: '', experience: '', skills: '', phone: '', linkedinUrl: '', githubUrl: '', portfolioUrl: '' });
  const [credentials, setCredentials] = useState({ senderName: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    api.get('/config').then((r) => {
      setConfig(r.data);
      setCredentials({ senderName: r.data.senderName || '' });
      if (r.data.profile) {
        setProfile({
          role: r.data.profile.role || '',
          experience: r.data.profile.experience || '',
          skills: r.data.profile.skills || '',
          phone: r.data.profile.phone || '',
          linkedinUrl: r.data.profile.linkedinUrl || '',
          githubUrl: r.data.profile.githubUrl || '',
          portfolioUrl: r.data.profile.portfolioUrl || '',
        });
      }
    }).catch(() => addToast('Failed to load config', 'error'));
  }, []);

  const uploadResume = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const r = await api.post('/resume', formData);
      if (r.data.filename) setConfig((prev) => ({ ...prev, resumeFilename: r.data.filename }));

      // Auto-fill profile from extracted resume data
      if (r.data.extracted && Object.keys(r.data.extracted).length > 0) {
        const ext = r.data.extracted;
        setProfile((prev) => ({
          role: ext.role || prev.role || '',
          experience: ext.experience || prev.experience || '',
          skills: ext.skills || prev.skills || '',
          phone: ext.phone || prev.phone || '',
          linkedinUrl: ext.linkedinUrl || prev.linkedinUrl || '',
          githubUrl: ext.githubUrl || prev.githubUrl || '',
          portfolioUrl: ext.portfolioUrl || prev.portfolioUrl || '',
        }));
        if (ext.name) setCredentials((prev) => ({ ...prev, senderName: ext.name || prev.senderName }));

        // Auto-save profile to backend
        const profileData = {
          role: ext.role || '',
          experience: ext.experience || '',
          skills: ext.skills || '',
          phone: ext.phone || '',
          linkedinUrl: ext.linkedinUrl || '',
          githubUrl: ext.githubUrl || '',
          portfolioUrl: ext.portfolioUrl || '',
        };
        await api.post('/config/profile', profileData);
        if (ext.name) await api.post('/config/credentials', { senderName: ext.name });

        const filled = Object.keys(ext).filter((k) => ext[k]).join(', ');
        addToast(`Resume uploaded! Auto-filled: ${filled}`);
      } else {
        addToast(`Resume uploaded: ${r.data.filename}`);
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Resume upload failed', 'error');
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.post('/config/profile', profile);
      addToast('Profile saved successfully');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save profile', 'error');
    }
    setSavingProfile(false);
  };

  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
        <FileUp size={22} className="text-cyan-600" /> Resume
      </h2>

      {/* Resume Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileUp size={18} className="text-cyan-500" /> Upload Resume
        </h3>
        {config.resumeFilename && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <FileText size={20} className="text-red-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{config.resumeFilename}</p>
              <p className="text-xs text-gray-400">Attached to outgoing emails</p>
            </div>
            <button onClick={async () => { try { const r = await api.get('/resume', { responseType: 'blob' }); window.open(URL.createObjectURL(r.data), '_blank'); } catch { addToast('Failed to load resume', 'error'); } }} className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-medium flex-shrink-0">
              <Eye size={14} /> View
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 text-sm cursor-pointer w-fit transition-colors">
          <Upload size={16} /> {config.resumeFilename ? 'Replace Resume' : 'Upload Resume (PDF)'}
          <input type="file" accept=".pdf" onChange={uploadResume} className="hidden" />
        </label>
      </div>

      {/* Profile Info Section (auto-filled from resume) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <User size={18} className="text-purple-500" /> Profile Info
        </h3>
        <p className="text-xs text-gray-500">Auto-filled from resume. Used to generate email templates.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Role / Title</label>
            <input type="text" value={profile.role} onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))} placeholder="e.g. Senior Backend Developer" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Experience</label>
            <input type="text" value={profile.experience} onChange={(e) => setProfile((p) => ({ ...p, experience: e.target.value }))} placeholder="e.g. 3.5+ years at Acme Corp" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Skills</label>
          <input type="text" value={profile.skills} onChange={(e) => setProfile((p) => ({ ...p, skills: e.target.value }))} placeholder="e.g. Node.js, Express.js, MongoDB, AWS" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone</label>
            <input type="text" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">LinkedIn URL</label>
            <input type="text" value={profile.linkedinUrl} onChange={(e) => setProfile((p) => ({ ...p, linkedinUrl: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">GitHub URL</label>
            <input type="text" value={profile.githubUrl} onChange={(e) => setProfile((p) => ({ ...p, githubUrl: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Portfolio URL</label>
            <input type="text" value={profile.portfolioUrl} onChange={(e) => setProfile((p) => ({ ...p, portfolioUrl: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
          <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

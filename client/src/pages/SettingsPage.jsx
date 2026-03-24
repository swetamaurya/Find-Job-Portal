import { useEffect, useState } from 'react';
import { Save, TestTube, Upload, Trash2, Eye, EyeOff, User, FileText, ChevronDown, ChevronRight, Settings, KeyRound, Mail, FileUp, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store';

function Section({ title, icon, open, onToggle, children, borderColor = 'border-gray-100' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${borderColor}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">{icon}{title}</h3>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-5 space-y-4 border-t border-gray-50 pt-4">{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState(null);
  const [credentials, setCredentials] = useState({ senderEmail: '', senderName: '', appPassword: '' });
  const [profile, setProfile] = useState({ role: '', experience: '', skills: '', phone: '', linkedinUrl: '', githubUrl: '', portfolioUrl: '' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [openSection, setOpenSection] = useState('credentials');
  const addToast = useStore((s) => s.addToast);

  const toggle = (name) => setOpenSection((prev) => prev === name ? null : name);

  useEffect(() => {
    api.get('/config').then((r) => {
      setConfig(r.data);
      setCredentials({ senderEmail: r.data.senderEmail || '', senderName: r.data.senderName || '', appPassword: r.data.gmailAppPassword || '' });
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

  const saveCredentials = async () => {
    setSaving(true);
    try {
      const payload = { senderEmail: credentials.senderEmail, senderName: credentials.senderName };
      if (credentials.appPassword) payload.appPassword = credentials.appPassword;
      await api.post('/config/credentials', payload);
      const r = await api.get('/config');
      setConfig(r.data);
      setCredentials((p) => ({ ...p, senderEmail: r.data.senderEmail || p.senderEmail, senderName: r.data.senderName || p.senderName }));
      addToast('Credentials saved successfully');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save credentials', 'error');
    }
    setSaving(false);
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

  const testEmail = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/config/test-email');
      setTestResult({ success: true, message: r.data.message });
      addToast('Gmail connection successful');
    } catch (err) {
      const msg = err.response?.data?.error || 'Connection failed';
      setTestResult({ success: false, message: msg });
      addToast(msg, 'error');
    }
    setTesting(false);
  };

  const updateConfig = (updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    api.put('/config', updates)
      .catch(() => addToast('Failed to save settings', 'error'));
  };

  const uploadResume = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const r = await api.post('/config/resume', formData);
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
        setOpenSection('profile');
      } else {
        addToast(`Resume uploaded: ${r.data.filename}`);
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Resume upload failed', 'error');
    }
  };

  const loadPreview = async () => {
    try {
      const r = await api.get('/config/email-preview');
      setEmailPreview(r.data);
      setShowPreview(true);
    } catch {
      addToast('Failed to load preview', 'error');
    }
  };

  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-3 max-w-3xl">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Settings size={22} className="text-blue-600" /> Settings
      </h2>

      <Section title="Email Credentials" icon={<KeyRound size={18} className="text-blue-500" />} open={openSection === 'credentials'} onToggle={() => toggle('credentials')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sender Email</label>
            <input type="email" value={credentials.senderEmail} onChange={(e) => setCredentials((p) => ({ ...p, senderEmail: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sender Name</label>
            <input type="text" value={credentials.senderName} onChange={(e) => setCredentials((p) => ({ ...p, senderName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Gmail App Password
            {config.hasPassword && <span className="ml-2 text-green-600 font-medium text-xs bg-green-50 px-2 py-0.5 rounded-full">Saved</span>}
          </label>
          <div className="relative">
            <input type={showAppPassword ? 'text' : 'password'} value={credentials.appPassword} onChange={(e) => setCredentials((p) => ({ ...p, appPassword: e.target.value }))} placeholder="Enter Gmail App Password" autoComplete="new-password" className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => setShowAppPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showAppPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={saveCredentials} disabled={saving} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Credentials'}
          </button>
          <button onClick={testEmail} disabled={testing} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
            <TestTube size={16} /> {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        {testResult && (
          <div className={`text-sm px-3 py-2 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {testResult.message}
          </div>
        )}
      </Section>

      <Section title="Profile Info" icon={<User size={18} className="text-purple-500" />} open={openSection === 'profile'} onToggle={() => toggle('profile')}>
        <p className="text-xs text-gray-500">Used to auto-generate email templates in Structured mode.</p>
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
      </Section>

      <Section title="Email Template" icon={<FileText size={18} className="text-green-500" />} open={openSection === 'template'} onToggle={() => toggle('template')}>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="templateMode" checked={(config.emailTemplateMode || 'structured') === 'structured'} onChange={() => updateConfig({ emailTemplateMode: 'structured' })} className="text-blue-600" />
            Structured (auto from profile)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="templateMode" checked={config.emailTemplateMode === 'custom'} onChange={() => updateConfig({ emailTemplateMode: 'custom' })} className="text-blue-600" />
            Custom
          </label>
        </div>
        {config.emailTemplateMode === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">HTML Template</label>
              <textarea value={config.emailTemplateHtml || ''} onChange={(e) => updateConfig({ emailTemplateHtml: e.target.value })} rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="<div>Your HTML email template...</div>" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Plain Text Template</label>
              <textarea value={config.emailTemplateText || ''} onChange={(e) => updateConfig({ emailTemplateText: e.target.value })} rows={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="Your plain text email template..." />
            </div>
          </div>
        )}
        <button onClick={showPreview ? () => setShowPreview(false) : loadPreview} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700">
          {showPreview ? <><EyeOff size={16} /> Hide Preview</> : <><Eye size={16} /> Preview Email</>}
        </button>
        {showPreview && emailPreview && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">HTML Preview:</p>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm" dangerouslySetInnerHTML={{ __html: emailPreview.html }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Plain Text Preview:</p>
              <pre className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm whitespace-pre-wrap font-sans">{emailPreview.text}</pre>
            </div>
          </div>
        )}
      </Section>

      <Section title="Email & DM Settings" icon={<Mail size={18} className="text-orange-500" />} open={openSection === 'emaildm'} onToggle={() => toggle('emaildm')}>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email Subject</label>
          <input type="text" value={config.emailSubject || ''} onChange={(e) => updateConfig({ emailSubject: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Delay between batches (ms)</label>
            <input type="number" value={config.emailDelay || 5000} onChange={(e) => updateConfig({ emailDelay: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Batch size</label>
            <input type="number" value={config.emailBatchSize || 2} onChange={(e) => updateConfig({ emailBatchSize: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={config.sendLinkedInDMs !== false} onChange={(e) => updateConfig({ sendLinkedInDMs: e.target.checked })} className="rounded" />
            Enable LinkedIn DMs
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={config.sendConnectionRequest !== false} onChange={(e) => updateConfig({ sendConnectionRequest: e.target.checked })} className="rounded" />
            Send connection requests (fallback)
          </label>
        </div>
      </Section>

      <Section title="Resume" icon={<FileUp size={18} className="text-cyan-500" />} open={openSection === 'resume'} onToggle={() => toggle('resume')}>
        {config.resumeFilename && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <FileText size={20} className="text-red-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{config.resumeFilename}</p>
              <p className="text-xs text-gray-400">Attached to outgoing emails</p>
            </div>
            <button onClick={async () => { try { const r = await api.get('/config/resume', { responseType: 'blob' }); window.open(URL.createObjectURL(r.data), '_blank'); } catch { addToast('Failed to load resume', 'error'); } }} className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-medium flex-shrink-0">
              <Eye size={14} /> View
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 text-sm cursor-pointer w-fit transition-colors">
          <Upload size={16} /> {config.resumeFilename ? 'Replace Resume' : 'Upload Resume (PDF)'}
          <input type="file" accept=".pdf" onChange={uploadResume} className="hidden" />
        </label>
      </Section>

      <Section title="Danger Zone" icon={<AlertTriangle size={18} className="text-red-500" />} borderColor="border-red-200" open={openSection === 'danger'} onToggle={() => toggle('danger')}>
        <p className="text-sm text-gray-500">These actions cannot be undone.</p>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="flex items-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2 text-sm font-medium">
            <Trash2 size={16} /> Clear History
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">Are you sure? This will clear all sent email history.</p>
            <button onClick={() => { api.put('/config', {}).then(() => { addToast('History cleared'); setConfirmClear(false); window.location.reload(); }).catch(() => addToast('Failed to clear history', 'error')); }} className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap">Yes, Clear</button>
            <button onClick={() => setConfirmClear(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-1.5 text-sm font-medium">Cancel</button>
          </div>
        )}
      </Section>
    </div>
  );
}

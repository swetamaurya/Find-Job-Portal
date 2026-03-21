import { useEffect, useState } from 'react';
import { Save, TestTube, Upload, Trash2, Eye, EyeOff, User, FileText } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store';

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
  const addToast = useStore((s) => s.addToast);

  useEffect(() => {
    api.get('/config').then((r) => {
      setConfig(r.data);
      setCredentials({ senderEmail: r.data.senderEmail || '', senderName: r.data.senderName || '', appPassword: '' });
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
      addToast(`Resume uploaded: ${r.data.filename}`);
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
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {/* Email Credentials */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Email Credentials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sender Email</label>
            <input
              type="email"
              value={credentials.senderEmail}
              onChange={(e) => setCredentials((p) => ({ ...p, senderEmail: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sender Name</label>
            <input
              type="text"
              value={credentials.senderName}
              onChange={(e) => setCredentials((p) => ({ ...p, senderName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Gmail App Password {config.hasPassword && <span className="text-gray-400">(current: {config.passwordMasked})</span>}
          </label>
          <div className="relative">
            <input
              type={showAppPassword ? 'text' : 'password'}
              value={credentials.appPassword}
              onChange={(e) => setCredentials((p) => ({ ...p, appPassword: e.target.value }))}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowAppPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showAppPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={saveCredentials} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Credentials'}
          </button>
          <button onClick={testEmail} disabled={testing} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
            <TestTube size={16} /> {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>
        )}
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><User size={18} /> Profile Info</h3>
        <p className="text-xs text-gray-500">Used to auto-generate email templates in Structured mode.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Role / Title</label>
            <input
              type="text"
              value={profile.role}
              onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))}
              placeholder="e.g. Senior Backend Developer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Experience</label>
            <input
              type="text"
              value={profile.experience}
              onChange={(e) => setProfile((p) => ({ ...p, experience: e.target.value }))}
              placeholder="e.g. 3.5+ years at Acme Corp"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Skills</label>
          <input
            type="text"
            value={profile.skills}
            onChange={(e) => setProfile((p) => ({ ...p, skills: e.target.value }))}
            placeholder="e.g. Node.js, Express.js, MongoDB, AWS"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone</label>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">LinkedIn URL</label>
            <input
              type="text"
              value={profile.linkedinUrl}
              onChange={(e) => setProfile((p) => ({ ...p, linkedinUrl: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">GitHub URL</label>
            <input
              type="text"
              value={profile.githubUrl}
              onChange={(e) => setProfile((p) => ({ ...p, githubUrl: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Portfolio URL</label>
            <input
              type="text"
              value={profile.portfolioUrl}
              onChange={(e) => setProfile((p) => ({ ...p, portfolioUrl: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
          <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Email Template */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Email Template</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="templateMode"
              checked={(config.emailTemplateMode || 'structured') === 'structured'}
              onChange={() => updateConfig({ emailTemplateMode: 'structured' })}
              className="text-blue-600"
            />
            Structured (auto from profile)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="templateMode"
              checked={config.emailTemplateMode === 'custom'}
              onChange={() => updateConfig({ emailTemplateMode: 'custom' })}
              className="text-blue-600"
            />
            Custom
          </label>
        </div>

        {config.emailTemplateMode === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">HTML Template</label>
              <textarea
                value={config.emailTemplateHtml || ''}
                onChange={(e) => updateConfig({ emailTemplateHtml: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="<div>Your HTML email template...</div>"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Plain Text Template</label>
              <textarea
                value={config.emailTemplateText || ''}
                onChange={(e) => updateConfig({ emailTemplateText: e.target.value })}
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="Your plain text email template..."
              />
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
              <div
                className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm"
                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Plain Text Preview:</p>
              <pre className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm whitespace-pre-wrap font-sans">
                {emailPreview.text}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Email Settings</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email Subject</label>
          <input
            type="text"
            value={config.emailSubject || ''}
            onChange={(e) => updateConfig({ emailSubject: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Delay between batches (ms)</label>
            <input
              type="number"
              value={config.emailDelay || 5000}
              onChange={(e) => updateConfig({ emailDelay: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Wait time after each batch. Too low may get Gmail blocked</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Batch size</label>
            <input
              type="number"
              value={config.emailBatchSize || 2}
              onChange={(e) => updateConfig({ emailBatchSize: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Emails sent at once before waiting for delay</p>
          </div>
        </div>
      </div>

      {/* DM Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">DM Settings</h3>
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={config.sendLinkedInDMs !== false}
              onChange={(e) => updateConfig({ sendLinkedInDMs: e.target.checked })}
              className="rounded"
            />
            Enable LinkedIn DMs
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">Send direct messages to profiles found during search</p>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={config.sendConnectionRequest !== false}
              onChange={(e) => updateConfig({ sendConnectionRequest: e.target.checked })}
              className="rounded"
            />
            Send connection requests (fallback)
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">If DM fails, sends a connection request with note instead</p>
        </div>
      </div>

      {/* Resume */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Resume</h3>
        {config.resumeFilename && (
          <p className="text-sm text-gray-600">Current: <span className="font-medium">{config.resumeFilename}</span></p>
        )}
        <div className="flex gap-3">
          <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 text-sm cursor-pointer w-fit">
            <Upload size={16} /> Upload Resume (PDF)
            <input type="file" accept=".pdf" onChange={uploadResume} className="hidden" />
          </label>
          {config.resumeFilename && (
            <button
              onClick={async () => {
                try {
                  const r = await api.get('/config/resume', { responseType: 'blob' });
                  const url = URL.createObjectURL(r.data);
                  window.open(url, '_blank');
                } catch {
                  addToast('Failed to load resume', 'error');
                }
              }}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <FileText size={16} /> Preview Resume
            </button>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 space-y-4">
        <h3 className="font-semibold text-red-600">Danger Zone</h3>
        <p className="text-sm text-gray-500">These actions cannot be undone.</p>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Trash2 size={16} /> Clear History
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">Are you sure? This will clear all sent email history.</p>
            <button
              onClick={() => {
                api.put('/config', {}).then(() => { addToast('History cleared'); setConfirmClear(false); window.location.reload(); }).catch(() => addToast('Failed to clear history', 'error'));
              }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap"
            >
              Yes, Clear
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-1.5 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, UserPlus } from 'lucide-react';
import api from '../lib/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function HistoryPage() {
  const [tab, setTab] = useState('emails');
  const [sentEmails, setSentEmails] = useState([]);
  const [sentDMs, setSentDMs] = useState([]);
  const [dmCount, setDmCount] = useState(0);
  const [connCount, setConnCount] = useState(0);

  useEffect(() => {
    api.get('/history/emails').then((r) => setSentEmails(r.data.emails || [])).catch(() => {});
    api.get('/history/dms').then((r) => {
      setSentDMs(r.data.dms || []);
      setDmCount(r.data.dmCount || 0);
      setConnCount(r.data.connCount || 0);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">History</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('emails')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === 'emails' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Mail size={15} /> Sent Emails ({sentEmails.length})
        </button>
        <button
          onClick={() => setTab('dms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === 'dms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <MessageSquare size={15} /> DMs & Connections ({sentDMs.length})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'emails' && (
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {sentEmails.length === 0 && <p className="text-gray-400">No emails sent yet</p>}
            {sentEmails.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-gray-400 shrink-0">{i + 1}</span>
                  <span className="text-gray-700 truncate">{item.email}</span>
                </div>
                {item.sentAt && <span className="text-xs text-gray-400 shrink-0 ml-3">{formatDate(item.sentAt)}</span>}
              </div>
            ))}
          </div>
        )}
        {tab === 'dms' && (
          <div className="space-y-3">
            <div className="flex gap-4 mb-2">
              <div className="flex items-center gap-2 bg-green-50 rounded-lg px-4 py-2">
                <MessageSquare size={14} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">{dmCount} DMs</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-4 py-2">
                <UserPlus size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{connCount} Connections</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-500">Total: {sentDMs.length}</span>
              </div>
            </div>
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {sentDMs.length === 0 && <p className="text-gray-400">No DMs sent yet</p>}
            {sentDMs.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-gray-400 shrink-0">{i + 1}</span>
                  <a href={item.profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    {item.profileUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'dm_sent' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.status === 'dm_sent' ? 'DM' : item.status === 'connected' ? 'Connect' : item.status}
                    </span>
                  )}
                  {item.sentAt && <span className="text-xs text-gray-400">{formatDate(item.sentAt)}</span>}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

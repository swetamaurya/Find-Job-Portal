import { useEffect, useState } from 'react';
import { Mail, MessageSquare, UserPlus, Clock, RefreshCw, Search } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store';

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
  const [searchText, setSearchText] = useState('');
  const emailProgress = useStore((s) => s.emailProgress);
  const dmProgress = useStore((s) => s.dmProgress);

  const fetchHistory = () => {
    api.get('/history/emails').then((r) => setSentEmails(r.data.emails || [])).catch(() => {});
    api.get('/history/dms').then((r) => {
      setSentDMs(r.data.dms || []);
      setDmCount(r.data.dmCount || 0);
      setConnCount(r.data.connCount || 0);
    }).catch(() => {});
  };

  useEffect(() => { fetchHistory(); }, []);

  useEffect(() => {
    if (!emailProgress.running && emailProgress.sent > 0) fetchHistory();
  }, [emailProgress.running]);

  useEffect(() => {
    if (!dmProgress.running && (dmProgress.dmSent > 0 || dmProgress.connectSent > 0)) fetchHistory();
  }, [dmProgress.running]);

  const filteredEmails = sentEmails
    .filter((e) => {
      if (!searchText) return true;
      return e.email.toLowerCase().includes(searchText.toLowerCase());
    })
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  const filteredDMs = sentDMs
    .filter((d) => {
      if (!searchText) return true;
      return (d.profileUrl || '').toLowerCase().includes(searchText.toLowerCase());
    })
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock size={22} className="text-blue-600" /> History
        </h2>
        <button onClick={fetchHistory} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm px-2 py-1.5">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          <button onClick={() => { setTab('emails'); setSearchText(''); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'emails' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Mail size={14} /> Emails ({sentEmails.length})
          </button>
          <button onClick={() => { setTab('dms'); setSearchText(''); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'dms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <MessageSquare size={14} /> DMs & Connections ({sentDMs.length})
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={tab === 'emails' ? 'Search emails...' : 'Search profiles...'} className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* DM Stats */}
      {tab === 'dms' && (
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-green-50 rounded-lg px-4 py-2.5 border border-green-100">
            <MessageSquare size={14} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">{dmCount} DMs</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-100">
            <UserPlus size={14} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{connCount} Connections</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[550px] overflow-y-auto">
          {tab === 'emails' && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-gray-600 font-medium w-8">#</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-medium">Email</th>
                  <th className="py-3 px-4 text-right text-gray-600 font-medium w-28">Sent</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmails.length === 0 && (
                  <tr><td colSpan={3} className="py-10 text-center text-gray-400">No emails sent yet</td></tr>
                )}
                {filteredEmails.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2.5 px-4 text-gray-800">{item.email}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-gray-400">{formatDate(item.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'dms' && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-gray-600 font-medium w-8">#</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-medium">Profile</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-medium w-24">Type</th>
                  <th className="py-3 px-4 text-right text-gray-600 font-medium w-28">Sent</th>
                </tr>
              </thead>
              <tbody>
                {filteredDMs.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-gray-400">No DMs sent yet</td></tr>
                )}
                {filteredDMs.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2.5 px-4">
                      <a href={item.profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline text-xs truncate block max-w-[300px]">
                        {item.profileUrl?.replace('https://www.linkedin.com/in/', '') || item.profileUrl}
                      </a>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === 'dm_sent' ? 'bg-green-100 text-green-700' : item.status === 'connected' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.status === 'dm_sent' ? 'DM' : item.status === 'connected' ? 'Connect' : item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-gray-400">{formatDate(item.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

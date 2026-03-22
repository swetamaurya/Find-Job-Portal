import { useEffect, useState } from 'react';
import { Send, Square, RefreshCw, Mail, Search } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/common/StatusBadge';
import ProgressBar from '../components/common/ProgressBar';
import { useStore } from '../store';

export default function EmailsPage() {
  const [emails, setEmails] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const emailProgress = useStore((s) => s.emailProgress);
  const setEmailProgress = useStore((s) => s.setEmailProgress);
  const searchProgress = useStore((s) => s.searchProgress);
  const addToast = useStore((s) => s.addToast);

  const fetchEmails = () => {
    api.get('/emails').then((r) => setEmails(r.data.emails || [])).catch(() => {});
  };

  useEffect(() => {
    fetchEmails();
    if (!emailProgress.running) {
      setEmailProgress({ running: false });
    }
  }, []);

  useEffect(() => {
    if (!emailProgress.running && emailProgress.sent > 0) fetchEmails();
  }, [emailProgress.running]);

  useEffect(() => {
    if (!searchProgress.running && searchProgress.completed) fetchEmails();
  }, [searchProgress.running]);

  const counts = {
    total: emails.length,
    new: emails.filter((e) => e.status === 'new').length,
    sent: emails.filter((e) => e.status === 'sent').length,
  };

  const filteredEmails = emails.filter((e) => {
    if (filter !== 'all' && e.status !== filter) return false;
    if (searchText && !e.email.includes(searchText.toLowerCase())) return false;
    return true;
  });

  const sendSelected = () => {
    const selected = Array.from(selectedRows).map((i) => filteredEmails[i]);
    if (selected.length === 0) {
      addToast('No emails selected', 'error');
      return;
    }
    api.post('/emails/send', { emails: selected }).then(() => {
      addToast(`Sending ${selected.length} emails...`, 'info');
    }).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to send emails', 'error');
    });
    setSelectedRows(new Set());
  };

  const sendAll = () => {
    api.post('/emails/send-all').then(() => {
      addToast('Sending all unsent emails...', 'info');
    }).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to send emails', 'error');
    });
  };

  const stopSending = () => {
    api.post('/emails/stop').then(() => addToast('Email sending stopped')).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop sending', 'error');
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredEmails.map((_, i) => i)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail size={22} className="text-blue-600" /> Emails
        </h2>
        <div className="flex gap-2">
          <button onClick={fetchEmails} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm px-2 py-1.5">
            <RefreshCw size={14} />
          </button>
          {emailProgress.running ? (
            <button onClick={stopSending} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <Square size={16} /> Stop
            </button>
          ) : (
            <>
              <button onClick={sendSelected} disabled={selectedRows.size === 0} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
                <Send size={14} /> Send Selected ({selectedRows.size})
              </button>
              <button onClick={sendAll} disabled={counts.new === 0} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium">
                <Send size={14} /> Send All ({counts.new})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      {emailProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Sending Emails
            </h3>
            <span className="text-sm text-gray-500">
              <strong className="text-green-600">{emailProgress.sent || 0}</strong> sent | <strong className="text-red-500">{emailProgress.failed || 0}</strong> failed
            </span>
          </div>
          <ProgressBar
            current={(emailProgress.sent || 0) + (emailProgress.failed || 0)}
            total={emailProgress.total || 1}
            label={emailProgress.currentEmail ? `Sending: ${emailProgress.currentEmail}` : ''}
          />
        </div>
      )}

      {/* Completion */}
      {!emailProgress.running && emailProgress.sent > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-sm text-green-800">
            Email session complete: <strong>{emailProgress.sent}</strong> sent, <strong>{emailProgress.failed || 0}</strong> failed
          </p>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search emails..." className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All', count: counts.total },
            { key: 'new', label: 'New', count: counts.new },
            { key: 'sent', label: 'Sent', count: counts.sent },
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-left w-10">
                  <input type="checkbox" checked={selectedRows.size === filteredEmails.length && filteredEmails.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium w-8">#</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium">Email</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium hidden md:table-cell">Snippet</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium hidden md:table-cell">Poster</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmails.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">No emails found</td></tr>
              )}
              {filteredEmails.map((e, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-4">
                    <input type="checkbox" checked={selectedRows.has(i)} onChange={() => {
                      const next = new Set(selectedRows);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      setSelectedRows(next);
                    }} className="rounded" />
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-gray-800 truncate max-w-[200px]">{e.email}</td>
                  <td className="py-2.5 px-4 hidden md:table-cell">
                    <span className="text-xs text-gray-500 line-clamp-1">{e.snippet || '-'}</span>
                  </td>
                  <td className="py-2.5 px-4 hidden md:table-cell text-gray-600 text-xs">{e.posterName || '-'}</td>
                  <td className="py-2.5 px-4"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

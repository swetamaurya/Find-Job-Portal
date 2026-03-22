import { useEffect, useState } from 'react';
import { Send, Square, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import DataTable from '../components/common/DataTable';
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
    // Clear stale email progress from previous session
    if (!emailProgress.running) {
      setEmailProgress({ running: false });
    }
  }, []);

  // Refresh when email sending completes
  useEffect(() => {
    if (!emailProgress.running && emailProgress.sent > 0) fetchEmails();
  }, [emailProgress.running]);

  // Refresh when search completes (new emails found)
  useEffect(() => {
    if (!searchProgress.running && searchProgress.completed) fetchEmails();
  }, [searchProgress.running]);

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
    api.post('/emails/stop').then(() => {
      addToast('Email sending stopped');
    }).catch((err) => {
      addToast(err.response?.data?.error || 'Failed to stop sending', 'error');
    });
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'snippet', label: 'Snippet', render: (v) => <span className="text-gray-500 text-xs line-clamp-1">{v}</span> },
    { key: 'posterName', label: 'Poster', render: (v) => v || '-' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Emails ({emails.length})
          <span className="text-sm font-normal text-gray-500 ml-3">
            {emails.filter((e) => e.status === 'new').length} new | {emails.filter((e) => e.status === 'sent').length} already sent
          </span>
        </h2>
        <div className="flex gap-3">
          <button onClick={fetchEmails} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          {emailProgress.running ? (
            <button onClick={stopSending} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              <Square size={16} /> Stop Sending
            </button>
          ) : (
            <>
              <button
                onClick={sendSelected}
                disabled={selectedRows.size === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                <Send size={16} /> Send Selected ({selectedRows.size})
              </button>
              <button
                onClick={sendAll}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                <Send size={16} /> Send All Unsent
              </button>
            </>
          )}
        </div>
      </div>

      {emailProgress.running && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Sending Emails...</h3>
            <span className="text-sm text-gray-500">
              Sent: <strong className="text-green-600">{emailProgress.sent || 0}</strong> | Failed: <strong className="text-red-600">{emailProgress.failed || 0}</strong>
            </span>
          </div>
          <ProgressBar
            current={(emailProgress.sent || 0) + (emailProgress.failed || 0)}
            total={emailProgress.total || 1}
            label={emailProgress.currentEmail ? `Sending to: ${emailProgress.currentEmail}` : ''}
          />
        </div>
      )}

      <div className="flex gap-4 items-center">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search emails..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          {['all', 'new', 'sent'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${emails.length})` : `(${emails.filter((e) => e.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <DataTable columns={columns} data={filteredEmails} onRowSelect={setSelectedRows} selectedRows={selectedRows} />
      </div>
    </div>
  );
}

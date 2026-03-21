import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function HistoryPage() {
  const [tab, setTab] = useState('emails');
  const [sentEmails, setSentEmails] = useState([]);
  const [sentDMs, setSentDMs] = useState([]);

  useEffect(() => {
    api.get('/history/emails').then((r) => setSentEmails(r.data.emails || [])).catch(() => {});
    api.get('/history/dms').then((r) => setSentDMs(r.data.dms || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">History</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('emails')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'emails' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Sent Emails ({sentEmails.length})
        </button>
        <button
          onClick={() => setTab('dms')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'dms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Sent DMs ({sentDMs.length})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'emails' && (
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {sentEmails.length === 0 && <p className="text-gray-400">No emails sent yet</p>}
            {sentEmails.map((email, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg text-sm">
                <span className="w-8 text-gray-400">{i + 1}</span>
                <span className="text-gray-700">{email}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'dms' && (
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {sentDMs.length === 0 && <p className="text-gray-400">No DMs sent yet</p>}
            {sentDMs.map((url, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg text-sm">
                <span className="w-8 text-gray-400">{i + 1}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                  {url}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

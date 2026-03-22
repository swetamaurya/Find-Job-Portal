import { useEffect, useState } from 'react';
import { Users, Mail, MessageSquare, UserPlus, RefreshCw, Briefcase } from 'lucide-react';
import api from '../lib/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    setLoading(true);
    api.get('/users')
      .then((r) => setUsers(r.data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={22} className="text-blue-600" /> Users
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{users.length} registered</span>
          <button onClick={fetchUsers} className="text-gray-500 hover:text-gray-900">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      {users.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-left text-gray-600 font-medium">User</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium hidden md:table-cell">Role</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">Emails</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">DMs</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">Connects</th>
                <th className="py-3 px-4 text-right text-gray-600 font-medium hidden md:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {(u.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    {u.profile?.role ? (
                      <span className="text-xs text-gray-600 flex items-center gap-1 truncate max-w-[200px]">
                        <Briefcase size={12} className="text-gray-400 flex-shrink-0" /> {u.profile.role}
                      </span>
                    ) : <span className="text-xs text-gray-300">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Mail size={13} className="text-green-500" />
                      <span className="font-semibold text-gray-800">{u.emailsSent || 0}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare size={13} className="text-purple-500" />
                      <span className="font-semibold text-gray-800">{u.dmsSent || 0}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <UserPlus size={13} className="text-blue-500" />
                      <span className="font-semibold text-gray-800">{u.connectsSent || 0}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right hidden md:table-cell">
                    <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {users.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center">
          <Users size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No users found</p>
        </div>
      )}
    </div>
  );
}

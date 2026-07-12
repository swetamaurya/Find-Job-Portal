import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Mail, MessageSquare, UserPlus, RefreshCw, Briefcase, Clock, ShieldCheck, LogIn, X, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store';
import { useAuthStore } from '../store/authStore';
import { reconnect } from '../lib/websocket';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatLastLogin(dateStr) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return `Today, ${time}`;
  if (diff < 172800000) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  return `${date}, ${time}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-2.5 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </td>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-3 w-12 bg-gray-100 rounded animate-pulse mx-auto" />
        </td>
      ))}
    </tr>
  );
}

// Modal for both creating a new user and editing an existing one.
function UserModal({ editUser, onClose, onSaved }) {
  const addToast = useStore((s) => s.addToast);
  const isEdit = !!editUser;
  const [form, setForm] = useState({
    name: editUser?.name || '',
    email: editUser?.email || '',
    password: '',
    role: editUser?.role || 'user',
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editUser._id}`, payload);
        addToast(`User "${form.name}" updated`);
      } else {
        await api.post('/users', form);
        addToast(`User "${form.name}" created`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {isEdit ? <><Pencil size={17} className="text-blue-600" /> Edit User</> : <><UserPlus size={18} className="text-blue-600" /> Add User</>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{isEdit ? 'New Password' : 'Password'}</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required={!isEdit} minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
              <option value="user">User — sees only their own data</option>
              <option value="admin">Admin — sees all users &amp; can manage users</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium">{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ user, onClose, onDeleted }) {
  const addToast = useStore((s) => s.addToast);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${user._id}`);
      addToast(`User "${user.name}" deleted`);
      onDeleted();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete user', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Trash2 size={18} className="text-red-500" /> Delete User
        </h3>
        <p className="text-sm text-gray-600 mb-5">
          Delete <strong>{user.name}</strong> ({user.email}) and all of their data? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={doDelete} disabled={deleting} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium">{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const addToast = useStore((s) => s.addToast);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalUser, setModalUser] = useState(undefined); // undefined = closed, null = create, obj = edit
  const [deleteUser, setDeleteUser] = useState(null);

  const fetchUsers = () => {
    setLoading(true);
    api.get('/users')
      .then((r) => { setUsers(r.data.users || []); setIsAdmin(!!r.data.isAdmin); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const impersonate = async (u) => {
    try {
      const r = await api.post(`/users/${u._id}/impersonate`);
      startImpersonation(r.data.token, r.data.user);
      reconnect();
      addToast(`Now viewing as ${u.name}`, 'info');
      navigate('/');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to log in as user', 'error');
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const onlineCount = users.filter((u) => u.online).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={22} className="text-blue-600" /> {isAdmin ? 'Users' : 'My Account'}
        </h2>
        <div className="flex items-center gap-3">
          {isAdmin && onlineCount > 0 && (
            <span className="text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> {onlineCount} online
            </span>
          )}
          {isAdmin && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{users.length} registered</span>
          )}
          <button onClick={fetchUsers} className="text-gray-500 hover:text-gray-900" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button onClick={() => setModalUser(null)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-3 py-1.5">
              <UserPlus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {!isAdmin && !loading && (
        <p className="text-sm text-gray-500">You can view your own account details. Only administrators can see and manage all users.</p>
      )}

      {/* Users Table */}
      {(loading || users.length > 0) && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-left text-gray-600 font-medium">User</th>
                <th className="py-3 px-4 text-left text-gray-600 font-medium hidden sm:table-cell">Role</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">Emails</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">DMs</th>
                <th className="py-3 px-4 text-center text-gray-600 font-medium">Connects</th>
                <th className="py-3 px-4 text-right text-gray-600 font-medium hidden lg:table-cell">Last Login</th>
                <th className="py-3 px-4 text-right text-gray-600 font-medium hidden md:table-cell">Joined</th>
                {isAdmin && <th className="py-3 px-4 text-right text-gray-600 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
              {users.map((u) => (
                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                          {(u.name || '?')[0].toUpperCase()}
                        </div>
                        {u.online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" title="Online" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={12} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        User
                      </span>
                    )}
                    {u.profile?.role && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-1 truncate max-w-[180px]">
                        <Briefcase size={11} className="flex-shrink-0" /> {u.profile.role}
                      </span>
                    )}
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
                  <td className="py-3 px-4 text-right hidden lg:table-cell">
                    <span className={`text-xs flex items-center justify-end gap-1 ${u.online ? 'text-green-600 font-medium' : u.lastLogin ? 'text-gray-500' : 'text-gray-300'}`}>
                      <Clock size={12} className="flex-shrink-0" /> {u.online ? 'Online now' : formatLastLogin(u.lastLogin)}
                    </span>
                    {u.loginCount > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                        <LogIn size={10} /> {u.loginCount} login{u.loginCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right hidden md:table-cell">
                    <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u._id !== currentUser?.id && (
                          <button onClick={() => impersonate(u)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title={`Login as ${u.name}`}>
                            <LogIn size={14} />
                          </button>
                        )}
                        <button onClick={() => setModalUser(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit user">
                          <Pencil size={14} />
                        </button>
                        {u._id !== currentUser?.id && (
                          <button onClick={() => setDeleteUser(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete user">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 py-16 text-center">
          <Users size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No users found</p>
        </div>
      )}

      {modalUser !== undefined && (
        <UserModal editUser={modalUser} onClose={() => setModalUser(undefined)} onSaved={fetchUsers} />
      )}
      {deleteUser && (
        <DeleteConfirm user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={fetchUsers} />
      )}
    </div>
  );
}

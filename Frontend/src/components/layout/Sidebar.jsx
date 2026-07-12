import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Mail, MessageSquare, History, Settings, Users, LogOut, X, Briefcase, FileUp, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store';
import { disconnect } from '../../lib/websocket';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/emails', icon: Mail, label: 'Emails' },
  { to: '/dms', icon: MessageSquare, label: 'DMs' },
  { to: '/naukri', icon: Briefcase, label: 'Naukri' },
  { to: '/resume', icon: FileUp, label: 'Resume' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useStore((s) => s.addToast);
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
    disconnect();
    logout();
    addToast('Logged out successfully', 'success');
    navigate('/login');
    setShowConfirm(false);
  };

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-white min-h-screen flex-col flex-shrink-0 border-r border-white/5">
        <SidebarContent user={user} onLogout={() => setShowConfirm(true)} />
      </aside>

      {/* Mobile sidebar - slide drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col transform transition-transform duration-200 ease-in-out md:hidden shadow-2xl',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <Brand />
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <SidebarContent user={user} onLogout={() => setShowConfirm(true)} hideHeader />
      </aside>

      {/* Logout confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to logout?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
        <Zap size={18} className="text-white" fill="currentColor" />
      </div>
      <div className="leading-tight">
        <h1 className="text-base font-bold tracking-tight">LinkedIn Dash</h1>
        <p className="text-[11px] text-slate-400">Job Automation</p>
      </div>
    </div>
  );
}

function SidebarContent({ user, onLogout, hideHeader }) {
  return (
    <>
      {!hideHeader && (
        <div className="px-5 py-5 border-b border-white/10">
          <Brand />
        </div>
      )}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx(
                  'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white transition-opacity',
                  isActive ? 'opacity-90' : 'opacity-0'
                )} />
                <Icon size={18} className={clsx('shrink-0 transition-transform group-hover:scale-110', isActive && 'drop-shadow')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(user.name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} title="Logout" className="text-slate-400 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

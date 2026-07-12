import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { reconnect } from '../lib/websocket';
import api from '../lib/api';

function getPasswordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Weak', color: 'bg-red-500', text: 'text-red-600', width: 'w-1/4' },
    { label: 'Fair', color: 'bg-orange-500', text: 'text-orange-600', width: 'w-2/4' },
    { label: 'Good', color: 'bg-yellow-500', text: 'text-yellow-600', width: 'w-3/4' },
    { label: 'Strong', color: 'bg-green-500', text: 'text-green-600', width: 'w-full' },
  ];
  return levels[Math.min(score, 5) <= 1 ? 0 : Math.min(score, 5) === 2 ? 1 : Math.min(score, 5) === 3 ? 2 : 3];
}

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const strength = tab === 'signup' ? getPasswordStrength(password) : null;

  // Open signup is only available while no account exists yet (first admin).
  useEffect(() => {
    api.get('/auth/signup-status')
      .then((r) => setSignupOpen(!!r.data.open))
      .catch(() => setSignupOpen(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/signup';
      const payload = tab === 'login' ? { email, password } : { name, email, password };
      const res = await api.post(endpoint, payload);
      setAuth(res.data.token, res.data.user);
      reconnect();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
            <Zap size={26} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">LinkedIn Dashboard</h1>
          <p className="text-slate-400 mt-2">Job Automation Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 border border-white/10 p-6">
          {signupOpen ? (
            <div className="flex mb-6 border-b border-gray-200">
              <button
                onClick={() => { setTab('login'); setError(''); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'login' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setTab('signup'); setError(''); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'signup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Login</h2>
              <p className="text-xs text-gray-400 mt-1">New accounts can only be created by an administrator.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {strength && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`} />
                  </div>
                  <span className={`text-xs font-medium ${strength.text}`}>{strength.label}</span>
                </div>
              )}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait...' : tab === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

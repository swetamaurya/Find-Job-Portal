import { clsx } from 'clsx';

const statusColors = {
  new: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  done: 'bg-gray-100 text-gray-500 ring-gray-500/20',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  running: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  stopped: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  'logged-in': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'login-required': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  'dm sent': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'connected': 'bg-purple-50 text-purple-700 ring-purple-600/20',
  'not relevant': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  'premium required': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'no msg btn': 'bg-gray-100 text-gray-500 ring-gray-500/20',
  'no connect btn': 'bg-gray-100 text-gray-500 ring-gray-500/20',
  'timeout': 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

const dotColors = {
  running: 'bg-amber-500 animate-pulse',
  'logged-in': 'bg-emerald-500',
  'login-required': 'bg-orange-500 animate-pulse',
  stopped: 'bg-gray-400',
};

export default function StatusBadge({ status }) {
  const dot = dotColors[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset', statusColors[status] || 'bg-gray-100 text-gray-700 ring-gray-500/20')}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />}
      {status}
    </span>
  );
}

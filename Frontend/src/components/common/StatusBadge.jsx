import { clsx } from 'clsx';

const statusColors = {
  new: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  done: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
  running: 'bg-yellow-100 text-yellow-700',
  stopped: 'bg-gray-100 text-gray-700',
  'logged-in': 'bg-green-100 text-green-700',
  'login-required': 'bg-orange-100 text-orange-700',
  'dm sent': 'bg-green-100 text-green-700',
  'connected': 'bg-purple-100 text-purple-700',
  'not relevant': 'bg-orange-100 text-orange-700',
  'premium required': 'bg-yellow-100 text-yellow-700',
  'no msg btn': 'bg-gray-100 text-gray-500',
  'no connect btn': 'bg-gray-100 text-gray-500',
  'timeout': 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[status] || 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  );
}

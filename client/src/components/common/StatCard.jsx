import { clsx } from 'clsx';

export default function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className={clsx('p-2 sm:p-3 rounded-lg', colorMap[color])}>
          <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

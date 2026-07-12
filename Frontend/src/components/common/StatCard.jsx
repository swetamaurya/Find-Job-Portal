import { clsx } from 'clsx';

export default function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
    green: 'from-emerald-500 to-green-600 shadow-emerald-500/25',
    purple: 'from-purple-500 to-fuchsia-600 shadow-purple-500/25',
    orange: 'from-orange-500 to-amber-600 shadow-orange-500/25',
    red: 'from-rose-500 to-red-600 shadow-rose-500/25',
  };

  return (
    <div className="group bg-white rounded-2xl shadow-card hover:shadow-card-hover border border-gray-100 p-3 sm:p-5 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className={clsx('p-2 sm:p-3 rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-105', colorMap[color])}>
          <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

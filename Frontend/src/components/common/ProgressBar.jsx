export default function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm text-gray-600 truncate pr-2">{label}</p>
          <span className="text-xs font-semibold text-blue-600 tabular-nums shrink-0">{pct}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200/70 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1 tabular-nums">{current}/{total}</p>
    </div>
  );
}

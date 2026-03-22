import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { useStore } from '../../store';

export default function LiveLog({ maxHeight = '300px' }) {
  const logs = useStore((s) => s.logs);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-800">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700">
        <Terminal size={13} className="text-green-400" />
        <span className="text-xs text-gray-400 font-medium">Live Log</span>
        <span className="text-[10px] text-gray-600 ml-auto">{logs.length} entries</span>
      </div>
      <div ref={containerRef} className="p-4 font-mono text-xs text-green-400 overflow-auto" style={{ maxHeight }}>
        {logs.length === 0 && <p className="text-gray-600">Waiting for activity...</p>}
        {logs.map((log, i) => (
          <div key={i} className="leading-5 flex gap-3">
            <span className="text-gray-600 select-none w-6 text-right flex-shrink-0">{i + 1}</span>
            <span>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

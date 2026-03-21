import { useEffect, useRef } from 'react';
import { useStore } from '../../store';

export default function LiveLog({ maxHeight = '300px' }) {
  const logs = useStore((s) => s.logs);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-auto" style={{ maxHeight }}>
      {logs.length === 0 && <p className="text-gray-500">No logs yet...</p>}
      {logs.map((log, i) => (
        <div key={i} className="leading-5">{log}</div>
      ))}
    </div>
  );
}

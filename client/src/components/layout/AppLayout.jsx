import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function AppLayout() {
  useWebSocket();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

let ws = null;
let listeners = [];
let reconnectTimer = null;

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const token = localStorage.getItem('token');
  if (!token) return; // Don't connect without auth

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((fn) => fn(data));
    } catch {}
  };

  ws.onclose = () => {
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
  ws = null;
}

function reconnect() {
  disconnect();
  connect();
}

// Auto-connect if token exists
if (localStorage.getItem('token')) {
  connect();
}

export { subscribe, disconnect, reconnect, connect };

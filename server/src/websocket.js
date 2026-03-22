const { WebSocketServer } = require('ws');
const { verifyToken } = require('./middleware/auth');

let wss = null;
// Per-user logs
const userLogs = new Map();
const MAX_LOGS = 500;

function getUserLogs(userId) {
  const key = userId ? userId.toString() : 'global';
  if (!userLogs.has(key)) userLogs.set(key, []);
  return userLogs.get(key);
}

function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    // Extract token from query string
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = verifyToken(token);
        ws.userId = decoded.userId;
      }
    } catch {}

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send recent logs to new client
    if (ws.userId) {
      const logs = getUserLogs(ws.userId);
      ws.send(JSON.stringify({ type: 'init', logs: logs.slice(-50) }));
    }
  });

  // Ping all clients every 30s to keep connections alive
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
}

function broadcast(type, data, userId) {
  const logEntry = { type, ...data, timestamp: Date.now() };
  const msg = JSON.stringify(logEntry);

  if (userId) {
    const logs = getUserLogs(userId);
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  }

  if (!wss) return;
  const targetUserId = userId ? userId.toString() : null;
  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    // Send to matching user, or to all if no userId specified
    if (!targetUserId || (client.userId && client.userId.toString() === targetUserId)) {
      client.send(msg);
    }
  });
}

function log(message, userId) {
  const time = new Date().toLocaleTimeString('en-IN');
  const formatted = `[${time}] ${message}`;
  console.log(formatted);
  broadcast('log', { message: formatted }, userId);
}

module.exports = { init, broadcast, log };

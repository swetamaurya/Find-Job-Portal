const http = require('http');
const app = require('./app');
const { init } = require('./websocket');
const { PORT } = require('./config');
const { connectDB } = require('./db');

async function start() {
  await connectDB();

  const server = http.createServer(app);
  init(server);

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  server.listen(PORT, host, () => {
    console.log(`Server running on http://${host}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

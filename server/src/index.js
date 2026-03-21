const http = require('http');
const app = require('./app');
const { init } = require('./websocket');
const { PORT } = require('./config');
const { connectDB } = require('./db');

async function start() {
  await connectDB();

  const server = http.createServer(app);
  init(server);

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

const { auth } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const configRoutes = require('./routes/config.routes');
const searchRoutes = require('./routes/search.routes');
const emailsRoutes = require('./routes/emails.routes');
const dmsRoutes = require('./routes/dms.routes');

const SentEmail = require('./models/SentEmail');
const SentDM = require('./models/SentDM');
const User = require('./models/User');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    // Allow localhost dev + any vercel/render deployment
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3001',
    ];
    const isAllowed = allowed.includes(origin)
      || origin.endsWith('.vercel.app')
      || origin.endsWith('.onrender.com');
    callback(null, isAllowed);
  },
  credentials: true,
}));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/config', auth, configRoutes);
app.use('/api', auth, searchRoutes);
app.use('/api/emails', auth, emailsRoutes);
app.use('/api/dms', auth, dmsRoutes);

// Users list (protected)
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, gmailAppPassword: 0 }).sort({ createdAt: -1 }).lean();
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const emailsSent = await SentEmail.countDocuments({ userId: u._id });
      const dmsSent = await SentDM.countDocuments({ userId: u._id, status: 'dm_sent' });
      const connectsSent = await SentDM.countDocuments({ userId: u._id, status: 'connected' });
      return { ...u, emailsSent, dmsSent, connectsSent };
    }));
    res.json({ users: usersWithStats, total: usersWithStats.length });
  } catch {
    res.json({ users: [], total: 0 });
  }
});

// History routes (protected)
app.get('/api/history/emails', auth, async (req, res) => {
  try {
    const docs = await SentEmail.find({ userId: req.userId }).sort({ sentAt: -1 }).lean();
    const emails = docs.map((d) => ({ email: d.email, sentAt: d.sentAt }));
    res.json({ emails, total: emails.length });
  } catch {
    res.json({ emails: [], total: 0 });
  }
});

app.get('/api/history/dms', auth, async (req, res) => {
  try {
    const docs = await SentDM.find({ userId: req.userId }).sort({ sentAt: -1 }).lean();
    const dms = docs.map((d) => ({ profileUrl: d.profileUrl, status: d.status, sentAt: d.sentAt }));
    const dmCount = dms.filter((d) => d.status === 'dm_sent').length;
    const connCount = dms.filter((d) => d.status === 'connected').length;
    res.json({ dms, total: dms.length, dmCount, connCount });
  } catch {
    res.json({ dms: [], total: 0, dmCount: 0, connCount: 0 });
  }
});

// Serve React frontend in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

module.exports = app;

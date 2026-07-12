const express = require('express');
const cors = require('cors');
const path = require('path');

const { auth, generateToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const configRoutes = require('./routes/config.routes');
const searchRoutes = require('./routes/search.routes');
const emailsRoutes = require('./routes/emails.routes');
const dmsRoutes = require('./routes/dms.routes');
const naukriRoutes = require('./routes/naukri.routes');
const resumeRoutes = require('./routes/resume.routes');

const SentEmail = require('./models/SentEmail');
const SentDM = require('./models/SentDM');
const User = require('./models/User');
const ExtractedResult = require('./models/ExtractedResult');
const NaukriJob = require('./models/NaukriJob');
const websocket = require('./websocket');

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
app.use('/api/naukri', auth, naukriRoutes);
app.use('/api/resume', auth, resumeRoutes);

// Users list — admin sees everyone, a normal user sees only their own record.
app.get('/api/users', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role').lean();
    const isAdmin = !!requester && requester.role === 'admin';
    const onlineIds = websocket.getOnlineUserIds();
    const filter = isAdmin ? {} : { _id: req.userId };
    const users = await User.find(filter, { password: 0, gmailAppPassword: 0 }).sort({ createdAt: -1 }).lean();
    const userIds = users.map((u) => u._id);

    // One aggregation per collection instead of 3 counts × N users (removes the N+1 round-trips).
    const [emailAgg, dmAgg] = await Promise.all([
      SentEmail.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', c: { $sum: 1 } } },
      ]),
      SentDM.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: {
          _id: '$userId',
          dm: { $sum: { $cond: [{ $eq: ['$status', 'dm_sent'] }, 1, 0] } },
          conn: { $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] } },
        } },
      ]),
    ]);
    const emailMap = new Map(emailAgg.map((e) => [String(e._id), e.c]));
    const dmMap = new Map(dmAgg.map((d) => [String(d._id), d]));

    const usersWithStats = users.map((u) => {
      const id = String(u._id);
      const dm = dmMap.get(id) || {};
      return {
        ...u,
        role: u.role || 'user',
        isAdmin: u.role === 'admin',
        emailsSent: emailMap.get(id) || 0,
        dmsSent: dm.dm || 0,
        connectsSent: dm.conn || 0,
        online: onlineIds.has(id),
      };
    });
    res.json({ users: usersWithStats, total: usersWithStats.length, isAdmin });
  } catch (err) {
    res.status(500).json({ error: err.message, users: [], total: 0, isAdmin: false });
  }
});

// Create a new user — admin only.
app.post('/api/users', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role').lean();
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can create users' });
    }
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const newRole = role === 'admin' ? 'admin' : 'user';
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = await User.create({ name, email: email.toLowerCase(), password, role: newRole });
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing user — admin only.
app.patch('/api/users/:id', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role').lean();
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can update users' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { name, email, password, role } = req.body;
    if (name !== undefined && name.trim()) target.name = name.trim();
    if (email !== undefined && email.trim()) {
      const dupe = await User.findOne({ email: email.toLowerCase(), _id: { $ne: target._id } });
      if (dupe) return res.status(409).json({ error: 'Email already in use' });
      target.email = email.toLowerCase();
    }
    if (role !== undefined && ['admin', 'user'].includes(role)) {
      // Don't let the last admin be demoted (would lock everyone out of user management).
      if (target.role === 'admin' && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the last remaining admin' });
      }
      target.role = role;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      target.password = password; // pre-save hook re-hashes it
    }
    await target.save();
    res.json({ user: { id: target._id, name: target.name, email: target.email, role: target.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Impersonate a user — admin only. Returns a login token for the target user
// so an admin can view the app exactly as that user sees it.
app.post('/api/users/:id/impersonate', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role').lean();
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can impersonate users' });
    }
    const target = await User.findById(req.params.id).lean();
    if (!target) return res.status(404).json({ error: 'User not found' });

    const token = generateToken(target._id);
    res.json({
      token,
      user: {
        id: target._id,
        name: target.name,
        email: target.email,
        role: target.role || 'user',
        isAdmin: target.role === 'admin',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a user and all of their data — admin only.
app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role').lean();
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can delete users' });
    }
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last remaining admin' });
    }
    const uid = target._id;
    await Promise.all([
      User.deleteOne({ _id: uid }),
      SentEmail.deleteMany({ userId: uid }),
      SentDM.deleteMany({ userId: uid }),
      ExtractedResult.deleteMany({ userId: uid }),
      NaukriJob.deleteMany({ userId: uid }),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Clear all history for the logged-in user (sent emails, DMs, extracted results, Naukri jobs)
app.post('/api/history/clear', auth, async (req, res) => {
  try {
    const [emails, dms, extracted, naukri] = await Promise.all([
      SentEmail.deleteMany({ userId: req.userId }),
      SentDM.deleteMany({ userId: req.userId }),
      ExtractedResult.deleteMany({ userId: req.userId }),
      NaukriJob.deleteMany({ userId: req.userId }),
    ]);
    res.json({
      success: true,
      deleted: {
        emails: emails.deletedCount || 0,
        dms: dms.deletedCount || 0,
        extractedResults: extracted.deletedCount || 0,
        naukriJobs: naukri.deletedCount || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React frontend in production
const clientDist = path.join(__dirname, '../../Frontend/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

module.exports = app;

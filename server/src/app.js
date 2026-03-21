const express = require('express');
const cors = require('cors');

const { auth } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const configRoutes = require('./routes/config.routes');
const searchRoutes = require('./routes/search.routes');
const emailsRoutes = require('./routes/emails.routes');
const dmsRoutes = require('./routes/dms.routes');

const SentEmail = require('./models/SentEmail');
const SentDM = require('./models/SentDM');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/config', auth, configRoutes);
app.use('/api', auth, searchRoutes);
app.use('/api/emails', auth, emailsRoutes);
app.use('/api/dms', auth, dmsRoutes);

// History routes (protected)
app.get('/api/history/emails', auth, async (req, res) => {
  try {
    const docs = await SentEmail.find({ userId: req.userId }).lean();
    const emails = docs.map((d) => d.email);
    res.json({ emails, total: emails.length });
  } catch {
    res.json({ emails: [], total: 0 });
  }
});

app.get('/api/history/dms', auth, async (req, res) => {
  try {
    const docs = await SentDM.find({ userId: req.userId }).lean();
    const dms = docs.map((d) => d.profileUrl);
    res.json({ dms, total: dms.length });
  } catch {
    res.json({ dms: [], total: 0 });
  }
});

module.exports = app;

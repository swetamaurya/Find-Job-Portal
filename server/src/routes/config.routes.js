const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const configService = require('../services/config.service');
const emailService = require('../services/email-send.service');
const config = require('../config');
const User = require('../models/User');

const router = Router();

const upload = multer({
  dest: config.UPLOADS_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
});

router.get('/', async (req, res) => {
  try {
    const cfg = await configService.getConfig(req.userId);
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updated = await configService.updateConfig(req.userId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credentials', async (req, res) => {
  try {
    await configService.updateCredentials(req.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/profile', async (req, res) => {
  try {
    await configService.updateProfile(req.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-email', async (req, res) => {
  try {
    const result = await emailService.testConnection(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const userDir = path.join(config.UPLOADS_DIR, req.userId.toString());
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  // Delete old resume if exists
  const user = await User.findById(req.userId);
  if (user?.resumeFilename) {
    const oldPath = path.join(userDir, user.resumeFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const newPath = path.join(userDir, req.file.originalname);
  fs.renameSync(req.file.path, newPath);

  await User.findByIdAndUpdate(req.userId, { resumeFilename: req.file.originalname });

  res.json({ success: true, filename: req.file.originalname });
});

// Serve resume PDF for preview
router.get('/resume', async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.resumeFilename) return res.status(404).json({ error: 'No resume uploaded' });

    const filePath = path.join(config.UPLOADS_DIR, req.userId.toString(), user.resumeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Resume file not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${user.resumeFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview email template
router.get('/email-preview', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).lean();
    const cfg = await config.loadConfig(req.userId);
    const html = emailService.generateEmailHTML(user, cfg);
    const text = emailService.generateEmailText(user, cfg);
    res.json({ html, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

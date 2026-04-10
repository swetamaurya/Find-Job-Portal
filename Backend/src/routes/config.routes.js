const { Router } = require('express');
const configService = require('../services/config.service');
const emailService = require('../services/email-send.service');
const config = require('../config');

const router = Router();

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

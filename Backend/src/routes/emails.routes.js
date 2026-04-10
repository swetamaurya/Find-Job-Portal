const { Router } = require('express');
const emailService = require('../services/email-send.service');
const ExtractedResult = require('../models/ExtractedResult');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await ExtractedResult.findOne({ userId: req.userId }).lean();
    if (!data) return res.json({ emails: [], totalPosts: 0 });
    const sentEmails = await emailService.loadSentEmails(req.userId);
    const emails = (data.emails || []).map((e) => ({
      ...e,
      status: sentEmails.has(e.email.toLowerCase()) ? 'sent' : 'new',
    }));
    res.json({ emails, totalPosts: data.totalPosts || 0, extractedAt: data.extractedAt });
  } catch {
    res.json({ emails: [], totalPosts: 0 });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || !emails.length) return res.status(400).json({ error: 'No emails provided' });
    res.json({ success: true, message: 'Sending started' });
    emailService.sendEmails(req.userId, emails).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-all', async (req, res) => {
  try {
    const data = await ExtractedResult.findOne({ userId: req.userId }).lean();
    const emails = (data && data.emails) || [];
    if (!emails.length) return res.status(400).json({ error: 'No emails to send' });
    res.json({ success: true, message: 'Sending all emails' });
    emailService.sendEmails(req.userId, emails).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', (req, res) => {
  emailService.stopSending(req.userId);
  res.json({ success: true });
});

module.exports = router;

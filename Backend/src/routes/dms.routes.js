const { Router } = require('express');
const dmService = require('../services/dm.service');
const ExtractedResult = require('../models/ExtractedResult');

const router = Router();

const statusLabels = {
  dm_sent: 'dm sent',
  connected: 'connected',
  not_relevant_profile: 'not relevant',
  premium_required: 'premium required',
  no_message_button: 'no msg btn',
  no_connect_button: 'no connect btn',
  compose_box_not_found: 'failed',
  modal_send_failed: 'failed',
  page_detached: 'failed',
  '30s timeout': 'timeout',
  failed: 'failed',
};

router.get('/profiles', async (req, res) => {
  try {
    const data = await ExtractedResult.findOne({ userId: req.userId }).lean();
    if (!data) return res.json({ profiles: [] });
    const sentDMs = await dmService.loadSentDMs(req.userId);

    const profileMap = new Map();
    (data.profiles || []).forEach((p) => {
      if (!profileMap.has(p.profileUrl)) profileMap.set(p.profileUrl, p);
    });
    (data.emails || []).forEach((e) => {
      if (e.profileUrl && !profileMap.has(e.profileUrl)) {
        profileMap.set(e.profileUrl, { profileUrl: e.profileUrl, posterName: e.posterName || '', email: e.email });
      }
    });

    const profiles = Array.from(profileMap.values()).map((p) => {
      const rawStatus = sentDMs[p.profileUrl.toLowerCase()];
      return {
        ...p,
        dmStatus: rawStatus ? (statusLabels[rawStatus] || rawStatus) : 'new',
      };
    });

    res.json({ profiles });
  } catch {
    res.json({ profiles: [] });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { profiles } = req.body;
    const { log } = require('../websocket');
    if (!profiles || !profiles.length) {
      const data = await ExtractedResult.findOne({ userId: req.userId }).lean();
      if (!data) return res.status(400).json({ error: 'No extracted data' });
      const allProfiles = [...(data.profiles || [])];
      (data.emails || []).forEach((e) => {
        if (e.profileUrl && !allProfiles.some((p) => p.profileUrl === e.profileUrl)) {
          allProfiles.push({ profileUrl: e.profileUrl, posterName: e.posterName || '' });
        }
      });
      res.json({ success: true, message: `DM sending started for ${allProfiles.length} profiles` });
      dmService.sendAllDMs(req.userId, allProfiles).catch((e) => log(`DM error: ${e.message}`, req.userId));
    } else {
      res.json({ success: true, message: `DM sending started for ${profiles.length} profiles` });
      dmService.sendAllDMs(req.userId, profiles).catch((e) => log(`DM error: ${e.message}`, req.userId));
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', (req, res) => {
  dmService.stopDMs(req.userId);
  res.json({ success: true });
});

module.exports = router;

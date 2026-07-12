const mongoose = require('mongoose');
const config = require('../config');
const ExtractedResult = require('../models/ExtractedResult');
const SentEmail = require('../models/SentEmail');
const SentDM = require('../models/SentDM');
const User = require('../models/User');

function generateDefaultDM(user) {
  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role ? p.role.split('|')[0].trim() : 'Developer';
  const experience = p.experience || '';

  let msg = `Hi, came across your post and the role caught my attention.\n`;
  msg += `I'm ${name}, a ${role}`;
  if (experience) msg += ` with ${experience}`;
  msg += `.\n`;
  msg += `Let me know if the role is still open — happy to share my resume and discuss further.`;
  return msg;
}

function generateDefaultConnectionNote(user) {
  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role ? p.role.split('|')[0].trim() : 'Developer';
  // LinkedIn connection note max 300 chars
  let note = `Hi, I'm ${name}, a ${role}. Came across your post about the role. Let me know if it's still open — happy to discuss anytime!`;
  return note.substring(0, 300);
}

async function getConfig(userId) {
  const [cfg, user] = await Promise.all([
    config.loadConfig(userId),
    User.findById(userId).select('-password').lean(),
  ]);

  if (!cfg.dmMessage && user) cfg.dmMessage = generateDefaultDM(user);
  if (!cfg.connectionNote && user) cfg.connectionNote = generateDefaultConnectionNote(user);

  return {
    ...cfg,
    senderEmail: user?.senderEmail || '',
    senderName: user?.senderName || '',
    hasPassword: !!user?.gmailAppPassword,
    gmailAppPassword: user?.gmailAppPassword || '',
    profile: user?.profile || {},
    resumeFilename: user?.resumeFilename || '',
  };
}

async function updateConfig(userId, updates) {
  const cfg = await config.loadConfig(userId);
  Object.assign(cfg, updates);
  await config.saveConfig(userId, cfg);
  return cfg;
}

async function updateCredentials(userId, { senderEmail, senderName, appPassword }) {
  const update = {};
  if (senderEmail) update.senderEmail = senderEmail;
  if (senderName) update.senderName = senderName;
  if (appPassword) update.gmailAppPassword = appPassword;
  await User.findByIdAndUpdate(userId, update);
  return { success: true };
}

async function updateProfile(userId, profileData) {
  await User.findByIdAndUpdate(userId, { profile: profileData });
  return { success: true };
}

async function getStats(userId) {
  let totalEmails = 0;
  let totalProfiles = 0;
  let sentEmailsCount = 0;
  let dmSentCount = 0;
  let connectSentCount = 0;

  try {
    // Run the independent reads in parallel. For ExtractedResult we compute the array
    // sizes server-side with $size so we never transfer the (potentially huge) emails/
    // profiles arrays just to count them — this was the main cause of the slow /stats.
    const uid = new mongoose.Types.ObjectId(userId); // aggregate() doesn't auto-cast like find()/count()
    const [sizeAgg, sent, dmSent, connectSent] = await Promise.all([
      ExtractedResult.aggregate([
        { $match: { userId: uid } },
        { $project: {
          totalEmails: { $size: { $ifNull: ['$emails', []] } },
          totalProfiles: { $size: { $ifNull: ['$profiles', []] } },
        } },
      ]),
      SentEmail.countDocuments({ userId }),
      SentDM.countDocuments({ userId, status: 'dm_sent' }),
      SentDM.countDocuments({ userId, status: 'connected' }),
    ]);
    if (sizeAgg && sizeAgg[0]) {
      totalEmails = sizeAgg[0].totalEmails || 0;
      totalProfiles = sizeAgg[0].totalProfiles || 0;
    }
    sentEmailsCount = sent;
    dmSentCount = dmSent;
    connectSentCount = connectSent;
  } catch {}

  return { totalEmails, totalProfiles, sentEmailsCount, dmSentCount, connectSentCount };
}

module.exports = { getConfig, updateConfig, updateCredentials, updateProfile, getStats };

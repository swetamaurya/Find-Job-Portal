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

  let msg = `Hey, saw your post about the opening — seems like a great fit for my background.\n`;
  msg += `I'm ${name}, ${role}`;
  if (experience) msg += ` with ${experience}`;
  msg += `. Currently open to new roles and can join immediately.\n`;
  msg += `I've attached my resume to my profile. Let me know if you'd be open to a quick chat!`;
  return msg;
}

function generateDefaultConnectionNote(user) {
  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role ? p.role.split('|')[0].trim() : 'Developer';
  // LinkedIn connection note max 300 chars
  let note = `Hi, I'm ${name}, a ${role}. Saw your post and interested in connecting regarding the opportunity. Open to discuss anytime!`;
  return note.substring(0, 300);
}

async function getConfig(userId) {
  const cfg = await config.loadConfig(userId);
  const user = await User.findById(userId).select('-password').lean();

  if (!cfg.dmMessage && user) cfg.dmMessage = generateDefaultDM(user);
  if (!cfg.connectionNote && user) cfg.connectionNote = generateDefaultConnectionNote(user);

  return {
    ...cfg,
    senderEmail: user?.senderEmail || '',
    senderName: user?.senderName || '',
    hasPassword: !!user?.gmailAppPassword,
    passwordMasked: user?.gmailAppPassword ? '****' + user.gmailAppPassword.slice(-4) : '',
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
  let sentDMsCount = 0;

  try {
    const data = await ExtractedResult.findOne({ userId }).lean();
    if (data) {
      totalEmails = (data.emails || []).length;
      totalProfiles = (data.profiles || []).length;
    }
  } catch {}

  try {
    sentEmailsCount = await SentEmail.countDocuments({ userId });
  } catch {}

  try {
    sentDMsCount = await SentDM.countDocuments({ userId });
  } catch {}

  return { totalEmails, totalProfiles, sentEmailsCount, sentDMsCount };
}

module.exports = { getConfig, updateConfig, updateCredentials, updateProfile, getStats };

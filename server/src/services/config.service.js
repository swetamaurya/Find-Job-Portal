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
  msg += `Would love to learn more about the position. Happy to share my resume if it's a fit!`;
  return msg;
}

function generateDefaultConnectionNote(user) {
  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role ? p.role.split('|')[0].trim() : 'Developer';
  // LinkedIn connection note max 300 chars
  let note = `Hi, I'm ${name}, a ${role}. Came across your post and would love to connect regarding the role. Happy to chat anytime!`;
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

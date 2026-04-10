const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Config = require('./models/Config');

async function loadConfig(userId) {
  try {
    const doc = await Config.findOne({ userId }).lean();
    if (doc) {
      const { _id, __v, ...cfg } = doc;
      return cfg;
    }
    return {};
  } catch {
    return {};
  }
}

async function saveConfig(userId, config) {
  await Config.findOneAndUpdate({ userId }, { ...config, userId }, { upsert: true });
}

module.exports = {
  PORT: process.env.PORT || 3001,
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'linkedin-dashboard-secret-key-2026',
  UPLOADS_DIR: path.join(__dirname, '../uploads'),
  CHROME_PROFILE_DIR: path.join(__dirname, '../../chrome-temp-profile'),
  loadConfig,
  saveConfig,
};

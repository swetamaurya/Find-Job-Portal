const mongoose = require('mongoose');

const sentDMSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profileUrl: { type: String, required: true, lowercase: true },
  status: { type: String, default: 'dm_sent' },
  sentAt: { type: Date, default: Date.now },
}, { collection: 'sentdms' });

sentDMSchema.index({ userId: 1, profileUrl: 1 }, { unique: true });

module.exports = mongoose.model('SentDM', sentDMSchema);

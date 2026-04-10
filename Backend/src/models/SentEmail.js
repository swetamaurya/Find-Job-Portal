const mongoose = require('mongoose');

const sentEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true },
  sentAt: { type: Date, default: Date.now },
}, { collection: 'sentemails' });

sentEmailSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('SentEmail', sentEmailSchema);

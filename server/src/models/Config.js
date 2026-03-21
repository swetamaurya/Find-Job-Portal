const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  searchQueries: [String],
  skipKeywords: [String],
  dateFilter: String,
  locationFilter: Boolean,
  geoIds: [String],
  scrollCount: Number,
  extractComments: Boolean,
  searchGoogle: Boolean,
  emailDelay: Number,
  emailBatchSize: Number,
  emailSubject: String,
  sendLinkedInDMs: Boolean,
  dmDelayMin: Number,
  dmDelayMax: Number,
  maxDMsPerSession: Number,
  sendConnectionRequest: Boolean,
  dmMessage: String,
  connectionNote: String,
  emailTemplateMode: { type: String, enum: ['structured', 'custom'], default: 'structured' },
  emailTemplateHtml: { type: String, default: '' },
  emailTemplateText: { type: String, default: '' },
}, { strict: false, collection: 'configs' });

configSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Config', configSchema);

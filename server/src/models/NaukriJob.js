const mongoose = require('mongoose');

const naukriJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: String, required: true },
  title: { type: String, default: '' },
  company: { type: String, default: '' },
  experience: { type: String, default: '' },
  salary: { type: String, default: '' },
  location: { type: String, default: '' },
  skills: [String],
  jobUrl: { type: String, default: '' },
  applyType: { type: String, enum: ['naukri', 'external', 'unknown'], default: 'unknown' },
  status: {
    type: String,
    enum: ['found', 'applying', 'applied', 'skipped', 'failed', 'external'],
    default: 'found',
  },
  failReason: { type: String, default: '' },
  foundAt: { type: Date, default: Date.now },
  appliedAt: { type: Date },
}, { collection: 'naukrijobs' });

naukriJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
naukriJobSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('NaukriJob', naukriJobSchema);

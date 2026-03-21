const mongoose = require('mongoose');

const extractedResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  extractedAt: Date,
  totalEmails: Number,
  totalPosts: Number,
  emails: [{
    email: String,
    source: String,
    snippet: String,
    profileUrl: String,
    posterName: String,
  }],
  profiles: [{
    profileUrl: String,
    posterName: String,
    headline: String,
  }],
  jobPosts: [{
    name: String,
    snippet: String,
    emails: [String],
    searchQuery: String,
  }],
}, { strict: false, collection: 'extractedresults' });

extractedResultSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('ExtractedResult', extractedResultSchema);

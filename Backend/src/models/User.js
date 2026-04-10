const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  senderEmail: { type: String, default: '' },
  senderName: { type: String, default: '' },
  gmailAppPassword: { type: String, default: '' },
  profile: {
    role: { type: String, default: '' },
    experience: { type: String, default: '' },
    skills: { type: String, default: '' },
    phone: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
  },
  resumeFilename: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'users' });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

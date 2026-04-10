/**
 * Migration script: Tags all existing data with a default "Tarun Kumar" user.
 * Run once: node Backend/src/scripts/migrate-to-multiuser.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const mongoose = require('mongoose');

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');

  await mongoose.connect(MONGODB_URI, { dbName: 'StoreEmailJob' });
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const Config = require('../models/Config');
  const ExtractedResult = require('../models/ExtractedResult');
  const SentEmail = require('../models/SentEmail');
  const SentDM = require('../models/SentDM');

  // 1. Create default user (or find existing)
  let user = await User.findOne({ email: 'tarunmehto71@gmail.com' });
  if (!user) {
    user = await User.create({
      name: 'Tarun Kumar',
      email: 'tarunmehto71@gmail.com',
      password: 'tarun123456', // Will be bcrypt hashed by pre-save hook
      senderEmail: process.env.SENDER_EMAIL || 'tarunmehto71@gmail.com',
      senderName: process.env.SENDER_NAME || 'Tarun Kumar',
      gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
      profile: {
        role: 'Senior Backend Developer',
        experience: '3.5+ years at Quikkred',
        skills: 'Node.js, Express.js, MongoDB, AWS (ECS, ElastiCache, Redis)',
        phone: '+91-7678104587',
        linkedinUrl: 'https://linkedin.com/in/thetarunkumar',
        githubUrl: 'https://github.com/IAmtarunKumar',
        portfolioUrl: 'https://tarun-kumar-141120.vercel.app/',
      },
    });
    console.log(`Created user: ${user.name} (${user._id})`);
  } else {
    // Update credentials from .env if not already set
    if (!user.senderEmail) user.senderEmail = process.env.SENDER_EMAIL || '';
    if (!user.senderName) user.senderName = process.env.SENDER_NAME || '';
    if (!user.gmailAppPassword) user.gmailAppPassword = process.env.GMAIL_APP_PASSWORD || '';
    await user.save();
    console.log(`Found existing user: ${user.name} (${user._id})`);
  }

  const userId = user._id;

  // 2. Drop old unique indexes that conflict with new compound indexes
  try {
    await mongoose.connection.collection('sentemails').dropIndex('email_1');
    console.log('Dropped old SentEmail email_1 index');
  } catch (e) {
    if (!e.message.includes('not found')) console.log('SentEmail index drop:', e.message);
  }

  try {
    await mongoose.connection.collection('sentdms').dropIndex('profileUrl_1');
    console.log('Dropped old SentDM profileUrl_1 index');
  } catch (e) {
    if (!e.message.includes('not found')) console.log('SentDM index drop:', e.message);
  }

  // 3. Tag Config documents
  const configResult = await Config.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Config: tagged ${configResult.modifiedCount} docs`);

  // 4. Tag ExtractedResult documents
  const extractResult = await ExtractedResult.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`ExtractedResult: tagged ${extractResult.modifiedCount} docs`);

  // 5. Tag SentEmail documents
  const emailResult = await SentEmail.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`SentEmail: tagged ${emailResult.modifiedCount} docs`);

  // 6. Tag SentDM documents
  const dmResult = await SentDM.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`SentDM: tagged ${dmResult.modifiedCount} docs`);

  // 7. Move resume to user-specific directory
  const uploadsDir = path.join(__dirname, '../../uploads');
  const userUploadsDir = path.join(uploadsDir, userId.toString());

  if (fs.existsSync(uploadsDir)) {
    const pdfs = fs.readdirSync(uploadsDir).filter((f) => f.endsWith('.pdf'));
    if (pdfs.length > 0) {
      if (!fs.existsSync(userUploadsDir)) fs.mkdirSync(userUploadsDir, { recursive: true });
      pdfs.forEach((pdf) => {
        const src = path.join(uploadsDir, pdf);
        const dest = path.join(userUploadsDir, pdf);
        if (!fs.existsSync(dest)) {
          fs.renameSync(src, dest);
          console.log(`Moved resume: ${pdf} → uploads/${userId}/${pdf}`);
        }
      });
      // Update user's resumeFilename
      await User.findByIdAndUpdate(userId, { resumeFilename: pdfs[0] });
    }
  }

  // 8. Sync indexes
  await Config.syncIndexes();
  await ExtractedResult.syncIndexes();
  await SentEmail.syncIndexes();
  await SentDM.syncIndexes();
  console.log('Indexes synced');

  // Print summary
  const emailCount = await SentEmail.countDocuments({ userId });
  const dmCount = await SentDM.countDocuments({ userId });
  console.log(`\nMigration complete!`);
  console.log(`User: ${user.name} (${user.email})`);
  console.log(`Emails tagged: ${emailCount}`);
  console.log(`DMs tagged: ${dmCount}`);
  console.log(`\nDefault login: tarunmehto71@gmail.com / tarun123456`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

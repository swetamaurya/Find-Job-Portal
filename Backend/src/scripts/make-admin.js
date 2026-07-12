/**
 * Promote an existing user to the "admin" role (or demote to "user").
 *
 * Usage:
 *   node Backend/src/scripts/make-admin.js <email>            # make admin
 *   node Backend/src/scripts/make-admin.js <email> user       # demote to user
 *
 * Needed once after adding roles, so an existing account can become the admin
 * (open signup is closed once any user exists).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const mongoose = require('mongoose');

async function run() {
  const email = process.argv[2];
  const role = (process.argv[3] || 'admin').toLowerCase();
  if (!email) {
    console.error('Usage: node Backend/src/scripts/make-admin.js <email> [admin|user]');
    process.exit(1);
  }
  if (!['admin', 'user'].includes(role)) {
    console.error(`Invalid role "${role}". Use "admin" or "user".`);
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set in .env');
  await mongoose.connect(MONGODB_URI, { dbName: 'StoreEmailJob' });
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email: ${email}`);
  } else {
    console.log(`✅ ${user.email} is now "${user.role}"`);
  }

  await mongoose.disconnect();
  process.exit(user ? 0 : 1);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

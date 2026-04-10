const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }
  await mongoose.connect(MONGODB_URI, { dbName: 'StoreEmailJob' });
  console.log('Connected to MongoDB Atlas');
}

module.exports = { connectDB };

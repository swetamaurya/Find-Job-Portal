const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://tarunmehto71_db_user:jobemail@storeemailjob.y7diiv1.mongodb.net/StoreEmailJob?appName=StoreEmailJob';
const TARUN_ID = '69bf06f975041d25fabd2bb2';
const SWETA_ID = '69bf088c8441db87e67cad9a';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // Get Sweta's user info
  const sweta = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(SWETA_ID) });
  console.log('Sweta user:', sweta ? sweta.name : 'NOT FOUND');
  console.log('Sweta sender email:', sweta ? sweta.senderEmail : 'N/A');

  // Get Tarun's extracted emails
  const tarunExtracted = await db.collection('extractedresults').findOne({ userId: new mongoose.Types.ObjectId(TARUN_ID) });
  const tarunEmails = (tarunExtracted && tarunExtracted.emails) || [];
  console.log('\nTarun extracted emails:', tarunEmails.length);

  // Get Sweta's already sent emails
  const swetaSent = await db.collection('sentemails').find({ userId: new mongoose.Types.ObjectId(SWETA_ID) }).toArray();
  const swetaSentSet = new Set(swetaSent.map(s => s.email.toLowerCase()));
  console.log('Sweta already sent:', swetaSentSet.size);

  // Get Tarun's already sent emails
  const tarunSent = await db.collection('sentemails').find({ userId: new mongoose.Types.ObjectId(TARUN_ID) }).toArray();
  const tarunSentSet = new Set(tarunSent.map(s => s.email.toLowerCase()));
  console.log('Tarun already sent:', tarunSentSet.size);

  // Emails from Tarun's extracted that Sweta hasn't sent
  const unsent = tarunEmails.filter(e => !swetaSentSet.has(e.email.toLowerCase()));
  console.log('\nEmails Sweta has NOT sent (from Tarun extracted):', unsent.length);

  // Also check: emails Tarun sent but Sweta hasn't
  const tarunSentButSwetaHasnt = [...tarunSentSet].filter(e => !swetaSentSet.has(e));
  console.log('Emails Tarun sent but Sweta has not:', tarunSentButSwetaHasnt.length);

  // Show first 10 unsent
  console.log('\nFirst 10 unsent emails:');
  unsent.slice(0, 10).forEach(e => console.log(' -', e.email));

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

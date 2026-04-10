const mongoose = require('mongoose');
const URI = 'mongodb+srv://tarunmehto71_db_user:jobemail@storeemailjob.y7diiv1.mongodb.net/StoreEmailJob?appName=StoreEmailJob';
const SWETA_ID = '69bf088c8441db87e67cad9a';

(async () => {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const newPass = 'jiajpwdlyswmugmi';
  const r = await db.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(SWETA_ID) },
    { $set: { gmailAppPassword: newPass } }
  );
  console.log('Modified:', r.modifiedCount);
  const u = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(SWETA_ID) });
  console.log('Sender:', u.senderEmail);
  console.log('Password length:', (u.gmailAppPassword || '').length);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });

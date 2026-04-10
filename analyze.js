const data = require('/Users/swetamaurya/Downloads/StoreEmailJob.sentemails.json');
const userIds = {};
data.forEach(d => {
  const uid = d.userId && d.userId.$oid ? d.userId.$oid : 'unknown';
  if (!userIds[uid]) userIds[uid] = { count: 0, emails: [] };
  userIds[uid].count++;
  userIds[uid].emails.push(d.email);
});
console.log('Total records:', data.length);
Object.entries(userIds).forEach(([uid, info]) => {
  console.log(`\nUser: ${uid} → ${info.count} sent emails`);
});

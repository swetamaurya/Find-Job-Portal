const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'swetamaurya2019@gmail.com',
    pass: 'jiajpwdlyswmugmi', // without spaces
  },
});

transporter.verify().then(() => {
  console.log('AUTH OK (no spaces)');
  process.exit(0);
}).catch(err => {
  console.log('FAILED (no spaces):', err.message);

  // Try with spaces
  const t2 = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'swetamaurya2019@gmail.com',
      pass: 'jiaj pwdl yswm ugmi',
    },
  });
  return t2.verify().then(() => {
    console.log('AUTH OK (with spaces)');
    process.exit(0);
  }).catch(e => {
    console.log('FAILED (with spaces):', e.message);
    process.exit(1);
  });
});

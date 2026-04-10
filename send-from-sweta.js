const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://tarunmehto71_db_user:jobemail@storeemailjob.y7diiv1.mongodb.net/StoreEmailJob?appName=StoreEmailJob';
const TARUN_ID = '69bf06f975041d25fabd2bb2';
const SWETA_ID = '69bf088c8441db87e67cad9a';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // Get Sweta's user info
  const sweta = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(SWETA_ID) });
  if (!sweta) { console.log('Sweta user not found!'); process.exit(1); }

  console.log('Sending from:', sweta.senderName, '<' + sweta.senderEmail + '>');

  // Get Sweta's config
  const swetaConfig = await db.collection('configs').findOne({ userId: new mongoose.Types.ObjectId(SWETA_ID) });

  // Get all emails Tarun has sent
  const tarunSent = await db.collection('sentemails').find({ userId: new mongoose.Types.ObjectId(TARUN_ID) }).toArray();
  const tarunEmails = tarunSent.map(s => s.email.toLowerCase());
  console.log('Tarun total sent:', tarunEmails.length);

  // Get Sweta's already sent
  const swetaSent = await db.collection('sentemails').find({ userId: new mongoose.Types.ObjectId(SWETA_ID) }).toArray();
  const swetaSentSet = new Set(swetaSent.map(s => s.email.toLowerCase()));
  console.log('Sweta already sent:', swetaSentSet.size);

  // Filter unsent
  const unsent = [...new Set(tarunEmails)].filter(e => !swetaSentSet.has(e));
  console.log('To send:', unsent.length);

  if (unsent.length === 0) {
    console.log('Nothing to send!');
    await mongoose.disconnect();
    return;
  }

  // Setup transporter with Sweta's credentials
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    auth: { user: sweta.senderEmail, pass: sweta.gmailAppPassword },
  });

  await transporter.verify();
  console.log('Gmail connection verified!\n');

  // Load Sweta's resume
  const uploadsDir = path.join(__dirname, 'Backend', 'uploads', SWETA_ID);
  let resumeBuffer = null;
  let resumeFilename = null;
  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
      if (files.length > 0) {
        resumeBuffer = fs.readFileSync(path.join(uploadsDir, files[0]));
        resumeFilename = files[0];
        console.log('Resume attached:', resumeFilename);
      }
    }
  } catch (err) {
    console.log('No resume found, sending without attachment');
  }

  // Generate email content using Sweta's profile
  const p = sweta.profile || {};
  const name = sweta.senderName || sweta.name || '';
  const role = p.role || 'Developer';
  const experience = p.experience || '';
  const skills = p.skills || '';
  const phone = p.phone || '';
  const email = sweta.senderEmail || sweta.email || '';
  const linkedin = p.linkedinUrl || '';
  const github = p.githubUrl || '';
  const portfolio = p.portfolioUrl || '';

  let expLine = '';
  if (experience) {
    expLine = `<p>I'm <strong>${name}</strong> — I've been working as a <strong>${role}</strong> for <strong>${experience}</strong>${skills ? `, primarily with ${skills}` : ''}.</p>`;
  } else {
    expLine = `<p>I'm <strong>${name}</strong>, a <strong>${role}</strong>${skills ? ` skilled in ${skills}` : ''}.</p>`;
  }

  let linksHtml = '';
  const linkParts = [];
  if (linkedin) linkParts.push(`<a href="${linkedin}" style="color:#0A66C2;">LinkedIn</a>`);
  if (github) linkParts.push(`<a href="${github}" style="color:#0A66C2;">GitHub</a>`);
  if (portfolio) linkParts.push(`<a href="${portfolio}" style="color:#0A66C2;">Portfolio</a>`);
  if (linkParts.length > 0) {
    linksHtml = `<p style="margin-top:8px;font-size:13px;color:#555;">${linkParts.join(' &nbsp;|&nbsp; ')}</p>`;
  }

  const htmlBody = `<div style="font-family:Arial,sans-serif;color:#222;font-size:14px;line-height:1.7;max-width:600px;padding:20px 30px;text-align:left;">
<p>Hi,</p>
<p>I saw your recent post on LinkedIn about the role and thought I'd reach out directly.</p>
${expLine}
<p>I'm currently exploring new opportunities and can <strong>join immediately</strong> — happy to discuss full-time, part-time, or freelance arrangements.</p>
<p>I've attached my resume. Let me know if this seems like a good fit.</p>
<p style="margin-top:20px;">Thanks,<br>
<strong>${name}</strong>${phone ? `<br>${phone}` : ''}${email ? `<br><a href="mailto:${email}">${email}</a>` : ''}</p>
${linksHtml}
</div>`;

  const textBody = `Hi,

I saw your recent post on LinkedIn about the role and thought I'd reach out directly.

${experience ? `I'm ${name} — I've been working as a ${role} for ${experience}${skills ? `, primarily with ${skills}` : ''}.` : `I'm ${name}, a ${role}${skills ? ` skilled in ${skills}` : ''}.`}

I'm currently exploring new opportunities and can join immediately — happy to discuss full-time, part-time, or freelance arrangements.

I've attached my resume. Let me know if this seems like a good fit.

Thanks,
${name}
${phone ? phone + '\n' : ''}${email}`;

  const subject = (swetaConfig && swetaConfig.emailSubject) || `${role} | Immediate Joiner`;

  console.log('\nSubject:', subject);
  console.log('Starting to send', unsent.length, 'emails...\n');

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < unsent.length; i++) {
    const recipient = unsent[i];

    const mailOptions = {
      from: `"${sweta.senderName || sweta.name}" <${sweta.senderEmail}>`,
      replyTo: sweta.senderEmail,
      to: recipient,
      subject: subject,
      text: textBody,
      html: htmlBody,
    };

    if (resumeBuffer) {
      mailOptions.attachments = [{ filename: resumeFilename, content: resumeBuffer }];
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        sent++;
        console.log(`[${i + 1}/${unsent.length}] SENT: ${recipient} (total sent: ${sent})`);

        // Record in DB
        await db.collection('sentemails').updateOne(
          { userId: new mongoose.Types.ObjectId(SWETA_ID), email: recipient },
          { $set: { userId: new mongoose.Types.ObjectId(SWETA_ID), email: recipient, sentAt: new Date() } },
          { upsert: true }
        );
        break;
      } catch (err) {
        if (attempt === 1) {
          console.log(`[${i + 1}/${unsent.length}] Retry: ${recipient} - ${err.message}`);
          await sleep(3000);
        } else {
          failed++;
          console.log(`[${i + 1}/${unsent.length}] FAILED: ${recipient} - ${err.message}`);

          // If rate limited, wait longer
          if (err.message.includes('Too many') || err.message.includes('rate') || err.responseCode === 421) {
            console.log('Rate limited! Waiting 60 seconds...');
            await sleep(60000);
          }
        }
      }
    }

    // Delay between emails (5-7 seconds)
    if (i < unsent.length - 1) {
      await sleep(5000 + Math.random() * 2000);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Sent: ${sent}, Failed: ${failed}, Total: ${unsent.length}`);

  transporter.close();
  await mongoose.disconnect();
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });

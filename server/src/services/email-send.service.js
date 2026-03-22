const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log, broadcast } = require('../websocket');
const SentEmail = require('../models/SentEmail');
const User = require('../models/User');

// Per-user state
const userState = new Map();

function getState(userId) {
  const key = userId.toString();
  if (!userState.has(key)) {
    userState.set(key, { isSending: false, shouldStop: false, transporter: null });
  }
  return userState.get(key);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateEmailHTML(user, cfg) {
  if (cfg.emailTemplateMode === 'custom' && cfg.emailTemplateHtml) {
    return cfg.emailTemplateHtml;
  }

  // Structured mode — auto-generate from user.profile
  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role || 'Developer';
  const experience = p.experience || '';
  const skills = p.skills || '';
  const phone = p.phone || '';
  const email = user.senderEmail || user.email || '';
  const linkedin = p.linkedinUrl || '';
  const github = p.githubUrl || '';
  const portfolio = p.portfolioUrl || '';

  let expLine = '';
  if (experience) {
    expLine = `<p>I'm <strong>${name}</strong> — I've been working as a ${role} for ${experience}${skills ? `, primarily with ${skills}` : ''}.</p>`;
  } else {
    expLine = `<p>I'm <strong>${name}</strong>, a ${role}${skills ? ` skilled in ${skills}` : ''}.</p>`;
  }

  let linksHtml = '';
  const linkParts = [];
  if (linkedin) linkParts.push(`<a href="${linkedin}" style="color:#0A66C2;">LinkedIn</a>`);
  if (github) linkParts.push(`<a href="${github}" style="color:#0A66C2;">GitHub</a>`);
  if (portfolio) linkParts.push(`<a href="${portfolio}" style="color:#0A66C2;">Portfolio</a>`);
  if (linkParts.length > 0) {
    linksHtml = `<p style="margin-top:8px;font-size:13px;color:#555;">${linkParts.join(' &nbsp;|&nbsp; ')}</p>`;
  }

  return `<div style="font-family:Arial,sans-serif;color:#222;font-size:14px;line-height:1.7;max-width:600px;padding:20px 30px;text-align:left;">
<p>Hi,</p>
<p>I saw your recent post on LinkedIn about the role and thought I'd reach out directly.</p>
${expLine}
<p>I'm currently exploring new opportunities and can <strong>join immediately</strong> — happy to discuss full-time, part-time, or freelance arrangements.</p>
<p>I've attached my resume. Let me know if this seems like a good fit.</p>
<p style="margin-top:20px;">Thanks,<br>
<strong>${name}</strong>${phone ? `<br>${phone}` : ''}${email ? `<br><a href="mailto:${email}">${email}</a>` : ''}</p>
${linksHtml}
</div>`;
}

function generateEmailText(user, cfg) {
  if (cfg.emailTemplateMode === 'custom' && cfg.emailTemplateText) {
    return cfg.emailTemplateText;
  }

  const p = user.profile || {};
  const name = user.senderName || user.name || '';
  const role = p.role || 'Developer';
  const experience = p.experience || '';
  const skills = p.skills || '';
  const phone = p.phone || '';
  const email = user.senderEmail || user.email || '';
  const linkedin = p.linkedinUrl || '';
  const github = p.githubUrl || '';
  const portfolio = p.portfolioUrl || '';

  let expLine = '';
  if (experience) {
    expLine = `I'm ${name} — I've been working as a ${role} for ${experience}${skills ? `, primarily with ${skills}` : ''}.`;
  } else {
    expLine = `I'm ${name}, a ${role}${skills ? ` skilled in ${skills}` : ''}.`;
  }

  let links = '';
  if (linkedin) links += `LinkedIn: ${linkedin}\n`;
  if (github) links += `GitHub: ${github}\n`;
  if (portfolio) links += `Portfolio: ${portfolio}\n`;

  return `Hi,

I saw your recent post on LinkedIn about the role and thought I'd reach out directly.

${expLine}

I'm currently exploring new opportunities and can join immediately — happy to discuss full-time, part-time, or freelance arrangements.

I've attached my resume. Let me know if this seems like a good fit.

Thanks,
${name}
${phone ? phone + '\n' : ''}${email}
${links}`.trim();
}

async function loadSentEmails(userId) {
  try {
    const docs = await SentEmail.find({ userId }, { email: 1 }).lean();
    return new Set(docs.map((d) => d.email));
  } catch {
    return new Set();
  }
}

async function saveSentEmail(userId, email) {
  await SentEmail.updateOne(
    { userId, email: email.toLowerCase() },
    { userId, email: email.toLowerCase(), sentAt: new Date() },
    { upsert: true }
  );
}

async function testConnection(userId) {
  const user = await User.findById(userId).lean();
  if (!user || !user.senderEmail || !user.gmailAppPassword) {
    throw new Error('Email credentials not configured');
  }
  const t = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: user.senderEmail, pass: user.gmailAppPassword },
  });
  await t.verify();
  return { success: true, message: 'Gmail connection successful' };
}

function getSendStatus(userId) {
  const state = getState(userId);
  return { isSending: state.isSending, shouldStop: state.shouldStop };
}

function stopSending(userId) {
  const state = getState(userId);
  state.shouldStop = true;
  log('Email send stop requested', userId);
}

async function sendEmails(userId, emailList) {
  const state = getState(userId);
  if (state.isSending) throw new Error('Already sending emails');
  state.isSending = true;
  state.shouldStop = false;

  const user = await User.findById(userId).lean();
  if (!user || !user.senderEmail || !user.gmailAppPassword) {
    state.isSending = false;
    throw new Error('Email credentials not configured');
  }

  const cfg = await config.loadConfig(userId);

  state.transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    auth: { user: user.senderEmail, pass: user.gmailAppPassword },
  });

  try {
    await state.transporter.verify();
  } catch (err) {
    state.isSending = false;
    throw new Error('Gmail connection failed: ' + err.message);
  }

  // Load resume from user-specific dir
  const userUploadsDir = path.join(config.UPLOADS_DIR, userId.toString());
  let resumeBuffer = null;
  let resumeFilename = null;
  try {
    if (fs.existsSync(userUploadsDir)) {
      const resumeFiles = fs.readdirSync(userUploadsDir).filter((f) => f.endsWith('.pdf'));
      if (resumeFiles.length > 0) {
        resumeBuffer = fs.readFileSync(path.join(userUploadsDir, resumeFiles[0]));
        resumeFilename = resumeFiles[0];
      }
    }
  } catch {}

  const sentEmails = await loadSentEmails(userId);
  const toSend = emailList.filter((e) => !sentEmails.has(e.email.toLowerCase()));
  const skipped = emailList.length - toSend.length;

  if (skipped > 0) log(`${skipped} emails skipped (already sent)`, userId);
  if (toSend.length === 0) {
    state.isSending = false;
    return { sent: 0, failed: 0, skipped };
  }

  broadcast('email:started', { total: toSend.length, skipped }, userId);
  log(`Sending ${toSend.length} emails...`, userId);

  const emailHtml = generateEmailHTML(user, cfg);
  const emailText = generateEmailText(user, cfg);

  let sent = 0;
  let failed = 0;
  const batchSize = cfg.emailBatchSize || 2;

  for (let i = 0; i < toSend.length; i += batchSize) {
    if (state.shouldStop) break;
    const batch = toSend.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (recipient, j) => {
        const idx = i + j;
        broadcast('email:sending', { index: idx, total: toSend.length, email: recipient.email }, userId);

        const mailOptions = {
          from: `"${user.senderName || user.name}" <${user.senderEmail}>`,
          replyTo: user.senderEmail,
          to: recipient.email,
          subject: cfg.emailSubject || `${user.profile?.role || 'Developer'} | Immediate Joiner`,
          text: emailText,
          html: emailHtml,
        };

        if (resumeBuffer) {
          mailOptions.attachments = [{ filename: resumeFilename, content: resumeBuffer }];
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await state.transporter.sendMail(mailOptions);
            log(`[${idx + 1}/${toSend.length}] SENT: ${recipient.email}`, userId);
            broadcast('email:sent', { index: idx, email: recipient.email }, userId);
            sentEmails.add(recipient.email.toLowerCase());
            await saveSentEmail(userId, recipient.email);
            return true;
          } catch (err) {
            if (attempt === 1) {
              await sleep(2000);
            } else {
              log(`[${idx + 1}/${toSend.length}] FAILED: ${recipient.email} - ${err.message}`, userId);
              broadcast('email:failed', { index: idx, email: recipient.email, error: err.message }, userId);
            }
          }
        }
        return false;
      })
    );

    results.forEach((success) => { if (success) sent++; else failed++; });

    if (i + batchSize < toSend.length && !state.shouldStop) {
      const delay = cfg.emailDelay || 5000;
      await sleep(delay + Math.random() * 2000);
    }
  }

  state.isSending = false;
  state.shouldStop = false;
  broadcast('email:complete', { sent, failed, skipped }, userId);
  log(`Email sending complete! Sent: ${sent}, Failed: ${failed}`, userId);
  return { sent, failed, skipped };
}

module.exports = { sendEmails, stopSending, getSendStatus, testConnection, loadSentEmails, generateEmailHTML, generateEmailText };

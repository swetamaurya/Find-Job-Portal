// =============================================================
// AUTOMATED EMAIL SENDER - Node.js Script
// =============================================================
// SETUP:
// 1. npm init -y
// 2. npm install nodemailer
// 3. Gmail mein "App Password" generate karo:
//    - Google Account > Security > 2-Step Verification ON karo
//    - Phir "App Passwords" mein jao > "Mail" select karo > Generate
//    - Jo 16-digit password mile wo neeche paste karo
// 4. node send-emails.js
// =============================================================

const nodemailer = require('nodemailer');

// ===================== CONFIG =====================
const CONFIG = {
    // Tumhara email credentials
    senderEmail: 'tarunmehto71@gmail.com',
    senderName: 'Tarun Kumar',
    // Gmail App Password (16 digit)
    appPassword: 'pvohvzitpmmymcai',

    // Email ke beech delay (milliseconds) - spam flag se bachne ke liye
    delayBetweenEmails: 30000, // 30 seconds

    // Subject line
    subject: 'Application for Senior Backend Developer Position - Tarun Kumar',
};

// ===================== EMAIL LIST =====================
// Browser console script se jo emails mile, yahan paste karo
// Ya manually add karo
const recipients = [
    // Example format:
    // { email: 'hr@company.com', name: 'HR Manager', company: 'Company Name' },

    // ---- YAHAN APNE EXTRACTED EMAILS PASTE KARO ----

];

// ===================== EMAIL TEMPLATE =====================
function getEmailHTML(recipientName, recipientCompany) {
    const name = recipientName || 'Hiring Manager';
    const company = recipientCompany ? ` at ${recipientCompany}` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.7; color: #333; max-width: 700px; }
        .header { background: linear-gradient(135deg, #0077B5, #00a0dc); padding: 20px; border-radius: 8px 8px 0 0; }
        .header h2 { color: white; margin: 0; }
        .header p { color: #e0f0ff; margin: 5px 0 0; }
        .content { padding: 25px; border: 1px solid #e0e0e0; border-top: none; }
        .skills { display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0; }
        .skill-tag { background: #e8f4fd; color: #0077B5; padding: 5px 12px; border-radius: 20px; font-size: 13px; }
        .highlight { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 15px 0; }
        .footer { padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; font-size: 13px; }
        a { color: #0077B5; text-decoration: none; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Tarun Kumar</h2>
        <p>Senior Backend Developer | Node.js & Cloud Architect</p>
    </div>
    <div class="content">
        <p>Dear ${name},</p>

        <p>I hope this email finds you well. I came across your post on LinkedIn and wanted to express my interest in any <strong>Senior Backend Developer</strong> opportunities${company}.</p>

        <p>With <strong>3.5+ years of experience</strong> in building enterprise-grade backend systems, I bring a strong combination of technical expertise and leadership skills:</p>

        <div class="highlight">
            <strong>Key Achievements:</strong>
            <ul style="margin: 8px 0;">
                <li>Reduced API response time by <strong>20%</strong> through MongoDB query optimization</li>
                <li>Improved backend integration efficiency by <strong>30%</strong></li>
                <li>Successfully delivered <strong>15+ client projects</strong> as Senior Backend Developer at Quikkred</li>
                <li>Boosted CRM-driven sales team efficiency by <strong>35%</strong></li>
            </ul>
        </div>

        <p><strong>Technical Skills:</strong></p>
        <div class="skills">
            <span class="skill-tag">Node.js</span>
            <span class="skill-tag">Express.js</span>
            <span class="skill-tag">MongoDB</span>
            <span class="skill-tag">Redis</span>
            <span class="skill-tag">AWS ECS</span>
            <span class="skill-tag">Microservices</span>
            <span class="skill-tag">REST APIs</span>
            <span class="skill-tag">JWT Auth</span>
            <span class="skill-tag">React.js</span>
            <span class="skill-tag">PostgreSQL</span>
            <span class="skill-tag">Nginx</span>
            <span class="skill-tag">System Design</span>
        </div>

        <p>Currently serving as <strong>Senior Backend Developer at Quikkred</strong>, I architect scalable fintech systems handling loan management, CRM, and customer portals deployed on AWS ECS with Redis ElastiCache.</p>

        <p>I'd welcome the opportunity to discuss how my experience could contribute to your team. I've attached my resume for your reference.</p>

        <p>
            Best regards,<br>
            <strong>Tarun Kumar</strong><br>
            📞 +91-7678104587<br>
            📧 <a href="mailto:tarunmehto71@gmail.com">tarunmehto71@gmail.com</a><br>
            🔗 <a href="https://linkedin.com/in/thetarunkumar">LinkedIn Profile</a> |
            <a href="https://github.com/IAmtarunKumar">GitHub</a> |
            <a href="https://tarun-kumar-141120.vercel.app">Portfolio</a>
        </p>
    </div>
    <div class="footer">
        <p>This email was sent in response to a job opportunity posted on LinkedIn. If this wasn't intended for you, please disregard this email.</p>
    </div>
</body>
</html>`;
}

// ===================== PLAIN TEXT VERSION =====================
function getEmailText(recipientName, recipientCompany) {
    const name = recipientName || 'Hiring Manager';
    const company = recipientCompany ? ` at ${recipientCompany}` : '';

    return `Dear ${name},

I hope this email finds you well. I came across your post on LinkedIn and wanted to express my interest in any Senior Backend Developer opportunities${company}.

With 3.5+ years of experience in building enterprise-grade backend systems, I bring a strong combination of technical expertise and leadership skills:

KEY ACHIEVEMENTS:
- Reduced API response time by 20% through MongoDB query optimization
- Improved backend integration efficiency by 30%
- Successfully delivered 15+ client projects as Senior Backend Developer at Quikkred
- Boosted CRM-driven sales team efficiency by 35%

TECHNICAL SKILLS:
Node.js, Express.js, MongoDB, Redis, AWS ECS, Microservices, REST APIs, JWT Authentication, React.js, PostgreSQL, Nginx, System Design

Currently serving as Senior Backend Developer at Quikkred, I architect scalable fintech systems handling loan management, CRM, and customer portals deployed on AWS ECS with Redis ElastiCache.

I'd welcome the opportunity to discuss how my experience could contribute to your team. I've attached my resume for your reference.

Best regards,
Tarun Kumar
Phone: +91-7678104587
Email: tarunmehto71@gmail.com
LinkedIn: https://linkedin.com/in/thetarunkumar
GitHub: https://github.com/IAmtarunKumar
Portfolio: https://tarun-kumar-141120.vercel.app
`;
}

// ===================== EMAIL SENDER =====================
async function sendEmails() {
    if (CONFIG.appPassword === 'YOUR_APP_PASSWORD_HERE') {
        console.log('❌ ERROR: Pehle apna Gmail App Password set karo!');
        console.log('');
        console.log('Steps:');
        console.log('1. https://myaccount.google.com/security pe jao');
        console.log('2. 2-Step Verification ON karo (agar nahi hai)');
        console.log('3. "App Passwords" search karo ya jao: https://myaccount.google.com/apppasswords');
        console.log('4. App: "Mail", Device: "Other" select karo');
        console.log('5. Generate pe click karo');
        console.log('6. Jo 16-digit password mile wo CONFIG.appPassword mein paste karo');
        process.exit(1);
    }

    if (recipients.length === 0) {
        console.log('❌ ERROR: Koi recipient nahi hai!');
        console.log('');
        console.log('Steps:');
        console.log('1. Pehle LinkedIn pe browser script run karo (linkedin-email-extractor.js)');
        console.log('2. Jo emails mile wo recipients array mein add karo');
        console.log('3. Format: { email: "hr@company.com", name: "HR", company: "Company" }');
        process.exit(1);
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: CONFIG.senderEmail,
            pass: CONFIG.appPassword,
        },
    });

    // Verify connection
    try {
        await transporter.verify();
        console.log('✅ Gmail connection successful!\n');
    } catch (err) {
        console.log('❌ Gmail connection failed:', err.message);
        console.log('Check karo: App Password sahi hai? 2FA ON hai?');
        process.exit(1);
    }

    console.log(`📧 Sending emails to ${recipients.length} recipients...\n`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        const mailOptions = {
            from: `"${CONFIG.senderName}" <${CONFIG.senderEmail}>`,
            to: recipient.email,
            subject: CONFIG.subject,
            text: getEmailText(recipient.name, recipient.company),
            html: getEmailHTML(recipient.name, recipient.company),
            // Resume automatically attach hoga (file same folder mein hai)
            attachments: [
                {
                    filename: 'Tarun_Kumar_Resume.pdf',
                    path: './Tarun_Kumar_Resume.pdf'
                }
            ]
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            sent++;
            console.log(`✅ [${i + 1}/${recipients.length}] Sent to: ${recipient.email} (${info.messageId})`);
        } catch (err) {
            failed++;
            console.log(`❌ [${i + 1}/${recipients.length}] Failed: ${recipient.email} - ${err.message}`);
        }

        // Delay between emails (spam se bachne ke liye)
        if (i < recipients.length - 1) {
            const delaySec = CONFIG.delayBetweenEmails / 1000;
            console.log(`   ⏳ Waiting ${delaySec}s before next email...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenEmails));
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 RESULTS: Sent: ${sent} | Failed: ${failed} | Total: ${recipients.length}`);
    console.log('='.repeat(50));
}

// Run
sendEmails().catch(console.error);

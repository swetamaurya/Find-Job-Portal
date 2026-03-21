// =============================================================
// FULL AUTOMATED LinkedIn Job Finder + Email Sender
// =============================================================
// Sab kuch terminal se hoga:
//   1. Browser khulega (visible, headless nahi)
//   2. LinkedIn login page aayega - manually login karo
//   3. Automatically search karega job posts
//   4. Scroll karke emails extract karega
//   5. Emails pe mail bhej dega
//
// RUN: node auto-find-jobs.js
// =============================================================

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ===================== CONFIG =====================
const CONFIG = {
    // Tumhara email
    senderEmail: 'tarunmehto71@gmail.com',
    senderName: 'Tarun Kumar',

    // Gmail App Password (16 digit)
    appPassword: 'pvohvzitpmmymcai',

    // LinkedIn search queries (ek ek karke search hoga)
    searchQueries: [
        // Location filter already applied via geoIds (Delhi/Noida/Gurgaon)
        'node.js backend developer',
        'fintech backend developer',
        'Software developer',
        'Software Engineer',
        'Senior Node.js Backend Developer hiring',
        'Remote Node.js Backend Developer',
        'Node.js Backend Developer hiring',
        'senior node.js backend developer',
        'node.js backend developer immediate joiner',
        'node.js senior backend developer hiring',
        'hiring node.js backend developer send resume',
        'node.js backend developer job opening',
        'looking for node.js backend developer',
        'hiring nodejs express.js backend developer',
        'senior backend developer',
        'lead backend developer',
    ],

    // SIRF tab skip karo jab post PRIMARY Java/PHP/.NET ke baare mein ho
    // Generic roles (devops, cloud, qa) NAHI - kyunki multi-role posts mein backend bhi hota hai
    skipKeywords: [
        // Java specific
        'java backend developer', 'java backend', 'java developer', 'java full stack', 'full stack java', 'java engineer',
        'spring boot', 'j2ee', 'core java', 'java backend engineer',
        // PHP specific
        'php backend developer', 'php backend', 'php developer', 'laravel', 'wordpress developer', 'drupal', 'flutter',
        'php backend engineer',
        // .NET specific
        '.net developer', '.net backend', '.net backend developer', 'asp.net', 'c# developer', 'c# backend',
        '.net backend engineer',
        // Frontend only roles
        'react native developer', 'angular developer', 'frontend developer',
        // Python specific
        'python backend developer', 'python backend', 'python developer', 'django developer', 'flask developer',
        'python backend engineer',
        // Ruby/Go/Rust backend
        'ruby on rails', 'ruby backend', 'ruby developer', 'golang backend', 'go backend developer',
        'rust backend', 'rust developer',
        // Others
        'salesforce developer', 'sap developer',
    ],

    // Date filter: past-month = 4x zyada posts than past-week
    dateFilter: 'past-month',

    // Location filter - LinkedIn Geo IDs (Delhi NCR region)
    // Set locationFilter: true to enable
    locationFilter: true,
    geoIds: [
        '102890719',  // Delhi
        '106290293',  // Noida
        '115884833',  // Gurugram/Gurgaon
        '100963914',  // New Delhi
    ],

    // Scroll count - 10 fast hai, 30 slow but zyada results
    scrollCount: 10,

    // LinkedIn Comments se bhi emails extract karo (bahut log comments mein email daalte hain)
    extractComments: true,

    // Google search bhi karo (extra emails source) - false = skip (koi result nahi aata)
    searchGoogle: false,

    // Batch ke beech delay (ms) - 5 sec safe hai, spam mein nahi jayega
    emailDelay: 5000,

    // Kitne emails ek batch mein parallel bhejein (2 = ~15/min, safe for Gmail)
    emailBatchSize: 2,

    // Subject line
    emailSubject: 'Senior Node.js Backend Developer | Immediate Joiner',
    // Results save file
    outputFile: path.join(__dirname, 'extracted-results.json'),

    // Cookie file (login save rehega)
    cookieFile: path.join(__dirname, 'linkedin-cookies.json'),

    // ===== LinkedIn DM Settings =====
    sendLinkedInDMs: true,
    dmDelayMin: 10000,
    dmDelayMax: 20000,
    maxDMsPerSession: 50,
    sendConnectionRequest: true,
    dmMessage: `Hi, I came across your hiring post on LinkedIn. I'm Tarun Kumar, a Senior Node.js Backend Developer with 3.5+ years of experience. I'm available for full-time, part-time, or freelancing opportunities and can join immediately. I've sent my resume to your email as well. Would love to discuss any suitable opportunity. Thanks!`,
    connectionNote: `Hi, I noticed your hiring post for a backend role. I'm Tarun Kumar - Senior Node.js Backend Developer with 3.5+ yrs exp. Available for full-time, part-time & freelancing. Immediate joiner. Would love to connect and discuss.`,
    sentDMsFile: path.join(__dirname, 'sent-dms.json'),
};

// Ignore these email domains
const IGNORED_DOMAINS = [
    'linkedin.com', 'licdn.com', 'example.com', 'email.com',
    'yourmail.com', 'xyz.com', 'abc.com', 'test.com',
    'sentry.io', 'w3.org', 'schema.org', 'googleapis.com',
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'protonmail.com', 'icloud.com', 'rediffmail.com',
];

// ===================== HELPERS =====================
function rl() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
    return new Promise(resolve => {
        const r = rl();
        r.question(question, answer => { r.close(); resolve(answer.trim()); });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay - bot detection se bachne ke liye
function randomSleep(minMs, maxMs) {
    const ms = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
    return sleep(ms);
}

// Email validation - fake emails filter karo
function isValidEmail(email) {
    if (email.length < 6 || email.length > 80) return false;
    // Common fake patterns
    if (/^(test|example|abc|xyz|info@info|noreply|no-reply|admin@admin)/.test(email)) return false;
    // Must have valid TLD
    if (!/\.[a-z]{2,10}$/.test(email)) return false;
    // No double dots
    if (email.includes('..')) return false;
    return true;
}

function log(msg) {
    const time = new Date().toLocaleTimeString('en-IN');
    console.log(`[${time}] ${msg}`);
}

// ===================== SENT EMAILS LOG (duplicate se bachne ke liye) =====================
const SENT_LOG_FILE = path.join(__dirname, 'sent-emails.json');

function loadSentEmails() {
    try {
        if (fs.existsSync(SENT_LOG_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(SENT_LOG_FILE, 'utf-8')));
        }
    } catch (e) { }
    return new Set();
}

function saveSentEmail(email) {
    const sent = loadSentEmails();
    sent.add(email.toLowerCase());
    fs.writeFileSync(SENT_LOG_FILE, JSON.stringify([...sent], null, 2));
}

// ===================== SENT DMS LOG (duplicate se bachne ke liye) =====================
function loadSentDMs() {
    try {
        if (fs.existsSync(CONFIG.sentDMsFile)) {
            return new Set(JSON.parse(fs.readFileSync(CONFIG.sentDMsFile, 'utf-8')));
        }
    } catch (e) { }
    return new Set();
}

function saveSentDM(profileUrl) {
    const sent = loadSentDMs();
    sent.add(profileUrl.toLowerCase());
    fs.writeFileSync(CONFIG.sentDMsFile, JSON.stringify([...sent], null, 2));
}

// ===================== EMAIL TEMPLATE (Previous content + Real simple style) =====================
function getEmailHTML() {
    return `<div style="font-family:Arial,sans-serif;color:#222;font-size:14px;line-height:1.7;max-width:600px;margin:0 auto;padding:20px 30px;">
<p>Hi,</p>

<p>I saw your recent post on LinkedIn about the backend role and thought I'd reach out directly.</p>

<p>I'm <strong>Tarun Kumar</strong> - I've been working as a <strong>Senior Backend Developer</strong> at Quikkred for the past <strong>3.5+ years</strong>, mainly building fintech backend systems using <strong>Node.js, Express.js, and MongoDB</strong>. I've handled everything from <strong>microservices architecture</strong> to <strong>AWS deployments</strong> (ECS, ElastiCache, Redis) and have led delivery of <strong>15+ projects</strong> so far.</p>

<p>I'm currently exploring new opportunities and can <strong>join immediately</strong> - happy to discuss <strong>full-time, part-time, or freelance</strong> arrangements, whatever works best for the role.</p>

<p>I've attached my resume. Would love to hop on a quick call if you think there's a fit.</p>

<p style="margin-top:20px;">Thanks,<br>
<strong>Tarun Kumar</strong><br>
+91-7678104587<br>
<a href="mailto:tarunmehto71@gmail.com">tarunmehto71@gmail.com</a></p>

<p style="margin-top:8px;font-size:13px;color:#555;">
<a href="https://linkedin.com/in/thetarunkumar" style="color:#0A66C2;">LinkedIn</a> &nbsp;|&nbsp;
<a href="https://github.com/IAmtarunKumar" style="color:#0A66C2;">GitHub</a> &nbsp;|&nbsp;
<a href="https://tarun-kumar-141120.vercel.app/" style="color:#0A66C2;">Portfolio</a>
</p>
</div>`;
}

function getEmailText() {
    return `Hi,

I saw your recent post on LinkedIn about the backend role and thought I'd reach out directly.

I'm Tarun Kumar - I've been working as a Senior Backend Developer at Quikkred for the past 3.5+ years, mainly building fintech backend systems using Node.js, Express.js, and MongoDB. I've handled everything from microservices architecture to AWS deployments (ECS, ElastiCache, Redis) and have led delivery of 15+ projects so far.

I'm currently exploring new opportunities and can join immediately - happy to discuss full-time, part-time, or freelance arrangements, whatever works best for the role.

I've attached my resume. Would love to hop on a quick call if you think there's a fit.

Thanks,
Tarun Kumar
+91-7678104587
tarunmehto71@gmail.com
LinkedIn: https://linkedin.com/in/thetarunkumar
GitHub: https://github.com/IAmtarunKumar
Portfolio: https://tarun-kumar-141120.vercel.app/`;
}

// ===================== AUTO MODE (cron job ke liye) =====================
const AUTO_MODE = process.argv.includes('--auto');

// ===================== LINKEDIN DM SENDER =====================
async function sendLinkedInDM(page, profileUrl, message, index, total) {
    // Hard timeout - 30 sec mein jo ho, aage badho
    const dmPromise = _sendLinkedInDMInner(page, profileUrl, message, index, total);
    const result = await Promise.race([
        dmPromise,
        sleep(30000).then(() => ({ success: false, method: 'timeout', reason: '30s timeout' }))
    ]);
    return result;
}

async function _sendLinkedInDMInner(page, profileUrl, message, index, total) {
    try {
        // Page valid hai ya nahi check karo
        try {
            await page.title();
        } catch(e) {
            log(`[DM ${index + 1}/${total}] Page detached, skipping...`);
            return { success: false, method: 'error', reason: 'page_detached' };
        }

        log(`[DM ${index + 1}/${total}] Opening profile: ${profileUrl}`);

        // STEP 1: Pehle saare message overlays band karo
        try {
            // Close ALL messaging overlays using LinkedIn's actual close buttons
            await page.evaluate(() => {
                // Method 1: Close conversation windows
                document.querySelectorAll('[class*="msg-overlay-list-bubble"] button, [class*="msg-convo-wrapper"] button').forEach(btn => {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (label.includes('close')) {
                        try { btn.click(); } catch(e){}
                    }
                });
                // Method 2: Close buttons inside msg overlays
                document.querySelectorAll('[class*="msg-overlay"] button[aria-label*="close" i], [class*="msg-overlay"] button[aria-label*="Close"]').forEach(btn => {
                    try { btn.click(); } catch(e){}
                });
                // Method 3: Minimize/close the entire messaging panel
                document.querySelectorAll('[class*="msg-overlay-list-bubble--is-minimized"] button, aside[class*="msg"] button[aria-label*="close" i]').forEach(btn => {
                    try { btn.click(); } catch(e){}
                });
            });
            await sleep(500);

            // ESC press for anything remaining
            for (let i = 0; i < 3; i++) {
                await page.keyboard.press('Escape');
                await sleep(200);
            }
            await sleep(300);
        } catch(e) {}

        // STEP 2: Profile page pe jao
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await randomSleep(2000, 3000);

        // STEP 3: Profile load hone ke baad phir se ESC press karo (safety)
        try {
            for (let i = 0; i < 3; i++) {
                await page.keyboard.press('Escape');
                await sleep(200);
            }
        } catch(e) {}

        // Check page loaded
        let pageOk = true;
        try {
            const pageTitle = await page.title();
            if (pageTitle.includes('Page not found') || pageTitle.includes('Error')) pageOk = false;
        } catch(e) { pageOk = false; }
        if (!pageOk) {
            log(`[DM ${index + 1}/${total}] Profile not found`);
            return { success: false, method: 'none', reason: 'profile_not_found' };
        }

        // STEP 4: Profile headline check - sirf HR/Recruiter/relevant logon ko DM karo
        const profileHeadline = await page.evaluate(() => {
            const selectors = [
                '.text-body-medium.break-words',
                '[class*="pv-top-card"] .text-body-medium',
                'h2.mt1 + .text-body-medium',
                '.pv-top-card--list .text-body-medium',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.innerText.trim().length > 3) {
                    return el.innerText.trim().toLowerCase();
                }
            }
            return '';
        });

        const relevantRoles = ['hr', 'human resource', 'recruiter', 'recruiting', 'talent acquisition',
            'hiring', 'staffing', 'founder', 'co-founder', 'cofounder', 'ceo', 'cto',
            'tech lead', 'engineering manager', 'team lead', 'head of', 'lead',
            'vp of engineering', 'director', 'manager', 'consultant',
            'developer', 'engineer', 'architect', 'devops', 'sde', 'swe'];
        const skipRoles = ['student', 'fresher', 'intern', 'learner', 'aspiring',
            'looking for job', 'looking for opportunity', 'seeking', 'b.tech', 'btech',
            'mca', 'graduate', 'undergraduate', 'trainee', 'open to work'];
        const isSkipProfile = profileHeadline && skipRoles.some(role => profileHeadline.includes(role));
        // Agar headline empty hai (extract nahi hua) to allow karo, sirf skip jab clearly irrelevant ho
        const isRelevantProfile = !isSkipProfile && (profileHeadline === '' || relevantRoles.some(role => profileHeadline.includes(role)));

        if (!isRelevantProfile) {
            log(`[DM ${index + 1}/${total}] SKIP: "${profileHeadline.substring(0, 60)}"`);
            return { success: false, method: 'none', reason: 'not_relevant_profile' };
        }

        log(`[DM ${index + 1}/${total}] Relevant: "${profileHeadline.substring(0, 60) || 'headline not found'}"`);

        // Quick check: main profile action buttons
        const profileButtons = await page.evaluate(() => {
            const btns = [];
            const seen = new Set();
            // Scan all visible buttons on main section
            document.querySelectorAll('main button, [class*="pv-top-card"] button, [class*="scaffold-layout"] button').forEach(btn => {
                const text = (btn.innerText || '').trim().split('\n')[0].trim();
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (btn.offsetHeight > 0 && (text.length > 0 && text.length < 20)) {
                    const lower = text.toLowerCase();
                    if ((lower === 'message' || lower === 'connect' || lower === 'follow' || lower === 'more' || lower === 'pending' ||
                        lower.includes('+ follow') || lower.includes('+ connect') ||
                        label.includes('message') || label.includes('connect')) && !seen.has(lower)) {
                        seen.add(lower);
                        btns.push(text);
                    }
                }
                if (btns.length >= 4) return;
            });
            return btns;
        });
        log(`[DM ${index + 1}/${total}] Buttons: ${profileButtons.join(', ') || 'NONE'}`);

        // Find Message button - multiple ways to detect
        const messageBtnInfo = await page.evaluate(() => {
            // Method 1: aria-label based (most common)
            const selectors = [
                'button[aria-label*="Message"]',
                'button[aria-label*="message"]',
            ];
            for (const sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetHeight > 0) {
                    return { found: true, selector: sel };
                }
            }
            // Method 2: Text-based - button that says "Message"
            const allBtns = document.querySelectorAll('button, a');
            for (const btn of allBtns) {
                const text = (btn.innerText || '').trim().toLowerCase();
                if (text === 'message' && btn.offsetHeight > 0) {
                    btn.setAttribute('data-dm-target', 'true');
                    return { found: true, selector: '[data-dm-target="true"]' };
                }
            }
            return { found: false };
        });

        if (messageBtnInfo.found) {
            const messageButton = await page.$(messageBtnInfo.selector);
            if (messageButton) {
                const dmResult = await sendDirectMessage(page, messageButton, message, index, total);
                // Agar DM success ho gaya, return karo
                if (dmResult.success) return dmResult;
                // Agar premium_required ya compose_box_not_found, connection request try karo
                if (CONFIG.sendConnectionRequest && (dmResult.reason === 'premium_required' || dmResult.reason === 'compose_box_not_found')) {
                    log(`[DM ${index + 1}/${total}] DM failed, trying Connect instead...`);
                    // Profile page pe wapas jao
                    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await randomSleep(1500, 2500);
                    return await sendConnectionRequest(page, CONFIG.connectionNote, index, total);
                }
                return dmResult;
            }
        }

        // No Message button - try Connect
        if (CONFIG.sendConnectionRequest) {
            return await sendConnectionRequest(page, CONFIG.connectionNote, index, total);
        }

        log(`[DM ${index + 1}/${total}] No Message/Connect button`);
        return { success: false, method: 'none', reason: 'no_message_button' };
    } catch (err) {
        log(`[DM ${index + 1}/${total}] ERROR: ${err.message}`);
        return { success: false, method: 'error', reason: err.message };
    }
}

async function sendDirectMessage(page, messageButton, message, index, total) {
    try {
        // Purane message overlays band karo
        await page.evaluate(() => {
            document.querySelectorAll('[class*="msg-overlay-list-bubble"] button, [class*="msg-overlay"] button').forEach(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('close')) {
                    try { btn.click(); } catch(e) {}
                }
            });
        });
        await sleep(800);

        // Message button click karo
        await page.evaluate(btn => btn.click(), messageButton);

        // Wait longer for compose overlay to appear (LinkedIn is slow)
        await randomSleep(3000, 5000);

        // STEP 1: FIRST try to find compose box - if it opens, no Premium needed!
        let composeFound = false;

        // Try finding compose box with retries (sometimes takes time to load)
        for (let attempt = 0; attempt < 3 && !composeFound; attempt++) {
            if (attempt > 0) await sleep(2000); // Extra wait on retries

            composeFound = await page.evaluate(() => {
                // LinkedIn messaging compose selectors - most specific first
                const selectors = [
                    'div.msg-form__contenteditable',
                    'div.msg-form__msg-content-container div[contenteditable="true"]',
                    '[class*="msg-form"] div[contenteditable="true"]',
                    '[class*="msg-form"] [role="textbox"]',
                    'div.msg-overlay-conversation-bubble div[contenteditable="true"]',
                    '[class*="msg-overlay"] div[contenteditable="true"]',
                    '[class*="msg-overlay"] [role="textbox"]',
                    // Messaging panel (right side) selectors
                    '[class*="msg-convo-wrapper"] div[contenteditable="true"]',
                    '[class*="msg-convo-wrapper"] [role="textbox"]',
                    '[class*="msg-s-message-list"] ~ div div[contenteditable="true"]',
                    'aside[class*="msg"] div[contenteditable="true"]',
                    // Generic fallback - any contenteditable in messaging area
                    'div[contenteditable="true"][aria-label*="message" i]',
                    'div[contenteditable="true"][aria-label*="Write" i]',
                    '[role="textbox"][aria-label*="message" i]',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) {
                        el.focus();
                        el.click();
                        return true;
                    }
                }

                // Try any contenteditable inside msg-related containers
                const containers = document.querySelectorAll('[class*="msg"], [class*="compose"], [class*="conversation"]');
                for (const container of containers) {
                    const editables = container.querySelectorAll('div[contenteditable="true"], [role="textbox"]');
                    for (const el of editables) {
                        if (el.offsetHeight > 10 && el.offsetWidth > 50) {
                            el.focus();
                            el.click();
                            return true;
                        }
                    }
                }

                // Any visible contenteditable on page (LinkedIn might have changed classes)
                const allEditables = document.querySelectorAll('div[contenteditable="true"], [role="textbox"]');
                for (const el of allEditables) {
                    if (el.offsetHeight > 15 && el.offsetWidth > 80) {
                        // Make sure it's not a post editor or about section
                        const parent = el.closest('[class*="msg"], [class*="overlay"], [class*="compose"], [class*="conversation"], [class*="message"]');
                        if (parent) {
                            el.focus();
                            el.click();
                            return true;
                        }
                    }
                }

                return false;
            });
        }

        // Method: Try "Write a message" placeholder click
        if (!composeFound) {
            composeFound = await page.evaluate(() => {
                const placeholders = document.querySelectorAll('[data-placeholder], [aria-placeholder], p[class*="placeholder"]');
                for (const el of placeholders) {
                    const text = (el.getAttribute('data-placeholder') || el.getAttribute('aria-placeholder') || el.innerText || '').toLowerCase();
                    if (text.includes('message') || text.includes('write')) {
                        const target = el.closest('div[contenteditable="true"]') || el.closest('[role="textbox"]') || el.parentElement;
                        if (target && target.offsetHeight > 0) {
                            target.focus();
                            target.click();
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        // Method: Tab key navigation to find compose field
        if (!composeFound) {
            for (let i = 0; i < 15; i++) {
                await page.keyboard.press('Tab');
                await sleep(150);
                const isEditable = await page.evaluate(() => {
                    const el = document.activeElement;
                    return el && (el.contentEditable === 'true' || el.getAttribute('role') === 'textbox' || el.tagName === 'TEXTAREA');
                });
                if (isEditable) {
                    composeFound = true;
                    break;
                }
            }
        }

        // STEP 2: If NO compose box found, THEN check for Premium popup
        if (!composeFound) {
            // Check ONLY for actual Premium/InMail upsell modals (very specific)
            const isPremiumPopup = await page.evaluate(() => {
                // Look for artdeco-modal__content which is LinkedIn's actual modal
                const modals = document.querySelectorAll('[class*="artdeco-modal"][class*="visible"], [class*="artdeco-modal__content"]');
                for (const modal of modals) {
                    if (modal.offsetHeight === 0 || modal.offsetWidth === 0) continue;
                    const text = (modal.innerText || '').toLowerCase();
                    // Very specific Premium upsell keywords that appear ONLY in the InMail popup
                    if (text.includes('inmail') || text.includes('send for free with premium') ||
                        text.includes('unlock messaging') || text.includes('free inmail')) {
                        return 'premium';
                    }
                }
                // Check if the Message button opened a premium-specific overlay
                const btns = document.querySelectorAll('[class*="artdeco-modal"] button, [role="dialog"] button');
                for (const btn of btns) {
                    if (btn.offsetHeight === 0) continue;
                    const text = (btn.innerText || '').toLowerCase().trim();
                    // These buttons ONLY appear in Premium upsell dialogs
                    if (text === 'get premium' || text === 'try premium for free' ||
                        text === 'send inmail' || text.includes('start free trial')) {
                        return 'premium';
                    }
                }
                return false;
            });

            if (isPremiumPopup) {
                log(`[DM ${index + 1}/${total}] Premium required for this person`);
                await page.keyboard.press('Escape');
                await sleep(500);
                return { success: false, method: 'dm', reason: 'premium_required' };
            }

            // Neither compose box nor premium popup - compose nahi mila, connect try karo
            log(`[DM ${index + 1}/${total}] Compose box not found, trying Connect...`);
            await page.keyboard.press('Escape');
            await sleep(300);
            // Directly return compose_box_not_found - caller will try Connect
            return { success: false, method: 'dm', reason: 'compose_box_not_found' };
        }

        await randomSleep(300, 600);

        // Clear any existing text in compose box first (Mac uses Meta, not Control)
        await page.keyboard.down('Meta');
        await page.keyboard.press('a');
        await page.keyboard.up('Meta');
        await sleep(100);
        await page.keyboard.press('Backspace');
        await sleep(200);

        // Type message
        await page.keyboard.type(message, { delay: 15 });
        await randomSleep(800, 1200);

        // Send - try button click first, then Enter
        let sent = await page.evaluate(() => {
            // Find send button inside messaging area (specific selectors first)
            const sendSelectors = [
                'button.msg-form__send-button',
                '[class*="msg-form"] button[type="submit"]',
                '[class*="msg-form"] button[aria-label*="Send"]',
                '[class*="msg-form"] button[aria-label*="send"]',
            ];
            for (const sel of sendSelectors) {
                const btn = document.querySelector(sel);
                if (btn && !btn.disabled && btn.offsetHeight > 0) {
                    btn.click();
                    return true;
                }
            }
            // Fallback: Find send button inside any msg container
            const msgContainers = document.querySelectorAll('[class*="msg-form"], [class*="msg-overlay"], [class*="msg-convo"]');
            for (const container of msgContainers) {
                const btns = container.querySelectorAll('button');
                for (const btn of btns) {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const text = (btn.innerText || '').toLowerCase().trim();
                    if ((label === 'send' || text === 'send') && !btn.disabled && btn.offsetHeight > 0) {
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        });

        if (!sent) {
            // Enter key se send karo
            await page.keyboard.press('Enter');
            sent = true;
        }

        await randomSleep(2000, 3000);

        // Close messaging overlay
        await page.evaluate(() => {
            document.querySelectorAll('[class*="msg-overlay"] button').forEach(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('close')) {
                    try { btn.click(); } catch(e) {}
                }
            });
        });
        await sleep(300);
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('Escape');
            await sleep(200);
        }

        log(`[DM ${index + 1}/${total}] DM SENT!`);
        return { success: true, method: 'dm' };
    } catch (err) {
        log(`[DM ${index + 1}/${total}] DM error: ${err.message}`);
        return { success: false, method: 'dm', reason: err.message };
    }
}

async function sendConnectionRequest(page, note, index, total) {
    try {
        // page.evaluate se Connect button dhundho aur click karo
        const connectClicked = await page.evaluate(() => {
            // Direct Connect button
            const selectors = ['button[aria-label*="Connect"]', 'button[aria-label*="connect"]'];
            for (const sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.innerText.toLowerCase().includes('connect')) {
                    btn.click();
                    return 'direct';
                }
            }
            // "More" dropdown mein Connect
            const moreBtn = document.querySelector('button[aria-label="More actions"], button[aria-label*="More"]');
            if (moreBtn) {
                moreBtn.click();
                return 'more';
            }
            return false;
        });

        if (!connectClicked) {
            log(`[DM ${index + 1}/${total}] No Connect button (already connected?)`);
            return { success: false, method: 'connect', reason: 'no_connect_button' };
        }

        if (connectClicked === 'more') {
            await randomSleep(1000, 1500);
            // Dropdown mein Connect click karo
            const found = await page.evaluate(() => {
                // Try all dropdown items, list items, menu items
                const items = document.querySelectorAll('div[class*="dropdown"] li, div[class*="artdeco-dropdown"] li, [role="menuitem"], [role="listbox"] li, ul li');
                for (const item of items) {
                    const text = (item.innerText || '').toLowerCase();
                    if (text.includes('connect') && !text.includes('disconnect')) {
                        const clickable = item.querySelector('button, a, span, div') || item;
                        clickable.click();
                        return true;
                    }
                }
                // Also try any visible button with "Connect"
                const btns = document.querySelectorAll('button, a');
                for (const btn of btns) {
                    const text = (btn.innerText || '').toLowerCase().trim();
                    if (text === 'connect' && btn.offsetHeight > 0) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            if (!found) {
                log(`[DM ${index + 1}/${total}] Connect not in dropdown`);
                return { success: false, method: 'connect', reason: 'no_connect_in_dropdown' };
            }
        }

        await randomSleep(1500, 2500);

        // "Add a note" click karo
        const noteAdded = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
                const text = (btn.innerText || '').toLowerCase();
                if (text.includes('add a note') || text.includes('note')) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });

        if (noteAdded) {
            await randomSleep(1000, 1500);
            // Note type karo
            const noteBox = await page.$('textarea#custom-message, textarea[name="message"], textarea[id*="custom-message"]');
            if (noteBox) {
                await page.evaluate(box => { box.focus(); box.click(); }, noteBox);
                await randomSleep(300, 500);
                await page.keyboard.type(note.substring(0, 300), { delay: 12 });
                await randomSleep(800, 1200);
            }
        }

        // Send button click - multiple strategies
        const sendClicked = await page.evaluate(() => {
            // Strategy 1: Exact text match
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
                const text = (btn.innerText || '').toLowerCase().trim();
                if ((text === 'send' || text === 'send now' || text === 'send invitation' ||
                     text.includes('send without a note') || text === 'connect') && !btn.disabled && btn.offsetHeight > 0) {
                    btn.click();
                    return 'text';
                }
            }
            // Strategy 2: Primary button in modal/dialog (usually the action button)
            const modals = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="artdeco-modal"]');
            for (const modal of modals) {
                if (modal.offsetHeight === 0) continue;
                // Find primary/action button inside modal
                const primaryBtns = modal.querySelectorAll('button[class*="primary"], button[class*="artdeco-button--primary"]');
                for (const btn of primaryBtns) {
                    if (!btn.disabled && btn.offsetHeight > 0) {
                        btn.click();
                        return 'primary';
                    }
                }
                // Any button with "send" in aria-label
                const allBtns = modal.querySelectorAll('button');
                for (const btn of allBtns) {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (label.includes('send') && !btn.disabled) {
                        btn.click();
                        return 'aria';
                    }
                }
            }
            // Strategy 3: Any visible primary button on page
            const primaryBtns = document.querySelectorAll('button[class*="artdeco-button--primary"]');
            for (const btn of primaryBtns) {
                const text = (btn.innerText || '').toLowerCase().trim();
                if ((text.includes('send') || text.includes('connect')) && !btn.disabled && btn.offsetHeight > 0) {
                    btn.click();
                    return 'fallback';
                }
            }
            return false;
        });

        if (sendClicked) {
            await randomSleep(1500, 2500);
            log(`[DM ${index + 1}/${total}] Connection request SENT with note! (via ${sendClicked})`);
            return { success: true, method: 'connect' };
        } else {
            log(`[DM ${index + 1}/${total}] Send button not found in modal`);
            // Dismiss karo
            await page.keyboard.press('Escape');
            await sleep(300);
            await page.keyboard.press('Escape');
            return { success: false, method: 'connect', reason: 'modal_send_failed' };
        }
    } catch (err) {
        log(`[DM ${index + 1}/${total}] Connection request error: ${err.message}`);
        return { success: false, method: 'connect', reason: err.message };
    }
}

async function sendAllLinkedInDMs(page, profiles) {
    const sentDMs = loadSentDMs();
    const newProfiles = profiles.filter(p => !sentDMs.has(p.profileUrl.toLowerCase()));
    const skippedDMs = profiles.length - newProfiles.length;

    if (skippedDMs > 0) {
        log(`${skippedDMs} profiles skip kiye (pehle DM bhej chuke hain)`);
    }

    if (newProfiles.length === 0) {
        log('Saare profiles ko pehle se DM bhej chuke hain!');
        return { sent: 0, failed: 0, connected: 0 };
    }

    const toProcess = newProfiles.slice(0, CONFIG.maxDMsPerSession);
    log(`\n${toProcess.length} profiles ko DM/Connection request bhej rahe hain...`);
    log(`(Max per session: ${CONFIG.maxDMsPerSession})\n`);

    let dmSent = 0, connectSent = 0, failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const profile = toProcess[i];

        log(`\n--- DM ${i + 1}/${toProcess.length} ---`);
        log(`Profile: ${profile.posterName || 'Unknown'} (${profile.profileUrl})`);

        const result = await sendLinkedInDM(page, profile.profileUrl, CONFIG.dmMessage, i, toProcess.length);

        if (result.success) {
            if (result.method === 'dm') dmSent++;
            if (result.method === 'connect') connectSent++;
            saveSentDM(profile.profileUrl);
        } else {
            failed++;
            log(`  Reason: ${result.reason}`);
        }

        // Random delay between DMs
        if (i < toProcess.length - 1) {
            const delayMs = Math.floor(Math.random() * (CONFIG.dmDelayMax - CONFIG.dmDelayMin)) + CONFIG.dmDelayMin;
            log(`  Waiting ${Math.round(delayMs / 1000)}s before next DM...`);
            await sleep(delayMs);
        }
    }

    return { sent: dmSent, connected: connectSent, failed };
}

// ===================== MAIN SCRIPT =====================
async function main() {
    console.log('\n');
    console.log('='.repeat(55));
    console.log('  LINKEDIN JOB FINDER + AUTO EMAIL SENDER (PREMIUM)');
    console.log('  Tarun Kumar - Senior Backend Developer');
    console.log('='.repeat(55));
    console.log('');
    console.log('  Search Queries:  ' + CONFIG.searchQueries.length);
    console.log('  Mode:            Premium (Posts + Jobs search)');
    console.log('  Date Filter:     ' + CONFIG.dateFilter);
    console.log('  Scroll Count:    ' + CONFIG.scrollCount);
    console.log('  Email Delay:     ' + (CONFIG.emailDelay / 1000) + 's');
    console.log('');
    console.log('='.repeat(55));

    // Always do fresh search - no prompts, direct start
    let skipSearch = false;
    log('\nStarting directly... no ENTER needed!\n');

    // --- Step 0: Get App Password & Verify Gmail EARLY ---
    if (!CONFIG.appPassword) {
        console.log('Gmail App Password chahiye email bhejne ke liye.');
        console.log('Generate karo: https://myaccount.google.com/apppasswords');
        console.log('(2-Step Verification ON hona chahiye)\n');
        CONFIG.appPassword = await ask('App Password enter karo (16 digits, spaces ok): ');
        CONFIG.appPassword = CONFIG.appPassword.replace(/\s/g, '');
        if (CONFIG.appPassword.length < 10) {
            console.log('\nApp Password galat lag raha hai. Phir se try karo.');
            process.exit(1);
        }
    }

    // Gmail connection pooling ON - ek connection reuse hoga, har email pe naya nahi banega
    log('Gmail connection verify ho raha hai...');
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 2,
        maxMessages: 100,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        auth: { user: CONFIG.senderEmail, pass: CONFIG.appPassword },
    });
    // 3 baar try karega - network slow ho to retry kare
    let gmailConnected = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await transporter.verify();
            log('Gmail connection successful!\n');
            gmailConnected = true;
            break;
        } catch (err) {
            log(`Gmail attempt ${attempt}/3 FAILED: ${err.message}`);
            if (attempt < 3) {
                log('5 sec mein retry kar raha...');
                await sleep(5000);
            }
        }
    }
    if (!gmailConnected) {
        log('Gmail connect nahi ho raha. Internet check karo aur phir se try karo.');
        process.exit(1);
    }

    let emailArray = [];
    let allJobs = [];
    let browser = null;
    let mainPage = null;
    let allProfiles = []; // DM ke liye profiles - outer scope mein hona chahiye

    if (skipSearch) {
        // Quick send mode - previous results se emails lo
        const prev = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf-8'));
        emailArray = prev.emails || [];
        allJobs = prev.jobPosts || [];
        log(`Previous results loaded: ${emailArray.length} emails, ${allJobs.length} job posts`);
    } else {

        // --- Step 1: Launch Browser (alag profile - Chrome band nahi karna padega) ---
        log('Browser launch ho raha hai...');
        log('Chrome khula reh sakta hai - koi problem nahi!\n');

        const tempProfileDir = path.join(__dirname, 'chrome-temp-profile');

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1366, height: 768 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1366,768',
            ],
            userDataDir: tempProfileDir,
        });

        const page = await browser.newPage();
        mainPage = page;

        // --- Step 2: LinkedIn open ---
        log('LinkedIn khol rahe hain...');
        try {
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
        } catch (e) {
            log('Page load slow hai, wait kar rahe hain...');
        }
        await sleep(5000);

        // Check if logged in
        const url = page.url();
        if (url.includes('/login') || url.includes('/checkpoint') || url.includes('authwall')) {
            log('Login chahiye - browser mein LinkedIn login karo...');
            log('Login detect hone tak wait kar raha hoon...');
            // Auto-detect login - har 3 sec check karega jab tak feed nahi aa jaata
            for (let i = 0; i < 60; i++) { // max 3 min wait
                await sleep(3000);
                const currentUrl = page.url();
                if (!currentUrl.includes('/login') && !currentUrl.includes('/checkpoint') && !currentUrl.includes('authwall')) {
                    log('Login detected! Continuing...');
                    break;
                }
                if ((i + 1) % 10 === 0) log(`  Still waiting for login... (${(i + 1) * 3}s)`);
            }
            // Feed pe jao
            try {
                await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
            } catch (e) { }
            await sleep(5000);
        }
        log('LinkedIn ready! Searching shuru...\n');

        // --- Step 3: Search & Extract Emails (PARALLEL TABS) ---
        const allEmails = new Map();

        // Function to extract emails from a single page/tab
        async function extractFromPage(tabPage) {
            return await tabPage.evaluate((ignoredDomains, skipKeywords) => {
                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                const results = { emails: [], posts: [] };

                const fullPageText = document.body.innerText || '';

                const jobKeywords = ['hiring', 'we are hiring', 'we\'re hiring', 'urgently hiring',
                    'looking for', 'send resume', 'send cv', 'send your resume', 'send your cv',
                    'job opening', 'job openings', 'open position', 'open positions',
                    'vacancy', 'vacancies', 'urgent requirement', 'immediate joiner',
                    'walk-in', 'walk in interview', 'developer needed', 'engineer needed',
                    'openings for', 'drop your', 'drop cv', 'drop resume',
                    'interested candidates', 'dm me', 'dm for', 'share your cv',
                    'apply now', 'apply here', 'currently hiring', 'actively hiring',
                    'looking to hire', 'we need', 'join our team', 'join us'];

                // ---- EXPERIENCE FILTER: Sirf 0-4 year experience wale posts ----
                function isExperienceMatch(text) {
                    const lower = text.toLowerCase();
                    // Patterns: "2-4 years", "3+ years", "1 to 5 years", "2 - 4 yrs", "3years", etc.
                    const expPatterns = [
                        /(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?|yr)/gi,   // "2-4 years", "1 to 5 yrs"
                        /(\d+)\s*\+?\s*(?:years?|yrs?|yr)\s*(?:of)?\s*(?:exp|experience)?/gi, // "3+ years", "2 years experience"
                        /experience\s*[:.]?\s*(\d+)\s*[-–to]*\s*(\d*)\s*(?:years?|yrs?|yr)?/gi, // "experience: 2-4 years"
                        /exp\s*[:.]?\s*(\d+)\s*[-–to]*\s*(\d*)\s*(?:years?|yrs?|yr)?/gi, // "exp: 3-5 yrs"
                    ];

                    let dominated = false; // true if only mentions experience outside 0-4

                    for (const pattern of expPatterns) {
                        let match;
                        while ((match = pattern.exec(lower)) !== null) {
                            const num1 = parseInt(match[1]);
                            const num2 = match[2] ? parseInt(match[2]) : num1;
                            const minExp = Math.min(num1, num2);
                            const maxExp = Math.max(num1, num2);

                            // Accept if any part of the range overlaps with 0-4
                            // e.g., "0-2" YES, "2-4" YES, "3-5" YES, "0-3" YES, "5-8" NO, "6+" NO
                            if (minExp <= 4 && maxExp >= 0) {
                                return true; // match! 0-4 range mein hai
                            }
                            dominated = true; // found exp mention but outside range
                        }
                    }

                    // Agar koi experience mention hi nahi hai, tab bhi accept karo
                    // (bahut posts mein experience nahi likha hota)
                    if (!dominated) return true;

                    return false; // sirf 5+ year wale mention mile, skip karo
                }

                // ---- JOB SEEKER FILTER: ye log khud job dhundh rahe hain, hiring nahi kar rahe ----
                function isJobSeekerPost(text) {
                    const lower = text.toLowerCase();
                    const seekerPatterns = [
                        'actively seeking', 'seeking opportunity', 'seeking opportunities',
                        'seeking a role', 'seeking roles', 'seeking job', 'seeking new',
                        'looking for opportunity', 'looking for opportunities',
                        'looking for a role', 'looking for roles', 'looking for a job',
                        'looking for backend developer roles', 'looking for developer roles',
                        'i am looking for', 'i\'m looking for',
                        'open to work', '#opentowork', '#fresherjobs', '#jobseekers',
                        'fresher looking', 'immediate joining', // when candidate says it about themselves
                        'hire me', 'i am available', 'i\'m available',
                        'appreciate a referral', 'need a referral',
                        'open for opportunities', 'actively looking',
                    ];
                    const hasSeekerPattern = seekerPatterns.some(p => lower.includes(p));
                    if (!hasSeekerPattern) return false;

                    // Double check: agar "we are hiring" ya "we're looking for" hai to ye HR ki post hai
                    const hirerPatterns = ['we are hiring', 'we\'re hiring', 'we are looking',
                        'we\'re looking', 'our team', 'our company', 'join our', 'join us'];
                    const isHirerPost = hirerPatterns.some(p => lower.includes(p));
                    if (isHirerPost) return false; // HR/company ki post hai, skip mat karo

                    return true; // job seeker hai, skip karo
                }

                // ---- METHOD 1: Text chunks se posts dhundho ----
                const chunks = fullPageText.split(/(?:Like\s*\nComment\s*\nRepost\s*\nSend|Like\s*\n\s*Comment\s*\n\s*Repost|reactions?\s*\n|comments?\s*\n.*?likes?)/i);

                chunks.forEach(chunk => {
                    if (chunk.length < 80) return;
                    const lowerChunk = chunk.toLowerCase();

                    // Skip check: agar Java/PHP/.NET etc. ka post hai to skip karo
                    // SIRF tab allow karo jab specifically node.js/express mention ho (not just "backend")
                    const hasSkipKeyword = skipKeywords.some(kw => lowerChunk.includes(kw.toLowerCase()));
                    const hasNodeSpecific = lowerChunk.includes('node.js') || lowerChunk.includes('nodejs') ||
                        lowerChunk.includes('express.js') || lowerChunk.includes('expressjs') || lowerChunk.includes('mongodb');
                    if (hasSkipKeyword && !hasNodeSpecific) return;

                    // Job seeker ki post hai to skip karo
                    if (isJobSeekerPost(chunk)) return;

                    const isJobRelated = jobKeywords.some(kw => lowerChunk.includes(kw.toLowerCase()));

                    // Experience filter: sirf 1-5 year range wale posts
                    if (!isExperienceMatch(chunk)) return;

                    const emails = chunk.match(emailRegex) || [];
                    const validEmails = emails.filter(email => {
                        return !ignoredDomains.some(d => email.toLowerCase().includes(d));
                    });

                    if (isJobRelated) {
                        const snippet = chunk.substring(0, 200).replace(/\n/g, ' ').trim();
                        results.posts.push({ name: 'Post', snippet, emails: validEmails });

                        validEmails.forEach(email => {
                            if (!results.emails.some(e => e.email === email.toLowerCase())) {
                                results.emails.push({ email: email.toLowerCase(), source: '', snippet: chunk.substring(0, 150) });
                            }
                        });
                    }
                });

                // ---- METHOD 2: CSS selectors (backup) ----
                const postSelectors = [
                    '.feed-shared-update-v2',
                    '[data-urn*="update"]',
                    '.occludable-update',
                    '.scaffold-finite-scroll__content > div',
                    '[data-id]',
                    '.update-components-text',
                ];
                let postEls = [];
                for (const sel of postSelectors) {
                    const found = document.querySelectorAll(sel);
                    if (found.length > postEls.length) postEls = Array.from(found);
                }

                postEls.forEach(post => {
                    const text = post.innerText || '';
                    if (text.length < 80) return;

                    const lowerText = text.toLowerCase();
                    const hasSkipKw = skipKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
                    const hasNodeSpecificKw = lowerText.includes('node.js') || lowerText.includes('nodejs') ||
                        lowerText.includes('express.js') || lowerText.includes('expressjs') || lowerText.includes('mongodb');
                    if (hasSkipKw && !hasNodeSpecificKw) return;

                    // Job seeker ki post hai to skip karo
                    if (isJobSeekerPost(text)) return;

                    // Experience filter: sirf 1-5 year range wale posts
                    if (!isExperienceMatch(text)) return;

                    // Extract poster profile URL
                    let posterProfileUrl = '';
                    let posterName = '';
                    const profileLinkSelectors = [
                        '.update-components-actor__meta-link',
                        '.update-components-actor a[href*="/in/"]',
                        'a.app-aware-link[href*="/in/"]',
                        '.feed-shared-actor a[href*="/in/"]',
                        'a[data-control-name="actor"]',
                    ];
                    for (const sel of profileLinkSelectors) {
                        const linkEl = post.querySelector(sel);
                        if (linkEl && linkEl.href && linkEl.href.includes('/in/')) {
                            posterProfileUrl = linkEl.href.split('?')[0];
                            break;
                        }
                    }
                    if (!posterProfileUrl) {
                        const allLinks = post.querySelectorAll('a[href*="/in/"]');
                        for (const link of allLinks) {
                            const href = link.href || '';
                            if (href.includes('linkedin.com/in/') && !href.includes('/in/app/')) {
                                posterProfileUrl = href.split('?')[0];
                                break;
                            }
                        }
                    }
                    const nameSelectors = [
                        '.update-components-actor__name span',
                        '.feed-shared-actor__name span',
                        '.update-components-actor__title span',
                    ];
                    for (const sel of nameSelectors) {
                        const nameEl = post.querySelector(sel);
                        if (nameEl && nameEl.innerText.trim()) {
                            posterName = nameEl.innerText.trim();
                            break;
                        }
                    }

                    // Poster ka headline/title extract karo (HR/Recruiter check ke liye)
                    let posterHeadline = '';
                    const headlineSelectors = [
                        '.update-components-actor__description span',
                        '.update-components-actor__supplementary-actor-info span',
                        '.feed-shared-actor__description span',
                        '.update-components-actor__meta span',
                    ];
                    for (const sel of headlineSelectors) {
                        const headEl = post.querySelector(sel);
                        if (headEl && headEl.innerText.trim().length > 3) {
                            posterHeadline = headEl.innerText.trim().toLowerCase();
                            break;
                        }
                    }

                    // Check: poster HR/Recruiter/Founder/CTO/relevant person hai ya nahi
                    const relevantRoles = ['hr', 'human resource', 'recruiter', 'recruiting', 'talent',
                        'hiring', 'staffing', 'founder', 'co-founder', 'cofounder', 'ceo', 'cto',
                        'tech lead', 'engineering manager', 'team lead', 'head of', 'lead',
                        'vp of engineering', 'director', 'manager', 'consultant',
                        'developer', 'engineer', 'architect', 'devops', 'sde', 'swe'];
                    const skipRoles = ['student', 'fresher', 'intern', 'learner', 'aspiring',
                        'looking for job', 'looking for opportunity', 'seeking', 'b.tech', 'btech',
                        'mca', 'graduate', 'undergraduate', 'trainee', 'open to work'];
                    const isPosterSkip = posterHeadline && skipRoles.some(role => posterHeadline.includes(role));
                    // Agar headline empty hai to allow karo (benefit of doubt), sirf skip jab headline mili aur irrelevant hai
                    const isPosterRelevant = !isPosterSkip && (posterHeadline === '' || relevantRoles.some(role => posterHeadline.includes(role)));

                    const emails = text.match(emailRegex) || [];
                    const validEmails = emails.filter(email => {
                        return !ignoredDomains.some(d => email.toLowerCase().includes(d));
                    });

                    const isJobPost = jobKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
                    // Email extract - hiring post se email lena theek hai (chahe koi bhi post kare)
                    if (validEmails.length > 0 && isJobPost) {
                        validEmails.forEach(email => {
                            if (!results.emails.some(e => e.email === email.toLowerCase())) {
                                results.emails.push({ email: email.toLowerCase(), source: '', snippet: text.substring(0, 150), profileUrl: posterProfileUrl, posterName: posterName });
                            }
                        });
                    }
                    // DM/Connection ke liye profile save karo - headline empty ho to allow, skip sirf jab student/fresher ho
                    if (posterProfileUrl && isJobPost && isPosterRelevant) {
                        if (!results.profiles) results.profiles = [];
                        if (!results.profiles.some(p => p.profileUrl === posterProfileUrl)) {
                            results.profiles.push({ profileUrl: posterProfileUrl, posterName: posterName, headline: posterHeadline });
                        }
                    }
                });

                return results;
            }, IGNORED_DOMAINS, CONFIG.skipKeywords);
        }

        async function searchOneQuery(tabPage, query, queryIndex, totalQueries) {
            const dateParam = `&datePosted=%22${CONFIG.dateFilter}%22`;
            const locationParam = CONFIG.locationFilter ? `&authorGeoRegion=%5B${CONFIG.geoIds.map(id => `%22${id}%22`).join('%2C')}%5D` : '';
            const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER${dateParam}${locationParam}&sortBy=%22date_posted%22`;

            try {
                await tabPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) { }

            await randomSleep(2000, 3000);

            let hasResults = true;
            try {
                hasResults = await tabPage.evaluate(() => {
                    const text = document.body.innerText || '';
                    return !text.includes('No results found') && !text.includes('Try different keywords');
                });
            } catch (e) { }
            if (!hasResults) return { emails: [], posts: [], profiles: [] };

            for (let s = 0; s < CONFIG.scrollCount; s++) {
                try {
                    await tabPage.evaluate(() => {
                        window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
                    });
                    await randomSleep(1000, 1800);

                    await tabPage.evaluate((extractComments) => {
                        document.querySelectorAll(
                            'button.see-more, button[aria-label="see more"], ' +
                            '.feed-shared-inline-show-more-text button, ' +
                            'button[aria-label="…more"], button.feed-shared-inline-show-more-text, ' +
                            '[data-control-name="see_more"], span.see-more-less-toggle--see-more'
                        ).forEach(btn => { try { btn.click(); } catch (e) { } });

                        if (extractComments) {
                            document.querySelectorAll(
                                'button[aria-label*="comment"], button[aria-label*="Comment"], ' +
                                'span.social-details-social-counts__comments-count, ' +
                                '.social-details-social-counts__comments, ' +
                                'button.comment-button, [data-control-name="comment"]'
                            ).forEach(btn => { try { btn.click(); } catch (e) { } });
                            document.querySelectorAll(
                                'button.comments-comments-list__load-more-comments-button, ' +
                                'button[aria-label*="Load more comments"], ' +
                                'button[aria-label*="previous comments"]'
                            ).forEach(btn => { try { btn.click(); } catch (e) { } });
                        }
                    }, CONFIG.extractComments);
                } catch (scrollErr) {
                    log(`  Scroll ${s + 1} failed, extracting what we have...`);
                    break;
                }
            }

            let extracted;
            try {
                extracted = await extractFromPage(tabPage);
            } catch (extractErr) {
                log(`  Extraction failed: ${extractErr.message}`);
                extracted = { emails: [], posts: [], profiles: [] };
            }

            // Separate profile URL extraction - scan full page text for hiring + profiles
            try {
                const pageProfiles = await tabPage.evaluate(() => {
                    const profiles = [];
                    const fullText = (document.body.innerText || '').toLowerCase();

                    // Page level check - kya is page pe koi hiring post hai?
                    const jobWords = ['hiring', 'we are hiring', 'we\'re hiring', 'urgently hiring',
                        'looking for', 'send resume', 'send cv', 'job opening', 'open position',
                        'vacancy', 'urgent requirement', 'immediate joiner', 'developer needed',
                        'drop your', 'drop cv', 'interested candidates', 'dm me', 'share your cv',
                        'apply now', 'currently hiring', 'actively hiring', 'looking to hire',
                        'we need', 'join our team', 'join us'];
                    const pageHasJobs = jobWords.some(kw => fullText.includes(kw));
                    if (!pageHasJobs) return profiles;

                    // Job seeker words - skip these profiles
                    const seekerWords = ['actively seeking', 'seeking opportunity', 'looking for a role',
                        'looking for a job', 'open to work', '#opentowork', '#fresherjobs',
                        'hire me', 'appreciate a referral', 'actively looking'];

                    // Scan all profile links
                    const allLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
                    const seen = new Set();

                    allLinks.forEach(link => {
                        const href = link.href || '';
                        if (href.includes('/in/app/') || href.includes('/in/miniprofile')) return;

                        const profileUrl = href.split('?')[0];
                        if (seen.has(profileUrl)) return;

                        // Valid profile URL check
                        const inParts = profileUrl.split('/in/')[1];
                        if (!inParts) return;
                        if (inParts.split('/').filter(Boolean).length > 1) return;
                        if (profileUrl.includes('/overlay/') || profileUrl.includes('/details/')) return;

                        // Get name
                        let name = '';
                        const spans = link.querySelectorAll('span');
                        for (const span of spans) {
                            const t = (span.innerText || '').trim();
                            if (t.length > 2 && t.length < 60 && !/^(Like|Comment|Follow|Share|Repost|View|More)/.test(t)) {
                                name = t;
                                break;
                            }
                        }
                        if (!name) name = (link.innerText || '').trim().split('\n')[0].trim();
                        if (name.length > 60) name = name.substring(0, 60);
                        if (name.length < 3) return;

                        const badNames = ['view', 'follow', 'connect', 'message', 'more', 'like', 'comment', 'share', 'repost'];
                        if (badNames.some(b => name.toLowerCase().startsWith(b))) return;

                        // Get nearby text (parent container ~500 chars)
                        let nearbyText = '';
                        let el = link;
                        for (let i = 0; i < 6; i++) {
                            el = el.parentElement;
                            if (!el) break;
                            if ((el.innerText || '').length > 200) {
                                nearbyText = (el.innerText || '').toLowerCase().substring(0, 800);
                                break;
                            }
                        }

                        // Check: nearby text mein hiring words hain?
                        const isNearJob = jobWords.some(kw => nearbyText.includes(kw));
                        if (!isNearJob) return;

                        // Check: job seeker ki post to nahi?
                        const isSeeker = seekerWords.some(w => nearbyText.includes(w));
                        if (isSeeker) return;

                        seen.add(profileUrl);
                        profiles.push({ profileUrl, posterName: name });
                    });
                    return profiles;
                });

                if (pageProfiles.length > 0) {
                    if (!extracted.profiles) extracted.profiles = [];
                    pageProfiles.forEach(p => {
                        if (!extracted.profiles.some(x => x.profileUrl === p.profileUrl)) {
                            extracted.profiles.push(p);
                        }
                    });
                }
            } catch (profileErr) {
                // Silently continue - profile extraction is optional
            }

            return { ...extracted, query };
        }

        // Helper to collect results
        // allProfiles outer scope mein declared hai
        function collectResults(result) {
            const validExtracted = result.emails.filter(e => isValidEmail(e.email));
            validExtracted.forEach(e => {
                if (!allEmails.has(e.email)) {
                    allEmails.set(e.email, e);
                } else if (e.profileUrl && !allEmails.get(e.email).profileUrl) {
                    const existing = allEmails.get(e.email);
                    existing.profileUrl = e.profileUrl;
                    existing.posterName = e.posterName || existing.posterName;
                }
            });
            // Profiles without emails bhi collect karo (DM ke liye)
            (result.profiles || []).forEach(p => {
                if (!allProfiles.some(x => x.profileUrl === p.profileUrl)) {
                    allProfiles.push(p);
                }
            });
            if (validExtracted.length < result.emails.length) {
                log(`  ${result.emails.length - validExtracted.length} invalid emails filtered out`);
            }
            (result.posts || []).forEach(p => allJobs.push({ ...p, searchQuery: result.query }));
        }

        // Helper: Jobs section se emails nikalo - HARD timeout so it never hangs
        async function searchJobsForQuery(tabPage, query, queryIndex) {
            log(`  [${queryIndex + 1}] Jobs section bhi search kar raha...`);

            // Hard timeout wrapper - 15 sec mein jo bhi ho, aage badh jao
            const jobResult = await Promise.race([
                _searchJobsInner(tabPage, query, queryIndex),
                sleep(15000).then(() => { log(`  [${queryIndex + 1}] Jobs 15s timeout, skipping...`); return []; })
            ]);
            return jobResult;
        }

        async function _searchJobsInner(tabPage, query, queryIndex) {
            const jobUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&f_E=2%2C3%2C4&f_TPR=r604800&sortBy=DD`;

            try {
                // networkidle2 nahi, sirf commit - fastest possible
                await tabPage.goto(jobUrl, { waitUntil: 'commit', timeout: 10000 });
            } catch (e) {
                log(`  [${queryIndex + 1}] Jobs page skip...`);
                return [];
            }
            await sleep(3000); // 3 sec wait for content to render

            // Quick scroll - sirf 5 baar (jobs page mein zyada scroll zaruri nahi)
            for (let s = 0; s < 5; s++) {
                try {
                    await tabPage.evaluate(() => {
                        const jobsList = document.querySelector('.jobs-search-results-list') ||
                            document.querySelector('.scaffold-layout__list') ||
                            document.querySelector('[class*="jobs-search"]');
                        if (jobsList) jobsList.scrollTop = jobsList.scrollHeight;
                        window.scrollTo(0, document.documentElement.scrollHeight);
                    });
                    await randomSleep(800, 1200);
                } catch (e) { break; }
            }

            // Page text se emails extract karo
            let jobEmails = [];
            try {
                jobEmails = await tabPage.evaluate((ignoredDomains) => {
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    const found = [];
                    const emails = (document.body.innerText || '').match(emailRegex) || [];
                    emails.forEach(email => {
                        const lower = email.toLowerCase();
                        if (!ignoredDomains.some(d => lower.includes(d)) && !found.some(e => e.email === lower)) {
                            found.push({ email: lower, source: 'linkedin-jobs', snippet: '' });
                        }
                    });
                    return found;
                }, IGNORED_DOMAINS);
            } catch (e) { return []; }

            // Job cards click karke description se emails nikalo
            try {
                const jobCards = await tabPage.$$('.job-card-container, .jobs-search-results__list-item, [data-job-id]');
                const maxClicks = Math.min(jobCards.length, 8);

                for (let c = 0; c < maxClicks; c++) {
                    try {
                        await jobCards[c].click();
                        await randomSleep(600, 900);
                        const descEmails = await tabPage.evaluate((ignoredDomains) => {
                            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                            const descEl = document.querySelector('.jobs-description, .jobs-box__html-content, [class*="description"]');
                            if (!descEl) return [];
                            return (descEl.innerText.match(emailRegex) || [])
                                .map(e => e.toLowerCase())
                                .filter(e => !ignoredDomains.some(d => e.includes(d)));
                        }, IGNORED_DOMAINS);
                        descEmails.forEach(email => {
                            if (!jobEmails.some(e => e.email === email)) {
                                jobEmails.push({ email, source: 'linkedin-jobs', snippet: '' });
                            }
                        });
                    } catch (e) { }
                }
            } catch (e) { }

            return jobEmails;
        }

        // --- SINGLE LOOP: Har query ke liye Posts + Jobs dono ek saath ---
        const queries = CONFIG.searchQueries;

        for (let q = 0; q < queries.length; q++) {
            try {
                const result = await searchOneQuery(page, queries[q], q, queries.length);
                collectResults(result);

                if (CONFIG.searchJobs) {
                    try {
                        const jobEmails = await searchJobsForQuery(page, queries[q], q);
                        const validJobEmails = jobEmails.filter(e => isValidEmail(e.email));
                        validJobEmails.forEach(e => {
                            if (!allEmails.has(e.email)) allEmails.set(e.email, e);
                        });
                    } catch (jobErr) {
                        log(`  [${q + 1}] Jobs search failed, continuing... (${jobErr.message})`);
                    }
                }

                log(`[${q + 1}/${queries.length}] "${queries[q]}" → ${result.emails.length} emails, ${(result.profiles || []).length} profiles (total: ${allEmails.size} emails, ${allProfiles.length} profiles)`);
            } catch (queryErr) {
                log(`[${q + 1}/${queries.length}] "${queries[q]}" → FAILED: ${queryErr.message}`);
                log(`  Recovering and continuing to next query...`);
                // Page recover karo - LinkedIn feed pe wapas jao
                try {
                    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await randomSleep(2000, 4000);
                } catch (e) {
                    log(`  Page recovery bhi fail - trying to continue anyway...`);
                }
            }

            if (q < queries.length - 1) {
                await randomSleep(2000, 3000);
            }
        }

        // --- Step 3C: Google Search for emails (extra source!) ---
        if (CONFIG.searchGoogle) {
            log('\n========== Google Search for emails ==========\n');

            const googleQueries = [
                'hiring node.js backend developer send resume email',
                'node.js developer job opening contact email',
                'backend developer hiring immediate joiner email',
                'hiring express.js developer send cv email',
                'senior backend developer node.js opening email resume',
                'node.js developer vacancy email contact',
                'backend engineer hiring email apply',
                'senior node.js developer job email',
                'node.js backend developer',
                'fintech backend developer',
                'backend developer',
                'Software developer',
                'Software Engineer',
                'Senior Backend Developer',
                'Remote Backend Developer',
                'Backend Developer hiring',
                'senior backend developer node.js',
                'node.js backend developer immediate joiner',
                'node.js senior backend developer hiring',
                'hiring node.js backend developer send resume',
                'node.js backend developer job opening',
                'looking for node.js backend developer',
                'hiring nodejs express.js backend developer',
                'senior backend developer',
                'lead backend developer',
            ];

            for (let g = 0; g < googleQueries.length; g++) {
                const gQuery = googleQueries[g];
                log(`[Google ${g + 1}/${googleQueries.length}] "${gQuery}"`);

                try {
                    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(gQuery)}&num=30`;
                    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await randomSleep(2000, 3000);

                    // Extract emails from Google search results page
                    const googleEmails = await page.evaluate((ignoredDomains) => {
                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const found = [];
                        const text = document.body.innerText || '';
                        const emails = text.match(emailRegex) || [];
                        emails.forEach(email => {
                            const lower = email.toLowerCase();
                            if (!ignoredDomains.some(d => lower.includes(d)) && !found.some(e => e.email === lower)) {
                                found.push({ email: lower, source: 'google', snippet: '' });
                            }
                        });
                        return found;
                    }, IGNORED_DOMAINS);

                    // Click on top 5 search results and extract emails from those pages
                    const links = await page.$$('a[href*="linkedin.com"], a[href*="naukri"], a[href*="indeed"], a h3');
                    const maxLinks = Math.min(links.length, 5);

                    for (let l = 0; l < maxLinks; l++) {
                        try {
                            const href = await links[l].evaluate(el => {
                                const a = el.closest('a') || el;
                                return a.href || '';
                            });
                            if (!href || href.includes('google.com') || href.includes('accounts.google')) continue;

                            await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                            await randomSleep(1500, 2500);

                            const pageEmails = await page.evaluate((ignoredDomains) => {
                                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                                const found = [];
                                const text = document.body.innerText || '';
                                const emails = text.match(emailRegex) || [];
                                emails.forEach(email => {
                                    const lower = email.toLowerCase();
                                    if (!ignoredDomains.some(d => lower.includes(d)) && !found.some(e => e.email === lower)) {
                                        found.push({ email: lower, source: 'google-page', snippet: '' });
                                    }
                                });
                                return found;
                            }, IGNORED_DOMAINS);

                            pageEmails.forEach(e => googleEmails.push(e));
                        } catch (e) { }
                    }

                    // Add valid emails to master list
                    const validGEmails = googleEmails.filter(e => isValidEmail(e.email));
                    const newFromGoogle = validGEmails.filter(e => !allEmails.has(e.email)).length;
                    validGEmails.forEach(e => {
                        if (!allEmails.has(e.email)) allEmails.set(e.email, e);
                    });
                    if (newFromGoogle > 0) log(`  [Google ${g + 1}] ${newFromGoogle} new emails from Google`);

                } catch (e) {
                    log(`  [Google ${g + 1}] Failed, skipping...`);
                }

                // Navigate back to Google for next query
                await randomSleep(2000, 4000);
            }

            log(`\nGoogle search done. Total: ${allEmails.size} unique emails`);
        }

        // --- Step 4: Show Results ---
        emailArray = Array.from(allEmails.values());

        console.log('\n' + '='.repeat(55));
        console.log(`  RESULTS`);
        console.log('='.repeat(55));
        console.log(`  Total emails found: ${emailArray.length}`);
        console.log(`  Total job posts:    ${allJobs.length}`);
        console.log('='.repeat(55) + '\n');

        if (emailArray.length === 0) {
            log('Koi email nahi mila. Possible reasons:');
            log('  1. LinkedIn ne bot detect kar liya - thodi der baad try karo');
            log('  2. Posts mein email nahi tha');
            log('  3. scrollCount badha do CONFIG mein (20-30)');
            log('\nAlternative: linkedin-job-search.js browser mein manually paste karo.');
            if (browser) if (browser) await browser.close();
            process.exit(0);
        }

        // Print emails
        emailArray.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.email}  (from: ${e.source})`);
        });

        // Save results to file
        const resultData = {
            extractedAt: new Date().toISOString(),
            totalEmails: emailArray.length,
            totalPosts: allJobs.length,
            emails: emailArray,
            jobPosts: allJobs,
        };
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(resultData, null, 2));
        log(`\nResults saved to: ${CONFIG.outputFile}`);

    } // end else (search mode)

    // --- Filter out already sent emails ---
    const sentEmails = loadSentEmails();
    const newEmails = emailArray.filter(e => !sentEmails.has(e.email.toLowerCase()));
    const skipped = emailArray.length - newEmails.length;

    if (skipped > 0) {
        log(`${skipped} emails skip kiye (pehle bhej chuke hain)`);
    }

    if (newEmails.length === 0 && !CONFIG.sendLinkedInDMs) {
        log('Saare emails pehle se bhej chuke hain! Naye posts dhundho.');
        if (browser) await browser.close();
        process.exit(0);
    }

    // --- Step 5: Direct Send (no confirmation needed) ---
    log(`${newEmails.length} NEW emails send ho rahe hain...`);

    // Check for resume attachment
    const resumePath = path.join(__dirname, 'Tarun_Kumar_Resume.pdf');
    const hasResume = fs.existsSync(resumePath);
    if (hasResume) {
        log('Resume file mila: Tarun_Kumar_Resume.pdf (attach hoga)\n');
    } else {
        log('Resume file nahi mili. Agar attach karna hai to "Tarun_Kumar_Resume.pdf" same folder mein rakho.\n');
    }

    let sent = 0, failed = 0;
    const sentLog = []; // sent emails track karenge

    // Resume file ek baar read karo (har email pe read nahi)
    const resumeBuffer = hasResume ? fs.readFileSync(resumePath) : null;

    // Send one email (with retry)
    async function sendOneEmail(recipient, index) {
        const mailOptions = {
            from: `"${CONFIG.senderName}" <${CONFIG.senderEmail}>`,
            replyTo: CONFIG.senderEmail,
            to: recipient.email,
            subject: CONFIG.emailSubject,
            text: getEmailText(),
            html: getEmailHTML(),
        };

        if (resumeBuffer) {
            mailOptions.attachments = [{
                filename: 'Tarun_Kumar_Resume.pdf',
                content: resumeBuffer,
            }];
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await transporter.sendMail(mailOptions);
                log(`[${index + 1}/${newEmails.length}] SENT: ${recipient.email}`);
                return true;
            } catch (err) {
                if (attempt === 1) {
                    log(`[${index + 1}/${newEmails.length}] Retry: ${recipient.email} - ${err.message}`);
                    await sleep(2000);
                } else {
                    log(`[${index + 1}/${newEmails.length}] FAILED: ${recipient.email} - ${err.message}`);
                }
            }
        }
        return false;
    }

    // Parallel batch email sending
    const batchSize = CONFIG.emailBatchSize;
    for (let i = 0; i < newEmails.length; i += batchSize) {
        const batch = newEmails.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(newEmails.length / batchSize);
        log(`Email batch ${batchNum}/${totalBatches} (${batch.length} emails)...`);

        // Send batch in parallel
        const results = await Promise.all(
            batch.map((recipient, j) => sendOneEmail(recipient, i + j))
        );

        // Count results & save sent emails
        results.forEach((success, j) => {
            if (success) {
                sent++;
                sentLog.push(batch[j].email);
            } else {
                failed++;
            }
        });

        // Save sent emails to file after each batch
        if (sentLog.length > 0) {
            const allSent = loadSentEmails();
            sentLog.forEach(e => allSent.add(e.toLowerCase()));
            fs.writeFileSync(SENT_LOG_FILE, JSON.stringify([...allSent], null, 2));
            sentLog.length = 0;
        }

        // Delay between batches (not between individual emails)
        if (i + batchSize < newEmails.length) {
            await randomSleep(CONFIG.emailDelay, CONFIG.emailDelay + 2000);
        }
    }

    // --- Step 5.5: LinkedIn DMs ---
    let dmResults = { sent: 0, connected: 0, failed: 0 };
    if (CONFIG.sendLinkedInDMs && mainPage) {
        // Page detached ho gayi ho to naya page banao
        let pageValid = false;
        try {
            await mainPage.title();
            pageValid = true;
        } catch(e) {
            pageValid = false;
        }
        if (!pageValid && browser) {
            log('Page crashed, naya page bana rahe hain...');
            try {
                mainPage = await browser.newPage();
                await mainPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
                await randomSleep(2000, 3000);
                log('Naya page ready!');
            } catch(e) {
                log('Naya page bhi fail. DMs skip kar rahe hain.');
                mainPage = null;
            }
        }
        if (!mainPage) {
            log('Page available nahi hai. DMs skip.');
        } else {

        console.log('\n' + '='.repeat(55));
        console.log('  LINKEDIN DM / CONNECTION REQUEST PHASE');
        console.log('='.repeat(55) + '\n');

        // Collect profiles from emails that have profileUrl + standalone profiles
        const profilesFromEmails = emailArray.filter(e => e.profileUrl).map(e => ({
            profileUrl: e.profileUrl,
            posterName: e.posterName || '',
            email: e.email,
        }));

        // Merge with allProfiles (profiles without emails)
        const allProfilesForDM = [...profilesFromEmails];
        allProfiles.forEach(p => {
            if (!allProfilesForDM.some(x => x.profileUrl === p.profileUrl)) {
                allProfilesForDM.push(p);
            }
        });

        // Deduplicate by profileUrl
        const uniqueProfiles = [];
        const seenUrls = new Set();
        allProfilesForDM.forEach(p => {
            const url = p.profileUrl.toLowerCase();
            if (!seenUrls.has(url)) {
                seenUrls.add(url);
                uniqueProfiles.push(p);
            }
        });

        log(`Found ${uniqueProfiles.length} profiles with URLs for DM`);

        if (uniqueProfiles.length > 0) {
            dmResults = await sendAllLinkedInDMs(mainPage, uniqueProfiles);

            console.log('\n' + '-'.repeat(40));
            console.log(`  DMs sent:                ${dmResults.sent}`);
            console.log(`  Connection requests:     ${dmResults.connected}`);
            console.log(`  Failed:                  ${dmResults.failed}`);
            console.log('-'.repeat(40));
        } else {
            log('Koi profile URL nahi mila DM ke liye. Next run mein hoga.');
        }
        } // end else (page valid)
    }

    // --- Step 6: Final Report ---
    console.log('\n' + '='.repeat(55));
    console.log('  FINAL REPORT');
    console.log('='.repeat(55));
    console.log(`  Emails sent:           ${sent}`);
    console.log(`  Emails failed:         ${failed}`);
    console.log(`  LinkedIn DMs sent:     ${dmResults.sent}`);
    console.log(`  Connection requests:   ${dmResults.connected}`);
    console.log(`  DMs failed:            ${dmResults.failed}`);
    console.log(`  Total emails:          ${emailArray.length}`);
    console.log(`  Profiles found:        ${emailArray.filter(e => e.profileUrl).length}`);
    console.log(`  Results file:          ${CONFIG.outputFile}`);
    console.log('='.repeat(55) + '\n');

    // Update results file with send status
    try {
        const savedData = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf-8'));
        savedData.emailsSent = (savedData.emailsSent || 0) + sent;
        savedData.emailsFailed = (savedData.emailsFailed || 0) + failed;
        savedData.dmsSent = (savedData.dmsSent || 0) + dmResults.sent;
        savedData.connectionsSent = (savedData.connectionsSent || 0) + dmResults.connected;
        savedData.sentAt = new Date().toISOString();
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(savedData, null, 2));
    } catch (e) { }

    if (browser) await browser.close();
    log('Done! Browser band ho gaya.');
}

// Run
main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});

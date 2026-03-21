const browserService = require('./browser.service');
const config = require('../config');
const { log, broadcast } = require('../websocket');
const SentDM = require('../models/SentDM');

// Per-user state
const userState = new Map();

function getState(userId) {
  const key = userId.toString();
  if (!userState.has(key)) {
    userState.set(key, { isSending: false, shouldStop: false });
  }
  return userState.get(key);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomSleep(min, max) {
  return sleep(Math.floor(Math.random() * (max - min)) + min);
}

async function loadSentDMs(userId) {
  try {
    const docs = await SentDM.find({ userId }).lean();
    const map = {};
    docs.forEach((d) => { map[d.profileUrl] = d.status || 'dm_sent'; });
    return map;
  } catch {
    return {};
  }
}

async function loadSentDMsSet(userId) {
  try {
    const docs = await SentDM.find({ userId }, { profileUrl: 1 }).lean();
    return new Set(docs.map((d) => d.profileUrl));
  } catch {
    return new Set();
  }
}

async function saveSentDM(userId, profileUrl, status) {
  await SentDM.updateOne(
    { userId, profileUrl: profileUrl.toLowerCase() },
    { userId, profileUrl: profileUrl.toLowerCase(), status: status || 'dm_sent', sentAt: new Date() },
    { upsert: true }
  );
}

function getDMStatus(userId) {
  const state = getState(userId);
  return { isSending: state.isSending, shouldStop: state.shouldStop };
}

function stopDMs(userId) {
  const state = getState(userId);
  state.shouldStop = true;
  log('DM stop requested', userId);
}

async function sendDirectMessage(page, messageButton, message, index, total) {
  try {
    // Close any open message overlays first
    await page.evaluate(() => {
      document.querySelectorAll('[class*="msg-overlay-list-bubble"] button, [class*="msg-overlay"] button').forEach((btn) => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('close')) { try { btn.click(); } catch {} }
      });
    });
    await sleep(800);

    // Click Message button
    await page.evaluate((btn) => btn.click(), messageButton);
    await randomSleep(3000, 5000);

    // Wait for any compose/modal to appear
    let composeFound = false;
    for (let attempt = 0; attempt < 3 && !composeFound; attempt++) {
      if (attempt > 0) await sleep(2000);
      composeFound = await page.evaluate(() => {
        const checks = [
          'div.msg-form__contenteditable',
          '[class*="msg-form"] div[contenteditable="true"]',
          'div[contenteditable="true"][aria-label*="Write" i]',
          'div[contenteditable="true"][aria-label*="message" i]',
          'input[placeholder*="Subject"]',
          '[class*="msg-form__placeholder"]',
        ];
        for (const sel of checks) {
          const el = document.querySelector(sel);
          if (el && el.offsetHeight > 0) return true;
        }
        return false;
      });
    }

    if (!composeFound) {
      const isPremium = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('inmail') || text.includes('send for free with premium') || text.includes('get premium');
      });
      await page.keyboard.press('Escape');
      await sleep(500);
      if (isPremium) return { success: false, method: 'dm', reason: 'premium_required' };
      return { success: false, method: 'dm', reason: 'compose_box_not_found' };
    }

    await randomSleep(300, 600);

    // DEBUG: Log all elements in compose area
    const debugInfo = await page.evaluate(() => {
      const info = [];
      // Find all interactive elements in the compose area
      const allElements = document.querySelectorAll('div[contenteditable], [role="textbox"], textarea, input, [class*="msg-form"], [class*="msg-overlay"], [class*="compose"]');
      allElements.forEach((el) => {
        if (el.offsetHeight > 0) {
          info.push({
            tag: el.tagName,
            class: el.className?.toString().substring(0, 80),
            contenteditable: el.getAttribute('contenteditable'),
            role: el.getAttribute('role'),
            placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || el.getAttribute('data-placeholder'),
            ariaLabel: el.getAttribute('aria-label'),
            type: el.getAttribute('type'),
            height: el.offsetHeight,
            width: el.offsetWidth,
            text: (el.innerText || '').substring(0, 30),
          });
        }
      });
      return info;
    });
    console.log('DEBUG compose elements:', JSON.stringify(debugInfo, null, 2));

    // Handle Subject field if present (InMail / Free message)
    const hasSubject = await page.evaluate(() => {
      const subj = document.querySelector('input[placeholder*="Subject"], input[name="subject"], input[aria-label*="Subject"]');
      return subj && subj.offsetHeight > 0;
    });

    if (hasSubject) {
      try {
        await page.click('input[placeholder*="Subject"]');
        await sleep(300);
        await page.keyboard.type('Regarding the open role', { delay: 15 });
        await sleep(500);
      } catch {}
    }

    // Focus message body using JavaScript (mouse click blocked by drag-drop overlay)
    await page.evaluate(() => {
      const el = document.querySelector('div.msg-form__contenteditable');
      if (el) {
        el.focus();
        // Place cursor inside the contenteditable
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    await sleep(500);

    // Type message using keyboard
    await page.keyboard.type(message, { delay: 20 });
    await sleep(800);

    // Verify message was typed
    let typed = await page.evaluate(() => {
      const el = document.querySelector('div.msg-form__contenteditable');
      return el && el.innerText.trim().length > 5;
    });

    // Fallback: direct DOM injection if keyboard didn't work
    if (!typed) {
      typed = await page.evaluate((msg) => {
        const el = document.querySelector('div.msg-form__contenteditable');
        if (el) {
          el.focus();
          el.innerHTML = '<p>' + msg.replace(/\n/g, '</p><p>') + '</p>';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return el.innerText.trim().length > 5;
        }
        return false;
      }, message);
    }

    if (!typed) {
      await page.keyboard.press('Escape');
      await sleep(300);
      return { success: false, method: 'dm', reason: 'message_not_typed' };
    }

    // Click Send button
    await randomSleep(500, 800);
    let sent = await page.evaluate(() => {
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = (btn.innerText || '').toLowerCase().trim();
        if ((label === 'send' || text === 'send') && !btn.disabled && btn.offsetHeight > 0) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!sent) { await page.keyboard.press('Enter'); }
    await randomSleep(2000, 3000);

    // Close overlays
    await page.evaluate(() => {
      document.querySelectorAll('[class*="msg-overlay"] button').forEach((btn) => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('close')) { try { btn.click(); } catch {} }
      });
    });
    await sleep(300);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(200); }

    return { success: true, method: 'dm' };
  } catch (err) {
    return { success: false, method: 'dm', reason: err.message };
  }
}

async function sendConnectionRequest(page, note, index, total) {
  try {
    const connectClicked = await page.evaluate(() => {
      const selectors = ['button[aria-label*="Connect"]', 'button[aria-label*="connect"]'];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.innerText.toLowerCase().includes('connect')) { btn.click(); return 'direct'; }
      }
      const moreBtn = document.querySelector('button[aria-label="More actions"], button[aria-label*="More"]');
      if (moreBtn) { moreBtn.click(); return 'more'; }
      return false;
    });

    if (!connectClicked) return { success: false, method: 'connect', reason: 'no_connect_button' };

    if (connectClicked === 'more') {
      await randomSleep(1000, 1500);
      const found = await page.evaluate(() => {
        const items = document.querySelectorAll('div[class*="dropdown"] li, [role="menuitem"], ul li');
        for (const item of items) {
          const text = (item.innerText || '').toLowerCase();
          if (text.includes('connect') && !text.includes('disconnect')) {
            const clickable = item.querySelector('button, a, span, div') || item;
            clickable.click();
            return true;
          }
        }
        return false;
      });
      if (!found) return { success: false, method: 'connect', reason: 'no_connect_in_dropdown' };
    }

    await randomSleep(1500, 2500);

    const noteAdded = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if ((btn.innerText || '').toLowerCase().includes('add a note')) { btn.click(); return true; }
      }
      return false;
    });

    if (noteAdded) {
      await randomSleep(1000, 1500);
      const noteBox = await page.$('textarea#custom-message, textarea[name="message"], textarea[id*="custom-message"]');
      if (noteBox) {
        await page.evaluate((box) => { box.focus(); box.click(); }, noteBox);
        await randomSleep(300, 500);
        await page.keyboard.type(note.substring(0, 300), { delay: 12 });
        await randomSleep(800, 1200);
      }
    }

    const sendClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn.innerText || '').toLowerCase().trim();
        if ((text === 'send' || text === 'send now' || text === 'send invitation' || text === 'connect') && !btn.disabled && btn.offsetHeight > 0) {
          btn.click(); return true;
        }
      }
      const modals = document.querySelectorAll('[role="dialog"], [class*="modal"]');
      for (const modal of modals) {
        if (modal.offsetHeight === 0) continue;
        const primaryBtns = modal.querySelectorAll('button[class*="primary"]');
        for (const btn of primaryBtns) {
          if (!btn.disabled && btn.offsetHeight > 0) { btn.click(); return true; }
        }
      }
      return false;
    });

    if (sendClicked) {
      await randomSleep(1500, 2500);
      return { success: true, method: 'connect' };
    }

    await page.keyboard.press('Escape');
    await sleep(300);
    return { success: false, method: 'connect', reason: 'modal_send_failed' };
  } catch (err) {
    return { success: false, method: 'connect', reason: err.message };
  }
}

async function sendSingleDM(page, profileUrl, message, connectionNote, index, total, sendConnectionReq) {
  const dmPromise = (async () => {
    try {
      try { await page.title(); } catch {
        return { success: false, method: 'error', reason: 'page_detached' };
      }

      try {
        await page.evaluate(() => {
          document.querySelectorAll('[class*="msg-overlay-list-bubble"] button, [class*="msg-overlay"] button').forEach((btn) => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('close')) { try { btn.click(); } catch {} }
          });
        });
        await sleep(500);
        for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(200); }
      } catch {}

      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await randomSleep(2000, 3000);

      for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(200); }

      const profileHeadline = await page.evaluate(() => {
        const selectors = [
          '.text-body-medium.break-words',
          '[class*="pv-top-card"] .text-body-medium',
          'h2.mt1 + .text-body-medium',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim().length > 3) return el.innerText.trim().toLowerCase();
        }
        return '';
      });

      const skipRoles = ['student', 'fresher', 'intern', 'learner', 'aspiring', 'looking for job', 'seeking', 'trainee', 'open to work'];
      if (profileHeadline && skipRoles.some((r) => profileHeadline.includes(r))) {
        return { success: false, method: 'none', reason: 'not_relevant_profile' };
      }

      const messageBtnInfo = await page.evaluate(() => {
        const selectors = ['button[aria-label*="Message"]', 'button[aria-label*="message"]'];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetHeight > 0) return { found: true, selector: sel };
        }
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
          if (dmResult.success) return dmResult;
          if (sendConnectionReq && (dmResult.reason === 'premium_required' || dmResult.reason === 'compose_box_not_found')) {
            await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await randomSleep(1500, 2500);
            return await sendConnectionRequest(page, connectionNote, index, total);
          }
          return dmResult;
        }
      }

      if (sendConnectionReq) {
        return await sendConnectionRequest(page, connectionNote, index, total);
      }

      return { success: false, method: 'none', reason: 'no_message_button' };
    } catch (err) {
      return { success: false, method: 'error', reason: err.message };
    }
  })();

  return Promise.race([
    dmPromise,
    sleep(30000).then(() => ({ success: false, method: 'timeout', reason: '30s timeout' })),
  ]);
}

async function sendAllDMs(userId, profiles) {
  const state = getState(userId);
  if (state.isSending) throw new Error('DMs already sending');
  state.isSending = true;
  state.shouldStop = false;

  const cfg = await config.loadConfig(userId);
  let page;
  try {
    page = await browserService.ensurePage();
  } catch (err) {
    state.isSending = false;
    log(`DM Error: ${err.message}`, userId);
    broadcast('dm:complete', { dmSent: 0, connectSent: 0, failed: 0, error: err.message }, userId);
    throw err;
  }

  const sentDMsSet = await loadSentDMsSet(userId);
  const newProfiles = profiles.filter((p) => !sentDMsSet.has(p.profileUrl.toLowerCase()));
  const toProcess = newProfiles.slice(0, cfg.maxDMsPerSession || 50);

  if (toProcess.length === 0) {
    state.isSending = false;
    log('No new profiles to DM (all already sent)', userId);
    broadcast('dm:complete', { dmSent: 0, connectSent: 0, failed: 0 }, userId);
    return { dmSent: 0, connectSent: 0, failed: 0 };
  }

  broadcast('dm:started', { total: toProcess.length, skipped: profiles.length - newProfiles.length }, userId);
  log(`Sending DMs to ${toProcess.length} profiles...`, userId);

  let dmSent = 0;
  let connectSent = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    if (state.shouldStop) break;
    const profile = toProcess[i];

    broadcast('dm:sending', { index: i, total: toProcess.length, name: profile.posterName, profileUrl: profile.profileUrl }, userId);
    log(`[DM ${i + 1}/${toProcess.length}] ${profile.posterName || 'Unknown'} (${profile.profileUrl})`, userId);

    const result = await sendSingleDM(
      page, profile.profileUrl, cfg.dmMessage || '', cfg.connectionNote || '',
      i, toProcess.length, cfg.sendConnectionRequest !== false
    );

    if (result.success) {
      if (result.method === 'dm') dmSent++;
      if (result.method === 'connect') connectSent++;
      await saveSentDM(userId, profile.profileUrl, result.method === 'dm' ? 'dm_sent' : 'connected');
      broadcast('dm:sent', { index: i, method: result.method, name: profile.posterName }, userId);
    } else {
      failed++;
      log(`  Reason: ${result.reason}`, userId);
      await saveSentDM(userId, profile.profileUrl, result.reason || 'failed');
      broadcast('dm:failed', { index: i, reason: result.reason, name: profile.posterName }, userId);
    }

    if (i < toProcess.length - 1 && !state.shouldStop) {
      const delayMs = Math.floor(Math.random() * ((cfg.dmDelayMax || 20000) - (cfg.dmDelayMin || 10000))) + (cfg.dmDelayMin || 10000);
      await sleep(delayMs);
    }
  }

  state.isSending = false;
  state.shouldStop = false;
  broadcast('dm:complete', { dmSent, connectSent, failed }, userId);
  log(`DMs complete! DMs: ${dmSent}, Connections: ${connectSent}, Failed: ${failed}`, userId);
  return { dmSent, connectSent, failed };
}

module.exports = { sendAllDMs, stopDMs, getDMStatus, loadSentDMs, loadSentDMsSet };

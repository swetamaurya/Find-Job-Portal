const browserService = require('./browser.service');
const config = require('../config');
const configService = require('./config.service');
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
    await randomSleep(2000, 3500);

    // Wait for compose to appear
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

    // Remove the drag-and-drop overlay that blocks mouse clicks
    await page.evaluate(() => {
      document.querySelectorAll('[class*="msg-form__attachment-drag"], [class*="attachment-drag-and-drop"]').forEach((el) => {
        el.style.display = 'none';
      });
    });
    await sleep(300);

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

    let typed = false;

    // Strategy 1: CDP DOM.focus + keyboard.type (CDP sets real focus, keyboard.type triggers React events)
    if (!typed) {
      try {
        const client = await page.createCDPSession();
        const { root } = await client.send('DOM.getDocument');
        let nodeId = 0;
        const cdpSelectors = [
          'div.msg-form__contenteditable div[role="textbox"]',
          'div.msg-form__contenteditable[contenteditable="true"]',
          'div.msg-form__contenteditable',
        ];
        for (const sel of cdpSelectors) {
          try {
            const result = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
            if (result.nodeId) { nodeId = result.nodeId; break; }
          } catch {}
        }
        if (nodeId) {
          await client.send('DOM.focus', { nodeId });
          await sleep(400);
          await page.keyboard.type(message, { delay: 15 });
          await sleep(500);
          typed = await page.evaluate(() => {
            const el = document.querySelector('div.msg-form__contenteditable');
            return el && el.innerText.trim().length > 5;
          });
        }
        await client.detach();
      } catch (err) {
      }
    }

    // Strategy 2: Tab from Subject to body + keyboard.type
    if (!typed && hasSubject) {
      try {
        await page.click('input[placeholder*="Subject"]');
        await sleep(200);
        await page.keyboard.press('Tab');
        await sleep(600);
        await page.keyboard.type(message, { delay: 15 });
        await sleep(500);
        typed = await page.evaluate(() => {
          const el = document.querySelector('div.msg-form__contenteditable');
          return el && el.innerText.trim().length > 5;
        });
      } catch (err) {
      }
    }

    // Strategy 3: Click body + keyboard.type
    if (!typed) {
      try {
        const bodyEl = await page.$('div.msg-form__contenteditable');
        if (bodyEl) {
          await bodyEl.click();
          await sleep(400);
          await page.keyboard.type(message, { delay: 15 });
          await sleep(500);
          typed = await page.evaluate(() => {
            const el = document.querySelector('div.msg-form__contenteditable');
            return el && el.innerText.trim().length > 5;
          });
        }
      } catch (err) {
      }
    }

    // Strategy 4: CDP Input.insertText + event dispatch (fallback)
    if (!typed) {
      try {
        const client = await page.createCDPSession();
        const { root } = await client.send('DOM.getDocument');
        let nodeId = 0;
        for (const sel of ['div.msg-form__contenteditable[contenteditable="true"]', 'div.msg-form__contenteditable']) {
          try {
            const result = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
            if (result.nodeId) { nodeId = result.nodeId; break; }
          } catch {}
        }
        if (nodeId) {
          await client.send('DOM.focus', { nodeId });
          await sleep(300);
          await client.send('Input.insertText', { text: message });
          await sleep(300);
          // Dispatch events so React/LinkedIn recognizes the text and enables Send
          await page.evaluate(() => {
            const el = document.querySelector('div.msg-form__contenteditable');
            if (el) {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
              // Also press a space and backspace to trigger React's onChange
            }
          });
          await page.keyboard.press('Space');
          await page.keyboard.press('Backspace');
          await sleep(500);
          typed = await page.evaluate(() => {
            const el = document.querySelector('div.msg-form__contenteditable');
            return el && el.innerText.trim().length > 5;
          });
        }
        await client.detach();
      } catch (err) {
      }
    }

    if (!typed) {
      await page.keyboard.press('Escape');
      await sleep(300);
      return { success: false, method: 'dm', reason: 'message_not_typed' };
    }

    // Click Send button — wait for it to be enabled first
    await sleep(800);
    let sent = false;
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      if (attempt > 0) await sleep(1000);
      sent = await page.evaluate(() => {
        const allBtns = document.querySelectorAll('button');
        for (const btn of allBtns) {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = (btn.innerText || '').toLowerCase().trim();
          const cls = (btn.className || '').toLowerCase();
          if ((label === 'send' || text === 'send' || cls.includes('msg-form__send-btn')) && btn.offsetHeight > 0) {
            if (btn.disabled) return 'disabled';
            btn.click();
            return 'clicked';
          }
        }
        return 'not_found';
      });
      sent = sent === 'clicked';
    }

    if (!sent) {
      // Try submit via keyboard shortcut (Ctrl/Cmd + Enter)
      await page.keyboard.down('Meta');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Meta');
      await sleep(500);
    }
    await randomSleep(2000, 3000);

    // Verify compose closed (message was sent)
    const composeClosed = await page.evaluate(() => {
      const el = document.querySelector('div.msg-form__contenteditable');
      return !el || el.offsetHeight === 0 || el.innerText.trim().length < 5;
    });

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
          console.log(`[DM-DEBUG] ${index + 1}/${total} DM failed: ${dmResult.reason} → falling back to connection`);
          // Fallback to connection request if DM fails for any recoverable reason
          const fallbackReasons = ['premium_required', 'compose_box_not_found', 'message_not_typed'];
          if (sendConnectionReq && fallbackReasons.includes(dmResult.reason)) {
            await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await randomSleep(1500, 2500);
            const connResult = await sendConnectionRequest(page, connectionNote, index, total);
            connResult.dmFailReason = dmResult.reason;
            return connResult;
          }
          return dmResult;
        }
      } else {
        console.log(`[DM-DEBUG] ${index + 1}/${total} No Message button found → trying connection`);
      }

      if (sendConnectionReq) {
        const connResult = await sendConnectionRequest(page, connectionNote, index, total);
        connResult.dmFailReason = 'no_message_button';
        return connResult;
      }

      return { success: false, method: 'none', reason: 'no_message_button' };
    } catch (err) {
      return { success: false, method: 'error', reason: err.message };
    }
  })();

  return Promise.race([
    dmPromise,
    sleep(60000).then(() => ({ success: false, method: 'timeout', reason: '60s timeout' })),
  ]);
}

async function sendAllDMs(userId, profiles) {
  const state = getState(userId);
  if (state.isSending) throw new Error('DMs already sending');
  state.isSending = true;
  state.shouldStop = false;

  // Use getConfig which includes default dmMessage and connectionNote from user profile
  const cfg = await configService.getConfig(userId);
  let page;
  try {
    page = await browserService.ensurePage(userId);
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

    // Check if browser is still alive before each DM
    try {
      await page.title();
    } catch {
      log(`Browser disconnected after ${i} DMs. Stopping.`, userId);
      // Try to get a fresh page
      try {
        page = await browserService.ensurePage(userId);
      } catch {
        log('Browser is dead. Cannot continue DMs.', userId);
        break;
      }
    }

    broadcast('dm:sending', { index: i, total: toProcess.length, name: profile.posterName, profileUrl: profile.profileUrl }, userId);

    const result = await sendSingleDM(
      page, profile.profileUrl, cfg.dmMessage || '', cfg.connectionNote || '',
      i, toProcess.length, cfg.sendConnectionRequest !== false
    );

    if (result.success) {
      if (result.method === 'dm') dmSent++;
      if (result.method === 'connect') connectSent++;
      await saveSentDM(userId, profile.profileUrl, result.method === 'dm' ? 'dm_sent' : 'connected');
      broadcast('dm:sent', { index: i, method: result.method, name: profile.posterName }, userId);
      const dmFailInfo = result.dmFailReason ? ` (DM failed: ${result.dmFailReason})` : '';
      log(`[DM ${i + 1}/${toProcess.length}] ${profile.posterName || 'Unknown'} — ${result.method === 'dm' ? 'DM sent' : 'Connection sent'}${dmFailInfo}`, userId);
    } else {
      failed++;
      // If protocol error, browser is dead — stop loop
      if (result.reason && result.reason.includes('Protocol error')) {
        log(`[DM ${i + 1}/${toProcess.length}] ${profile.posterName || 'Unknown'} — Browser crashed, stopping DMs`, userId);
        break;
      }
      const dmFailInfo = result.dmFailReason ? `DM: ${result.dmFailReason}, Connect: ${result.reason}` : result.reason;
      log(`[DM ${i + 1}/${toProcess.length}] ${profile.posterName || 'Unknown'} — ${dmFailInfo}`, userId);
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

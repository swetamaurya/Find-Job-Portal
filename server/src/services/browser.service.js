const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log, broadcast } = require('../websocket');

// Per-user browser instances: Map<userId, { browser, page }>
const userBrowsers = new Map();

function getProfileDir(userId) {
  return path.join(config.CHROME_PROFILE_DIR, userId.toString());
}

function cleanProfileLocks(profileDir) {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  lockFiles.forEach((f) => {
    const p = path.join(profileDir, f);
    try { fs.unlinkSync(p); } catch {}
  });
}

async function launch(userId) {
  const key = userId.toString();
  const existing = userBrowsers.get(key);

  // Check if existing browser is still alive
  if (existing && existing.browser) {
    try {
      const pages = await existing.browser.pages();
      if (pages.length > 0) return { success: true, message: 'Browser already running' };
    } catch {
      // Browser dead - force cleanup
    }
    try { await existing.browser.close(); } catch {}
    userBrowsers.delete(key);
  }

  const profileDir = getProfileDir(userId);

  // Ensure profile dir exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Clean stale lock files from previous crashed sessions
  cleanProfileLocks(profileDir);

  log('Launching browser...', userId);
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768'],
    userDataDir: profileDir,
  });

  const page = await browser.newPage();

  // Dismiss any Chrome error dialogs (e.g. "Something went wrong when opening your profile")
  page.on('dialog', async (dialog) => {
    try { await dialog.accept(); } catch {}
  });

  userBrowsers.set(key, { browser, page });

  log('Browser launched!', userId);
  broadcast('browser:launched', {}, userId);
  return { success: true, message: 'Browser launched' };
}

async function close(userId) {
  const key = userId.toString();
  const entry = userBrowsers.get(key);
  if (entry && entry.browser) {
    try { await entry.browser.close(); } catch {}
    userBrowsers.delete(key);
    log('Browser closed', userId);
    broadcast('browser:closed', {}, userId);
  }
  return { success: true };
}

function getPage(userId) {
  const key = userId.toString();
  const entry = userBrowsers.get(key);
  return entry ? entry.page : null;
}

function getBrowser(userId) {
  const key = userId.toString();
  const entry = userBrowsers.get(key);
  return entry ? entry.browser : null;
}

async function isRunning(userId) {
  const key = userId.toString();
  const entry = userBrowsers.get(key);
  if (!entry || !entry.browser) return false;
  try {
    await entry.browser.pages();
    return true;
  } catch {
    userBrowsers.delete(key);
    return false;
  }
}

async function ensurePage(userId) {
  const key = userId.toString();
  const entry = userBrowsers.get(key);
  if (!entry || !entry.browser) throw new Error('Browser not launched');

  if (entry.page) {
    try {
      await entry.page.title();
      return entry.page;
    } catch {}
  }
  entry.page = await entry.browser.newPage();
  return entry.page;
}

module.exports = { launch, close, getPage, getBrowser, isRunning, ensurePage };

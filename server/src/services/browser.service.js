const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log, broadcast } = require('../websocket');

let browser = null;
let mainPage = null;

function cleanProfileLocks() {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  lockFiles.forEach((f) => {
    const p = path.join(config.CHROME_PROFILE_DIR, f);
    try { fs.unlinkSync(p); } catch {}
  });
}

async function launch() {
  // Check if existing browser is still alive
  if (browser) {
    try {
      const pages = await browser.pages();
      if (pages.length > 0) return { success: true, message: 'Browser already running' };
    } catch {
      // Browser dead - force cleanup
    }
    // Kill stale reference
    try { await browser.close(); } catch {}
    browser = null;
    mainPage = null;
  }

  // Clean stale lock files from previous crashed sessions
  cleanProfileLocks();

  log('Launching browser...');
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768'],
    userDataDir: config.CHROME_PROFILE_DIR,
  });

  mainPage = await browser.newPage();
  log('Browser launched!');
  broadcast('browser:launched', {});
  return { success: true, message: 'Browser launched' };
}

async function close() {
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
    mainPage = null;
    log('Browser closed');
    broadcast('browser:closed', {});
  }
  return { success: true };
}

function getPage() {
  return mainPage;
}

function getBrowser() {
  return browser;
}

async function isRunning() {
  if (!browser) return false;
  try {
    await browser.pages();
    return true;
  } catch {
    browser = null;
    mainPage = null;
    return false;
  }
}

async function ensurePage() {
  if (!browser) throw new Error('Browser not launched');
  if (mainPage) {
    try {
      await mainPage.title();
      return mainPage;
    } catch {}
  }
  mainPage = await browser.newPage();
  return mainPage;
}

module.exports = { launch, close, getPage, getBrowser, isRunning, ensurePage };

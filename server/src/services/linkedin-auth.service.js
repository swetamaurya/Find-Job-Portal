const browserService = require('./browser.service');
const { log, broadcast } = require('../websocket');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkLoginStatus(userId) {
  const page = browserService.getPage(userId);
  if (!page) return { loggedIn: false, reason: 'no_browser' };
  try {
    const url = page.url();
    if (url.includes('/feed') || url.includes('/mynetwork') || url.includes('/messaging') || url.includes('/search')) {
      return { loggedIn: true };
    }
    if (url.includes('/login') || url.includes('/checkpoint') || url.includes('authwall')) {
      return { loggedIn: false, reason: 'login_required' };
    }
    return { loggedIn: false, reason: 'unknown_page' };
  } catch {
    return { loggedIn: false, reason: 'page_error' };
  }
}

async function navigateToLinkedIn(userId) {
  const page = await browserService.ensurePage(userId);
  log('Navigating to LinkedIn...', userId);
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch {
    log('Page load slow, waiting...', userId);
  }
  await sleep(5000);

  const status = await checkLoginStatus(userId);
  if (!status.loggedIn) {
    log('Login required - please log in via the browser window', userId);
    broadcast('auth:login-required', {}, userId);
  } else {
    log('LinkedIn logged in!', userId);
    broadcast('auth:logged-in', {}, userId);
  }
  return status;
}

async function waitForLogin(userId, maxWaitSeconds = 180) {
  const page = browserService.getPage(userId);
  if (!page) throw new Error('No browser page');

  for (let i = 0; i < maxWaitSeconds / 3; i++) {
    await sleep(3000);
    const status = await checkLoginStatus(userId);
    if (status.loggedIn) {
      log('Login detected!', userId);
      broadcast('auth:logged-in', {}, userId);
      // Navigate to feed
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      } catch {}
      await sleep(3000);
      return { loggedIn: true };
    }
    if ((i + 1) % 10 === 0) log(`Still waiting for login... (${(i + 1) * 3}s)`, userId);
  }
  return { loggedIn: false, reason: 'timeout' };
}

module.exports = { checkLoginStatus, navigateToLinkedIn, waitForLogin };

const browserService = require('./browser.service');
const { log, broadcast } = require('../websocket');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkLoginStatus() {
  const page = browserService.getPage();
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

async function navigateToLinkedIn() {
  const page = await browserService.ensurePage();
  log('Navigating to LinkedIn...');
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch {
    log('Page load slow, waiting...');
  }
  await sleep(5000);

  const status = await checkLoginStatus();
  if (!status.loggedIn) {
    log('Login required - please log in via the browser window');
    broadcast('auth:login-required', {});
  } else {
    log('LinkedIn logged in!');
    broadcast('auth:logged-in', {});
  }
  return status;
}

async function waitForLogin(maxWaitSeconds = 180) {
  const page = browserService.getPage();
  if (!page) throw new Error('No browser page');

  for (let i = 0; i < maxWaitSeconds / 3; i++) {
    await sleep(3000);
    const status = await checkLoginStatus();
    if (status.loggedIn) {
      log('Login detected!');
      broadcast('auth:logged-in', {});
      // Navigate to feed
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      } catch {}
      await sleep(3000);
      return { loggedIn: true };
    }
    if ((i + 1) % 10 === 0) log(`Still waiting for login... (${(i + 1) * 3}s)`);
  }
  return { loggedIn: false, reason: 'timeout' };
}

module.exports = { checkLoginStatus, navigateToLinkedIn, waitForLogin };

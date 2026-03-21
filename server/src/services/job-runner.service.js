const browserService = require('./browser.service');
const authService = require('./linkedin-auth.service');
const searchService = require('./linkedin-search.service');
const emailService = require('./email-send.service');
const dmService = require('./dm.service');
const { log, broadcast } = require('../websocket');

// Per-user state
const userState = new Map();

function getState(userId) {
  const key = userId.toString();
  if (!userState.has(key)) {
    userState.set(key, { isRunning: false });
  }
  return userState.get(key);
}

async function runFullPipeline(userId) {
  const state = getState(userId);
  if (state.isRunning) throw new Error('Pipeline already running');

  const searchStatus = searchService.getSearchStatus(userId);
  const emailStatus = emailService.getSendStatus(userId);
  const dmStatus = dmService.getDMStatus(userId);

  if (searchStatus.isSearching) throw new Error('Search is already running');
  if (emailStatus.isSending) throw new Error('Emails are being sent');
  if (dmStatus.isSending) throw new Error('DMs are being sent');

  state.isRunning = true;

  try {
    broadcast('pipeline:started', {}, userId);
    log('Starting full pipeline...', userId);

    await browserService.launch();

    const authStatus = await authService.navigateToLinkedIn();
    if (!authStatus.loggedIn) {
      log('Waiting for login...', userId);
      const loginResult = await authService.waitForLogin(180);
      if (!loginResult.loggedIn) {
        throw new Error('Login timeout - please log in and try again');
      }
    }

    const searchResults = await searchService.startSearch(userId);

    if (searchResults.emails && searchResults.emails.length > 0) {
      await emailService.sendEmails(userId, searchResults.emails);
    }

    const cfg = await require('../config').loadConfig(userId);
    if (cfg.sendLinkedInDMs && searchResults.profiles && searchResults.profiles.length > 0) {
      const allProfiles = [...(searchResults.profiles || [])];
      searchResults.emails.forEach((e) => {
        if (e.profileUrl && !allProfiles.some((p) => p.profileUrl === e.profileUrl)) {
          allProfiles.push({ profileUrl: e.profileUrl, posterName: e.posterName || '' });
        }
      });
      await dmService.sendAllDMs(userId, allProfiles);
    }

    broadcast('pipeline:complete', {}, userId);
    log('Full pipeline complete!', userId);
  } catch (err) {
    log(`Pipeline error: ${err.message}`, userId);
    broadcast('pipeline:error', { error: err.message }, userId);
    throw err;
  } finally {
    state.isRunning = false;
  }
}

function getPipelineStatus(userId) {
  const state = getState(userId);
  return { isRunning: state.isRunning };
}

module.exports = { runFullPipeline, getPipelineStatus };

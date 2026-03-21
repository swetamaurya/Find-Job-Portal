const { Router } = require('express');
const browserService = require('../services/browser.service');
const authService = require('../services/linkedin-auth.service');
const searchService = require('../services/linkedin-search.service');

const router = Router();

router.post('/browser/launch', async (req, res) => {
  try {
    const result = await browserService.launch();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/browser/close', async (req, res) => {
  try {
    const result = await browserService.close();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/browser/status', async (req, res) => {
  const running = await browserService.isRunning();
  let loginStatus = { loggedIn: false, reason: 'no_browser' };
  if (running) {
    loginStatus = await authService.checkLoginStatus();
  }
  res.json({ browserRunning: running, ...loginStatus });
});

router.post('/browser/navigate', async (req, res) => {
  try {
    const result = await authService.navigateToLinkedIn();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/start', async (req, res) => {
  try {
    const status = searchService.getSearchStatus(req.userId);
    if (status.isSearching) return res.status(409).json({ error: 'Search already running' });
    res.json({ success: true, message: 'Search started' });
    searchService.startSearch(req.userId).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/stop', (req, res) => {
  searchService.stopSearch(req.userId);
  res.json({ success: true });
});

router.get('/search/status', (req, res) => {
  res.json(searchService.getSearchStatus(req.userId));
});

module.exports = router;

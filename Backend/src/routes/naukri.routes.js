const { Router } = require('express');
const naukriService = require('../services/naukri-search.service');

const router = Router();

router.post('/search/start', async (req, res) => {
  try {
    const browserService = require('../services/browser.service');
    const status = naukriService.getSearchStatus(req.userId);
    if (status.isSearching) return res.status(409).json({ error: 'Naukri search already running' });
    const browserRunning = await browserService.isRunning(req.userId);
    if (!browserRunning) return res.status(400).json({ error: 'Browser not launched. Launch browser first.' });
    res.json({ success: true, message: 'Naukri search started' });
    const { log } = require('../websocket');
    naukriService.startSearch(req.userId).catch((e) => log(`Naukri error: ${e.message}`, req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/stop', (req, res) => {
  naukriService.stopSearch(req.userId);
  res.json({ success: true });
});

router.get('/search/status', (req, res) => {
  res.json(naukriService.getSearchStatus(req.userId));
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await naukriService.getNaukriStats(req.userId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const result = await naukriService.getJobs(req.userId, {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

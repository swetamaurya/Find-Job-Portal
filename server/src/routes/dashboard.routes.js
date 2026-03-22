const { Router } = require('express');
const configService = require('../services/config.service');
const browserService = require('../services/browser.service');
const searchService = require('../services/linkedin-search.service');
const emailService = require('../services/email-send.service');
const dmService = require('../services/dm.service');
const jobRunner = require('../services/job-runner.service');

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await configService.getStats(req.userId);
    const isBrowserRunning = await browserService.isRunning(req.userId);
    const searchStatus = searchService.getSearchStatus(req.userId);
    const emailStatus = emailService.getSendStatus(req.userId);
    const dmStatus = dmService.getDMStatus(req.userId);
    const pipelineStatus = jobRunner.getPipelineStatus(req.userId);

    res.json({
      ...stats,
      browserRunning: isBrowserRunning,
      searchRunning: searchStatus.isSearching,
      emailSending: emailStatus.isSending,
      dmSending: dmStatus.isSending,
      pipelineRunning: pipelineStatus.isRunning,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/run-pipeline', async (req, res) => {
  try {
    const { log } = require('../websocket');
    const pipelineStatus = jobRunner.getPipelineStatus(req.userId);
    if (pipelineStatus.isRunning) throw new Error('Pipeline already running');
    if (searchService.getSearchStatus(req.userId).isSearching) throw new Error('Search is already running');
    if (emailService.getSendStatus(req.userId).isSending) throw new Error('Emails are being sent');
    if (dmService.getDMStatus(req.userId).isSending) throw new Error('DMs are being sent');

    res.json({ success: true, message: 'Pipeline started' });
    jobRunner.runFullPipeline(req.userId).catch((e) => log(`Pipeline error: ${e.message}`, req.userId));
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

module.exports = router;

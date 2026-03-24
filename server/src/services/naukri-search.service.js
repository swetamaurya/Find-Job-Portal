const browserService = require('./browser.service');
const { log, broadcast } = require('../websocket');
const { loadConfig } = require('../config');
const NaukriJob = require('../models/NaukriJob');

// Per-user state
const userState = new Map();

function getState(userId) {
  const key = userId.toString();
  if (!userState.has(key)) {
    userState.set(key, { isSearching: false, shouldStop: false, naukriPage: null });
  }
  return userState.get(key);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomSleep(min, max) {
  return sleep(Math.floor(Math.random() * (max - min)) + min);
}

function getSearchStatus(userId) {
  const state = getState(userId);
  return { isSearching: state.isSearching, shouldStop: state.shouldStop };
}

function stopSearch(userId) {
  const state = getState(userId);
  state.shouldStop = true;
  log('Naukri search stop requested', userId);
}

async function getNaukriStats(userId) {
  const total = await NaukriJob.countDocuments({ userId });
  const applied = await NaukriJob.countDocuments({ userId, status: 'applied' });
  const failed = await NaukriJob.countDocuments({ userId, status: 'failed' });
  const skipped = await NaukriJob.countDocuments({ userId, status: { $in: ['skipped', 'external'] } });
  return { total, applied, failed, skipped };
}

async function getJobs(userId, { status, page = 1, limit = 50 } = {}) {
  const query = { userId };
  if (status) query.status = status;
  const jobs = await NaukriJob.find(query).sort({ foundAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const total = await NaukriJob.countDocuments(query);
  return { jobs, total, page, limit };
}

async function applyToJob(naukriPage, job, userId) {
  try {
    await naukriPage.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomSleep(2000, 3000);

    // Check for Apply button type
    const applyInfo = await naukriPage.evaluate(() => {
      const selectors = [
        'button#apply-button', 'button.apply-button',
        'button[class*="apply"]', 'a[class*="apply"]',
        'button[id*="apply"]', '.apply-btn', '.styles_jhc__apply-button',
      ];
      let applyBtn = null;
      for (const sel of selectors) {
        applyBtn = document.querySelector(sel);
        if (applyBtn) break;
      }
      if (!applyBtn) {
        // Try text-based search
        const allBtns = document.querySelectorAll('button, a');
        for (const btn of allBtns) {
          const text = (btn.innerText || '').trim().toLowerCase();
          if (text === 'apply' || text === 'apply now' || text === 'apply on naukri') {
            applyBtn = btn;
            break;
          }
        }
      }
      if (!applyBtn) return { found: false };

      const text = (applyBtn.innerText || '').toLowerCase();
      if (text.includes('company site') || text.includes('apply on ') || text.includes('external')) {
        return { found: true, external: true };
      }
      // Check if already applied
      const pageText = (document.body.innerText || '').toLowerCase();
      if (pageText.includes('already applied') || pageText.includes('you have applied')) {
        return { found: true, alreadyApplied: true };
      }
      return { found: true, external: false };
    });

    if (!applyInfo.found) return { applied: false, reason: 'no_apply_button' };
    if (applyInfo.external) return { applied: false, external: true, reason: 'external_site' };
    if (applyInfo.alreadyApplied) return { applied: true, reason: 'already_applied' };

    // Click Apply button
    await naukriPage.evaluate(() => {
      const selectors = [
        'button#apply-button', 'button.apply-button',
        'button[class*="apply"]', 'a[class*="apply"]',
        'button[id*="apply"]', '.apply-btn', '.styles_jhc__apply-button',
      ];
      let btn = null;
      for (const sel of selectors) {
        btn = document.querySelector(sel);
        if (btn) break;
      }
      if (!btn) {
        const allBtns = document.querySelectorAll('button, a');
        for (const b of allBtns) {
          const text = (b.innerText || '').trim().toLowerCase();
          if (text === 'apply' || text === 'apply now' || text === 'apply on naukri') {
            btn = b;
            break;
          }
        }
      }
      if (btn) btn.click();
    });
    await randomSleep(2000, 4000);

    // Handle apply modal/form
    const submitted = await naukriPage.evaluate(() => {
      // Check for complex questionnaire
      const inputs = document.querySelectorAll(
        '.chatbot_DrawerContentWrapper input, .chatbot_DrawerContentWrapper textarea, ' +
        '.chatbot_DrawerContentWrapper select, .apply-modal input, .apply-modal textarea'
      );
      if (inputs.length > 2) return 'has_questions';

      // Look for Submit button
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn.innerText || '').toLowerCase().trim();
        if ((text === 'submit' || text === 'apply' || text.includes('submit application') || text.includes('apply now'))
          && !btn.disabled && btn.offsetHeight > 0) {
          btn.click();
          return 'submitted';
        }
      }

      // Check if it was instant apply (no modal)
      const pageText = (document.body.innerText || '').toLowerCase();
      if (pageText.includes('application submitted') || pageText.includes('applied successfully')) {
        return 'instant_applied';
      }
      return 'no_submit_button';
    });

    if (submitted === 'has_questions') return { applied: false, reason: 'has_questionnaire' };
    if (submitted === 'instant_applied') return { applied: true, reason: 'ok' };
    if (submitted === 'no_submit_button') return { applied: false, reason: 'no_submit_button' };

    await randomSleep(2000, 3000);

    // Verify success
    const success = await naukriPage.evaluate(() => {
      const text = (document.body.innerText || '').toLowerCase();
      return text.includes('application submitted') ||
        text.includes('applied successfully') ||
        text.includes('already applied') ||
        text.includes('you have applied');
    });

    return { applied: success, reason: success ? 'ok' : 'unconfirmed' };
  } catch (err) {
    return { applied: false, reason: err.message };
  }
}

async function startSearch(userId) {
  const state = getState(userId);
  if (state.isSearching) throw new Error('Naukri search already running');
  state.isSearching = true;
  state.shouldStop = false;

  try {
    const cfg = await loadConfig(userId);
    const browser = browserService.getBrowser(userId);
    if (!browser) throw new Error('Browser not launched. Launch browser first.');

    // Open new tab for Naukri
    const naukriPage = await browser.newPage();
    state.naukriPage = naukriPage;

    // Check Naukri login
    log('Checking Naukri login...', userId);
    try {
      await naukriPage.goto('https://www.naukri.com/mnjuser/homepage', { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch {}
    await randomSleep(2000, 3000);

    const currentUrl = naukriPage.url();
    if (currentUrl.includes('/nlogin') || currentUrl.includes('/login') || currentUrl.includes('about:blank')) {
      log('Naukri login required! Please log in via the browser window.', userId);
      broadcast('naukri:login-required', {}, userId);
      broadcast('naukri:complete', { applied: 0, failed: 0, skipped: 0, totalFound: 0 }, userId);
      try { await naukriPage.close(); } catch {}
      state.naukriPage = null;
      return;
    }

    log('Naukri logged in!', userId);

    const keywords = (cfg.naukriKeywords || []).join(' ');
    const locations = (cfg.naukriLocations || []).join(', ');
    const minExp = cfg.naukriMinExp || 0;
    const maxExp = cfg.naukriMaxExp || 5;
    const minSalary = cfg.naukriMinSalary || 0;
    const maxApply = cfg.naukriMaxApply || 20;
    const maxPages = 5;

    if (!keywords) {
      log('No Naukri keywords configured. Add keywords in the Naukri page.', userId);
      broadcast('naukri:complete', { applied: 0, failed: 0, skipped: 0, totalFound: 0 }, userId);
      try { await naukriPage.close(); } catch {}
      state.naukriPage = null;
      return;
    }

    broadcast('naukri:search:started', { keywords, location: locations }, userId);
    log(`Naukri search: "${keywords}" | Location: ${locations || 'Any'} | Exp: ${minExp}-${maxExp} yrs`, userId);

    // Phase 1: Scrape job listings
    let totalFound = 0;
    for (let page = 1; page <= maxPages && !state.shouldStop; page++) {
      const searchUrl = `https://www.naukri.com/joblist?k=${encodeURIComponent(keywords)}&l=${encodeURIComponent(locations)}&experience=${minExp}&nignbelow_salary=${minSalary * 100000}&pageNo=${page}`;

      log(`[Page ${page}/${maxPages}] Searching...`, userId);
      try {
        await naukriPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      } catch {}
      await randomSleep(2000, 4000);

      const jobs = await naukriPage.evaluate((maxExpFilter) => {
        const results = [];
        const cardSelectors = [
          'article.jobTuple', 'div.jobTuple', 'div.srp-jobtuple-wrapper',
          'div[class*="jobTuple"]', 'div[data-job-id]',
          '.cust-job-tuple', '.list > article', '.srp-jobtuple-wrapper',
        ];

        let cards = [];
        for (const sel of cardSelectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > cards.length) cards = Array.from(found);
        }

        // Fallback: look for job title links
        if (cards.length === 0) {
          const jobLinks = document.querySelectorAll('a[class*="title"][href*="/job/"]');
          jobLinks.forEach((link) => {
            let parent = link;
            for (let i = 0; i < 5; i++) {
              parent = parent.parentElement;
              if (!parent) break;
              if (parent.tagName === 'ARTICLE' || parent.getAttribute('data-job-id')) break;
            }
            if (parent && !cards.includes(parent)) cards.push(parent);
          });
        }

        cards.forEach((card) => {
          const titleEl = card.querySelector('a[class*="title"], a[href*="/job/"], h2 a, .row1 a, .info a');
          const companyEl = card.querySelector('a[class*="comp-name"], a.subTitle, .comp-name, .row2 span a, .companyInfo a');
          const expEl = card.querySelector('span[class*="exp"], li.experience, .expwdth, .exp');
          const salaryEl = card.querySelector('span[class*="sal"], li.salary, .sal');
          const locationEl = card.querySelector('span[class*="loc"], li.location, .locWdth, .loc');
          const skillEls = card.querySelectorAll('li.tag, span.tag, a.tag, .tags span, .skill');

          const title = titleEl ? titleEl.innerText.trim() : '';
          const jobUrl = titleEl ? (titleEl.href || '') : '';
          const jobIdMatch = jobUrl.match(/jobid-(\d+)/i) || jobUrl.match(/jid[=-](\d+)/i);
          const jobId = jobIdMatch ? jobIdMatch[1] : (card.getAttribute('data-job-id') || card.getAttribute('data-jobid') || '');

          if (!title || !jobId) return;

          // Check experience range
          const expText = expEl ? expEl.innerText.trim() : '';
          const expMatch = expText.match(/(\d+)/);
          if (expMatch && parseInt(expMatch[1]) > maxExpFilter) return;

          results.push({
            jobId,
            title,
            company: companyEl ? companyEl.innerText.trim() : '',
            experience: expText,
            salary: salaryEl ? salaryEl.innerText.trim() : '',
            location: locationEl ? locationEl.innerText.trim() : '',
            skills: Array.from(skillEls).map((el) => el.innerText.trim()).filter(Boolean).slice(0, 10),
            jobUrl,
          });
        });

        return results;
      }, maxExp);

      if (jobs.length === 0) {
        log(`[Page ${page}] No more jobs found`, userId);
        break;
      }

      let newOnPage = 0;
      for (const job of jobs) {
        try {
          const existing = await NaukriJob.findOne({ userId, jobId: job.jobId });
          if (existing) continue;
          await NaukriJob.create({ userId, ...job, status: 'found' });
          newOnPage++;
          totalFound++;
          broadcast('naukri:job:found', { title: job.title, company: job.company, totalFound }, userId);
        } catch {}
      }
      log(`[Page ${page}] Found ${jobs.length} jobs (${newOnPage} new)`, userId);

      if (page < maxPages) await randomSleep(2000, 3000);
    }

    log(`Search done! ${totalFound} new jobs found. Starting auto-apply...`, userId);

    // Phase 2: Auto-apply
    const jobsToApply = await NaukriJob.find({
      userId,
      status: 'found',
    }).sort({ foundAt: 1 }).limit(maxApply);

    let applied = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < jobsToApply.length && !state.shouldStop; i++) {
      const job = jobsToApply[i];
      broadcast('naukri:apply:started', {
        index: i, total: jobsToApply.length, title: job.title, company: job.company,
      }, userId);
      log(`[Apply ${i + 1}/${jobsToApply.length}] ${job.title} @ ${job.company}`, userId);

      const result = await applyToJob(naukriPage, job, userId);

      if (result.applied) {
        applied++;
        await NaukriJob.updateOne({ _id: job._id }, { status: 'applied', appliedAt: new Date() });
        broadcast('naukri:apply:success', { index: i, title: job.title, company: job.company, applied, failed, skipped }, userId);
        log(`[Apply ${i + 1}] APPLIED: ${job.title}`, userId);
      } else if (result.external) {
        skipped++;
        await NaukriJob.updateOne({ _id: job._id }, { status: 'external', applyType: 'external' });
        broadcast('naukri:apply:skipped', { index: i, title: job.title, reason: 'external' }, userId);
        log(`[Apply ${i + 1}] SKIPPED (external): ${job.title}`, userId);
      } else {
        failed++;
        await NaukriJob.updateOne({ _id: job._id }, { status: 'failed', failReason: result.reason });
        broadcast('naukri:apply:failed', { index: i, title: job.title, reason: result.reason }, userId);
        log(`[Apply ${i + 1}] FAILED (${result.reason}): ${job.title}`, userId);
      }

      if (i < jobsToApply.length - 1 && !state.shouldStop) {
        await randomSleep(3000, 6000);
      }
    }

    // Cleanup
    try { await naukriPage.close(); } catch {}
    state.naukriPage = null;

    broadcast('naukri:complete', { applied, failed, skipped, totalFound }, userId);
    log(`Naukri complete! Found: ${totalFound} | Applied: ${applied} | Failed: ${failed} | Skipped: ${skipped}`, userId);
  } catch (err) {
    log(`Naukri error: ${err.message}`, userId);
    broadcast('naukri:complete', { applied: 0, failed: 0, skipped: 0, totalFound: 0 }, userId);
  } finally {
    if (state.naukriPage) {
      try { await state.naukriPage.close(); } catch {}
      state.naukriPage = null;
    }
    state.isSearching = false;
    state.shouldStop = false;
  }
}

module.exports = { startSearch, stopSearch, getSearchStatus, getNaukriStats, getJobs };

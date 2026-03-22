const browserService = require('./browser.service');
const { isValidEmail, IGNORED_DOMAINS } = require('./email-extract.service');
const { log, broadcast } = require('../websocket');
const { loadConfig } = require('../config');
const ExtractedResult = require('../models/ExtractedResult');

// Per-user state
const userState = new Map();

function getState(userId) {
  const key = userId.toString();
  if (!userState.has(key)) {
    userState.set(key, { isSearching: false, shouldStop: false });
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
  log('Search stop requested', userId);
}

async function extractFromPage(tabPage, skipKeywords) {
  return tabPage.evaluate(
    (ignoredDomains, skipKw) => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const results = { emails: [], posts: [], profiles: [] };
      const debug = { totalChunks: 0, tooShort: 0, skippedByKeyword: 0, jobSeekerSkip: 0, expSkip: 0, notJobRelated: 0, noEmails: 0, domainFiltered: 0, passed: 0, totalPosts: 0, postTooShort: 0, postSkipKw: 0, postJobSeeker: 0, postExpSkip: 0, postNotJob: 0, postNoProfile: 0, postNotRelevant: 0, postPassed: 0 };
      const fullPageText = document.body.innerText || '';

      const jobKeywords = [
        'hiring', 'we are hiring', "we're hiring", 'urgently hiring',
        'looking for', 'send resume', 'send cv', 'send your resume', 'send your cv',
        'job opening', 'job openings', 'open position', 'open positions',
        'vacancy', 'vacancies', 'urgent requirement', 'immediate joiner',
        'walk-in', 'walk in interview', 'developer needed', 'engineer needed',
        'openings for', 'drop your', 'drop cv', 'drop resume',
        'interested candidates', 'dm me', 'dm for', 'share your cv',
        'apply now', 'apply here', 'currently hiring', 'actively hiring',
        'looking to hire', 'we need', 'join our team', 'join us',
      ];

      function isExperienceMatch(text) {
        const lower = text.toLowerCase();
        const expPatterns = [
          /(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?|yr)/gi,
          /(\d+)\s*\+?\s*(?:years?|yrs?|yr)\s*(?:of)?\s*(?:exp|experience)?/gi,
          /experience\s*[:.]?\s*(\d+)\s*[-–to]*\s*(\d*)\s*(?:years?|yrs?|yr)?/gi,
          /exp\s*[:.]?\s*(\d+)\s*[-–to]*\s*(\d*)\s*(?:years?|yrs?|yr)?/gi,
        ];
        let dominated = false;
        for (const pattern of expPatterns) {
          let match;
          while ((match = pattern.exec(lower)) !== null) {
            const num1 = parseInt(match[1]);
            const num2 = match[2] ? parseInt(match[2]) : num1;
            const minExp = Math.min(num1, num2);
            const maxExp = Math.max(num1, num2);
            if (minExp <= 4 && maxExp >= 0) return true;
            dominated = true;
          }
        }
        return !dominated;
      }

      function isJobSeekerPost(text) {
        const lower = text.toLowerCase();
        const seekerPatterns = [
          'actively seeking', 'seeking opportunity', 'seeking opportunities',
          'seeking a role', 'seeking roles', 'seeking job', 'seeking new',
          'looking for opportunity', 'looking for opportunities',
          'looking for a role', 'looking for roles', 'looking for a job',
          'i am looking for', "i'm looking for",
          'open to work', '#opentowork', '#fresherjobs', '#jobseekers',
          'fresher looking', 'hire me', 'i am available', "i'm available",
          'appreciate a referral', 'need a referral',
          'open for opportunities', 'actively looking',
        ];
        const hasSeekerPattern = seekerPatterns.some((p) => lower.includes(p));
        if (!hasSeekerPattern) return false;
        const hirerPatterns = [
          'we are hiring', "we're hiring", 'we are looking',
          "we're looking", 'our team', 'our company', 'join our', 'join us',
        ];
        return !hirerPatterns.some((p) => lower.includes(p));
      }

      // Method 1: Text chunks
      const chunks = fullPageText.split(
        /(?:Like\s*\nComment\s*\nRepost\s*\nSend|Like\s*\n\s*Comment\s*\n\s*Repost|reactions?\s*\n|comments?\s*\n.*?likes?)/i
      );

      chunks.forEach((chunk) => {
        debug.totalChunks++;
        if (chunk.length < 80) { debug.tooShort++; return; }
        const lowerChunk = chunk.toLowerCase();
        const hasSkipKeyword = skipKw.some((kw) => lowerChunk.includes(kw.toLowerCase()));
        const hasNodeSpecific =
          lowerChunk.includes('node.js') || lowerChunk.includes('nodejs') ||
          lowerChunk.includes('express.js') || lowerChunk.includes('expressjs') ||
          lowerChunk.includes('mongodb');
        if (hasSkipKeyword && !hasNodeSpecific) { debug.skippedByKeyword++; return; }
        if (isJobSeekerPost(chunk)) { debug.jobSeekerSkip++; return; }
        if (!isExperienceMatch(chunk)) { debug.expSkip++; return; }

        const isJobRelated = jobKeywords.some((kw) => lowerChunk.includes(kw.toLowerCase()));
        const emails = chunk.match(emailRegex) || [];
        const validEmails = emails.filter((email) => !ignoredDomains.some((d) => email.toLowerCase().includes(d)));

        if (isJobRelated) {
          debug.passed++;
          if (emails.length > 0 && validEmails.length === 0) debug.domainFiltered += emails.length;
          const snippet = chunk.substring(0, 200).replace(/\n/g, ' ').trim();
          results.posts.push({ name: 'Post', snippet, emails: validEmails });
          validEmails.forEach((email) => {
            if (!results.emails.some((e) => e.email === email.toLowerCase())) {
              results.emails.push({ email: email.toLowerCase(), source: '', snippet: chunk.substring(0, 150) });
            }
          });
        } else {
          debug.notJobRelated++;
        }
      });

      // Method 2: CSS selectors
      const postSelectors = [
        '.feed-shared-update-v2', '[data-urn*="update"]', '.occludable-update',
        '.scaffold-finite-scroll__content > div', '[data-id]', '.update-components-text',
      ];
      let postEls = [];
      for (const sel of postSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > postEls.length) postEls = Array.from(found);
      }

      const relevantRoles = [
        'hr', 'human resource', 'recruiter', 'recruiting', 'talent',
        'hiring', 'staffing', 'founder', 'co-founder', 'cofounder', 'ceo', 'cto',
        'tech lead', 'engineering manager', 'team lead', 'head of', 'lead',
        'vp of engineering', 'director', 'manager', 'consultant',
        'developer', 'engineer', 'architect', 'devops', 'sde', 'swe',
      ];
      const skipRolesArr = [
        'student', 'fresher', 'intern', 'learner', 'aspiring',
        'looking for job', 'looking for opportunity', 'seeking', 'b.tech', 'btech',
        'mca', 'graduate', 'undergraduate', 'trainee', 'open to work',
      ];

      postEls.forEach((post) => {
        debug.totalPosts++;
        const text = post.innerText || '';
        if (text.length < 80) { debug.postTooShort++; return; }
        const lowerText = text.toLowerCase();
        const hasSkipKw = skipKw.some((kw) => lowerText.includes(kw.toLowerCase()));
        const hasNodeSpecificKw =
          lowerText.includes('node.js') || lowerText.includes('nodejs') ||
          lowerText.includes('express.js') || lowerText.includes('expressjs') ||
          lowerText.includes('mongodb');
        if (hasSkipKw && !hasNodeSpecificKw) { debug.postSkipKw++; return; }
        if (isJobSeekerPost(text)) { debug.postJobSeeker++; return; }
        if (!isExperienceMatch(text)) { debug.postExpSkip++; return; }

        let posterProfileUrl = '';
        let posterName = '';
        const profileLinkSelectors = [
          '.update-components-actor__meta-link', '.update-components-actor a[href*="/in/"]',
          'a.app-aware-link[href*="/in/"]', '.feed-shared-actor a[href*="/in/"]',
          'a[data-control-name="actor"]',
        ];
        for (const sel of profileLinkSelectors) {
          const linkEl = post.querySelector(sel);
          if (linkEl && linkEl.href && linkEl.href.includes('/in/')) {
            posterProfileUrl = linkEl.href.split('?')[0];
            break;
          }
        }
        if (!posterProfileUrl) {
          const allLinks = post.querySelectorAll('a[href*="/in/"]');
          for (const link of allLinks) {
            const href = link.href || '';
            if (href.includes('linkedin.com/in/') && !href.includes('/in/app/')) {
              posterProfileUrl = href.split('?')[0];
              break;
            }
          }
        }
        const nameSelectors = [
          '.update-components-actor__name span', '.feed-shared-actor__name span',
          '.update-components-actor__title span',
        ];
        for (const sel of nameSelectors) {
          const nameEl = post.querySelector(sel);
          if (nameEl && nameEl.innerText.trim()) {
            // LinkedIn duplicates name (visible + screen reader spans), take first line only
            posterName = nameEl.innerText.trim().split('\n')[0].trim();
            break;
          }
        }

        let posterHeadline = '';
        const headlineSelectors = [
          '.update-components-actor__description span',
          '.update-components-actor__supplementary-actor-info span',
          '.feed-shared-actor__description span',
          '.update-components-actor__meta span',
        ];
        for (const sel of headlineSelectors) {
          const headEl = post.querySelector(sel);
          if (headEl && headEl.innerText.trim().length > 3) {
            posterHeadline = headEl.innerText.trim().split('\n')[0].trim().toLowerCase();
            break;
          }
        }

        const isPosterSkip = posterHeadline && skipRolesArr.some((role) => posterHeadline.includes(role));
        const isPosterRelevant = !isPosterSkip && (posterHeadline === '' || relevantRoles.some((role) => posterHeadline.includes(role)));

        const emails = text.match(emailRegex) || [];
        const validEmails = emails.filter((email) => !ignoredDomains.some((d) => email.toLowerCase().includes(d)));
        const isJobPost = jobKeywords.some((kw) => lowerText.includes(kw.toLowerCase()));

        if (validEmails.length > 0 && isJobPost) {
          validEmails.forEach((email) => {
            if (!results.emails.some((e) => e.email === email.toLowerCase())) {
              results.emails.push({
                email: email.toLowerCase(), source: '', snippet: text.substring(0, 150),
                profileUrl: posterProfileUrl, posterName,
              });
            }
          });
        }
        if (emails.length > 0 && validEmails.length === 0) debug.domainFiltered += emails.length;

        if (posterProfileUrl && isJobPost && isPosterRelevant) {
          debug.postPassed++;
          if (!results.profiles.some((p) => p.profileUrl === posterProfileUrl)) {
            results.profiles.push({ profileUrl: posterProfileUrl, posterName, headline: posterHeadline });
          }
        } else if (!isJobPost) {
          debug.postNotJob++;
        } else if (!posterProfileUrl) {
          debug.postNoProfile++;
        } else if (!isPosterRelevant) {
          debug.postNotRelevant++;
        }
      });

      results._debug = debug;
      return results;
    },
    IGNORED_DOMAINS,
    skipKeywords
  );
}

async function extractPageProfiles(tabPage) {
  try {
    return await tabPage.evaluate(() => {
      const profiles = [];
      const fullText = (document.body.innerText || '').toLowerCase();
      const jobWords = [
        'hiring', 'we are hiring', "we're hiring", 'urgently hiring',
        'looking for', 'send resume', 'send cv', 'job opening', 'open position',
        'vacancy', 'urgent requirement', 'immediate joiner', 'developer needed',
        'drop your', 'drop cv', 'interested candidates', 'dm me', 'share your cv',
        'apply now', 'currently hiring', 'actively hiring', 'looking to hire',
        'we need', 'join our team', 'join us',
      ];
      if (!jobWords.some((kw) => fullText.includes(kw))) return profiles;

      const seekerWords = [
        'actively seeking', 'seeking opportunity', 'looking for a role',
        'looking for a job', 'open to work', '#opentowork', '#fresherjobs',
        'hire me', 'appreciate a referral', 'actively looking',
      ];

      const allLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
      const seen = new Set();

      allLinks.forEach((link) => {
        const href = link.href || '';
        if (href.includes('/in/app/') || href.includes('/in/miniprofile')) return;
        const profileUrl = href.split('?')[0];
        if (seen.has(profileUrl)) return;
        const inParts = profileUrl.split('/in/')[1];
        if (!inParts) return;
        if (inParts.split('/').filter(Boolean).length > 1) return;
        if (profileUrl.includes('/overlay/') || profileUrl.includes('/details/')) return;

        let name = '';
        const spans = link.querySelectorAll('span');
        for (const span of spans) {
          const t = (span.innerText || '').trim();
          if (t.length > 2 && t.length < 60 && !/^(Like|Comment|Follow|Share|Repost|View|More)/.test(t)) {
            name = t;
            break;
          }
        }
        if (!name) name = (link.innerText || '').trim().split('\n')[0].trim();
        if (name.length > 60) name = name.substring(0, 60);
        if (name.length < 3) return;
        const badNames = ['view', 'follow', 'connect', 'message', 'more', 'like', 'comment', 'share', 'repost'];
        if (badNames.some((b) => name.toLowerCase().startsWith(b))) return;

        let nearbyText = '';
        let el = link;
        for (let i = 0; i < 6; i++) {
          el = el.parentElement;
          if (!el) break;
          if ((el.innerText || '').length > 200) {
            nearbyText = (el.innerText || '').toLowerCase().substring(0, 800);
            break;
          }
        }
        if (!jobWords.some((kw) => nearbyText.includes(kw))) return;
        if (seekerWords.some((w) => nearbyText.includes(w))) return;

        seen.add(profileUrl);
        profiles.push({ profileUrl, posterName: name });
      });
      return profiles;
    });
  } catch {
    return [];
  }
}

async function searchOneQuery(tabPage, query, cfg, state, userId) {
  const dateParam = `&datePosted=%22${cfg.dateFilter}%22`;
  const locationParam = cfg.locationFilter
    ? `&authorGeoRegion=%5B${cfg.geoIds.map((id) => `%22${id}%22`).join('%2C')}%5D`
    : '';
  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER${dateParam}${locationParam}&sortBy=%22date_posted%22`;

  try {
    await tabPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {}
  await randomSleep(2000, 3000);

  // Check if redirected to login page
  try {
    const currentUrl = tabPage.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('about:blank')) {
      log(`LinkedIn session expired — login required`, userId);
      broadcast('auth:login-required', {}, userId);
      return { emails: [], posts: [], profiles: [] };
    }
  } catch {}

  let hasResults = true;
  try {
    hasResults = await tabPage.evaluate(() => {
      const text = document.body.innerText || '';
      return !text.includes('No results found') && !text.includes('Try different keywords');
    });
  } catch {}
  if (!hasResults) return { emails: [], posts: [], profiles: [] };

  for (let s = 0; s < cfg.scrollCount; s++) {
    if (state.shouldStop) break;
    try {
      await tabPage.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
      });
      await randomSleep(1000, 1800);
      await tabPage.evaluate((extractComments) => {
        document.querySelectorAll(
          'button.see-more, button[aria-label="see more"], ' +
          '.feed-shared-inline-show-more-text button, ' +
          'button[aria-label="…more"], button.feed-shared-inline-show-more-text, ' +
          '[data-control-name="see_more"], span.see-more-less-toggle--see-more'
        ).forEach((btn) => { try { btn.click(); } catch {} });
        if (extractComments) {
          document.querySelectorAll(
            'button[aria-label*="comment"], button[aria-label*="Comment"], ' +
            'span.social-details-social-counts__comments-count, ' +
            '.social-details-social-counts__comments, ' +
            'button.comment-button, [data-control-name="comment"]'
          ).forEach((btn) => { try { btn.click(); } catch {} });
          document.querySelectorAll(
            'button.comments-comments-list__load-more-comments-button, ' +
            'button[aria-label*="Load more comments"], ' +
            'button[aria-label*="previous comments"]'
          ).forEach((btn) => { try { btn.click(); } catch {} });
        }
      }, cfg.extractComments);
    } catch {
      break;
    }
    broadcast('search:scroll', { scroll: s + 1, total: cfg.scrollCount, query }, userId);
  }

  let extracted;
  try {
    extracted = await extractFromPage(tabPage, cfg.skipKeywords || []);
  } catch {
    extracted = { emails: [], posts: [], profiles: [] };
  }

  if (extracted._debug) {
    delete extracted._debug;
  }

  const pageProfiles = await extractPageProfiles(tabPage);
  if (pageProfiles.length > 0) {
    if (!extracted.profiles) extracted.profiles = [];
    pageProfiles.forEach((p) => {
      if (!extracted.profiles.some((x) => x.profileUrl === p.profileUrl)) {
        extracted.profiles.push(p);
      }
    });
  }

  return { ...extracted, query };
}

async function startSearch(userId) {
  const state = getState(userId);
  if (state.isSearching) throw new Error('Search already running');
  state.isSearching = true;
  state.shouldStop = false;

  try {
  const cfg = await loadConfig(userId);
  const page = await browserService.ensurePage(userId);

  // Check if LinkedIn is logged in before starting search
  try {
    const url = page.url();
    if (!url.includes('linkedin.com') || url.includes('/login') || url.includes('/authwall') || url.includes('about:blank')) {
      // Try navigating to LinkedIn feed first
      log('LinkedIn not ready, navigating to feed...', userId);
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {}
      await sleep(5000);
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('about:blank')) {
        log('LinkedIn login required! Please log in via the browser window and try again.', userId);
        broadcast('auth:login-required', {}, userId);
        broadcast('search:complete', { totalEmails: 0, totalProfiles: 0, totalPosts: 0, error: 'Login required' }, userId);
        return { emails: [], profiles: [], jobPosts: [] };
      }
    }
  } catch {}
  const allEmails = new Map();
  const allProfiles = [];
  const allJobs = [];
  const queries = cfg.searchQueries || [];

  broadcast('search:started', { totalQueries: queries.length }, userId);
  log(`Starting search with ${queries.length} queries...`, userId);

  for (let q = 0; q < queries.length; q++) {
    if (state.shouldStop) break;
    broadcast('search:query-start', { index: q, total: queries.length, query: queries[q] }, userId);
    log(`[${q + 1}/${queries.length}] Searching: "${queries[q]}"`, userId);

    // Get fresh page before each query (fixes detached frame errors)
    let currentPage;
    try {
      currentPage = await browserService.ensurePage(userId);
    } catch (err) {
      log(`[${q + 1}/${queries.length}] Browser disconnected, stopping search.`, userId);
      break;
    }

    try {
      const result = await searchOneQuery(currentPage, queries[q], cfg, state, userId);

      const validExtracted = result.emails.filter((e) => isValidEmail(e.email));
      validExtracted.forEach((e) => {
        if (!allEmails.has(e.email)) {
          allEmails.set(e.email, e);
        } else if (e.profileUrl && !allEmails.get(e.email).profileUrl) {
          const existing = allEmails.get(e.email);
          existing.profileUrl = e.profileUrl;
          existing.posterName = e.posterName || existing.posterName;
        }
      });
      (result.profiles || []).forEach((p) => {
        if (!allProfiles.some((x) => x.profileUrl === p.profileUrl)) allProfiles.push(p);
      });
      (result.posts || []).forEach((p) => allJobs.push({ ...p, searchQuery: result.query }));

      broadcast('search:query-complete', {
        index: q, query: queries[q],
        emailsFound: validExtracted.length, profilesFound: (result.profiles || []).length,
        totalEmails: allEmails.size, totalProfiles: allProfiles.length,
      }, userId);
      log(`[${q + 1}/${queries.length}] "${queries[q]}" → ${validExtracted.length} emails, ${(result.profiles || []).length} profiles (total: ${allEmails.size} emails, ${allProfiles.length} profiles)`, userId);
    } catch (err) {
      log(`[${q + 1}/${queries.length}] "${queries[q]}" → FAILED: ${err.message}`, userId);
      // Try to recover with a fresh page
      try {
        currentPage = await browserService.ensurePage(userId);
        await currentPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await randomSleep(2000, 4000);
      } catch {}
    }

    if (q < queries.length - 1 && !state.shouldStop) await randomSleep(2000, 3000);
  }

  const emailArray = Array.from(allEmails.values());
  const resultData = {
    userId,
    extractedAt: new Date().toISOString(),
    totalEmails: emailArray.length,
    totalPosts: allJobs.length,
    emails: emailArray,
    profiles: allProfiles,
    jobPosts: allJobs,
  };

  await ExtractedResult.findOneAndReplace({ userId }, resultData, { upsert: true });

  const { loadSentEmails } = require('./email-send.service');
  const { loadSentDMsSet } = require('./dm.service');
  const sentEmails = await loadSentEmails(userId);
  const sentDMs = await loadSentDMsSet(userId);

  const newEmails = emailArray.filter((e) => !sentEmails.has(e.email.toLowerCase())).length;
  const alreadySentEmails = emailArray.length - newEmails;
  const newProfiles = allProfiles.filter((p) => !sentDMs.has(p.profileUrl.toLowerCase())).length;
  const alreadyDMedProfiles = allProfiles.length - newProfiles;

  broadcast('search:complete', {
    totalEmails: emailArray.length, newEmails, alreadySentEmails,
    totalProfiles: allProfiles.length, newProfiles, alreadyDMedProfiles,
    totalPosts: allJobs.length,
  }, userId);
  log(`Search complete! Emails: ${emailArray.length} total (${newEmails} new, ${alreadySentEmails} already sent) | Profiles: ${allProfiles.length} total (${newProfiles} new, ${alreadyDMedProfiles} already DMed) | Posts: ${allJobs.length}`, userId);

  return resultData;

  } finally {
    state.isSearching = false;
    state.shouldStop = false;
  }
}

module.exports = { startSearch, stopSearch, getSearchStatus };

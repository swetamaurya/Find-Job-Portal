// =============================================================
// LINKEDIN JOB SEARCH + EMAIL EXTRACTOR - All-in-One Browser Script
// =============================================================
// USAGE:
// 1. LinkedIn kholo aur login karo
// 2. LinkedIn search bar mein ye search karo:
//    "hiring backend developer node.js" ya
//    "looking for backend developer" ya
//    "send resume backend developer"
// 3. "Posts" filter select karo
// 4. Scroll down karo (jitna zyada scroll, utne zyada results)
// 5. F12 press karo > Console tab > Ye script paste karo
// =============================================================

(function() {
    console.clear();
    console.log("%c LinkedIn Job & Email Finder ", "background:#0077B5;color:white;font-size:20px;padding:10px;border-radius:5px;");
    console.log("%c Tarun Kumar - Backend Developer", "color:#0077B5;font-size:14px;");
    console.log("");

    // =================== CONFIGURATION ===================
    const SEARCH_KEYWORDS = [
        'backend developer',
        'node.js developer',
        'senior backend developer',
        'full stack developer',
        'node js',
        'express.js',
        'backend engineer',
        'hiring',
        'looking for',
        'send resume',
        'send cv',
        'drop your resume',
        'job opening',
        'we are hiring',
        'immediate joiner',
        'urgent requirement',
        'walk-in',
        'apply now',
        'DM me',
        'interested candidates',
    ];

    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Ignore these domains
    const IGNORED_DOMAINS = [
        'linkedin.com', 'licdn.com', 'example.com', 'email.com',
        'yourmail.com', 'xyz.com', 'abc.com', 'test.com',
        'sentry.io', 'w3.org', 'schema.org', 'googleapis.com',
    ];

    // =================== EXTRACT DATA ===================
    const results = {
        emails: new Map(),
        jobPosts: [],
        totalPostsScanned: 0,
    };

    // Get all post elements
    const postElements = document.querySelectorAll('.feed-shared-update-v2');
    console.log(`📄 Found ${postElements.length} posts on page\n`);

    postElements.forEach((post, index) => {
        results.totalPostsScanned++;
        const text = (post.innerText || '').toLowerCase();
        const fullText = post.innerText || '';

        // Check if post is job-related
        const matchedKeywords = SEARCH_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));

        if (matchedKeywords.length > 0) {
            // Get poster info
            const nameEl = post.querySelector('.update-components-actor__name span, .feed-shared-actor__name span');
            const name = nameEl ? nameEl.innerText.trim() : 'Unknown';

            const titleEl = post.querySelector('.update-components-actor__description span, .feed-shared-actor__description span');
            const title = titleEl ? titleEl.innerText.trim() : '';

            // Get post text
            const textEl = post.querySelector('.feed-shared-text, .update-components-text, .break-words');
            const postText = textEl ? textEl.innerText.trim() : fullText.substring(0, 500);

            // Extract emails from this post
            const emails = fullText.match(emailRegex) || [];
            const validEmails = emails.filter(email => {
                return !IGNORED_DOMAINS.some(domain => email.toLowerCase().includes(domain));
            });

            // Get post link
            const linkEl = post.querySelector('a[href*="/feed/update/"]');
            const postLink = linkEl ? linkEl.href : '';

            const jobPost = {
                posterName: name,
                posterTitle: title,
                postSnippet: postText.substring(0, 300),
                emails: validEmails,
                keywords: matchedKeywords,
                postLink: postLink,
            };

            results.jobPosts.push(jobPost);

            // Add emails to master list
            validEmails.forEach(email => {
                if (!results.emails.has(email.toLowerCase())) {
                    results.emails.set(email.toLowerCase(), {
                        email: email.toLowerCase(),
                        source: name,
                        postSnippet: postText.substring(0, 150),
                    });
                }
            });
        }
    });

    // Also scan entire visible page for emails
    const allText = document.body.innerText || '';
    const allEmails = allText.match(emailRegex) || [];
    allEmails.forEach(email => {
        const isIgnored = IGNORED_DOMAINS.some(domain => email.toLowerCase().includes(domain));
        if (!isIgnored && !results.emails.has(email.toLowerCase())) {
            results.emails.set(email.toLowerCase(), {
                email: email.toLowerCase(),
                source: 'Page Scan',
                postSnippet: '',
            });
        }
    });

    // =================== DISPLAY RESULTS ===================
    const emailArray = Array.from(results.emails.values());

    console.log("%c JOB-RELATED POSTS FOUND ", "background:#27ae60;color:white;font-size:16px;padding:5px;");
    console.log(`Found ${results.jobPosts.length} relevant posts out of ${results.totalPostsScanned} scanned\n`);

    results.jobPosts.forEach((job, i) => {
        console.log(`%c Post #${i + 1}`, "font-weight:bold;color:#0077B5;font-size:13px;");
        console.log(`  👤 ${job.posterName}`);
        console.log(`  💼 ${job.posterTitle}`);
        console.log(`  📧 Emails: ${job.emails.length > 0 ? job.emails.join(', ') : 'None found'}`);
        console.log(`  🔑 Keywords: ${job.keywords.join(', ')}`);
        console.log(`  📝 ${job.postSnippet.substring(0, 200)}...`);
        if (job.postLink) console.log(`  🔗 ${job.postLink}`);
        console.log('');
    });

    console.log("%c ALL EMAILS EXTRACTED ", "background:#e74c3c;color:white;font-size:16px;padding:5px;");
    console.log(`Total unique emails: ${emailArray.length}\n`);
    console.table(emailArray);

    // =================== EXPORT DATA ===================
    // Format for send-emails.js recipients array
    const recipientsCode = emailArray.map(e => {
        return `    { email: '${e.email}', name: '${e.source.replace(/'/g, "\\'")}', company: '' }`;
    }).join(',\n');

    const recipientsOutput = `// Ye code send-emails.js ke recipients array mein paste karo:\nconst recipients = [\n${recipientsCode}\n];`;

    console.log("%c COPY FOR EMAIL SENDER ", "background:#8e44ad;color:white;font-size:16px;padding:5px;");
    console.log(recipientsOutput);

    // Copy to clipboard
    navigator.clipboard.writeText(recipientsOutput).then(() => {
        console.log("\n✅ Recipients code clipboard mein copy ho gaya!");
        console.log("   send-emails.js mein recipients array replace karo.\n");
    }).catch(() => {
        console.log("\n⚠️ Auto-copy nahi hua. Manually select karke copy karo.\n");
    });

    // =================== ON-PAGE POPUP ===================
    const existing = document.getElementById('job-finder-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'job-finder-popup';
    popup.style.cssText = `
        position:fixed;top:10px;right:10px;z-index:99999;
        background:#1a1a2e;color:#eee;padding:20px;
        border-radius:12px;max-width:480px;max-height:85vh;
        overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);
        font-family:-apple-system,sans-serif;font-size:13px;
    `;

    let popupHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <div>
                <h3 style="margin:0;color:#00d4ff;">LinkedIn Job Finder</h3>
                <small style="color:#aaa;">Posts: ${results.jobPosts.length} | Emails: ${emailArray.length}</small>
            </div>
            <button onclick="this.closest('#job-finder-popup').remove()"
                style="background:none;border:none;color:#ff4757;font-size:22px;cursor:pointer;">✕</button>
        </div>
    `;

    // Tabs
    popupHTML += `
        <div style="display:flex;gap:8px;margin-bottom:15px;">
            <button id="tab-emails" onclick="document.getElementById('emails-list').style.display='block';document.getElementById('jobs-list').style.display='none';this.style.background='#00d4ff';this.style.color='#1a1a2e';document.getElementById('tab-jobs').style.background='#16213e';document.getElementById('tab-jobs').style.color='#eee';"
                style="flex:1;padding:8px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                📧 Emails (${emailArray.length})
            </button>
            <button id="tab-jobs" onclick="document.getElementById('jobs-list').style.display='block';document.getElementById('emails-list').style.display='none';this.style.background='#00d4ff';this.style.color='#1a1a2e';document.getElementById('tab-emails').style.background='#16213e';document.getElementById('tab-emails').style.color='#eee';"
                style="flex:1;padding:8px;background:#16213e;color:#eee;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                💼 Jobs (${results.jobPosts.length})
            </button>
        </div>
    `;

    // Emails tab
    popupHTML += '<div id="emails-list">';
    if (emailArray.length === 0) {
        popupHTML += '<p style="color:#ff6b6b;text-align:center;">Koi email nahi mila. Zyada scroll karo aur retry karo.</p>';
    }
    emailArray.forEach((item, i) => {
        popupHTML += `
            <div style="background:#16213e;padding:10px;margin:6px 0;border-radius:8px;border-left:3px solid #00d4ff;">
                <strong style="color:#00d4ff;">${i+1}. ${item.email}</strong><br>
                <small style="color:#aaa;">Source: ${item.source}</small>
            </div>
        `;
    });
    popupHTML += `
        <button id="copy-all-btn" style="width:100%;padding:12px;margin-top:12px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
            📋 Copy Recipients Code
        </button>
    </div>`;

    // Jobs tab
    popupHTML += '<div id="jobs-list" style="display:none;">';
    results.jobPosts.forEach((job, i) => {
        popupHTML += `
            <div style="background:#16213e;padding:12px;margin:6px 0;border-radius:8px;border-left:3px solid #ffc107;">
                <strong style="color:#ffc107;">${i+1}. ${job.posterName}</strong><br>
                <small style="color:#aaa;">${job.posterTitle}</small><br>
                <p style="color:#ccc;margin:8px 0;font-size:12px;">${job.postSnippet.substring(0, 200)}...</p>
                ${job.emails.length > 0 ? `<span style="color:#00d4ff;">📧 ${job.emails.join(', ')}</span>` : '<span style="color:#666;">No email found</span>'}
            </div>
        `;
    });
    popupHTML += '</div>';

    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);

    document.getElementById('copy-all-btn')?.addEventListener('click', function() {
        navigator.clipboard.writeText(recipientsOutput).then(() => {
            this.textContent = '✅ Copied!';
            setTimeout(() => { this.textContent = '📋 Copy Recipients Code'; }, 2000);
        });
    });

    // =================== HELPER FUNCTIONS ===================
    // Auto-scroll to load more posts
    window.autoScroll = function(times = 10) {
        let count = 0;
        console.log(`🔄 Auto-scrolling ${times} times...`);
        const interval = setInterval(() => {
            window.scrollBy(0, 800);
            // Click "See more" buttons
            document.querySelectorAll('button.see-more, button[aria-label="see more"]').forEach(btn => btn.click());
            count++;
            if (count >= times) {
                clearInterval(interval);
                console.log("✅ Scroll done! Script dubara run karo.");
            }
        }, 1500);
    };

    // Open LinkedIn search URLs
    window.searchJobs = function() {
        const searches = [
            'https://www.linkedin.com/search/results/content/?keywords=hiring%20backend%20developer%20node.js&origin=GLOBAL_SEARCH_HEADER',
            'https://www.linkedin.com/search/results/content/?keywords=looking%20for%20node.js%20developer&origin=GLOBAL_SEARCH_HEADER',
            'https://www.linkedin.com/search/results/content/?keywords=backend%20developer%20job%20opening%20send%20resume&origin=GLOBAL_SEARCH_HEADER',
        ];
        console.log("🔍 Opening job search tabs...");
        searches.forEach(url => window.open(url, '_blank'));
    };

    console.log("%c COMMANDS ", "background:#2c3e50;color:white;font-size:14px;padding:5px;");
    console.log("autoScroll(15)  → Zyada posts load karne ke liye");
    console.log("searchJobs()    → Job search tabs open karne ke liye");
    console.log("Phir ye script dubara paste karo!\n");

})();

// =============================================================
// LINKEDIN EMAIL EXTRACTOR - Browser Console Script
// =============================================================
// USAGE:
// 1. LinkedIn kholo browser mein
// 2. Search karo: "hiring backend developer node.js" ya koi bhi keyword
// 3. "Posts" tab pe click karo
// 4. Neeche scroll karo taaki zyada posts load ho jayein
// 5. F12 press karo (DevTools khulega)
// 6. Console tab pe jao
// 7. Ye poora script paste karo aur Enter press karo
// =============================================================

(function() {
    console.log("🔍 LinkedIn Email Extractor Started...");

    // Email regex pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Store unique emails
    const emailSet = new Set();
    const emailData = [];

    // Get all post containers
    const posts = document.querySelectorAll(
        '.feed-shared-update-v2, .update-components-text, .feed-shared-text, .break-words, .feed-shared-inline-show-more-text'
    );

    // Also get all text content from the feed
    const feedContainer = document.querySelector('.scaffold-finite-scroll__content')
        || document.querySelector('.search-results-container')
        || document.querySelector('.feed-shared-update-v2')
        || document.body;

    // Method 1: Search in post elements
    posts.forEach((post, index) => {
        const text = post.innerText || post.textContent || '';
        const emails = text.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                if (!emailSet.has(email.toLowerCase())) {
                    emailSet.add(email.toLowerCase());
                    // Try to get the poster's name
                    const nameEl = post.closest('.feed-shared-update-v2')
                        ?.querySelector('.update-components-actor__name span, .feed-shared-actor__name span');
                    const name = nameEl ? nameEl.innerText.trim() : 'Unknown';

                    // Get post snippet
                    const snippet = text.substring(0, 150).replace(/\n/g, ' ').trim();

                    emailData.push({
                        email: email.toLowerCase(),
                        name: name,
                        postSnippet: snippet
                    });
                }
            });
        }
    });

    // Method 2: Search in all visible text spans and paragraphs
    const allTextElements = document.querySelectorAll('span, p, div.break-words, div.feed-shared-text');
    allTextElements.forEach(el => {
        const text = el.innerText || '';
        const emails = text.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                if (!emailSet.has(email.toLowerCase())) {
                    emailSet.add(email.toLowerCase());
                    emailData.push({
                        email: email.toLowerCase(),
                        name: 'From Post',
                        postSnippet: text.substring(0, 150).replace(/\n/g, ' ').trim()
                    });
                }
            });
        }
    });

    // Method 3: Deep search in entire page HTML
    const pageHTML = document.body.innerHTML;
    const pageEmails = pageHTML.match(emailRegex);
    if (pageEmails) {
        pageEmails.forEach(email => {
            // Filter out LinkedIn system emails
            const ignore = ['@linkedin.com', '@licdn.com', '@l.linkedin.com'];
            const isIgnored = ignore.some(domain => email.toLowerCase().includes(domain));

            if (!emailSet.has(email.toLowerCase()) && !isIgnored) {
                emailSet.add(email.toLowerCase());
                emailData.push({
                    email: email.toLowerCase(),
                    name: 'From Page',
                    postSnippet: ''
                });
            }
        });
    }

    // Display results
    console.log("\n" + "=".repeat(60));
    console.log(`✅ Total Unique Emails Found: ${emailData.length}`);
    console.log("=".repeat(60));

    if (emailData.length === 0) {
        console.log("❌ Koi email nahi mila. Try karo:");
        console.log("   1. Zyada neeche scroll karo taaki posts load ho");
        console.log("   2. 'See more' buttons pe click karo posts mein");
        console.log('   3. Search karo: "hiring email" ya "send resume to"');
        console.log("   4. Phir se script run karo");
    } else {
        // Print table
        console.table(emailData);

        // Print email list for easy copy
        console.log("\n📋 COPY-PASTE EMAIL LIST:");
        console.log("-".repeat(40));
        const emailList = emailData.map(e => e.email).join('\n');
        console.log(emailList);

        // Create JSON for the Node.js email sender
        const jsonOutput = JSON.stringify(emailData, null, 2);
        console.log("\n📄 JSON DATA (Copy this for email sender script):");
        console.log(jsonOutput);

        // Copy to clipboard
        const emailsForClipboard = emailData.map(e => e.email).join(', ');
        navigator.clipboard.writeText(jsonOutput).then(() => {
            console.log("\n✅ JSON data clipboard mein copy ho gaya!");
        }).catch(() => {
            console.log("\n⚠️ Auto-copy nahi hua. Manually select karke copy karo.");
        });

        // Show a nice popup on the page
        showResultsPopup(emailData);
    }

    // Auto-scroll function to load more posts
    window.linkedinAutoScroll = function(times = 5) {
        let count = 0;
        const interval = setInterval(() => {
            window.scrollBy(0, 1000);
            count++;
            console.log(`Scrolling... ${count}/${times}`);
            if (count >= times) {
                clearInterval(interval);
                console.log("✅ Scroll complete! Ab script dubara run karo for more emails.");
            }
        }, 2000);
    };

    console.log("\n💡 TIP: Zyada posts load karne ke liye run karo: linkedinAutoScroll(10)");
    console.log("    Phir ye script dubara paste karo.\n");

    // Show popup with results on the page
    function showResultsPopup(data) {
        // Remove existing popup if any
        const existing = document.getElementById('email-extractor-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'email-extractor-popup';
        popup.style.cssText = `
            position: fixed; top: 10px; right: 10px; z-index: 99999;
            background: #1a1a2e; color: #eee; padding: 20px;
            border-radius: 12px; max-width: 450px; max-height: 80vh;
            overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            font-family: -apple-system, sans-serif; font-size: 14px;
        `;

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;color:#00d4ff;">Emails Found: ${data.length}</h3>
                <button onclick="this.parentElement.parentElement.remove()"
                    style="background:none;border:none;color:#ff4757;font-size:20px;cursor:pointer;">✕</button>
            </div>
        `;

        data.forEach((item, i) => {
            html += `
                <div style="background:#16213e;padding:10px;margin:8px 0;border-radius:8px;border-left:3px solid #00d4ff;">
                    <strong style="color:#00d4ff;">${i + 1}. ${item.email}</strong><br>
                    <small style="color:#aaa;">Source: ${item.name}</small>
                </div>
            `;
        });

        html += `
            <button id="copy-emails-btn" style="
                width:100%;padding:12px;margin-top:15px;background:#00d4ff;
                color:#1a1a2e;border:none;border-radius:8px;font-weight:bold;
                font-size:14px;cursor:pointer;
            ">📋 Copy All Emails</button>
        `;

        popup.innerHTML = html;
        document.body.appendChild(popup);

        document.getElementById('copy-emails-btn').addEventListener('click', () => {
            const emails = data.map(e => e.email).join('\n');
            navigator.clipboard.writeText(emails).then(() => {
                document.getElementById('copy-emails-btn').textContent = '✅ Copied!';
                setTimeout(() => {
                    document.getElementById('copy-emails-btn').textContent = '📋 Copy All Emails';
                }, 2000);
            });
        });
    }

})();

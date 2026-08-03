const platform = window.location.hostname.includes('geeksforgeeks') ? 'GeeksForGeeks' : 'LeetCode';

// Inject intercept.js into the main world to patch fetch/XHR
const script = document.createElement('script');
script.src = chrome.runtime.getURL('scripts/intercept.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// If on GFG, poll the DOM for success since their network response varies heavily
if (platform === 'GeeksForGeeks') {
    let gfgSuccessFound = false;
    setInterval(() => {
        if (gfgSuccessFound) return;
        const textElements = Array.from(document.querySelectorAll('div, span, h3')).map(el => el.textContent.trim());
        if (textElements.some(t => t.includes('Problem Solved Successfully') || t === 'Correct Answer')) {
            gfgSuccessFound = true;
            console.log("[Code Sync] GFG Success detected in DOM! Requesting code...");
            window.postMessage({ type: 'GET_PENDING_SUBMISSION' }, '*');
            // Reset after 10s to allow another submission
            setTimeout(() => { gfgSuccessFound = false; }, 10000);
        }
    }, 2000);
}

// Listen for messages from intercept.js
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'CODE_SUBMISSION_ACCEPTED') {
        console.log("[Code Sync Content] Received accepted submission via Network!", event.data.payload);
        pushSubmission(event.data.payload);
    } else if (event.data && event.data.type === 'PENDING_SUBMISSION_RESPONSE') {
        const payload = event.data.payload;
        // Prevent double pushing the exact same code
        if (window.__last_pushed_code === payload.code) return;
        window.__last_pushed_code = payload.code;

        console.log("[Code Sync Content] Received pending submission for GFG via DOM trigger!", payload);
        payload.stats = "See GeeksForGeeks for stats";
        pushSubmission(payload);
    }
});

function extractProblemTitle() {
    const pathname = window.location.pathname;
    const match = pathname.match(/\/problems\/([^/]+)/);
    if (match && match[1]) {
        return match[1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    const titleEl = document.querySelector('title');
    if (titleEl) {
        return titleEl.textContent.split('-')[0].split('|')[0].trim();
    }
    
    return 'Unknown Problem';
}

function pushSubmission(payload) {
    const title = extractProblemTitle();
    // Default difficulty, since it's hard to extract reliably and varies by layout
    const difficulty = "See LeetCode for difficulty"; 

    const finalPayload = {
        title: title,
        difficulty: difficulty,
        code: payload.code,
        language: payload.lang,
        stats: payload.stats
    };

    chrome.runtime.sendMessage({ type: 'PUSH_SUBMISSION', data: finalPayload }, (response) => {
        if (response && response.success) {
            console.log('[LeetCode Sync Content] Successfully pushed to GitHub!');
            showToast('✅ Successfully pushed to GitHub!');
        } else {
            console.error('[LeetCode Sync Content] Failed to push to GitHub:', response?.error);
            showToast('❌ Failed to push to GitHub: ' + (response?.error || 'Unknown error'), true);
        }
    });
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.background = isError ? '#f85149' : '#238636';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.fontFamily = 'sans-serif';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '999999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.transition = 'opacity 0.3s ease';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

console.log("[LeetCode Sync Content] Content script loaded.");

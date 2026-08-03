// Inject intercept.js into the main world to patch fetch/XHR
const script = document.createElement('script');
script.src = chrome.runtime.getURL('scripts/intercept.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from intercept.js
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'LEETCODE_SUBMISSION_ACCEPTED') {
        console.log("[LeetCode Sync Content] Received accepted submission!", event.data.payload);
        pushSubmission(event.data.payload);
    }
});

function extractProblemTitle() {
    // Attempt 1: Get from URL
    const pathname = window.location.pathname;
    const match = pathname.match(/\/problems\/([^/]+)/);
    if (match && match[1]) {
        // Convert 'two-sum' to 'Two Sum'
        return match[1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    // Attempt 2: DOM
    const titleEl = document.querySelector('title');
    if (titleEl) {
        return titleEl.textContent.split('-')[0].trim();
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

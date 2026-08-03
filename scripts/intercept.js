// Store the latest submitted code globally in the page context
window.__leetcode_sync_pending = null;

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    
    // 1. Catch the submission code
    if (url && url.includes('/submit/')) {
        console.log("[LeetCode Sync] Intercepted fetch to /submit/:", url);
        try {
            const init = args[1];
            if (init && init.body) {
                const bodyStr = typeof init.body === 'string' ? init.body : null;
                if (bodyStr) {
                    const parsed = JSON.parse(bodyStr);
                    if (parsed.typed_code && parsed.lang) {
                        console.log("[LeetCode Sync] Saved typed_code pending result...");
                        window.__leetcode_sync_pending = {
                            code: parsed.typed_code,
                            lang: parsed.lang
                        };
                    }
                }
            }
        } catch (e) { console.error("[LeetCode Sync] Error intercepting fetch body:", e); }
    }
    
    // 2. Await the actual network response
    const response = await originalFetch.apply(this, args);
    
    // 3. Catch the polling check result
    if (url && url.includes('/check/')) {
        try {
            const clonedRes = response.clone();
            clonedRes.json().then(data => {
                if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                    console.log("[LeetCode Sync] Submission Accepted via /check/ API!");
                    if (window.__leetcode_sync_pending) {
                        window.postMessage({
                            type: 'LEETCODE_SUBMISSION_ACCEPTED',
                            payload: {
                                code: window.__leetcode_sync_pending.code,
                                lang: window.__leetcode_sync_pending.lang,
                                stats: `Runtime: ${data.status_runtime} | Memory: ${data.status_memory}`
                            }
                        }, '*');
                        // Clear after sending
                        window.__leetcode_sync_pending = null;
                    } else {
                        console.log("[LeetCode Sync] No pending code found.");
                    }
                }
            }).catch(e => {});
        } catch (e) { console.error("[LeetCode Sync] Error intercepting check result:", e); }
    }
    
    return response;
};

// Also patch XMLHttpRequest just in case LeetCode uses it for polling
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    return originalXhrOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(body) {
    // 1. Catch submission code
    if (this._url && this._url.includes('/submit/')) {
        console.log("[LeetCode Sync] Intercepted XHR to /submit/:", this._url);
        try {
            if (body && typeof body === 'string') {
                const parsed = JSON.parse(body);
                if (parsed.typed_code && parsed.lang) {
                    window.__leetcode_sync_pending = {
                        code: parsed.typed_code,
                        lang: parsed.lang
                    };
                }
            }
        } catch (e) {}
    }
    
    // 2. Catch check result when request finishes
    this.addEventListener('load', function() {
        if (this._url && this._url.includes('/check/')) {
            try {
                if (this.responseText) {
                    const data = JSON.parse(this.responseText);
                    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                        console.log("[LeetCode Sync] Submission Accepted via XHR /check/ API!");
                        if (window.__leetcode_sync_pending) {
                            window.postMessage({
                                type: 'LEETCODE_SUBMISSION_ACCEPTED',
                                payload: {
                                    code: window.__leetcode_sync_pending.code,
                                    lang: window.__leetcode_sync_pending.lang,
                                    stats: `Runtime: ${data.status_runtime} | Memory: ${data.status_memory}`
                                }
                            }, '*');
                            window.__leetcode_sync_pending = null;
                        }
                    }
                }
            } catch (e) {}
        }
    });

    return originalXhrSend.apply(this, [body]);
};

console.log("[LeetCode Sync] Network interceptor loaded successfully.");

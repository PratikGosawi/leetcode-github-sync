// Store the latest submitted code globally in the page context
window.__leetcode_sync_pending = null;

window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data && e.data.type === 'GET_PENDING_SUBMISSION') {
        if (window.__leetcode_sync_pending) {
            window.postMessage({
                type: 'PENDING_SUBMISSION_RESPONSE',
                payload: window.__leetcode_sync_pending
            }, '*');
        }
    }
});

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    
    // 1. Catch the submission code
    if (url && (url.includes('/submit/') || url.includes('geeksforgeeks'))) {
        try {
            const init = args[1];
            if (init && init.body) {
                const bodyStr = typeof init.body === 'string' ? init.body : null;
                if (bodyStr) {
                    const parsed = JSON.parse(bodyStr);
                    if (parsed.typed_code && parsed.lang) {
                        console.log("[LeetCode Sync] Saved LeetCode typed_code...");
                        window.__leetcode_sync_pending = {
                            code: parsed.typed_code,
                            lang: parsed.lang,
                            platform: 'LeetCode'
                        };
                    } else if (url.includes('geeksforgeeks')) {
                        // Guess common GFG payload fields
                        let code = parsed.code || parsed.program || parsed.sourceCode || parsed.user_code || parsed.source;
                        let lang = parsed.language || parsed.lang;
                        if (code && lang) {
                            console.log("[LeetCode Sync] Saved GFG code...");
                            window.__leetcode_sync_pending = {
                                code: code,
                                lang: lang,
                                platform: 'GeeksForGeeks'
                            };
                        }
                    }
                }
            }
        } catch (e) {}
    }
    
    // 2. Await the actual network response
    const response = await originalFetch.apply(this, args);
    
    // 3. Catch the polling check result (LeetCode specific)
    if (url && url.includes('/check/')) {
        try {
            const clonedRes = response.clone();
            clonedRes.json().then(data => {
                if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                    console.log("[LeetCode Sync] Submission Accepted via /check/ API!");
                    if (window.__leetcode_sync_pending) {
                        window.postMessage({
                            type: 'CODE_SUBMISSION_ACCEPTED',
                            payload: {
                                code: window.__leetcode_sync_pending.code,
                                lang: window.__leetcode_sync_pending.lang,
                                platform: window.__leetcode_sync_pending.platform || 'LeetCode',
                                stats: `Runtime: ${data.status_runtime} | Memory: ${data.status_memory}`
                            }
                        }, '*');
                        window.__leetcode_sync_pending = null;
                    }
                }
            }).catch(e => {});
        } catch (e) {}
    }
    
    return response;
};

// Patch XMLHttpRequest
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    return originalXhrOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(body) {
    if (this._url && (this._url.includes('/submit/') || this._url.includes('geeksforgeeks'))) {
        try {
            if (body && typeof body === 'string') {
                const parsed = JSON.parse(body);
                if (parsed.typed_code && parsed.lang) {
                    window.__leetcode_sync_pending = {
                        code: parsed.typed_code,
                        lang: parsed.lang,
                        platform: 'LeetCode'
                    };
                } else if (this._url.includes('geeksforgeeks')) {
                    let code = parsed.code || parsed.program || parsed.sourceCode || parsed.user_code || parsed.source;
                    let lang = parsed.language || parsed.lang;
                    if (code && lang) {
                        window.__leetcode_sync_pending = { code, lang, platform: 'GeeksForGeeks' };
                    }
                }
            }
        } catch (e) {}
    }
    
    this.addEventListener('load', function() {
        if (this._url && this._url.includes('/check/')) {
            try {
                if (this.responseText) {
                    const data = JSON.parse(this.responseText);
                    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                        if (window.__leetcode_sync_pending) {
                            window.postMessage({
                                type: 'CODE_SUBMISSION_ACCEPTED',
                                payload: {
                                    code: window.__leetcode_sync_pending.code,
                                    lang: window.__leetcode_sync_pending.lang,
                                    platform: window.__leetcode_sync_pending.platform || 'LeetCode',
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

// Store the latest submitted code and its submission ID
window.__leetcode_sync_pending = null;
window.__leetcode_submit_id = null; // tracks the real submission ID from POST /submit/

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

    // --- LEETCODE SUBMIT (not Run/Interpret) ---
    // LeetCode "Run" uses /interpret_solution/ — we intentionally skip that.
    // Only /problems/<slug>/submit/ is a real submission.
    const isLCSubmit = url && url.includes('/submit/') && !url.includes('/interpret_solution/');
    const isGFG = url && url.includes('geeksforgeeks');

    if (isLCSubmit || isGFG) {
        try {
            const init = args[1];
            if (init && init.body) {
                const bodyStr = typeof init.body === 'string' ? init.body : null;
                if (bodyStr) {
                    const parsed = JSON.parse(bodyStr);
                    if (isLCSubmit && parsed.typed_code && parsed.lang) {
                        // Store code; we'll confirm the submission ID from the POST response below
                        window.__leetcode_sync_pending = {
                            code: parsed.typed_code,
                            lang: parsed.lang,
                            platform: 'LeetCode'
                        };
                        window.__leetcode_submit_id = null; // reset until response arrives
                        console.log('[Code Sync] Captured LeetCode submit payload.');
                    } else if (isGFG) {
                        let code = parsed.code || parsed.program || parsed.sourceCode || parsed.user_code || parsed.source;
                        let lang = parsed.language || parsed.lang;
                        if (code && lang) {
                            window.__leetcode_sync_pending = { code, lang, platform: 'GeeksForGeeks' };
                            console.log('[Code Sync] Captured GFG submit payload.');
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // Await the real network response
    const response = await originalFetch.apply(this, args);

    // --- Read the submission ID from the POST /submit/ response ---
    if (isLCSubmit) {
        try {
            const cloned = response.clone();
            cloned.json().then(data => {
                if (data.submission_id) {
                    window.__leetcode_submit_id = String(data.submission_id);
                    console.log('[Code Sync] Got LeetCode submission_id:', window.__leetcode_submit_id);
                }
            }).catch(() => {});
        } catch (e) {}
    }

    // --- Poll /check/ only for the real submission ID ---
    if (url && url.includes('/check/')) {
        try {
            // Only proceed if this check URL belongs to the actual submission, not a Run check.
            const isRealSubmit = window.__leetcode_submit_id && url.includes(window.__leetcode_submit_id);
            if (isRealSubmit) {
                const clonedRes = response.clone();
                clonedRes.json().then(data => {
                    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                        console.log('[Code Sync] Submission Accepted via /check/ API!');
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
                            window.__leetcode_submit_id = null;
                        }
                    }
                }).catch(() => {});
            }
        } catch (e) {}
    }

    return response;
};

// Patch XMLHttpRequest (fallback)
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    this._method = method;
    return originalXhrOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(body) {
    const isLCSubmit = this._url && this._url.includes('/submit/') && !this._url.includes('/interpret_solution/');
    const isGFG = this._url && this._url.includes('geeksforgeeks');

    if (isLCSubmit || isGFG) {
        try {
            if (body && typeof body === 'string') {
                const parsed = JSON.parse(body);
                if (isLCSubmit && parsed.typed_code && parsed.lang) {
                    window.__leetcode_sync_pending = {
                        code: parsed.typed_code,
                        lang: parsed.lang,
                        platform: 'LeetCode'
                    };
                    window.__leetcode_submit_id = null;
                } else if (isGFG) {
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
        // Capture submission ID from POST /submit/ response
        if (this._url && this._url.includes('/submit/') && !this._url.includes('/interpret_solution/')) {
            try {
                const data = JSON.parse(this.responseText);
                if (data.submission_id) {
                    window.__leetcode_submit_id = String(data.submission_id);
                }
            } catch (e) {}
        }

        // Only handle /check/ if it matches the real submission ID
        if (this._url && this._url.includes('/check/')) {
            const isRealSubmit = window.__leetcode_submit_id && this._url.includes(window.__leetcode_submit_id);
            if (!isRealSubmit) return;
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
                            window.__leetcode_submit_id = null;
                        }
                    }
                }
            } catch (e) {}
        }
    });

    return originalXhrSend.apply(this, [body]);
};

console.log('[Code Sync] Network interceptor loaded. Only real submissions will be synced.');

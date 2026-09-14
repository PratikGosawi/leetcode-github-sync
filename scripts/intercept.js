// Store the latest submitted code and its submission ID
window.__leetcode_sync_pending = null;
window.__leetcode_submit_id = null; // tracks the real submission ID from POST /submit/

// Helper: extract code + language from GFG request bodies.
// GFG sends data as form-encoded fields, NOT JSON.
async function extractGFGPayload(body) {
    if (!body) return null;

    // 1. FormData (most common for GFG)
    if (body instanceof FormData) {
        const code = body.get('userCode') || body.get('code') || body.get('user_code') || body.get('program');
        const lang = body.get('language') || body.get('lang');
        if (code && lang) return { code, lang };
        return null;
    }

    if (typeof body === 'string') {
        // 2. Try URL-encoded (e.g. "userCode=...&language=python3")
        try {
            const params = new URLSearchParams(body);
            const code = params.get('userCode') || params.get('code') || params.get('user_code') || params.get('program');
            const lang = params.get('language') || params.get('lang');
            if (code && lang) return { code, lang };
        } catch (e) {}

        // 3. Fallback: try JSON
        try {
            const parsed = JSON.parse(body);
            const code = parsed.code || parsed.program || parsed.sourceCode || parsed.user_code || parsed.userCode || parsed.source;
            const lang = parsed.language || parsed.lang;
            if (code && lang) return { code, lang };
        } catch (e) {}
    }

    return null;
}

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
    const isGFG = url && url.includes('geeksforgeeks');
    // isLCSubmit must exclude GFG URLs (GFG's endpoint also has /submit/ in the path)
    const isLCSubmit = url && url.includes('/submit/') && !url.includes('/interpret_solution/') && !isGFG;

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
                    }
                }
            }
        } catch (e) {}
    }

    // GFG: handle separately (body may be FormData or URL-encoded, not JSON)
    if (isGFG) {
        try {
            const body = args[1] && args[1].body;
            const result = await extractGFGPayload(body);
            if (result) {
                window.__leetcode_sync_pending = { code: result.code, lang: result.lang, platform: 'GeeksForGeeks' };
                console.log('[Code Sync] Captured GFG submit payload. lang:', result.lang);
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
    const isGFG = this._url && this._url.includes('geeksforgeeks');
    const isLCSubmit = this._url && this._url.includes('/submit/') && !this._url.includes('/interpret_solution/') && !isGFG;

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
                }
            }
        } catch (e) {}
    }

    // GFG: XHR body is always a string; try URL-encoded then JSON
    if (isGFG) {
        extractGFGPayload(body).then(result => {
            if (result) {
                window.__leetcode_sync_pending = { code: result.code, lang: result.lang, platform: 'GeeksForGeeks' };
                console.log('[Code Sync] Captured GFG submit payload (XHR). lang:', result.lang);
            }
        }).catch(() => {});
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

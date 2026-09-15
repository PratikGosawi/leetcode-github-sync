const platform = window.location.hostname.includes('geeksforgeeks') ? 'GeeksForGeeks' : 'LeetCode';

console.log('[Code Sync] Content script loaded. Platform:', platform);

// ── GFG: DOM-based approach ──────────────────────────────────────────────────
// GFG's CSP blocks injected scripts, so we read the code directly from
// the editor element when the success banner appears in the DOM.

function extractGFGCode() {
    // 1. CodeMirror (classic GFG editor)
    const cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) {
        const val = cm.CodeMirror.getValue();
        if (val) return val;
    }

    // 2. Monaco editor
    if (window.monaco) {
        try {
            const editors = window.monaco.editor.getEditors();
            if (editors && editors.length > 0) return editors[0].getValue();
        } catch(e) {}
    }

    // 3. Ace editor
    if (window.ace) {
        try {
            const aceEl = document.querySelector('.ace_editor');
            if (aceEl) return window.ace.edit(aceEl).getValue();
        } catch(e) {}
    }

    // 4. Fallback: any <textarea> with substantial content
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const codeArea = textareas.find(t => t.value && t.value.length > 10);
    if (codeArea) return codeArea.value;

    return null;
}

function extractGFGLanguage() {
    const selectors = [
        '[class*="lang"] button',
        '[class*="language"] button',
        '[class*="lang"] [class*="selected"]',
        '[id*="lang"] [class*="selected"]',
        'select[name="language"]',
        '[class*="dropdown"] [class*="selected"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim().toLowerCase();
    }
    const sel = document.querySelector('select');
    if (sel && sel.value) return sel.value.toLowerCase();
    return 'unknown';
}

if (platform === 'GeeksForGeeks') {
    let gfgSuccessFound = false;
    setInterval(() => {
        if (gfgSuccessFound) return;
        const allText = document.body.innerText || '';
        if (allText.includes('Problem Solved Successfully') || allText.includes('Correct Answer')) {
            gfgSuccessFound = true;
            console.log('[Code Sync] GFG Success detected! Reading code from editor...');

            const code = extractGFGCode();
            const lang = extractGFGLanguage();

            console.log('[Code Sync] Extracted code length:', code ? code.length : 0, '| lang:', lang);

            if (!code) {
                console.warn('[Code Sync] Could not read code from GFG editor.');
                showToast('⚠️ Solved! But could not read code from editor.', true);
                setTimeout(() => { gfgSuccessFound = false; }, 10000);
                return;
            }

            // Prevent double-pushing the same code
            if (window.__last_pushed_code === code) {
                console.log('[Code Sync] Duplicate push prevented.');
                setTimeout(() => { gfgSuccessFound = false; }, 10000);
                return;
            }
            window.__last_pushed_code = code;

            pushSubmission({ code, lang, platform: 'GeeksForGeeks', stats: 'See GeeksForGeeks for stats' });
            setTimeout(() => { gfgSuccessFound = false; }, 10000);
        }
    }, 2000);
}

// ── LeetCode: network interception ──────────────────────────────────────────
if (platform === 'LeetCode') {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/intercept.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data && event.data.type === 'CODE_SUBMISSION_ACCEPTED') {
            console.log('[Code Sync] LeetCode submission accepted!', event.data.payload);
            pushSubmission(event.data.payload);
        }
    });
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function extractProblemTitle() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (match && match[1]) {
        return match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    const titleEl = document.querySelector('title');
    if (titleEl) return titleEl.textContent.split('-')[0].split('|')[0].trim();
    return 'Unknown Problem';
}

function pushSubmission(payload) {
    const title = extractProblemTitle();
    const difficulty = payload.platform === 'GeeksForGeeks'
        ? 'See GeeksForGeeks for difficulty'
        : 'See LeetCode for difficulty';

    const finalPayload = {
        title,
        difficulty,
        code: payload.code,
        language: payload.lang,
        stats: payload.stats,
        platform: payload.platform || 'LeetCode'
    };

    console.log('[Code Sync] Pushing to GitHub:', finalPayload.title, '| platform:', finalPayload.platform);

    chrome.runtime.sendMessage({ type: 'PUSH_SUBMISSION', data: finalPayload }, (response) => {
        if (response && response.success) {
            console.log('[Code Sync] Successfully pushed to GitHub!');
            showToast('✅ Successfully pushed to GitHub!');
        } else {
            console.error('[Code Sync] Failed to push:', response?.error);
            showToast('❌ Failed to push: ' + (response?.error || 'Unknown error'), true);
        }
    });
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        padding: 12px 20px; border-radius: 8px;
        background: ${isError ? '#f85149' : '#238636'};
        color: white; font-family: sans-serif; font-weight: bold;
        z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

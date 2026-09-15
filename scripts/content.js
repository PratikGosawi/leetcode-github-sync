const platform = window.location.hostname.includes('geeksforgeeks') ? 'GeeksForGeeks' : 'LeetCode';

console.log('[Code Sync] Content script loaded. Platform:', platform);

// ── GFG: DOM-based approach ──────────────────────────────────────────────────
// GFG's CSP blocks injected scripts, so we read the code directly from
// the editor element when the success banner appears in the DOM.

// ── GFG pre-save: store code every second so it's always ready ───────────────
let _gfgSavedCode = null;
let _gfgSavedLang = null;

function readAceEditorValue() {
    const aceEl = document.querySelector('.ace_editor');
    if (!aceEl) return null;

    // Method 1: standard Ace env property
    if (aceEl.env && aceEl.env.editor) {
        try {
            const v = aceEl.env.editor.getValue();
            if (v && v.length > 0) return v;
        } catch(e) {}
    }

    // Method 2: traverse React's internal fiber tree to find the editor instance
    // (GFG wraps Ace in a React component — the editor lives in stateNode)
    try {
        const fiberKey = Object.keys(aceEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (fiberKey) {
            let fiber = aceEl[fiberKey];
            while (fiber) {
                const sn = fiber.stateNode;
                if (sn && typeof sn === 'object') {
                    // react-ace stores editor on stateNode.editor
                    if (sn.editor && typeof sn.editor.getValue === 'function') {
                        const v = sn.editor.getValue();
                        if (v && v.length > 0) return v;
                    }
                    // or directly on the component ref
                    if (sn.refEditor && typeof sn.refEditor.getValue === 'function') {
                        const v = sn.refEditor.getValue();
                        if (v && v.length > 0) return v;
                    }
                }
                fiber = fiber.return;
            }
        }
    } catch(e) {}

    // Method 3: ace.edit() — returns existing instance in standard Ace builds
    if (window.ace) {
        try {
            const v = window.ace.edit(aceEl).getValue();
            if (v && v.length > 0) return v;
        } catch(e) {}
    }

    // Method 4: read all rendered .ace_line elements (works for short solutions)
    const lines = document.querySelectorAll('.ace_line');
    if (lines.length > 0) {
        const v = Array.from(lines).map(l => l.textContent).join('\n');
        if (v.trim().length > 0) return v;
    }

    return null;
}

function readGFGLanguage() {
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
    // Pre-save the code every second while the user is on the problem page
    setInterval(() => {
        const code = readAceEditorValue();
        const lang = readGFGLanguage();
        if (code && code.length > 5) {
            _gfgSavedCode = code;
            _gfgSavedLang = lang;
        }
    }, 1000);

    // Detect success banner and push the last pre-saved code
    let gfgSuccessFound = false;
    setInterval(() => {
        if (gfgSuccessFound) return;
        const allText = document.body.innerText || '';
        if (allText.includes('Problem Solved Successfully') || allText.includes('Correct Answer')) {
            gfgSuccessFound = true;
            console.log('[Code Sync] GFG Success detected! Using pre-saved code...');
            console.log('[Code Sync] Pre-saved code length:', _gfgSavedCode ? _gfgSavedCode.length : 0, '| lang:', _gfgSavedLang);

            // Try reading fresh one more time, fall back to pre-saved
            const freshCode = readAceEditorValue();
            const code = (freshCode && freshCode.length > 5) ? freshCode : _gfgSavedCode;
            const lang = _gfgSavedLang || readGFGLanguage();

            if (!code) {
                console.warn('[Code Sync] No code available to push.');
                showToast('⚠️ Solved! But could not read code from editor.', true);
                setTimeout(() => { gfgSuccessFound = false; }, 10000);
                return;
            }

            if (window.__last_pushed_code === code) {
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

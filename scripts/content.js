// ── GFG: DOM-based approach ─────────────────────────────────────────────────
// GFG's CSP may block the network interceptor, so we read the code
// directly from the editor DOM when the success banner appears.

function extractGFGCode() {
    // 1. CodeMirror (classic GFG editor)
    const cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) {
        return cm.CodeMirror.getValue();
    }

    // 2. Monaco editor
    if (window.monaco) {
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
            return editors[0].getValue();
        }
    }

    // 3. Ace editor
    if (window.ace) {
        try { return window.ace.edit(document.querySelector('.ace_editor')).getValue(); } catch(e) {}
    }

    // 4. Fallback: any <textarea> with substantial content
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const codeArea = textareas.find(t => t.value && t.value.length > 10);
    if (codeArea) return codeArea.value;

    return null;
}

function extractGFGLanguage() {
    // Try various selectors GFG uses for the language dropdown
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
    // Try select elements
    const sel = document.querySelector('select');
    if (sel && sel.value) return sel.value.toLowerCase();
    return 'unknown';
}

if (platform === 'GeeksForGeeks') {
    let gfgSuccessFound = false;
    setInterval(() => {
        if (gfgSuccessFound) return;
        const allText = document.body.innerText;
        if (allText.includes('Problem Solved Successfully') || allText.includes('Correct Answer')) {
            gfgSuccessFound = true;
            console.log('[Code Sync] GFG Success detected in DOM! Reading code from editor...');

            const code = extractGFGCode();
            const lang = extractGFGLanguage();

            if (!code) {
                console.warn('[Code Sync] Could not read code from GFG editor.');
                showToast('⚠️ Solved! But could not read code from editor.', true);
                setTimeout(() => { gfgSuccessFound = false; }, 10000);
                return;
            }

            console.log('[Code Sync] GFG code captured from DOM. lang:', lang);

            // Prevent double-pushing
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

// ── LeetCode: network-interception based ─────────────────────────────────────
// Inject intercept.js into the main world to patch fetch/XHR (LeetCode only)
if (platform === 'LeetCode') {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/intercept.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
}

// Listen for messages from intercept.js (LeetCode)
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'CODE_SUBMISSION_ACCEPTED') {
        console.log('[Code Sync] Received accepted submission via Network!', event.data.payload);
        pushSubmission(event.data.payload);
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
    const difficulty = payload.platform === 'GeeksForGeeks' ? 'See GeeksForGeeks for difficulty' : 'See LeetCode for difficulty';

    const finalPayload = {
        title: title,
        difficulty: difficulty,
        code: payload.code,
        language: payload.lang,
        stats: payload.stats,
        platform: payload.platform || 'LeetCode'
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

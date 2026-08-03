document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settings-form');
    const tokenInput = document.getElementById('gh-token');
    const repoInput = document.getElementById('gh-repo');
    const saveBtn = document.getElementById('save-btn');
    const btnText = document.querySelector('.btn-text');
    const spinner = document.querySelector('.spinner');
    const statusMsg = document.getElementById('status-message');
    const connectionDot = document.getElementById('connection-dot');
    const connectionStatus = document.getElementById('connection-status');

    // Load saved settings
    const { ghToken, ghRepo } = await chrome.storage.local.get(['ghToken', 'ghRepo']);
    if (ghToken) tokenInput.value = ghToken;
    if (ghRepo) repoInput.value = ghRepo;

    if (ghToken && ghRepo) {
        checkConnection(ghToken, ghRepo);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = tokenInput.value.trim();
        const repo = repoInput.value.trim();

        if (!token || !repo) return;

        setLoading(true);
        hideStatus();

        try {
            // 1. Validate Token
            const userRes = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!userRes.ok) {
                throw new Error('Invalid GitHub token or missing permissions.');
            }

            const userData = await userRes.json();
            const username = userData.login;

            // 2. Check if repo exists, if not create it
            const repoRes = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (repoRes.status === 404) {
                // Create repo
                const createRes = await fetch('https://api.github.com/user/repos', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: repo,
                        description: 'Collection of LeetCode questions solved!',
                        private: false,
                        auto_init: true
                    })
                });

                if (!createRes.ok) {
                    throw new Error('Failed to create repository. Check token scope (needs "repo").');
                }
            } else if (!repoRes.ok) {
                throw new Error('Error checking repository status.');
            }

            // Save to storage
            await chrome.storage.local.set({ ghToken: token, ghRepo: repo, ghUsername: username });
            
            showStatus('Connected and repository ready!', 'success');
            updateConnectionStatus(true);
            
        } catch (err) {
            showStatus(err.message, 'error');
            updateConnectionStatus(false);
        } finally {
            setLoading(false);
        }
    });

    async function checkConnection(token, repo) {
        try {
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (userRes.ok) {
                updateConnectionStatus(true);
            } else {
                updateConnectionStatus(false);
            }
        } catch (e) {
            updateConnectionStatus(false);
        }
    }

    function setLoading(isLoading) {
        saveBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    function showStatus(message, type) {
        statusMsg.textContent = message;
        statusMsg.className = `status ${type}`;
        statusMsg.classList.remove('hidden');
    }

    function hideStatus() {
        statusMsg.classList.add('hidden');
        statusMsg.className = 'status hidden';
    }

    function updateConnectionStatus(isConnected) {
        if (isConnected) {
            connectionDot.className = 'dot connected';
            connectionStatus.textContent = 'Connected';
        } else {
            connectionDot.className = 'dot error';
            connectionStatus.textContent = 'Disconnected';
        }
    }
});

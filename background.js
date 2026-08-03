// Background Service Worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PUSH_SUBMISSION') {
        (async () => {
            try {
                await pushToGitHub(request.data);
                sendResponse({ success: true });
            } catch (err) {
                console.error("Error pushing to GitHub:", err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true; // Keep channel open for async response
    }
});

async function pushToGitHub(data) {
    const { title, difficulty, code, language, stats } = data;
    const { ghToken, ghRepo, ghUsername } = await chrome.storage.local.get(['ghToken', 'ghRepo', 'ghUsername']);

    if (!ghToken || !ghRepo || !ghUsername) {
        throw new Error('GitHub credentials not configured.');
    }

    // Determine file extension
    const extMap = {
        'python3': 'py', 'python': 'py', 'java': 'java', 'cpp': 'cpp', 'c': 'c',
        'javascript': 'js', 'typescript': 'ts', 'csharp': 'cs', 'ruby': 'rb',
        'swift': 'swift', 'golang': 'go', 'scala': 'scala', 'kotlin': 'kt', 'rust': 'rs',
        'php': 'php', 'mysql': 'sql', 'mssql': 'sql', 'oraclesql': 'sql'
    };
    const ext = extMap[language.toLowerCase()] || 'txt';
    
    // Clean up title for folder name
    const folderName = title.replace(/[^\w\s-]/g, '').trim();
    const filePath = `${folderName}/solution.${ext}`;
    const readmePath = `${folderName}/README.md`;

    // Create a README content with stats
    const readmeContent = `# ${title}\n\n**Difficulty:** ${difficulty}\n\n**Stats:** ${stats}`;
    
    // Push README
    await createOrUpdateFile(ghToken, ghUsername, ghRepo, readmePath, readmeContent, `Add README for ${title}`);
    
    // Push Code
    await createOrUpdateFile(ghToken, ghUsername, ghRepo, filePath, code, `Add solution for ${title}`);
}

async function createOrUpdateFile(token, owner, repo, path, content, message) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    // 1. Check if file exists to get its SHA
    let sha = null;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
    }

    // 2. Base64 encode content (handle unicode properly)
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    // 3. Create or update file
    const body = {
        message,
        content: encodedContent,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
    });

    if (!putRes.ok) {
        const errorData = await putRes.json();
        throw new Error(`GitHub API Error: ${errorData.message}`);
    }
}

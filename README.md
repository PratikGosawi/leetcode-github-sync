# Code Sync (LeetCode & GeeksForGeeks)

A modern, fast, and completely standalone Chrome Extension that automatically pushes your accepted LeetCode and GeeksForGeeks solutions to a GitHub repository of your choice. 

Built as a lightweight alternative to LeetHub, this extension prioritizes privacy, speed, and reliability by communicating directly with the GitHub API without any intermediate OAuth servers.

## ✨ Features

- **Dual Platform Support**: Seamlessly syncs from both LeetCode and GeeksForGeeks. Solutions are automatically organized into respective `LeetCode/` and `GeeksForGeeks/` folders.
- **Zero Backend**: All authentication and API requests happen locally on your machine.
- **Flawless Interception**: Instead of scraping the UI, it securely intercepts the underlying network requests to the platforms' servers, meaning it will never break when they update their visual layout.
- **Auto-Sync**: The moment your solution passes all test cases, it is pushed directly to your specified GitHub repository.
- **Auto-Repo Creation**: The extension can automatically initialize the repository on your GitHub account if it doesn't already exist.
- **Beautiful UI**: Features a sleek, dark-mode, glassmorphism popup interface.

## 🚀 Installation & Setup

### 1. Load the Extension
1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the folder containing this extension.

### 2. Configure your GitHub Token
To allow the extension to push code on your behalf, you need a Personal Access Token (PAT):
1. Go to your [GitHub Tokens settings](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Give it a descriptive name and check the **`repo`** scope (this grants it permission to create repos and push code).
4. Click **Generate** and copy the token.
5. Click on the LeetCode Sync extension icon in your Chrome toolbar.
6. Paste your token, type in your desired repository name (e.g., `LeetCode-Solutions`), and click **Connect & Save**.

## 💡 How it works

1. When you click "Submit" on LeetCode, the extension silently captures the code you wrote from the outgoing network request.
2. It then listens to LeetCode's polling mechanism (`/check/` endpoint).
3. As soon as the servers return an `Accepted` status, the extension bundles your code, generates a small README with your runtime/memory stats, and pushes it directly to your GitHub using the GitHub REST API.

## 🛠 Tech Stack

- Manifest V3 (Chrome Extension standard)
- Vanilla JavaScript (ES6+)
- Vanilla CSS3 (Glassmorphism design)
- GitHub REST API

## 📝 License

This project is licensed under the MIT License.

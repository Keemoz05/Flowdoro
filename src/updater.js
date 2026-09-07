/**
 * updater.js — Flowdoro In-App Update Checker
 *
 * Fetches latest release metadata from GitHub Releases API.
 * Compares semantic versions, presents changelog notes,
 * and provides direct download links to the installer.
 */

const REPO_OWNER = 'Keemoz05';
const REPO_NAME = 'Flowdoro';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const GITHUB_RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;

// Current version of Flowdoro
export const APP_VERSION = '2.0.0';

// ── State ──
let isChecking = false;
let latestReleaseData = null;

// ── SemVer Helper Functions ──

/**
 * Parse a version string (e.g. "v2.1.0", "2.0.0", "v2.1") into [major, minor, patch]
 */
export function parseVersion(versionStr) {
  if (!versionStr || typeof versionStr !== 'string') return [0, 0, 0];
  const clean = versionStr.replace(/^[vV]/, '').trim();
  const parts = clean.split(/[-+.]/);
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  return [major, minor, patch];
}

/**
 * Returns true if remoteVersion > currentVersion
 */
export function isNewerVersion(remoteVersion, currentVersion) {
  const [rMaj, rMin, rPatch] = parseVersion(remoteVersion);
  const [cMaj, cMin, cPatch] = parseVersion(currentVersion);

  if (rMaj > cMaj) return true;
  if (rMaj < cMaj) return false;
  if (rMin > cMin) return true;
  if (rMin < cMin) return false;
  return rPatch > cPatch;
}

/**
 * Find the primary Windows installer from release assets (.exe or .msi)
 */
export function findInstallerAsset(assets = []) {
  if (!Array.isArray(assets)) return null;
  const exe = assets.find((a) => a.name && a.name.toLowerCase().endsWith('.exe'));
  if (exe) return exe;
  const msi = assets.find((a) => a.name && a.name.toLowerCase().endsWith('.msi'));
  if (msi) return msi;
  return null;
}

/**
 * Format bytes into human-readable size (e.g. 14.5 MB)
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Format date string
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Open external URL using Tauri opener plugin if available, or browser fallback
 */
export async function openUrl(url) {
  if (!url) return;
  try {
    if (window.__TAURI__?.opener?.openUrl) {
      await window.__TAURI__.opener.openUrl(url);
      return;
    }
  } catch (e) {
    console.warn('Tauri opener failed, using window.open:', e);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Download installer file with real-time stream progress and launch it
 */
export async function downloadWithProgress(url, assetName, totalBytes) {
  const progressCard = document.getElementById('download-progress-card');
  const progressFill = document.getElementById('download-progress-fill');
  const percentText = document.getElementById('download-percent-text');
  const sizeText = document.getElementById('download-size-text');
  const statusText = document.getElementById('download-status-text');
  const btnDownload = document.getElementById('btn-download-update');
  const btnDownloadText = document.getElementById('btn-download-text');

  if (progressCard) progressCard.classList.remove('hidden');
  if (btnDownload) btnDownload.disabled = true;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : totalBytes;

    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;

      if (total > 0) {
        const percent = Math.min(100, Math.round((receivedBytes / total) * 100));
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (sizeText) {
          sizeText.textContent = `${formatBytes(receivedBytes)} / ${formatBytes(total)}`;
        }
      }
    }

    // Combine chunks into a blob
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);

    if (statusText) statusText.textContent = 'Download complete! Opening installer…';
    if (progressFill) progressFill.style.width = '100%';
    if (percentText) percentText.textContent = '100%';

    // Trigger download of the installer file
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = assetName || 'Flowdoro-Setup.exe';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      if (btnDownload) {
        btnDownload.disabled = false;
        if (btnDownloadText) btnDownloadText.textContent = 'Run / Open Again';
        btnDownload.onclick = () => openUrl(url);
      }
    }, 1500);
  } catch (err) {
    console.warn('In-app streaming download failed, falling back to direct URL:', err);
    if (progressCard) progressCard.classList.add('hidden');
    // Fallback directly to native opener
    await openUrl(url);
  } finally {
    if (btnDownload) btnDownload.disabled = false;
  }
}

/**
 * Minimal XSS-safe markdown renderer for release notes
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdown(md) {
  if (!md || !md.trim()) {
    return '<p class="text-muted">No release notes provided for this version.</p>';
  }

  // 1. HTML-escape raw text safely
  let html = escapeHtml(md);

  // 2. Headings
  html = html.replace(/^### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^## (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^# (.*$)/gim, '<h3>$1</h3>');

  // 3. Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // 4. Code backticks
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // 5. Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

  // 6. Paragraphs and linebreaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  return `<p>${html}</p>`;
}

// ─────────────────────────────────────────────────────
//  Update Checker Logic
// ─────────────────────────────────────────────────────

/**
 * Fetch latest release from GitHub API
 */
export async function fetchLatestRelease() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
  };

  const response = await fetch(GITHUB_API_URL, { headers });
  if (response.status === 404) {
    // Repository either has no releases yet or is currently private
    return { notFound: true };
  }
  if (!response.ok) {
    throw new Error(`GitHub API error: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Handle update found via native Tauri v2 updater plugin (silent in-place update)
 */
function handleNativeUpdate(update) {
  const statusIcon = document.getElementById('update-status-icon');
  const statusTitle = document.getElementById('update-status-title');
  const statusDesc = document.getElementById('update-status-desc');
  const detailsBox = document.getElementById('update-details');
  const btnDownload = document.getElementById('btn-download-update');
  const btnDownloadText = document.getElementById('btn-download-text');
  const badgeDot = document.getElementById('update-badge-dot');
  const newTagEl = document.getElementById('update-new-tag');
  const dateEl = document.getElementById('update-release-date');
  const assetNameEl = document.getElementById('update-asset-name');
  const changelogEl = document.getElementById('update-changelog-body');
  const progressCard = document.getElementById('download-progress-card');
  const progressFill = document.getElementById('download-progress-fill');
  const percentText = document.getElementById('download-percent-text');
  const sizeText = document.getElementById('download-size-text');
  const statusText = document.getElementById('download-status-text');

  if (statusIcon) {
    statusIcon.className = 'update-status-icon is-update-available';
    statusIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v14M19 9l-7 7-7-7"/>
        <path d="M5 21h14"/>
      </svg>
    `;
  }
  if (statusTitle) statusTitle.textContent = `Update available: v${update.version}`;
  if (statusDesc) {
    statusDesc.textContent = 'A new version is ready to install silently in the background.';
  }
  if (newTagEl) newTagEl.textContent = `v${update.version}`;
  if (dateEl) dateEl.textContent = update.date ? `Released ${formatDate(update.date)}` : '';
  if (assetNameEl) assetNameEl.textContent = 'Silent in-place update (Tauri Native)';
  if (changelogEl) changelogEl.innerHTML = renderMarkdown(update.body);
  if (detailsBox) detailsBox.classList.remove('hidden');
  if (badgeDot) badgeDot.classList.remove('hidden');

  if (btnDownload) {
    btnDownload.classList.remove('hidden');
    if (btnDownloadText) btnDownloadText.textContent = 'Update & Restart Now';

    btnDownload.onclick = async () => {
      if (progressCard) progressCard.classList.remove('hidden');
      btnDownload.disabled = true;
      if (statusText) statusText.textContent = 'Downloading update…';

      try {
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              if (contentLength > 0) {
                const percent = Math.min(100, Math.round((downloaded / contentLength) * 100));
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (percentText) percentText.textContent = `${percent}%`;
                if (sizeText) {
                  sizeText.textContent = `${formatBytes(downloaded)} / ${formatBytes(contentLength)}`;
                }
              }
              break;
            case 'Finished':
              if (statusText) statusText.textContent = 'Applying update & relaunching…';
              if (progressFill) progressFill.style.width = '100%';
              if (percentText) percentText.textContent = '100%';
              break;
          }
        });

        // Relaunch app cleanly on the new version!
        if (window.__TAURI__?.core?.invoke) {
          await window.__TAURI__.core.invoke('relaunch_app');
        }
      } catch (err) {
        console.error('Native update install error:', err);
        if (statusText) statusText.textContent = `Update failed: ${err}`;
        btnDownload.disabled = false;
      }
    };
  }
}

/**
 * Perform update check and update UI elements
 * @param {boolean} manual - true if triggered by user clicking 'Check for Updates'
 */
export async function checkForUpdates(manual = false) {
  if (isChecking) return;
  isChecking = true;

  const btnCheck = document.getElementById('btn-check-update');
  const btnCheckText = document.getElementById('btn-check-update-text');
  const statusIcon = document.getElementById('update-status-icon');
  const statusTitle = document.getElementById('update-status-title');
  const statusDesc = document.getElementById('update-status-desc');
  const detailsBox = document.getElementById('update-details');
  const btnDownload = document.getElementById('btn-download-update');
  const btnViewRelease = document.getElementById('btn-view-release');
  const badgeDot = document.getElementById('update-badge-dot');

  // Set checking UI state
  if (btnCheck) btnCheck.disabled = true;
  if (btnCheckText) btnCheckText.textContent = 'Checking…';
  if (statusIcon) {
    statusIcon.innerHTML = `
      <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    `;
    statusIcon.className = 'update-status-icon is-checking';
  }
  if (statusTitle) statusTitle.textContent = 'Checking for updates…';
  if (statusDesc) statusDesc.textContent = 'Connecting to GitHub to fetch the latest version.';

  try {
    // 1. Primary Engine: Try Native Tauri v2 Updater (signed silent in-place update)
    if (window.__TAURI__?.updater?.check) {
      try {
        const nativeUpdate = await window.__TAURI__.updater.check();
        if (nativeUpdate) {
          handleNativeUpdate(nativeUpdate);
          return;
        }
      } catch (nativeErr) {
        console.info('Native updater check skipped or not yet available, falling back to GitHub API:', nativeErr);
      }
    }

    // 2. Fallback Engine: GitHub Releases API
    const release = await fetchLatestRelease();
    latestReleaseData = release;

    if (release.notFound) {
      // 404: No releases published yet
      if (statusIcon) {
        statusIcon.className = 'update-status-icon is-up-to-date';
        statusIcon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
      }
      if (statusTitle) statusTitle.textContent = 'You are on the latest version';
      if (statusDesc) {
        statusDesc.textContent = `Flowdoro v${APP_VERSION} is current. No newer public releases were found.`;
      }
      if (detailsBox) detailsBox.classList.add('hidden');
      if (btnDownload) btnDownload.classList.add('hidden');
      if (btnViewRelease) btnViewRelease.classList.add('hidden');
      if (badgeDot) badgeDot.classList.add('hidden');
      return;
    }

    const latestTag = release.tag_name || release.name || '';
    const hasUpdate = isNewerVersion(latestTag, APP_VERSION);

    if (hasUpdate) {
      // Update Available!
      const asset = findInstallerAsset(release.assets);
      const downloadUrl = asset ? asset.browser_download_url : release.html_url;
      const assetSize = asset ? formatBytes(asset.size) : '';

      if (statusIcon) {
        statusIcon.className = 'update-status-icon is-update-available';
        statusIcon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v14M19 9l-7 7-7-7"/>
            <path d="M5 21h14"/>
          </svg>
        `;
      }
      if (statusTitle) statusTitle.textContent = `Update available: ${latestTag}`;
      if (statusDesc) {
        statusDesc.textContent = `A newer version of Flowdoro is ready to download.`;
      }

      // Populate details
      const newTagEl = document.getElementById('update-new-tag');
      const dateEl = document.getElementById('update-release-date');
      const assetNameEl = document.getElementById('update-asset-name');
      const changelogEl = document.getElementById('update-changelog-body');

      if (newTagEl) newTagEl.textContent = latestTag;
      if (dateEl) dateEl.textContent = `Released ${formatDate(release.published_at)}`;
      if (assetNameEl) {
        assetNameEl.textContent = asset
          ? `Package: ${asset.name}${assetSize ? ` (${assetSize})` : ''}`
          : 'Installer bundle';
      }
      if (changelogEl) {
        changelogEl.innerHTML = renderMarkdown(release.body);
      }

      if (detailsBox) detailsBox.classList.remove('hidden');

      // Setup Download button with smooth in-app progress flow
      if (btnDownload) {
        btnDownload.classList.remove('hidden');
        const btnDownloadText = document.getElementById('btn-download-text');
        if (btnDownloadText) {
          btnDownloadText.textContent = asset ? 'Download & Update' : 'View Release Page';
        }
        btnDownload.onclick = () => {
          if (asset && asset.browser_download_url) {
            downloadWithProgress(asset.browser_download_url, asset.name, asset.size);
          } else {
            openUrl(downloadUrl);
          }
        };
      }

      if (btnViewRelease) {
        btnViewRelease.classList.remove('hidden');
        btnViewRelease.onclick = (e) => {
          e.preventDefault();
          openUrl(release.html_url || GITHUB_RELEASES_PAGE);
        };
      }

      // Show indicator dot in main UI
      if (badgeDot) badgeDot.classList.remove('hidden');
    } else {
      // Up to date!
      if (statusIcon) {
        statusIcon.className = 'update-status-icon is-up-to-date';
        statusIcon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
      }
      if (statusTitle) statusTitle.textContent = 'Flowdoro is up to date';
      if (statusDesc) {
        statusDesc.textContent = `You are running version v${APP_VERSION}, which is the latest version available.`;
      }
      if (detailsBox) detailsBox.classList.add('hidden');
      if (btnDownload) btnDownload.classList.add('hidden');
      if (btnViewRelease) btnViewRelease.classList.add('hidden');
      if (badgeDot) badgeDot.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Failed to check for updates:', err);
    if (statusIcon) {
      statusIcon.className = 'update-status-icon is-error';
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    }
    if (statusTitle) statusTitle.textContent = 'Unable to check for updates';
    if (statusDesc) {
      statusDesc.textContent =
        'Could not connect to GitHub. Please check your internet connection and try again.';
    }
    if (detailsBox) detailsBox.classList.add('hidden');
    if (btnDownload) btnDownload.classList.add('hidden');
    if (btnViewRelease) btnViewRelease.classList.add('hidden');
  } finally {
    isChecking = false;
    if (btnCheck) btnCheck.disabled = false;
    if (btnCheckText) btnCheckText.textContent = 'Check for Updates';
  }
}

// ─────────────────────────────────────────────────────
//  Modal Management & Initialization
// ─────────────────────────────────────────────────────

export function openAboutModal() {
  const modal = document.getElementById('about-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

export function closeAboutModal() {
  const modal = document.getElementById('about-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

export function initUpdater() {
  const btnOpenAbout = document.getElementById('btn-open-about');
  const btnCloseAbout = document.getElementById('btn-close-about-modal');
  const modal = document.getElementById('about-modal');
  const btnCheck = document.getElementById('btn-check-update');
  const btnGithub = document.getElementById('btn-view-github');

  // Trigger button opens modal
  if (btnOpenAbout) {
    btnOpenAbout.addEventListener('click', () => {
      openAboutModal();
    });
  }

  // Close button
  if (btnCloseAbout) {
    btnCloseAbout.addEventListener('click', () => {
      closeAboutModal();
    });
  }

  // Backdrop click to close
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAboutModal();
      }
    });
  }

  // Escape key closes modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeAboutModal();
    }
  });

  // Check button inside modal
  if (btnCheck) {
    btnCheck.addEventListener('click', () => {
      checkForUpdates(true);
    });
  }

  // GitHub repo link
  if (btnGithub) {
    btnGithub.addEventListener('click', (e) => {
      e.preventDefault();
      openUrl(`https://github.com/${REPO_OWNER}/${REPO_NAME}`);
    });
  }

  // Background check 3 seconds after startup
  setTimeout(() => {
    checkForUpdates(false).catch(() => {});
  }, 3000);
}

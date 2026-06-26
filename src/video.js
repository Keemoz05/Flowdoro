/**
 * video.js — Ambient Video Player (Redesigned with Library + YouTube)
 *
 * Supports:
 *  - User-imported local videos (copied to $APPDATA/videos/)
 *  - YouTube URL embeds (iframe with postMessage control)
 *
 * Volume toggle (muted by default) for both local and YouTube.
 * Settings overlay for managing the video library.
 * Keyboard-isolated: does not capture keyboard events.
 */

import {
  getLibrary,
  addLocalVideo, addYouTubeVideo, removeVideo,
  getVolumeMuted, setVolumeMuted,
  getActiveVideoId, setActiveVideoId,
  extractYouTubeId, MAX_LIBRARY_SIZE,
} from './video-library.js';

// ── DOM refs ──
const elVideo         = document.getElementById('video-player');
const elYoutube       = document.getElementById('youtube-player');
const elHint          = document.getElementById('video-hint');
const elSelector      = document.getElementById('video-selector');
const elSettingsBtn   = document.getElementById('btn-video-settings');
const elSettingsOvl   = document.getElementById('video-settings-overlay');
const elCloseSettings = document.getElementById('btn-close-settings');
const elYtInput       = document.getElementById('youtube-url-input');
const elYtAdd         = document.getElementById('btn-add-youtube');
const elGrid          = document.getElementById('video-library-grid');
const elSlotCounter   = document.getElementById('video-slot-counter');
const elVolumeBtn     = document.getElementById('btn-volume-toggle');
const elVolumeMuted   = document.getElementById('icon-vol-muted');
const elVolumeOn      = document.getElementById('icon-vol-on');

// ── State ──
let currentEntry = null;   // Currently playing library entry
let isMuted = true;
let ytReady = false;       // YouTube iframe API ready
let libraryPath = '';      // Absolute path to $APPDATA/videos/
let shouldBePlaying = false;  // Whether the timer has requested video playback
let ytDeferred = false;       // Whether YouTube iframe load is deferred until play

// ─────────────────────────────────────────────────────
//  Resolve library path from Tauri backend
// ─────────────────────────────────────────────────────
async function resolveLibraryPath() {
  try {
    if (window.__TAURI__) {
      libraryPath = await window.__TAURI__.core.invoke('get_video_library_path');
    }
  } catch (e) {
    console.warn('Could not resolve video library path:', e);
  }
}

// ─────────────────────────────────────────────────────
//  Build asset URL for a library entry
// ─────────────────────────────────────────────────────
function getVideoSrc(entry) {
  if (entry.type === 'local') {
    // Use Tauri's convertFileSrc for files in $APPDATA/videos/
    if (window.__TAURI__ && libraryPath) {
      const fullPath = libraryPath + '\\' + entry.filename;
      return window.__TAURI__.core.convertFileSrc(fullPath);
    }
    return '';
  }
  return '';
}

// ─────────────────────────────────────────────────────
//  Load a video entry (local or YouTube)
// ─────────────────────────────────────────────────────
function loadEntry(entry) {
  if (!entry) return;
  currentEntry = entry;
  setActiveVideoId(entry.id);

  // Force volume to off when loading a video
  isMuted = true;
  setVolumeMuted(true);
  updateVolumeUI();

  if (entry.type === 'youtube') {
    // Switch to YouTube iframe
    elVideo.style.display = 'none';
    elVideo.pause();
    elYoutube.style.display = 'block';
    ytReady = false;

    if (shouldBePlaying) {
      // Timer is already running — load YouTube immediately with autoplay
      const embedUrl = `https://www.youtube.com/embed/${entry.youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${entry.youtubeId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&controls=0`;
      elYoutube.src = embedUrl;
      ytDeferred = false;
    } else {
      // Timer not running — defer iframe load to save GPU/RAM (~50-120MB)
      elYoutube.src = 'about:blank';
      ytDeferred = true;
    }

    elHint.textContent = `${isMuted ? '🔇' : '🔊'} YouTube · Ambient`;
  } else {
    // Switch to local <video>
    elYoutube.style.display = 'none';
    elYoutube.src = 'about:blank';  // Properly unload YouTube renderer process
    elVideo.style.display = 'block';
    ytDeferred = false;
    const src = getVideoSrc(entry);
    if (src) {
      elVideo.src = src;
      elVideo.muted = isMuted;
      elVideo.load();
    }
    elHint.textContent = `${isMuted ? '🔇' : '🔊'} ${entry.name} · Ambient`;
  }

  // Update dot selector active state
  renderDotSelector();
}

// ─────────────────────────────────────────────────────
//  Dot Selector (bottom-right)
// ─────────────────────────────────────────────────────
function renderDotSelector() {
  const library = getLibrary();
  elSelector.innerHTML = '';

  library.forEach((entry, i) => {
    const btn = document.createElement('button');
    btn.className = 'video-num-btn';
    if (currentEntry && currentEntry.id === entry.id) {
      btn.classList.add('active');
    }
    btn.title = entry.name || (entry.type === 'youtube' ? 'YouTube' : `Video ${i + 1}`);
    btn.dataset.videoId = entry.id;

    // YouTube entries get a tiny ▶ feel (handled by CSS active color)
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadEntry(entry);
    });

    elSelector.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────
//  Volume Toggle
// ─────────────────────────────────────────────────────
function updateVolumeUI() {
  if (elVolumeMuted && elVolumeOn) {
    elVolumeMuted.style.display = isMuted ? 'block' : 'none';
    elVolumeOn.style.display    = isMuted ? 'none' : 'block';
  }
}

function toggleVolume() {
  isMuted = !isMuted;
  setVolumeMuted(isMuted);
  updateVolumeUI();

  if (currentEntry && currentEntry.type === 'youtube') {
    // YouTube: send postMessage to mute/unmute (only if iframe is loaded)
    if (!ytDeferred) {
      try {
        const cmd = isMuted
          ? '{"event":"command","func":"mute","args":""}'
          : '{"event":"command","func":"unMute","args":""}';
        elYoutube.contentWindow.postMessage(cmd, '*');
      } catch (e) { /* cross-origin safety */ }
    }
  } else {
    elVideo.muted = isMuted;
  }

  // Update hint
  if (currentEntry) {
    const name = currentEntry.type === 'youtube' ? 'YouTube' : currentEntry.name;
    elHint.textContent = `${isMuted ? '🔇' : '🔊'} ${name} · Ambient`;
  }
}

// ─────────────────────────────────────────────────────
//  Settings Overlay
// ─────────────────────────────────────────────────────
function openSettings() {
  elSettingsOvl.classList.remove('hidden');
  renderLibraryGrid();
}

function closeSettings() {
  elSettingsOvl.classList.add('hidden');
}

// ─────────────────────────────────────────────────────
//  Library Grid (inside settings overlay)
// ─────────────────────────────────────────────────────
function renderLibraryGrid() {
  const library = getLibrary();
  elGrid.innerHTML = '';

  library.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'video-card';
    if (currentEntry && currentEntry.id === entry.id) {
      card.classList.add('active');
    }

    // Type icon
    const icon = document.createElement('span');
    icon.className = 'video-card-icon';
    if (entry.type === 'youtube') {
      icon.textContent = '▶';
      icon.classList.add('video-card-icon--yt');
    } else {
      icon.textContent = '🎬';
    }

    // Name
    const name = document.createElement('span');
    name.className = 'video-card-name';
    name.textContent = entry.name || 'YouTube Video';
    name.title = entry.name || 'YouTube Video';

    // Delete button
    const del = document.createElement('button');
    del.className = 'video-card-delete';
    del.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    del.title = 'Remove';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteVideo(entry);
    });

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(del);

    // Click card to select
    card.addEventListener('click', () => {
      loadEntry(entry);
      renderLibraryGrid(); // Re-render to update active state
    });

    elGrid.appendChild(card);
  });

  // Add card (if not full)
  if (library.length < MAX_LIBRARY_SIZE) {
    const addCard = document.createElement('div');
    addCard.className = 'video-card video-card--add';
    addCard.innerHTML = '<span class="video-card-add-icon">+</span><span class="video-card-name">Add Video</span>';
    addCard.addEventListener('click', handleAddLocalVideo);
    elGrid.appendChild(addCard);
  }

  // Update counter
  elSlotCounter.textContent = `${library.length} / ${MAX_LIBRARY_SIZE} slots used`;
}

// ─────────────────────────────────────────────────────
//  Add Local Video (file picker → copy → save)
// ─────────────────────────────────────────────────────
async function handleAddLocalVideo() {
  try {
    if (!window.__TAURI__) {
      showToast('File import requires the desktop app.');
      return;
    }

    // Open native file dialog
    const selected = await window.__TAURI__.dialog.open({
      multiple: false,
      filters: [{
        name: 'Video Files',
        extensions: ['mp4', 'webm'],
      }],
    });

    if (!selected) return; // User cancelled

    const filePath = typeof selected === 'string' ? selected : selected.path;
    if (!filePath) return;

    // Extract display name from the path
    const parts = filePath.replace(/\\/g, '/').split('/');
    const fileName = parts[parts.length - 1];
    const displayName = fileName.replace(/\.[^.]+$/, '');

    // Copy to library via Tauri command (includes 200MB size check)
    const uuidFilename = await window.__TAURI__.core.invoke('copy_video_to_library', {
      sourcePath: filePath,
    });

    // Add to library storage
    const result = addLocalVideo(displayName, uuidFilename);
    if (!result.ok) {
      showToast(result.error);
      return;
    }

    showToast(`Added "${displayName}"`);
    renderLibraryGrid();
    renderDotSelector();

  } catch (e) {
    const msg = typeof e === 'string' ? e : (e.message || 'Failed to add video');
    showToast(msg);
    console.error('Add video error:', e);
  }
}

// ─────────────────────────────────────────────────────
//  Add YouTube Video
// ─────────────────────────────────────────────────────
function handleAddYouTube() {
  const url = elYtInput.value.trim();
  if (!url) return;

  const result = addYouTubeVideo(url);
  if (!result.ok) {
    showToast(result.error);
    return;
  }

  elYtInput.value = '';
  showToast('YouTube video added');
  renderLibraryGrid();
  renderDotSelector();

  // Auto-play the newly added YouTube video
  if (result.entry) {
    loadEntry(result.entry);
  }
}

// ─────────────────────────────────────────────────────
//  Delete Video
// ─────────────────────────────────────────────────────
async function handleDeleteVideo(entry) {
  const removed = removeVideo(entry.id);
  if (!removed) return;

  // If it's a local (non-bundled) video, delete the file
  if (removed.type === 'local' && removed.filename && window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('delete_video_from_library', {
        filename: removed.filename,
      });
    } catch (e) {
      console.warn('Failed to delete video file:', e);
    }
  }

  // If we deleted the active video, load the first available
  if (currentEntry && currentEntry.id === removed.id) {
    const library = getLibrary();
    if (library.length > 0) {
      loadEntry(library[0]);
    } else {
      currentEntry = null;
      elVideo.src = '';
      elVideo.style.display = 'block';
      elYoutube.style.display = 'none';
      elYoutube.src = '';
      elHint.textContent = '🔇 No videos · Add one in settings';
    }
  }

  showToast(`Removed "${removed.name || 'video'}"`);
  renderLibraryGrid();
  renderDotSelector();
}

// ─────────────────────────────────────────────────────
//  Toast helper (reuses existing toast system if present)
// ─────────────────────────────────────────────────────
function showToast(msg) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─────────────────────────────────────────────────────
//  Keyboard isolation
// ─────────────────────────────────────────────────────
function blockVideoKeyboard(e) {
  if (e.target === elVideo || elVideo.contains(e.target)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// ─────────────────────────────────────────────────────
//  Timer control API (called from main.js)
// ─────────────────────────────────────────────────────
export function playVideo() {
  if (!currentEntry) return;
  shouldBePlaying = true;

  // Don't start video playback while window is hidden (save GPU/RAM)
  if (document.hidden) return;

  if (currentEntry.type === 'youtube') {
    if (ytDeferred) {
      // First play — load the YouTube iframe now with autoplay
      const embedUrl = `https://www.youtube.com/embed/${currentEntry.youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentEntry.youtubeId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&controls=0`;
      elYoutube.src = embedUrl;
      ytDeferred = false;
    } else {
      try {
        elYoutube.contentWindow.postMessage(
          '{"event":"command","func":"playVideo","args":""}', '*'
        );
      } catch (e) { /* cross-origin */ }
    }
  } else {
    elVideo.muted = isMuted;
    elVideo.play().catch(() => {});
  }
}

export function pauseVideo() {
  if (!currentEntry) return;
  shouldBePlaying = false;

  if (currentEntry.type === 'youtube') {
    if (!ytDeferred) {
      try {
        elYoutube.contentWindow.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}', '*'
        );
      } catch (e) { /* cross-origin */ }
    }
  } else {
    elVideo.pause();
  }
}

// ─────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────
export async function initVideo() {
  // Resolve library path from Tauri
  await resolveLibraryPath();

  // Force volume to off on app open
  isMuted = true;
  setVolumeMuted(true);
  updateVolumeUI();

  // Load the previously active video, or first in library
  const library = getLibrary();
  const activeId = getActiveVideoId();
  const activeEntry = library.find(v => v.id === activeId) || library[0];
  if (activeEntry) {
    loadEntry(activeEntry);
  } else {
    elHint.textContent = '🔇 No videos · Add one in settings';
  }

  // ── Event listeners ──

  // Settings overlay
  elSettingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
  });
  elCloseSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettings();
  });
  // Close overlay on backdrop click
  elSettingsOvl.addEventListener('click', (e) => {
    if (e.target === elSettingsOvl) closeSettings();
  });

  // YouTube add
  elYtAdd.addEventListener('click', handleAddYouTube);
  elYtInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddYouTube();
    e.stopPropagation(); // Don't let timer shortcuts fire
  });
  // Prevent YouTube input from triggering global shortcuts
  elYtInput.addEventListener('keyup', (e) => e.stopPropagation());

  // Volume toggle
  elVolumeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVolume();
  });

  // Keyboard isolation
  elVideo.addEventListener('keydown', blockVideoKeyboard);
  elVideo.addEventListener('keyup', blockVideoKeyboard);
  elVideo.setAttribute('tabindex', '-1');

  // ── Pause/resume video on window visibility change (GPU #1 + RAM #2) ──
  // Frees GPU decode resources and video buffer RAM while window is hidden.
  // Timer continues running — only the video playback pauses.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Window minimized/hidden — pause video to free GPU/RAM
      if (currentEntry) {
        if (currentEntry.type === 'youtube' && !ytDeferred) {
          try {
            elYoutube.contentWindow.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}', '*'
            );
          } catch (e) { /* cross-origin */ }
        } else if (currentEntry.type !== 'youtube') {
          elVideo.pause();
        }
      }
    } else {
      // Window visible again — resume video if timer is still running
      if (shouldBePlaying && currentEntry) {
        if (currentEntry.type === 'youtube') {
          if (ytDeferred) {
            // YouTube was deferred and timer started while hidden — load now
            const embedUrl = `https://www.youtube.com/embed/${currentEntry.youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentEntry.youtubeId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&controls=0`;
            elYoutube.src = embedUrl;
            ytDeferred = false;
          } else {
            try {
              elYoutube.contentWindow.postMessage(
                '{"event":"command","func":"playVideo","args":""}', '*'
              );
            } catch (e) { /* cross-origin */ }
          }
        } else {
          elVideo.muted = isMuted;
          elVideo.play().catch(() => {});
        }
      }
    }
  });
}

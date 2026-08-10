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
  getVolumeLevel, setVolumeLevel,
  getActiveVideoId, setActiveVideoId,
  extractYouTubeId, MAX_LIBRARY_SIZE,
} from './video-library.js';

// Volume to restore to when un-muting from a fully-silent state
const DEFAULT_UNMUTE_VOLUME = 50;

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
const elVolumeSlider  = document.getElementById('video-volume-slider');
const elThumb         = document.getElementById('youtube-thumb');

// ── State ──
let currentEntry = null;   // Currently playing library entry
let isMuted = false;
let volume = DEFAULT_UNMUTE_VOLUME;  // 0–100
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
//  Audio helpers (volume + mute)
// ─────────────────────────────────────────────────────
/** True when no sound should be heard (explicit mute or volume at 0). */
function isAudioOff() {
  return isMuted || volume === 0;
}

/** Build the YouTube embed URL, respecting the current mute state. */
function buildYouTubeEmbedUrl(youtubeId) {
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${isAudioOff() ? 1 : 0}&loop=1&playlist=${youtubeId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&controls=0`;
}

/** Send a command to the YouTube iframe via postMessage. */
function postYouTube(func, args = '') {
  try {
    elYoutube.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    );
  } catch (e) { /* cross-origin safety */ }
}

/** Push the current volume + mute state to whichever player is active. */
function applyVolume() {
  if (currentEntry && currentEntry.type === 'youtube') {
    if (!ytDeferred) {
      postYouTube('setVolume', [volume]);
      postYouTube(isAudioOff() ? 'mute' : 'unMute');
    }
  } else {
    elVideo.volume = volume / 100;
    elVideo.muted = isAudioOff();
  }
}

/** Update the hint label to reflect the current audio state. */
function updateHint() {
  if (!currentEntry) return;
  const name = currentEntry.type === 'youtube' ? 'YouTube' : currentEntry.name;
  elHint.textContent = `${isAudioOff() ? 'Muted' : 'Sound on'} · ${name} · Ambient`;
}

// ─────────────────────────────────────────────────────
//  YouTube poster thumbnail
//  Shown while the iframe is idle so the panel isn't black,
//  without paying the RAM/GPU cost of a live player.
// ─────────────────────────────────────────────────────
function showYouTubeThumb(youtubeId) {
  if (!elThumb) return;
  // Try highest quality first, then a smaller size; some videos (e.g. certain
  // live streams) have no static thumbnail at all — in that case stay black
  // rather than show a broken-image icon.
  let step = 0; // 0 = maxres, 1 = hqdefault, 2 = give up
  elThumb.onerror = () => {
    step++;
    if (step === 1) {
      elThumb.src = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    } else {
      elThumb.onerror = null;
      hideThumb();
    }
  };
  elThumb.src = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
  elThumb.style.display = 'block';
}

function hideThumb() {
  if (elThumb) elThumb.style.display = 'none';
}

// ─────────────────────────────────────────────────────
//  Empty State (no videos in library)
// ─────────────────────────────────────────────────────
function renderEmptyState() {
  clearEmptyState();
  hideThumb();
  elVideo.style.display = 'none';
  elHint.textContent = 'No videos yet';

  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'video-empty-state';
  emptyDiv.id = 'video-empty-state';
  emptyDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
    <h3>Set your scene</h3>
    <p>Add an ambient video to play while you focus</p>
    <button class="btn-empty-cta" id="btn-add-first-video">Add Video</button>
  `;

  const container = document.getElementById('video-container');
  container.appendChild(emptyDiv);

  // Wire the button to open settings
  document.getElementById('btn-add-first-video').addEventListener('click', () => {
    document.getElementById('video-settings-overlay').classList.remove('hidden');
    renderLibraryGrid();
  });
}

function clearEmptyState() {
  const existing = document.getElementById('video-empty-state');
  if (existing) existing.remove();
}

// ─────────────────────────────────────────────────────
//  Load a video entry (local or YouTube)
// ─────────────────────────────────────────────────────
function loadEntry(entry) {
  if (!entry) return;
  clearEmptyState();
  currentEntry = entry;
  setActiveVideoId(entry.id);

  // Reflect the saved volume preference on the controls
  updateVolumeUI();

  if (entry.type === 'youtube') {
    // Switch to YouTube iframe
    elVideo.style.display = 'none';
    elVideo.pause();
    elYoutube.style.display = 'block';
    ytReady = false;

    // Poster the panel with the thumbnail; it stays until the real iframe loads
    showYouTubeThumb(entry.youtubeId);

    if (shouldBePlaying) {
      // Timer is already running — load YouTube immediately with autoplay
      elYoutube.src = buildYouTubeEmbedUrl(entry.youtubeId);
      ytDeferred = false;
    } else {
      // Timer not running — defer iframe load to save GPU/RAM (~50-120MB)
      elYoutube.src = 'about:blank';
      ytDeferred = true;
    }
  } else {
    // Switch to local <video>
    hideThumb();
    elYoutube.style.display = 'none';
    elYoutube.src = 'about:blank';  // Properly unload YouTube renderer process
    elVideo.style.display = 'block';
    ytDeferred = false;
    const src = getVideoSrc(entry);
    if (src) {
      elVideo.src = src;
      elVideo.volume = volume / 100;
      elVideo.muted = isAudioOff();
      elVideo.load();
    }
  }

  updateHint();

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
  const off = isAudioOff();
  if (elVolumeMuted && elVolumeOn) {
    elVolumeMuted.style.display = off ? 'block' : 'none';
    elVolumeOn.style.display    = off ? 'none' : 'block';
  }
  if (elVolumeSlider) elVolumeSlider.value = String(volume);
}

/** Mute button — toggle sound off/on, restoring a sensible volume. */
function toggleVolume() {
  if (isAudioOff()) {
    // Turn sound back on
    isMuted = false;
    if (volume === 0) volume = DEFAULT_UNMUTE_VOLUME;
  } else {
    isMuted = true;
  }
  setVolumeMuted(isMuted);
  setVolumeLevel(volume);
  applyVolume();
  updateVolumeUI();
  updateHint();
}

/** Volume slider — set the level; any level above 0 implies un-muted. */
function handleVolumeSlider(e) {
  volume = parseInt(e.target.value, 10) || 0;
  if (volume > 0) isMuted = false;
  setVolumeLevel(volume);
  setVolumeMuted(isMuted);
  applyVolume();
  updateVolumeUI();
  updateHint();
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
async function handleAddYouTube() {
  const url = elYtInput.value.trim();
  if (!url) return;

  // Fetch video title from oEmbed (best-effort)
  let title = '';
  try {
    const resp = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.title) title = data.title;
    }
  } catch (_) { /* Fallback to default name */ }

  const result = addYouTubeVideo(url, title);
  if (!result.ok) {
    showToast(result.error);
    return;
  }

  elYtInput.value = '';
  showToast(title ? `Added "${title}"` : 'YouTube video added');
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
      elVideo.style.display = 'none';
      elYoutube.style.display = 'none';
      elYoutube.src = '';
      renderEmptyState();
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
      elYoutube.src = buildYouTubeEmbedUrl(currentEntry.youtubeId);
      ytDeferred = false;
    } else {
      postYouTube('playVideo');
      applyVolume();
    }
  } else {
    elVideo.volume = volume / 100;
    elVideo.muted = isAudioOff();
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

  // Restore saved volume preference (audible by default)
  isMuted = getVolumeMuted();
  volume = getVolumeLevel();
  updateVolumeUI();

  // Load the previously active video, or first in library
  const library = getLibrary();
  const activeId = getActiveVideoId();
  const activeEntry = library.find(v => v.id === activeId) || library[0];
  if (activeEntry) {
    loadEntry(activeEntry);
  } else {
    renderEmptyState();
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

  // Volume slider
  if (elVolumeSlider) {
    elVolumeSlider.value = String(volume);
    elVolumeSlider.addEventListener('input', handleVolumeSlider);
    elVolumeSlider.addEventListener('click', (e) => e.stopPropagation());
  }

  // Once a YouTube iframe finishes loading, push the saved volume to it
  // (the player ignores commands until it's ready, so re-apply after a beat).
  elYoutube.addEventListener('load', () => {
    if (currentEntry && currentEntry.type === 'youtube' && !ytDeferred) {
      hideThumb();  // real player is ready — swap poster for iframe
      setTimeout(applyVolume, 600);
    }
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
            elYoutube.src = buildYouTubeEmbedUrl(currentEntry.youtubeId);
            ytDeferred = false;
          } else {
            postYouTube('playVideo');
            applyVolume();
          }
        } else {
          elVideo.volume = volume / 100;
          elVideo.muted = isAudioOff();
          elVideo.play().catch(() => {});
        }
      }
    }
  });
}

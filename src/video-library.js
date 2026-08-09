/**
 * video-library.js — Video Library Storage Layer
 *
 * Manages a user's collection of ambient videos (up to 8).
 * Persists metadata to localStorage. Files stored in $APPDATA/videos/.
 * Supports local (.mp4, .webm) and YouTube URL entries.
 */

const STORAGE_KEY = 'flowdoro-video-library';
const VOLUME_KEY = 'flowdoro-video-muted';
const VOLUME_LEVEL_KEY = 'flowdoro-video-volume';
const ACTIVE_KEY = 'flowdoro-active-video';
const MAX_VIDEOS = 8;
const DEFAULT_VOLUME = 50; // 0–100

// Migrate from old storage keys (one-time)
(() => {
  const migrations = [
    ['pomobodo-video-library', STORAGE_KEY],
    ['pomobodo-video-muted', VOLUME_KEY],
    ['pomobodo-active-video', ACTIVE_KEY],
  ];
  migrations.forEach(([oldKey, newKey]) => {
    const old = localStorage.getItem(oldKey);
    if (old !== null && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, old);
      localStorage.removeItem(oldKey);
    }
  });
})();

// ─────────────────────────────────────────────────────
//  Library CRUD
// ─────────────────────────────────────────────────────

/**
 * Get the full video library array.
 * @returns {Array<{id: string, name: string, type: 'local'|'youtube', filename?: string, youtubeId?: string}>}
 */
export function getLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const library = JSON.parse(raw);
    if (Array.isArray(library)) {
      return library.filter(v => v.type !== 'bundled');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save the library array to localStorage.
 */
export function saveLibrary(library) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

/**
 * Add a local video to the library.
 * @param {string} name - Display name
 * @param {string} filename - UUID filename in $APPDATA/videos/
 * @returns {{ok: boolean, error?: string}}
 */
export function addLocalVideo(name, filename) {
  const library = getLibrary();
  if (library.length >= MAX_VIDEOS) {
    return { ok: false, error: `Library full (${MAX_VIDEOS} max). Remove a video first.` };
  }

  const id = 'local-' + Date.now();
  library.push({ id, name, type: 'local', filename });
  saveLibrary(library);
  return { ok: true };
}

/**
 * Add a YouTube video to the library.
 * @param {string} url - YouTube watch/short/embed URL
 * @param {string} [name] - Optional display name (fetched from oEmbed)
 * @returns {{ok: boolean, error?: string, entry?: object}}
 */
export function addYouTubeVideo(url, name) {
  const library = getLibrary();
  if (library.length >= MAX_VIDEOS) {
    return { ok: false, error: `Library full (${MAX_VIDEOS} max). Remove a video first.` };
  }

  const youtubeId = extractYouTubeId(url);
  if (!youtubeId) {
    return { ok: false, error: 'Invalid YouTube URL.' };
  }

  // Check for duplicates
  if (library.some(v => v.youtubeId === youtubeId)) {
    return { ok: false, error: 'This YouTube video is already in your library.' };
  }

  const id = 'yt-' + Date.now();
  const entry = { id, name: name || 'YouTube Video', type: 'youtube', youtubeId };
  library.push(entry);
  saveLibrary(library);
  return { ok: true, entry };
}

/**
 * Remove a video from the library by ID.
 * @param {string} videoId
 * @returns {object|null} The removed entry, or null if not found
 */
export function removeVideo(videoId) {
  let library = getLibrary();
  const index = library.findIndex(v => v.id === videoId);
  if (index === -1) return null;

  const [removed] = library.splice(index, 1);
  saveLibrary(library);
  return removed;
}

// ─────────────────────────────────────────────────────
//  Volume Preference
// ─────────────────────────────────────────────────────

export function getVolumeMuted() {
  const val = localStorage.getItem(VOLUME_KEY);
  return val === null ? false : val === 'true'; // Default: audible
}

export function setVolumeMuted(muted) {
  localStorage.setItem(VOLUME_KEY, String(muted));
}

/** Stored volume level, 0–100. Defaults to DEFAULT_VOLUME. */
export function getVolumeLevel() {
  const raw = localStorage.getItem(VOLUME_LEVEL_KEY);
  if (raw === null) return DEFAULT_VOLUME;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, n));
}

export function setVolumeLevel(level) {
  const n = Math.min(100, Math.max(0, Math.round(level)));
  localStorage.setItem(VOLUME_LEVEL_KEY, String(n));
}

// ─────────────────────────────────────────────────────
//  Active Video Preference
// ─────────────────────────────────────────────────────

export function getActiveVideoId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function setActiveVideoId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

// ─────────────────────────────────────────────────────
//  YouTube URL Parser
// ─────────────────────────────────────────────────────

/**
 * Extract a YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/
 * @param {string} url
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return u.searchParams.get('v');
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    // youtube.com/embed/ID or youtube.com/shorts/ID
    const embedMatch = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
    if (embedMatch) return embedMatch[2];
  } catch {
    // Not a valid URL
  }
  return null;
}

// ─────────────────────────────────────────────────────
//  Constants export
// ─────────────────────────────────────────────────────
export const MAX_LIBRARY_SIZE = MAX_VIDEOS;

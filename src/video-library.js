/**
 * video-library.js — Video Library Storage Layer
 *
 * Manages a user's collection of ambient videos (up to 8).
 * Persists metadata to localStorage. Files stored in $APPDATA/videos/.
 * Supports local (.mp4, .webm) and YouTube URL entries.
 */

const STORAGE_KEY = 'pomobodo-video-library';
const VOLUME_KEY = 'pomobodo-video-muted';
const ACTIVE_KEY = 'pomobodo-active-video';
const MAX_VIDEOS = 8;

// ── Default bundled videos (seeded on first launch) ──
const DEFAULT_VIDEOS = [
  { id: 'default-1', name: 'The Deep',        type: 'bundled', src: '/assets/thedeep.mp4' },
  { id: 'default-2', name: 'Doggo Renegade',  type: 'bundled', src: '/assets/videos/doggo-renegade.mp4' },
  { id: 'default-3', name: 'Thank You',       type: 'bundled', src: '/assets/videos/thankyou.mp4' },
];

// ─────────────────────────────────────────────────────
//  Library CRUD
// ─────────────────────────────────────────────────────

/**
 * Get the full video library array.
 * @returns {Array<{id: string, name: string, type: 'bundled'|'local'|'youtube', src?: string, filename?: string, youtubeId?: string}>}
 */
export function getLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
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
 * Seed the default bundled videos if the library is empty.
 */
export function seedDefaults() {
  if (getLibrary().length === 0) {
    saveLibrary([...DEFAULT_VIDEOS]);
  }
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
 * @returns {{ok: boolean, error?: string, entry?: object}}
 */
export function addYouTubeVideo(url) {
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
  const entry = { id, name: 'YouTube Video', type: 'youtube', youtubeId };
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
  return val === null ? true : val === 'true'; // Default: muted
}

export function setVolumeMuted(muted) {
  localStorage.setItem(VOLUME_KEY, String(muted));
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

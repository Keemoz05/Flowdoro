/**
 * video.js — Ambient Video Player (Redesigned)
 *
 * 3 local videos in assets. Random default on launch.
 * Numbered icons (1, 2, 3) in bottom-right to switch.
 * Keyboard-isolated: does not capture keyboard events.
 * Plays muted as ambient background when timer is running.
 */

// ── Video sources (local assets) ──
const VIDEOS = [
  { src: '/assets/thedeep.mp4',              name: 'The Deep' },
  { src: '/assets/videos/doggo-renegade.mp4', name: 'Doggo Renegade' },
  { src: '/assets/videos/thankyou.mp4',       name: 'Thank You' },
];

// ── DOM refs ──
const elVideo    = document.getElementById('video-player');
const elHint     = document.getElementById('video-hint');
const elSelector = document.getElementById('video-selector');
const elBtns     = document.querySelectorAll('.video-num-btn');

let currentIndex = 0;

// ─────────────────────────────────────────────────────
//  Load video by index
// ─────────────────────────────────────────────────────
function loadVideo(index) {
  if (index < 0 || index >= VIDEOS.length) return;

  currentIndex  = index;
  elVideo.src   = VIDEOS[index].src;
  elVideo.muted = true;
  elVideo.load();

  // Update active button
  elBtns.forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  // Update hint
  elHint.textContent = `🔇 ${VIDEOS[index].name} · Ambient`;
}

// ─────────────────────────────────────────────────────
//  Random start
// ─────────────────────────────────────────────────────
function loadRandom() {
  const randomIndex = Math.floor(Math.random() * VIDEOS.length);
  loadVideo(randomIndex);
}

// ─────────────────────────────────────────────────────
//  Timer control API (called from main.js)
// ─────────────────────────────────────────────────────
export function playVideo() {
  elVideo.muted = true;
  elVideo.play().catch(() => {});
}

export function pauseVideo() {
  elVideo.pause();
}

// ─────────────────────────────────────────────────────
//  Keyboard isolation
// ─────────────────────────────────────────────────────
function blockVideoKeyboard(e) {
  // Prevent Space, Enter, etc. from toggling video play/pause
  if (e.target === elVideo || elVideo.contains(e.target)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// ─────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────
export function initVideo() {
  // Load random video on launch
  loadRandom();

  // Video selector button clicks
  elBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.video, 10);
      loadVideo(index);
    });
  });

  // Keyboard isolation — prevent video element from capturing key events
  elVideo.addEventListener('keydown', blockVideoKeyboard);
  elVideo.addEventListener('keyup', blockVideoKeyboard);

  // Prevent video from being focusable
  elVideo.setAttribute('tabindex', '-1');
}

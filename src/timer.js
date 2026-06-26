/**
 * timer.js — Pomodoro Timer Logic (Redesigned)
 *
 * Two modes: Work (15 min default) ↔ Break (5 min default)
 * Auto-cycle: work→break auto-starts, break→work pauses ("Ready to focus?")
 * Counters: increment on completion only, persist via localStorage
 * Daily stats: auto-reset at midnight
 */

import { addWorkSecond, saveProgressNow } from './progress.js';

const RING_CIRCUMFERENCE = 553; // 2π × 88px (SVG circle radius)
const SETTINGS_KEY = 'pomobodo_settings';

// ── Default durations (in minutes) ──
const DEFAULTS = {
  workMin: 15,
  breakMin: 5,
};

let state = {
  mode:           'work',     // 'work' | 'break'
  timeRemaining:  DEFAULTS.workMin * 60,
  totalTime:      DEFAULTS.workMin * 60,
  isRunning:      false,
  waitingToStart: false,      // "Ready to focus?" state after break ends
  intervalId:     null,
};

// ── DOM refs ──
const elTime        = document.getElementById('timer-time');
const elLabel       = document.getElementById('timer-label');
const elRing        = document.getElementById('ring-progress');
const elPanel       = document.getElementById('timer-panel');
const elBtnSP       = document.getElementById('btn-start-pause');
const elIconPlay    = document.getElementById('icon-play');
const elIconPause   = document.getElementById('icon-pause');
const elBtnRestart  = document.getElementById('btn-restart');
const elBtnSkip     = document.getElementById('btn-skip');
const elModeTabs    = document.querySelectorAll('.mode-tab');
const elWorkInput   = document.getElementById('input-work-min');
const elBreakInput  = document.getElementById('input-break-min');

/** Callbacks so other modules can react to timer events */
export const timerEvents = {
  onStart:    null,  // () => void
  onPause:    null,  // () => void
  onComplete: null,  // (mode) => void
};


// ─────────────────────────────────────────────────────
//  Settings persistence
// ─────────────────────────────────────────────────────
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.workMin) elWorkInput.value = data.workMin;
    if (data.breakMin) elBreakInput.value = data.breakMin;
  } catch (_) {}
}

function saveSettings() {
  const data = {
    workMin:  parseInt(elWorkInput.value, 10) || DEFAULTS.workMin,
    breakMin: parseInt(elBreakInput.value, 10) || DEFAULTS.breakMin,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function getWorkSeconds() {
  const val = parseInt(elWorkInput.value, 10);
  return (val > 0 ? val : DEFAULTS.workMin) * 60;
}

function getBreakSeconds() {
  const val = parseInt(elBreakInput.value, 10);
  return (val > 0 ? val : DEFAULTS.breakMin) * 60;
}

// ─────────────────────────────────────────────────────
//  Sound — Web Audio API chime
// ─────────────────────────────────────────────────────
let audioCtx = null;

function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Pleasant ascending chime: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99];
    const now = audioCtx.currentTime;

    notes.forEach((freq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

      osc.start(start);
      osc.stop(start + 0.6);
    });
  } catch (_) {}
}

// ─────────────────────────────────────────────────────
//  Notifications
// ─────────────────────────────────────────────────────
function sendNotification(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/assets/tauri.svg' });
    }
  } catch (_) {}
}

function requestNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────
//  Formatting helpers
// ─────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getRingOffset(remaining, total) {
  const progress = remaining / total;
  return RING_CIRCUMFERENCE * (1 - progress);
}

function getLabelForMode(mode) {
  if (state.waitingToStart) return 'Ready?';
  return mode === 'work' ? 'Focus' : 'Break';
}



// ─────────────────────────────────────────────────────
//  DOM update
// ─────────────────────────────────────────────────────
function render() {
  elTime.textContent  = formatTime(state.timeRemaining);
  elLabel.textContent = getLabelForMode(state.mode);

  // Ring progress
  const offset = getRingOffset(state.timeRemaining, state.totalTime);
  elRing.style.strokeDashoffset = offset;

  // Body class for break accent
  document.body.classList.toggle('mode-break', state.mode !== 'work');

  // Button icon
  elIconPlay.style.display  = state.isRunning ? 'none'  : 'block';
  elIconPause.style.display = state.isRunning ? 'block' : 'none';

  // Panel state classes
  elPanel.classList.toggle('running', state.isRunning);
  elPanel.classList.toggle('waiting', state.waitingToStart);

  // Active mode tab
  elModeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });

  // Page title
  document.title = state.isRunning
    ? `${formatTime(state.timeRemaining)} · Pomobodo`
    : 'Pomobodo';

  // Disable duration inputs while running
  elWorkInput.disabled  = state.isRunning;
  elBreakInput.disabled = state.isRunning;
}

// ─────────────────────────────────────────────────────
//  Timer tick
// ─────────────────────────────────────────────────────
function tick() {
  if (state.timeRemaining <= 0) {
    handleComplete();
    return;
  }
  state.timeRemaining--;
  if (state.mode === 'work') {
    addWorkSecond();
  }
  render();
}

// ─────────────────────────────────────────────────────
//  Core actions
// ─────────────────────────────────────────────────────
export function startTimer() {
  if (state.isRunning) return;
  state.isRunning      = true;
  state.waitingToStart = false;
  state.intervalId     = setInterval(tick, 1000);
  render();
  if (timerEvents.onStart) timerEvents.onStart();
}

export function pauseTimer() {
  if (!state.isRunning) return;
  state.isRunning = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  saveProgressNow();
  render();
  if (timerEvents.onPause) timerEvents.onPause();
}

export function toggleTimer() {
  state.isRunning ? pauseTimer() : startTimer();
}

export function restartTimer() {
  pauseTimer();
  state.waitingToStart = false;
  state.totalTime     = state.mode === 'work' ? getWorkSeconds() : getBreakSeconds();
  state.timeRemaining = state.totalTime;
  render();
}

export function skipSession() {
  pauseTimer();
  advanceSession(true);
}

export function setMode(mode) {
  if (mode !== 'work' && mode !== 'break') return;
  pauseTimer();
  state.mode           = mode;
  state.waitingToStart = false;
  state.totalTime      = mode === 'work' ? getWorkSeconds() : getBreakSeconds();
  state.timeRemaining  = state.totalTime;
  render();
}

function handleComplete() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning  = false;

  const completedMode = state.mode;

  // Play sound
  playNotificationSound();

  // Send notification
  if (completedMode === 'work') {
    sendNotification('Work session complete!', 'Time for a break. 🎉');
  } else {
    sendNotification('Break over!', 'Ready to focus? 🍅');
  }

  saveProgressNow();

  if (timerEvents.onComplete) timerEvents.onComplete(completedMode);

  advanceSession(false);
}

/** Move to next phase: work→break (auto-start), break→work (pause/wait) */
function advanceSession(isSkip) {
  if (state.mode === 'work') {
    // Work finished → auto-start break
    state.mode      = 'break';
    state.totalTime = getBreakSeconds();
    state.timeRemaining = state.totalTime;
    state.waitingToStart = false;
    render();

    if (!isSkip) {
      showToast('☕ Break time! Relax.');
      // Auto-start the break timer
      setTimeout(() => startTimer(), 500);
    } else {
      showToast('⏭ Skipped to break.');
    }
  } else {
    // Break finished → wait for user ("Ready to focus?")
    state.mode      = 'work';
    state.totalTime = getWorkSeconds();
    state.timeRemaining = state.totalTime;
    state.waitingToStart = !isSkip;
    render();

    if (!isSkip) {
      showToast('🍅 Ready to focus? Press Start.');
    } else {
      showToast('⏭ Skipped to work.');
    }
  }
}

// ─────────────────────────────────────────────────────
//  Duration change handlers
// ─────────────────────────────────────────────────────
function handleDurationChange() {
  saveSettings();
  // Update current timer if not running
  if (!state.isRunning) {
    if (state.mode === 'work') {
      state.totalTime     = getWorkSeconds();
      state.timeRemaining = state.totalTime;
    } else {
      state.totalTime     = getBreakSeconds();
      state.timeRemaining = state.totalTime;
    }
    render();
  }
}

// ─────────────────────────────────────────────────────
//  Toast helper
// ─────────────────────────────────────────────────────
export function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ─────────────────────────────────────────────────────
//  Event listeners
// ─────────────────────────────────────────────────────
export function initTimer() {
  // Load persisted settings
  loadSettings();

  // Request notification permission
  requestNotificationPermission();

  // Set initial timer from settings
  state.totalTime     = getWorkSeconds();
  state.timeRemaining = state.totalTime;

  // Button listeners
  elBtnSP.addEventListener('click', toggleTimer);
  elBtnRestart.addEventListener('click', restartTimer);
  elBtnSkip.addEventListener('click', skipSession);

  // Mode tabs
  elModeTabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  // Duration inputs
  elWorkInput.addEventListener('change', handleDurationChange);
  elBreakInput.addEventListener('change', handleDurationChange);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
    if (e.code === 'KeyR')  { e.preventDefault(); restartTimer(); }
    if (e.code === 'KeyS')  { e.preventDefault(); skipSession(); }
  });

  render();
}

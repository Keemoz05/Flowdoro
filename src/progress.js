/**
 * progress.js — Daily Progress Widget
 *
 * Tracks accumulated work minutes per day, daily goal,
 * yesterday's total (last active day), and streak.
 * Renders a circular progress ring with stats.
 */

const PROGRESS_KEY = 'flowdoro_progress';

// Migrate from old storage key (one-time)
(() => {
  const old = localStorage.getItem('pomobodo_progress');
  if (old !== null && !localStorage.getItem(PROGRESS_KEY)) {
    localStorage.setItem(PROGRESS_KEY, old);
    localStorage.removeItem('pomobodo_progress');
  }
})();
const RING_CIRCUMFERENCE = 2 * Math.PI * 44; // ≈ 276.46

let progressState = {
  todaySeconds:          0,
  todayDate:             '',
  lastActiveDayMinutes:  0,
  streak:                0,
  goalHours:             1,
  goalMinutes:           0,
};


// ── DOM refs (cached on init) ──
const els = {};

// ─────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────
function getGoalTotalMinutes() {
  const total = progressState.goalHours * 60 + progressState.goalMinutes;
  return Math.max(total, 1); // minimum 1 minute
}

// ─────────────────────────────────────────────────────
//  Persistence
// ─────────────────────────────────────────────────────
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    progressState.todaySeconds         = data.todaySeconds         || 0;
    progressState.todayDate            = data.todayDate            || '';
    progressState.lastActiveDayMinutes = data.lastActiveDayMinutes || 0;
    progressState.streak               = data.streak               || 0;
    progressState.goalHours            = data.goalHours            ?? 1;
    progressState.goalMinutes          = data.goalMinutes          ?? 0;
  } catch (_) {}
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState));
}

// ─────────────────────────────────────────────────────
//  Daily reset (last-active-day logic)
// ─────────────────────────────────────────────────────
function checkDailyReset() {
  const today = new Date().toDateString();

  if (progressState.todayDate && progressState.todayDate !== today) {
    // A new day — archive the previous day
    const completedMinutes = progressState.todaySeconds / 60;
    progressState.lastActiveDayMinutes = completedMinutes;

    // Streak: met or exceeded goal?
    if (completedMinutes >= getGoalTotalMinutes()) {
      progressState.streak++;
    } else {
      progressState.streak = 0;
    }

    progressState.todaySeconds = 0;
    progressState.todayDate = today;
    saveProgress();
  } else if (!progressState.todayDate) {
    progressState.todayDate = today;
  }
}

// Track previously rendered values for animation triggers
let prevRendered = { completedMinutes: -1, streak: -1 };

/**
 * Trigger a brief scale-bump animation on an element when its value changes.
 */
function bumpIfChanged(el, newVal, key) {
  if (prevRendered[key] !== -1 && prevRendered[key] !== newVal) {
    el.classList.remove('stat-bump');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('stat-bump');
    el.addEventListener('animationend', () => el.classList.remove('stat-bump'), { once: true });
  }
  prevRendered[key] = newVal;
}

// ─────────────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────────────
function renderProgress() {
  checkDailyReset();

  const completedMinutes = Math.floor(progressState.todaySeconds / 60);
  const goalTotal = getGoalTotalMinutes();
  const progress = Math.min(completedMinutes / goalTotal, 1);

  // Ring arc
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  els.ringFill.style.strokeDashoffset = offset;

  // Yesterday
  els.yesterdayValue.textContent = Math.floor(progressState.lastActiveDayMinutes);

  // Streak
  els.streakValue.textContent = progressState.streak;
  bumpIfChanged(els.streakValue, progressState.streak, 'streak');

  // Completed
  els.completedMinutes.textContent = completedMinutes;
  els.completedUnit.textContent = completedMinutes === 1 ? 'minute' : 'minutes';
  bumpIfChanged(els.completedMinutes, completedMinutes, 'completedMinutes');

  // Goal display
  formatGoalDisplay();
}

function formatGoalDisplay() {
  const h = progressState.goalHours;
  const m = progressState.goalMinutes;

  if (h > 0 && m === 0) {
    els.goalValue.textContent = h;
    els.goalUnit.textContent  = h === 1 ? 'HOUR' : 'HOURS';
  } else if (h === 0) {
    els.goalValue.textContent = m;
    els.goalUnit.textContent  = m === 1 ? 'MINUTE' : 'MINUTES';
  } else {
    els.goalValue.textContent = `${h}h ${m}m`;
    els.goalUnit.textContent  = '';
  }
}

// ─────────────────────────────────────────────────────
//  Goal Adjustment
// ─────────────────────────────────────────────────────
function adjustGoal(minutesDelta) {
  let totalMins = progressState.goalHours * 60 + progressState.goalMinutes;
  totalMins += minutesDelta;
  if (totalMins < 30) totalMins = 30; // Minimum 30 mins
  
  progressState.goalHours = Math.floor(totalMins / 60);
  progressState.goalMinutes = totalMins % 60;
  saveProgress();
  renderProgress();
}

// ─────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────

/** Called by timer.js on every work-mode tick (+1 second) */
export function addWorkSecond() {
  progressState.todaySeconds++;
  renderProgress();

  // Auto-save every 30 seconds
  if (progressState.todaySeconds % 30 === 0) {
    saveProgress();
  }
}

/** Persist immediately (call on pause / complete / skip) */
export function saveProgressNow() {
  saveProgress();
}

/** Bootstrap — call once from main.js */
export function initProgress() {
  // Cache DOM refs
  els.ringFill       = document.getElementById('progress-ring-fill');
  els.yesterdayValue  = document.getElementById('yesterday-value');
  els.streakValue     = document.getElementById('streak-value');
  els.completedMinutes = document.getElementById('completed-minutes');
  els.completedUnit    = document.getElementById('completed-unit');
  els.goalValue       = document.getElementById('progress-goal-value');
  els.goalUnit        = document.getElementById('progress-goal-unit');
  els.incBtn          = document.getElementById('btn-inc-goal');
  els.decBtn          = document.getElementById('btn-dec-goal');

  loadProgress();
  checkDailyReset();

  // Listeners
  els.incBtn.addEventListener('click', () => adjustGoal(30));
  els.decBtn.addEventListener('click', () => adjustGoal(-30));

  renderProgress();
}

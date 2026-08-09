/**
 * onboarding.js — First-Run Spotlight Tour
 *
 * A short, 3-step guided tour that highlights the timer, tasks, and video
 * panels in turn with a spotlight cut-out and a positioned tooltip.
 * Shown only on first launch; the completion flag lives in localStorage.
 */

const ONBOARDED_KEY = 'flowdoro_onboarded';

// SVG icons keyed to each step (stroke uses currentColor)
const ICONS = {
  timer: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  tasks: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  video: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
};

const STEPS = [
  {
    target: '#timer-panel',
    icon: ICONS.timer,
    title: 'Start a focus session',
    body: 'Press Play or hit Space to begin. Work and break periods cycle automatically, and you can tune their lengths and the alarm sound right here.',
  },
  {
    target: '#todo-panel',
    icon: ICONS.tasks,
    title: 'Track your tasks',
    body: 'Jot down what you’re working on to stay focused. Tasks are saved automatically and stick around between sessions.',
  },
  {
    target: '#video-panel',
    icon: ICONS.video,
    title: 'Set your scene',
    body: 'Add ambient local or YouTube videos that play while you work — with a volume slider so it sounds just right.',
  },
];

const GAP = 12;      // px between spotlight and tooltip
const PAD = 6;       // px of breathing room around the highlighted panel

export function initOnboarding() {
  // Skip if the user has already completed the tour
  if (localStorage.getItem(ONBOARDED_KEY) === 'true') return;

  const overlay   = document.getElementById('onboarding-overlay');
  const spotlight = document.getElementById('onboarding-spotlight');
  const tooltip   = document.getElementById('onboarding-tooltip');
  const elIcon    = document.getElementById('ob-icon');
  const elTitle   = document.getElementById('ob-title');
  const elBody    = document.getElementById('ob-body');
  const elProgress = document.getElementById('ob-progress');
  const btnSkip   = document.getElementById('ob-skip');
  const btnBack   = document.getElementById('ob-back');
  const btnNext   = document.getElementById('ob-next');

  if (!overlay || !spotlight || !tooltip) return;

  let index = 0;

  function finish() {
    overlay.classList.add('hidden');
    localStorage.setItem(ONBOARDED_KEY, 'true');
    window.removeEventListener('resize', reposition);
    window.removeEventListener('keydown', onKey);
  }

  function positionFor(step) {
    const target = document.querySelector(step.target);
    if (!target) return null;
    return target.getBoundingClientRect();
  }

  function reposition() {
    const step = STEPS[index];
    const rect = positionFor(step);
    if (!rect) return;

    // Spotlight cut-out over the target panel
    const top = Math.max(rect.top - PAD, 4);
    const left = Math.max(rect.left - PAD, 4);
    const width = Math.min(rect.width + PAD * 2, window.innerWidth - left - 4);
    const height = Math.min(rect.height + PAD * 2, window.innerHeight - top - 4);
    spotlight.style.top = `${top}px`;
    spotlight.style.left = `${left}px`;
    spotlight.style.width = `${width}px`;
    spotlight.style.height = `${height}px`;

    // Tooltip placement: prefer left of the panel, else right, else below
    const tipW = tooltip.offsetWidth || 300;
    const tipH = tooltip.offsetHeight || 160;
    let tipLeft, tipTop;

    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    if (spaceLeft >= tipW + GAP) {
      tipLeft = rect.left - tipW - GAP;
      tipTop = rect.top;
    } else if (spaceRight >= tipW + GAP) {
      tipLeft = rect.right + GAP;
      tipTop = rect.top;
    } else {
      // Stack below (or above if there's no room below)
      tipLeft = rect.left;
      tipTop = (rect.bottom + GAP + tipH <= window.innerHeight)
        ? rect.bottom + GAP
        : rect.top - tipH - GAP;
    }

    // Clamp within the viewport
    tipLeft = Math.min(Math.max(tipLeft, 8), window.innerWidth - tipW - 8);
    tipTop = Math.min(Math.max(tipTop, 8), window.innerHeight - tipH - 8);
    tooltip.style.left = `${tipLeft}px`;
    tooltip.style.top = `${tipTop}px`;
  }

  function render() {
    const step = STEPS[index];
    if (elIcon) elIcon.innerHTML = step.icon;
    if (elTitle) elTitle.textContent = step.title;
    if (elBody) elBody.textContent = step.body;
    if (elProgress) elProgress.textContent = `${index + 1} / ${STEPS.length}`;

    if (btnBack) btnBack.style.visibility = index === 0 ? 'hidden' : 'visible';
    if (btnNext) btnNext.textContent = index === STEPS.length - 1 ? 'Finish' : 'Next';

    reposition();
  }

  function next() {
    if (index < STEPS.length - 1) {
      index++;
      render();
    } else {
      finish();
    }
  }

  function back() {
    if (index > 0) {
      index--;
      render();
    }
  }

  function onKey(e) {
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  }

  if (btnSkip) btnSkip.addEventListener('click', finish);
  if (btnNext) btnNext.addEventListener('click', next);
  if (btnBack) btnBack.addEventListener('click', back);
  window.addEventListener('resize', reposition);
  window.addEventListener('keydown', onKey);

  // Show the overlay and render the first step (after layout settles)
  overlay.classList.remove('hidden');
  requestAnimationFrame(render);
}

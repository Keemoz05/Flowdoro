/**
 * onboarding.js — First-Run Welcome Overlay
 *
 * Shows a simple welcome card on first launch explaining the 3 core features.
 * Dismissed via "Get Started" button. Stored in localStorage so it only shows once.
 */

const ONBOARDED_KEY = 'flowdoro_onboarded';

export function initOnboarding() {
  // Skip if user has already seen onboarding
  if (localStorage.getItem(ONBOARDED_KEY) === 'true') return;

  const overlay = document.getElementById('onboarding-overlay');
  const dismissBtn = document.getElementById('btn-onboarding-dismiss');

  if (!overlay || !dismissBtn) return;

  // Show the overlay
  overlay.classList.remove('hidden');

  // Dismiss handler
  function dismiss() {
    overlay.classList.add('hidden');
    localStorage.setItem(ONBOARDED_KEY, 'true');
  }

  dismissBtn.addEventListener('click', dismiss);

  // Also dismiss on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  // Dismiss on Escape key
  window.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      dismiss();
      window.removeEventListener('keydown', onEsc);
    }
  });
}

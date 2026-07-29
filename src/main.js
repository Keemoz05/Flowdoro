/**
 * main.js — Flowdoro App Entry Point
 * Wires together Timer, Todos, Video Player, Progress, and Onboarding modules.
 * Timer ↔ Video: ambient video plays/pauses with the timer.
 */

import { initTimer, timerEvents } from './timer.js';
import { initTodos } from './todos.js';
import { initVideo, playVideo, pauseVideo } from './video.js';
import { initProgress } from './progress.js';
import { initOnboarding } from './onboarding.js';

window.addEventListener('DOMContentLoaded', async () => {
  // ── Initialize each module ──
  initTimer();
  initTodos();
  initProgress();
  await initVideo();
  initOnboarding();

  // ── Connect timer events to video playback ──
  timerEvents.onStart = () => {
    playVideo();
  };

  timerEvents.onPause = () => {
    pauseVideo();
  };

  timerEvents.onComplete = (completedMode) => {
    pauseVideo();
    console.log(`Session complete: ${completedMode}`);
  };
});

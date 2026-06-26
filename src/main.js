/**
 * main.js — App Entry Point (Redesigned)
 * Wires together Timer, Todos, and Video Player modules.
 * Timer ↔ Video: ambient video plays/pauses with the timer.
 */

import { initTimer, timerEvents } from './timer.js';
import { initTodos } from './todos.js';
import { initVideo, playVideo, pauseVideo } from './video.js';
import { initProgress } from './progress.js';

window.addEventListener('DOMContentLoaded', async () => {
  // ── Initialize each module ──
  initTimer();
  initTodos();
  initProgress();
  await initVideo();

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

<h1 align="center">Flowdoro</h1>

<p align="center"><em>Focus in motion</em></p>

---

<p align="center">A Pomodoro timer, task manager, and ambient video player — in one distraction-free window.</p>

![alt text](image.png)

### What it is
Flowdoro is a lightweight desktop productivity app built with Tauri, HTML, CSS, and JavaScript. It combines three tools into a single mosaic layout:

- **Pomodoro Timer** — Work/Break cycle with an SVG progress ring, auto-cycling, and keyboard shortcuts
- **Task Manager** — Add, complete, and delete tasks with persistent storage
- **Ambient Video Player** — Loop local videos or YouTube URLs as your focus backdrop
- **Daily Progress Tracker** — Track focus minutes, daily goals, streaks, and yesterday's total

### Features
- Customizable work and break durations
- Auto-start breaks, "Ready to focus?" prompt before work sessions
- Ambient video syncs with the timer — plays when you work, pauses when you stop
- Video library with up to 8 slots (local files + YouTube URLs)
- Daily progress ring with adjustable goals
- Native OS notifications on session completion
- Keyboard shortcuts: `Space` (play/pause), `R` (restart), `S` (skip)
- First-run onboarding overlay for new users

### How to run
1. Ensure you have **Node.js** and the **Rust** toolchain installed.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Run in development mode:
   ```powershell
   npm run tauri dev
   ```

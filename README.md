<h1 align="center">Flowdoro</h1>

<p align="center"><em>Focus in motion</em></p>

<p align="center">
  A Pomodoro timer that plays your own ambient or lo-fi video while you focus,
  with task tracking and daily progress in one window.
</p>

<p align="center">
  <a href="https://github.com/Keemoz05/Flowdoro/releases/latest"><b>⬇ Download for Windows</b></a>
  ·
  <a href="https://github.com/Keemoz05/Flowdoro/issues">Report a bug</a>
</p>

---

<p align="center">
  <img src="docs/demo.gif" alt="Flowdoro demo: add a YouTube video, start the timer, add tasks, and switch to break" width="720" />
</p>

## What it is

Flowdoro is a small desktop app built with [Tauri](https://tauri.app). It puts four focus tools in one window:

- **Pomodoro timer:** a work and break cycle with a progress ring, auto-cycling, and keyboard shortcuts
- **Ambient video player:** loop your own local videos or YouTube links behind the timer, with a volume slider
- **Task manager:** add, complete, and delete tasks that stay saved between sessions
- **Daily progress:** focus minutes, an adjustable daily goal, streaks, and yesterday's total

## Features

- Customizable work/break durations and a choice of alarm sounds (chime, bell, soft beep)
- Ambient video syncs with the timer, so it plays when you work and pauses when you stop
- Video library with up to 8 slots (local files and YouTube links)
- Native desktop notification when a session ends
- Keyboard-first controls, so you can run the timer without the mouse
- First-run guided tour

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause the timer |
| `R` | Restart the current session |
| `S` | Skip to the next session, work or break |

## Download & install (Windows)

1. Grab the latest **`.exe`** (or `.msi`) from the [**Releases**](https://github.com/Keemoz05/Flowdoro/releases/latest) page.
2. Run it. Flowdoro isn't code-signed yet, so Windows SmartScreen may show
   **"Windows protected your PC."** This is normal for small indie apps. Click
   **More info**, then **Run anyway** to continue.

> Requires Windows 10/11. The installer bundles the WebView2 runtime if it isn't already present.

## Build from source

Requires **Node.js** and the **Rust** toolchain.

```powershell
npm install
npm run tauri dev     # run in development
npm run tauri build   # produce installers in src-tauri/target/release/bundle
```


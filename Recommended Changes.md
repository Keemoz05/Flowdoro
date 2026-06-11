# Pomobodo — Recommended Changes (Finalized)

> Based on the original `Changes.md` spec, reviewed and refined through discussion on 2026-06-11.

---

## 1. Design Changes

### Font
- Use **Inter** font for a premium, clean Apple-like aesthetic.

### Color Palette

| Component              | Color Hex              | Description                                                                 |
|------------------------|------------------------|-----------------------------------------------------------------------------|
| Primary Background     | `#0B0B0B` to `#000000` | Pure and near-pure black for app cards and settings screens.                |
| Accent Glow (Orange-Red) | `#FF451D` to `#E63917` | Vibrant orange-red for timer progress ring, "Timer" label, focus indicators. |
| Secondary Background   | `#202020`              | Lighter dark-gray for interactive elements (START, PAUSE, DURATION buttons). |
| Primary Text           | `#FFFFFF`              | Crisp white for high-importance readouts (timer digits, screen titles).     |
| Muted Text / Icons     | `#8E8E93`              | Neutral mid-gray for secondary labels, subtle borders, inactive icons.     |

---

## 2. Layout Changes

### Window
- Make the default window size **smaller** to minimize distraction.

### Navigation
- **Remove** the top navbar.
- **Remove** sessions display.
- **Remove** Work / Short Break / Long Break tabs.
- **Replace with** two modes: **Work** and **Break**.

### Controls
- Only two buttons: **Pause** and **Restart**.
- Add a **Skip** button to allow the user to skip the current phase (e.g., skip break to start working immediately). Low-effort addition that prevents frustration.

---

## 3. Timer Logic

### Durations
- **Work default:** 15 minutes
- **Break default:** 5 minutes
- User can set work and break durations **separately** via manual input.

### Auto-Cycle Behavior
The timer auto-cycles between Work and Break:
- When a **work timer finishes** → auto-start the **break timer** immediately (user earned the break).
- When a **break timer finishes** → **pause before starting work** and show a "Ready to focus?" state (respects user readiness).

### Alarm / Sound
- A **placeholder sound file** (bundled `.mp3` or `.wav` in `assets/`) plays when any timer completes.
- Sound customization is a **future feature**.
- Sound file must be accessible to the Tauri webview (place in `public/` or `assets/`).

---

## 4. Video Player

### Ambient Videos
- 3 local video files stored in `assets/videos/`.
- On app launch, **randomly play one** of the three videos.
- Small **numbered icons (1, 2, 3)** on the bottom-right corner of the video player to manually switch between videos.

### Keyboard Isolation
- The video player must **not** capture keyboard events (e.g., `Space` should not toggle video play/pause). The video is ambient background, not an interactive media player.

---

## 5. Counters & Persistence

### Work Done / Breaks Taken
- Replace the old "done" and "streak" display.
- **Work count** increments when a **work timer completes** (not on start).
- **Break count** increments when a **break timer completes** (not on start).
- This avoids double-counting from restarts or abandoned timers — counts reflect *actual completed sessions only*.

### Storage
- Use **`localStorage`** for now (zero setup, sufficient for trivial data: two counters + timer settings).
- Future migration path: `tauri-plugin-store` (file-backed JSON, survives webview data clears). Recommended when session history is added.

### Daily Stats
- Display a small counter: **"Today: X work, Y breaks"**.
- Auto-reset at midnight (or provide a manual reset button).
- Stored alongside the cumulative counters in localStorage.

---

## 6. Additional Features

### Keyboard Shortcuts

| Key     | Action                  |
|---------|-------------------------|
| `Space` | Pause / Resume timer    |
| `R`     | Restart current timer   |
| `S`     | Skip to next phase      |

> Note: Shortcuts must not conflict with the video player (see Section 4).

### Session History
- Minimal implementation: a daily counter display.
- Stored in localStorage alongside work/break counts.

### Native Notifications
- Use `tauri-plugin-notification` to fire **OS-level notifications** when a timer ends.
- Critical for when the app window is minimized or behind other windows.
- Fires alongside the alarm sound.

---

## Summary of Decisions

| Topic                   | Original Spec            | Final Decision                                      |
|-------------------------|--------------------------|-----------------------------------------------------|
| Break count trigger     | On break start           | **On break completion** (avoids restart double-count) |
| Work count trigger      | On timer finish          | **On work completion** (consistent with above)       |
| Auto-cycle              | Not specified            | **Auto-start breaks, pause before work**             |
| Default work duration   | 10 minutes               | **15 minutes**                                       |
| Default break duration  | Not specified            | **5 minutes**                                        |
| Timer customization     | "Set manually"           | **Separate durations for work and break**            |
| Sound                   | Alarm or song            | **Bundled placeholder sound, future customization**  |
| Storage                 | Not specified            | **localStorage now, tauri-plugin-store later**       |
| Skip button             | Not mentioned            | **Added**                                            |
| Keyboard shortcuts      | Not mentioned            | **Added (Space, R, S)**                              |
| Session history         | Not mentioned            | **Added (daily counter)**                            |
| Native notifications    | Not mentioned            | **Added (tauri-plugin-notification)**                |

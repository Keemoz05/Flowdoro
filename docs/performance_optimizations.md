# Pomobodo — Performance Optimization Guide

> Comprehensive analysis based on the full codebase: frontend JS modules, 1335-line CSS, and Rust Tauri backend.

---

## 1. DOM & Rendering

### 1.1 `renderProgress()` fires every second during work mode
- **File:** [progress.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L143-L151) — `addWorkSecond()` calls `renderProgress()` on every tick.
- **Problem:** Each call runs `checkDailyReset()` (constructs a `new Date()` + `.toDateString()`), queries 7 DOM elements, and updates the SVG ring offset — all once per second.
- **Fix:** Only re-render when the *minute* changes (`todaySeconds % 60 === 0`), or at most every 10s. The ring arc doesn't visually move for sub-minute changes anyway.

### 1.2 `renderList()` destroys and rebuilds all todo DOM nodes
- **File:** [todos.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/todos.js#L81-L101)
- **Problem:** `elList.innerHTML = ''` followed by a full rebuild on every add/toggle/delete. Each `createTaskElement()` creates 4 elements + 2 event listeners + sets innerHTML for the SVG delete button.
- **Fix:** Use a diffing strategy — only add/remove/reorder changed items. Or at minimum, use `DocumentFragment` to batch the DOM writes into a single reflow.

### 1.3 `renderLibraryGrid()` re-renders on card click
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L229-L231)
- **Problem:** Clicking a video card calls `loadEntry()` then `renderLibraryGrid()` again, which does `elGrid.innerHTML = ''` and rebuilds all cards + event listeners just to toggle an `.active` class.
- **Fix:** Toggle the `.active` class directly on the clicked card and remove it from the previously active card. No full re-render needed.

### 1.4 `renderDotSelector()` also does full innerHTML rebuild
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L115-L136)
- **Problem:** Same pattern — wipes and recreates all dot buttons + event listeners on every video switch.
- **Fix:** Only update the `.active` class on the relevant dots. Rebuild only when the library contents actually change (add/remove), not on selection change.

### 1.5 Timer `render()` touches many DOM properties unconditionally
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L160-L192)
- **Problem:** Every 1-second tick sets `textContent`, `style.strokeDashoffset`, `classList.toggle` (×5 calls), `style.display` (×2), `.disabled` (×2), and `document.title`. Most of these don't change tick-to-tick.
- **Fix:** Only update `elTime.textContent`, `elRing.style.strokeDashoffset`, and `document.title` on tick. Move the others (icon visibility, classList, disabled state) into `startTimer()`, `pauseTimer()`, and `setMode()` where the actual state transitions happen.

### 1.6 Top-level `document.getElementById` calls at module load
- **Files:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L31-L42), [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L22-L35), [todos.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/todos.js#L11-L15)
- **Problem:** These run at module evaluation time (before `DOMContentLoaded`). The script tag has `type="module"` which defers execution, so it *happens* to work, but it's fragile and prevents any future lazy-loading.
- **Fix:** Move DOM ref caching into each module's `init*()` function (as `progress.js` already does correctly).

### 1.7 Inline SVG strings via `innerHTML`
- **Files:** [todos.js L132-135](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/todos.js#L132-L135), [video.js L217](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L217), [video.js L241](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L241)
- **Problem:** Setting `innerHTML` with SVG strings triggers HTML parsing for every task item / video card creation. The SVG content is identical every time.
- **Fix:** Create a template SVG element once (via `document.createElementNS` or a `<template>` tag) and use `.cloneNode(true)` for each instance. Avoids repeated HTML parsing.

---

## 2. Timer & Interval Efficiency

### 2.1 `setInterval` drift
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L216)
- **Problem:** `setInterval(tick, 1000)` drifts over long sessions because each callback is scheduled relative to the *previous scheduled time*, not wall-clock time. Over a 25-minute work session this can drift by 1–3 seconds.
- **Fix:** Record `startTime = Date.now()` and on each tick compute `elapsed = Date.now() - startTime` to determine the actual remaining time. Use `setTimeout` with a self-correcting delay instead of `setInterval`.

### 2.2 `formatTime()` allocations every tick
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L139-L143)
- **Problem:** Creates 2 intermediate strings via `toString()` + `padStart()` + template literal every second.
- **Fix:** Pre-compute a lookup table of `"00"` through `"59"` (60 strings) and use direct indexing: `pad[m] + ':' + pad[s]`. Eliminates allocations.

### 2.3 `document.title` updated every tick
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L185-L187)
- **Problem:** Setting `document.title` is surprisingly expensive in WebView2/WKWebView because it may trigger native window title bar updates in Tauri.
- **Fix:** Only update when the formatted time string actually changes (it changes every second, but you can skip when paused) or batch with the timer display update.

---

## 3. localStorage Optimization

### 3.1 `getLibrary()` parses JSON on every call
- **File:** [video-library.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video-library.js#L22-L34)
- **Problem:** Every call does `localStorage.getItem()` + `JSON.parse()` + `.filter()`. This is called from `renderDotSelector()`, `renderLibraryGrid()`, `handleDeleteVideo()`, `initVideo()`, and on every video switch.
- **Fix:** Cache the library array in a module-level variable. Only re-read from localStorage on init. Update the in-memory cache on mutations (add/remove) and write-through to localStorage.

### 3.2 `saveTasks()` serializes the entire task array on every action
- **File:** [todos.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/todos.js#L20-L22)
- **Problem:** Adding, toggling, or deleting a task immediately serializes the full array. With rapid checkbox toggling, this can cause repeated `JSON.stringify` + `localStorage.setItem`.
- **Fix:** Debounce saves — e.g., save 500ms after the last mutation. The in-memory `tasks` array is always the source of truth anyway.

### 3.3 `saveSettings()` on every duration input `change` event
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L318-L331)
- **Problem:** Each keystroke that triggers `change` on the number input calls `saveSettings()` → `JSON.stringify` + `setItem`.
- **Fix:** Debounce by 300–500ms. The `change` event on `<input type="number">` can fire frequently with arrow key holding.

### 3.4 `saveProgress()` does `JSON.stringify` of the full state object
- **File:** [progress.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L50-L52)
- **Problem:** Called every 30 seconds during work, plus on pause/complete/skip/goal-adjust. Each call serializes 6 fields.
- **Fix:** Minor, but could be optimized by only writing changed fields if you switch to individual localStorage keys instead of a single JSON blob.

---

## 4. Video & YouTube Performance

### 4.1 YouTube iframe loaded immediately on app start
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L84-L93)
- **Problem:** If the active video is a YouTube entry, the iframe URL is set during `initVideo()` → `loadEntry()`. This loads the full YouTube embed (300+ KB JS, multiple network requests) before the user even starts a timer.
- **Fix:** Defer YouTube iframe loading until the user actually starts the timer (i.e., on `playVideo()`). Show a static thumbnail placeholder until then. Load the embed URL lazily.

### 4.2 YouTube iframe is never truly destroyed
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L96-L98)
- **Problem:** When switching from YouTube to local video, `elYoutube.src = ''` is set but the iframe element remains in the DOM. Setting `src=""` on an iframe may still keep some internal YouTube player state in memory.
- **Fix:** When switching away from YouTube, set `elYoutube.src = 'about:blank'` instead of empty string. This properly unloads the iframe content. For aggressive cleanup, remove the iframe and recreate it when needed.

### 4.3 `preload="metadata"` on the `<video>` element
- **File:** [index.html](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L31)
- **Problem:** `preload="metadata"` causes the browser to fetch the first few KB of the video file on load to extract duration/dimensions. For large local video files (up to 200MB allowed), this is unnecessary since the video only plays when the timer starts.
- **Fix:** Change to `preload="none"`. The video will only start loading when `play()` is called.

### 4.4 Volume toggle sends postMessage to YouTube even when not needed
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L153-L160)
- **Problem:** `toggleVolume()` sends a `postMessage` to the YouTube iframe every time, even if the iframe isn't loaded yet (`ytReady === false`) or the video is paused.
- **Fix:** Guard with a readiness check. Also batch the mute command with play/pause to avoid extra cross-origin messages.

### 4.5 `loadEntry()` forces mute state reset every time
- **File:** [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L79-L82)
- **Problem:** Every video switch resets `isMuted = true`, writes to localStorage, and updates UI — even if the user had unmuted. This is technically a UX issue, but the localStorage write + DOM update is also wasted work if already muted.
- **Fix:** Only reset if the current state differs. Or don't force-mute on switch and let the user's preference persist.

### 4.6 200MB video file copy is synchronous (blocking)
- **File:** [lib.rs](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L43)
- **Problem:** `fs::copy()` is synchronous in the Rust backend. For a 200MB file, this blocks the Tauri command handler thread for several seconds, freezing the IPC channel.
- **Fix:** Use `tokio::fs::copy()` with an `async` Tauri command, or spawn the copy on a background thread with progress reporting back to the frontend.

---

## 5. CSS & Animation Performance

### 5.1 `backdrop-filter: blur()` on multiple elements simultaneously
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css) — Lines 225, 463, 494, 537, 1314
- **Problem:** `backdrop-filter: blur()` is GPU-expensive. It's applied to: settings overlay, settings button, volume button, video dot selectors, and toast notifications. When the video panel is hovered, 3+ blur elements become visible at once.
- **Fix:** Remove `backdrop-filter` from small elements (buttons, dots) where the visual effect is barely noticeable. Keep it only on the settings overlay where it has real visual impact. Use solid `background` with slight opacity instead.

### 5.2 Three simultaneous CSS animations while timer is running
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1007-L1024)
- **Problem:** When `.running` is active, three infinite animations run concurrently: `timer-pulse` (opacity on time text), `ring-glow` (filter on SVG), and the ring's `stroke-dashoffset` transition. The `ring-glow` animation is especially expensive because it animates `filter: drop-shadow()` which triggers GPU compositing every frame.
- **Fix:** Replace `filter: drop-shadow()` animation with a static glow. Or use `will-change: filter` to hint the browser to promote the element to its own compositing layer. Better yet, use a CSS `box-shadow` on a circular wrapper div instead of SVG `drop-shadow`.

### 5.3 `@property` declarations for color transitions
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L59-L78)
- **Problem:** Four `@property` rules enable smooth custom property transitions on mode change. These force the browser to interpolate CSS custom properties as typed values, which has a small ongoing cost.
- **Fix:** These only matter during work↔break transitions (rare). Consider using direct class-based color swaps with standard `transition` on the actual properties (`stroke`, `background`, `color`) instead of animating custom properties.

### 5.4 `transition: all` on video dot buttons
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L543)
- **Problem:** `transition: all 0.25s var(--ease-elastic)` on `.video-num-btn` transitions *every* property, including layout-triggering properties like `width` and `height`. This forces layout recalculation on hover.
- **Fix:** Explicitly list only the properties you want to transition: `transition: background 0.25s, border-color 0.25s, transform 0.25s var(--ease-elastic), box-shadow 0.25s`. Use `transform: scale()` instead of changing `width`/`height`.

### 5.5 `slide-in` animation on every todo item render
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L698-L704)
- **Problem:** Every `.todo-item` gets `animation: slide-in 0.2s ease`. Since `renderList()` destroys and rebuilds all items, *every* existing task re-animates on any change — not just the newly added one.
- **Fix:** Only apply the animation class to newly created items. Remove it from the base `.todo-item` rule and add it programmatically in `createTaskElement()` only for the just-added task.

### 5.6 Large CSS file with no code splitting
- **File:** [styles.css](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css) — 1335 lines, 31KB
- **Problem:** The entire stylesheet is loaded upfront. The settings overlay styles (~120 lines) and toast styles (~35 lines) are rarely needed on first render.
- **Fix:** For a Tauri desktop app this is a minor concern (local file, no network), but if startup time matters: inline critical-path CSS in the HTML `<head>` and load the rest asynchronously.

---

## 6. Tauri Backend (Rust) Optimizations

### 6.1 Three Tauri plugins loaded unconditionally
- **File:** [lib.rs](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L83-L86)
- **Problem:** `tauri_plugin_opener`, `tauri_plugin_dialog`, and `tauri_plugin_fs` are all initialized on startup. Each plugin registers IPC handlers and may allocate resources. `opener` is never used in the frontend code.
- **Fix:** Remove `tauri-plugin-opener` from `Cargo.toml` and `lib.rs` if unused. Only init `dialog` and `fs` which are actually needed for video import.

### 6.2 `Cargo.toml` compiles `uuid` with v4 feature
- **File:** [Cargo.toml](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/Cargo.toml#L27)
- **Problem:** The `uuid` crate with `v4` pulls in a random number generator. This is fine, but the UUID is only used for filename generation in `copy_video_to_library`.
- **Fix:** Minor: could replace with a simpler timestamp-based name (`format!("{}.{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos(), ext)`) and drop the `uuid` dependency entirely, reducing binary size by ~30KB.

### 6.3 No Rust release profile optimizations
- **File:** [Cargo.toml](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/Cargo.toml)
- **Problem:** No `[profile.release]` section. Defaults to `opt-level = 3` which is fine for speed but doesn't optimize for binary size.
- **Fix:** Add a release profile:
```toml
[profile.release]
strip = true        # Strip debug symbols
lto = true          # Link-time optimization
codegen-units = 1   # Better optimization, slower compile
opt-level = "s"     # Optimize for size (or "z" for aggressive)
panic = "abort"     # Smaller binary, no unwinding
```
This can reduce the final binary by 30–50%.

### 6.4 `get_video_library_path` creates directory on every call
- **File:** [lib.rs](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L73)
- **Problem:** `fs::create_dir_all()` is called every time the frontend requests the library path (on every app startup). It's an unnecessary filesystem syscall after the first run.
- **Fix:** Cache the path in a `OnceCell<String>` or `OnceLock` so the directory check only happens once per app lifecycle.

### 6.5 File metadata read before copy — double filesystem access
- **File:** [lib.rs](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L32-L43)
- **Problem:** `fs::metadata()` reads the file info, then `fs::copy()` reads the file again. That's two separate filesystem accesses to the same file.
- **Fix:** Open the file once with `File::open()`, check `.metadata()?.len()` on the handle, then use `std::io::copy()` from the already-open handle to the destination.

---

## 7. Build & Bundle Optimizations

### 7.1 No build step / bundler for frontend assets
- **File:** [tauri.conf.json](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/tauri.conf.json#L7) — `"frontendDist": "../src"`
- **Problem:** Tauri serves raw source files directly. No minification, no tree-shaking, no bundling. The 31KB CSS and ~50KB of JS are served as-is.
- **Fix:** Add Vite as a dev dependency and configure Tauri to use Vite's build output. This gives you: JS minification (~40% size reduction), CSS minification (~30%), dead code elimination, and module bundling (fewer file reads on startup).

### 7.2 Google Fonts loaded from CDN on every launch
- **File:** [index.html](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L8-L10)
- **Problem:** Three network requests to `fonts.googleapis.com` and `fonts.gstatic.com` on every app start. If offline, fonts fail silently and fall back to system fonts (layout shift).
- **Fix:** Download the Inter and JetBrains Mono font files, bundle them in `src/assets/fonts/`, and use `@font-face` declarations in CSS. Zero network dependency, faster startup, consistent rendering. Use `font-display: swap` for good perceived performance.

### 7.3 Two unused SVG assets in `src/assets/`
- **File:** `src/assets/javascript.svg` (995B), `src/assets/tauri.svg` (2.6KB)
- **Problem:** These default Tauri scaffold files are shipped with the app but never used in the UI (the notification icon references `tauri.svg` but notifications use OS-level icons, not webview assets).
- **Fix:** Remove unused assets to reduce bundle size.

### 7.4 No Tauri bundle compression configured
- **File:** [tauri.conf.json](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/tauri.conf.json#L30-L40)
- **Problem:** `"targets": "all"` builds installers for all platforms. No compression or installer-specific optimizations configured.
- **Fix:** Only target your actual platform. On Windows, use NSIS with compression. Consider using UPX on the final binary for smaller distribution size.

---

## 8. Memory & Lifecycle

### 8.1 Event listeners are never cleaned up
- **Files:** All JS modules
- **Problem:** Every `addEventListener` call creates a permanent closure. While this is fine for a single-page Tauri app that never navigates away, it means: toast `setTimeout` closures stack up (one per toast), and the `keydown` handler on `window` is never removed.
- **Fix:** For toasts, clear timeout references when the toast is removed. For the main app, this is low priority since the app lifecycle = window lifecycle.

### 8.2 Toast DOM nodes removed by `setTimeout` — potential leak
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L336-L349) and [video.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L367-L379)
- **Problem:** Two separate `showToast()` implementations exist (duplicated code). Each creates a DOM element, appends it, then removes it after a timeout. If many toasts fire rapidly, they stack in the container.
- **Fix:** Consolidate into a single shared `showToast()` utility. Add a maximum toast count (e.g., 3) and remove older toasts when the limit is exceeded.

### 8.3 `AudioContext` created lazily but never closed
- **File:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L86-L115)
- **Problem:** `audioCtx` is created on first notification sound and persists forever. Each `playNotificationSound()` creates 3 oscillators + 3 gain nodes that are scheduled and stopped but never disconnected.
- **Fix:** Call `osc.disconnect()` and `gain.disconnect()` after the oscillator stops (add an `onended` handler). Alternatively, `audioCtx.close()` when the app is backgrounded and recreate on focus.

### 8.4 `checkDailyReset()` creates a new `Date` object on every call
- **File:** [progress.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L57-L78)
- **Problem:** Called from `renderProgress()` which is called every second during work mode. Each call creates `new Date()` and calls `.toDateString()`. While cheap individually, this is 3600 allocations per hour.
- **Fix:** Cache the date string and only refresh it every 60 seconds, or once per minute when the timer ticks.

### 8.5 No `requestAnimationFrame` batching for visual updates
- **Files:** [timer.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L160), [progress.js](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L83)
- **Problem:** DOM updates from `render()` and `renderProgress()` happen inside `setInterval` callbacks, which may fire between frames, causing unnecessary reflows that aren't visible until the next paint anyway.
- **Fix:** Wrap visual updates in `requestAnimationFrame()` to batch them with the browser's paint cycle.

---

## Priority Matrix

| Priority | Items | Impact |
|----------|-------|--------|
| 🔴 **High** | 1.1, 1.5, 3.1, 4.1, 5.2, 7.1, 7.2 | Directly reduces CPU/GPU usage and startup time |
| 🟡 **Medium** | 1.2, 1.3, 1.4, 2.1, 3.2, 4.3, 4.6, 5.1, 5.4, 6.1, 6.3 | Noticeable improvement under load or on weaker hardware |
| 🟢 **Low** | 1.6, 1.7, 2.2, 2.3, 3.3, 3.4, 4.2, 4.4, 4.5, 5.3, 5.5, 5.6, 6.2, 6.4, 6.5, 7.3, 7.4, 8.1–8.5 | Minor gains, good hygiene |

---

## Quick Wins (< 30 min each)

1. **Change `preload="metadata"` → `preload="none"`** on the video element
2. **Self-host Google Fonts** — download + `@font-face`
3. **Throttle `renderProgress()`** to once per minute
4. **Cache `getLibrary()`** in a module variable
5. **Add `[profile.release]`** with LTO + strip to Cargo.toml
6. **Remove `tauri-plugin-opener`** if unused
7. **Remove `backdrop-filter`** from small buttons/dots

# Pomobodo — Optimizations Ranked by Impact

> Ranked by measurable performance gain during the app's primary use case: **a 25-minute work session with a video playing and a few tasks in the list.** Estimates are based on the specific code patterns found in your codebase.

---

## Rank 1 — Throttle `renderProgress()` to once per minute
**Saves: ~98% of progress rendering work (~59 wasted calls/min)**

Right now, [addWorkSecond()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L143-L151) calls `renderProgress()` **every single second**. Each call does:
- `new Date()` + `.toDateString()` — string allocation + date formatting
- `Math.floor()` division for completed minutes
- SVG `strokeDashoffset` recalculation
- 7 DOM property writes (`textContent` × 4, `style.strokeDashoffset`, `formatGoalDisplay()` × 2)

But the progress ring's arc only visually changes **once per minute** (it tracks completed *minutes*, not seconds — see [L86](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/progress.js#L86): `Math.floor(todaySeconds / 60)`). So 59 out of every 60 calls produce identical DOM output. Over a 25-min session, that's **1,475 wasted renders** doing nothing visible.

**Why it's #1:** This is pure waste — the most frequent hot path in the app doing work that produces zero visual change 98% of the time.

---

## Rank 2 — Slim down timer `render()` to only update what changes per tick
**Saves: ~70% of per-tick DOM work (~10 unnecessary DOM ops/sec)**

[render()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L160-L192) runs every second and touches **15 DOM operations**:

| Operation | Changes per tick? | Changes per state transition? |
|---|---|---|
| `elTime.textContent` | ✅ Yes | — |
| `elRing.style.strokeDashoffset` | ✅ Yes | — |
| `document.title` | ✅ Yes | — |
| `document.body.classList.toggle` | ❌ No | mode change only |
| `elIconPlay.style.display` | ❌ No | start/pause only |
| `elIconPause.style.display` | ❌ No | start/pause only |
| `elPanel.classList.toggle('running')` | ❌ No | start/pause only |
| `elPanel.classList.toggle('waiting')` | ❌ No | start/pause only |
| `elModeTabs.forEach(classList.toggle)` ×2 | ❌ No | mode change only |
| `elWorkInput.disabled` | ❌ No | start/pause only |
| `elBreakInput.disabled` | ❌ No | start/pause only |

Only 3 of the 15 operations actually change on tick. The other 12 are redundant writes that the browser still has to process (check current value → compare → determine if reflow needed). Over 25 minutes that's **18,000 unnecessary DOM touches**.

**Why it's #2:** Second-highest frequency hot path. Easy to fix by splitting `render()` into `renderTick()` (3 ops) and `renderState()` (12 ops, called only on transitions).

---

## Rank 3 — Self-host Google Fonts instead of CDN fetch
**Saves: ~200–800ms on every app launch**

[index.html L8-10](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L8-L10) makes **3 blocking network requests** on every startup:
1. `fonts.googleapis.com` — CSS with `@font-face` declarations (~1KB)
2. `fonts.gstatic.com/inter` — Inter woff2 files (~90KB for 5 weights)
3. `fonts.gstatic.com/jetbrains-mono` — JetBrains Mono woff2 (~45KB for 2 weights)

These are **render-blocking** — the browser won't paint text with the correct fonts until they arrive. In a Tauri app, this means the WebView makes actual HTTP requests through the system network stack on every cold start. DNS resolution + TLS handshake + download = 200–800ms depending on network conditions. **If offline, fonts fail entirely** and fall back to system fonts, causing visible layout shift.

**Why it's #3:** This is the single biggest startup latency item. Self-hosting makes font loading instant (~1ms from local filesystem) and guarantees consistent rendering offline.

---

## Rank 4 — Defer YouTube iframe loading until timer starts
**Saves: ~300KB+ network transfer + ~50–150ms of JS parse time on startup**

If the user's active video is YouTube, [loadEntry()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L84-L93) sets the iframe `src` during `initVideo()` on app startup. This triggers the YouTube embed to load immediately:
- YouTube player JS: ~300KB gzipped
- Multiple DNS lookups: `youtube.com`, `ytimg.com`, `googlevideo.com`
- iframe renders a full player UI that's invisible (controls disabled, `autoplay=0`)

None of this is needed until the user presses Start. The video panel just needs to show a static state until then.

**Why it's #4:** Delays first-meaningful-paint and consumes bandwidth/CPU before the user needs it. Especially impactful on lower-end machines where parsing 300KB of YouTube JS takes 100ms+.

---

## Rank 5 — Cache `getLibrary()` in memory instead of parsing localStorage every call
**Saves: ~90% of localStorage + JSON.parse overhead across all video operations**

[getLibrary()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video-library.js#L22-L34) does `localStorage.getItem()` → `JSON.parse()` → `.filter()` on **every single call**. It's called from:
- `initVideo()` — once on startup
- `renderDotSelector()` — on every video switch
- `renderLibraryGrid()` — on settings open + every card click
- `handleDeleteVideo()` — after every deletion
- `addLocalVideo()` / `addYouTubeVideo()` — before every add

With an 8-video library, each call parses ~500 bytes of JSON and filters the array. `JSON.parse()` is one of the more expensive synchronous operations in JS — typically 5–10× slower than accessing an in-memory variable. The localStorage read itself goes through the WebView's IPC bridge to the browser storage layer.

**Why it's #5:** Eliminates repeated serialization/deserialization across multiple code paths. Simple fix (cache in a module variable, write-through on mutations) with broad impact.

---

## Rank 6 — Remove `backdrop-filter: blur()` from small UI elements
**Saves: ~3–5 GPU compositing layers during video panel hover**

Five elements use `backdrop-filter: blur()` ([styles.css L225, 463, 494, 537, 1314](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L225)). When the video panel is hovered, three become visible simultaneously (settings button, volume button, dot selectors). Each `backdrop-filter` element:
- Gets promoted to its own GPU compositing layer
- Requires the browser to render the content *behind* it into a texture
- Applies a multi-pass Gaussian blur shader to that texture
- Re-composites on every frame the video is playing

On integrated GPUs (common on laptops), this can drop the compositor from 60fps to 30–45fps during hover. The blur on 10×10px dot buttons is visually imperceptible anyway.

**Why it's #6:** The video plays continuously during work sessions. GPU compositing cost compounds with the video decoder's GPU usage. Removing blur from 3 small elements eliminates ~60% of the compositing overhead while keeping the settings overlay blur where it's visually meaningful.

---

## Rank 7 — Replace animated `drop-shadow` filter with static glow
**Saves: continuous GPU repainting during entire work session**

[ring-glow animation](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1017-L1024) runs an `infinite` CSS animation that alternates `filter: drop-shadow(0 0 8px ...)` ↔ `filter: drop-shadow(0 0 18px ...)` every 2 seconds on the SVG progress ring. `filter` changes trigger a **full repaint of the element** on every animation frame — that's 60 repaints/second for the entire duration of a work session (25+ minutes).

Combined with the `timer-pulse` opacity animation also running on `.running`, the browser is doing ~120 repaints/second on the timer panel.

**Why it's #7:** Continuous GPU cost for a subtle visual effect. Replace with a static `drop-shadow` or use `box-shadow` on a wrapper div (which is cheaper because it doesn't need to trace the SVG path).

---

## Rank 8 — Add Vite as a build step (minification + bundling)
**Saves: ~30–40% reduction in total asset size loaded on startup**

Currently [tauri.conf.json](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/tauri.conf.json#L7) serves raw `../src` files:
- `styles.css`: 31KB → ~20KB minified
- 5 JS files: ~50KB total → ~30KB minified + bundled into 1 file
- Eliminates 6 separate file reads → 2 (one CSS, one JS)

In a Tauri app, files are read from the embedded binary or local filesystem, so the "network" cost is minimal. But the parse time is real — the JS engine still has to parse unminified whitespace, comments, and long variable names. Minification reduces parse time roughly proportional to size reduction.

**Why it's #8:** Moderate but broad impact. The 6→2 file reduction also means fewer filesystem reads on cold start. Less impactful than items above because Tauri's local file access is already fast.

---

## Rank 9 — Add `[profile.release]` with LTO and strip to Cargo.toml
**Saves: ~30–50% binary size reduction (typically 10–20MB → 5–10MB)**

No [release profile](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/Cargo.toml) is configured. Adding LTO + strip + `codegen-units = 1` lets the compiler perform whole-program optimization and remove debug symbols. This reduces:
- Binary size → smaller installer, faster download for users
- Cold start time → less to load from disk into memory
- RAM usage → stripped binary maps fewer pages

**Why it's #9:** One-time configuration change with permanent benefit, but the impact is on distribution/install/cold-start rather than runtime performance.

---

## Rank 10 — Change `preload="metadata"` → `preload="none"` on video element
**Saves: eliminates an unnecessary file read (up to 200MB) on startup**

[index.html L31](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L31) has `preload="metadata"` which tells the browser to immediately fetch the beginning of the video file to extract duration, dimensions, and codec info. For local files served via Tauri's asset protocol, this reads from disk. With the 200MB file size limit, this could be reading several MB just to extract metadata that the app never displays.

**Why it's #10:** Single attribute change, zero risk, eliminates an unnecessary I/O operation.

---

## Rank 11 — Stop rebuilding todo list DOM on every interaction
**Saves: proportional to task count — with 10 tasks, eliminates ~40 DOM node creates + 20 event listener bindings per interaction**

[renderList()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/todos.js#L81-L101) does `innerHTML = ''` → rebuild all items on every add/toggle/delete. Each task creates 4 DOM elements + 2 event listeners + parses an inline SVG string. Checking a single checkbox rebuilds all 10+ tasks.

**Why it's #11:** Impact scales with task count. For typical usage (5–15 tasks), the absolute cost is modest (~2–5ms per full rebuild), but it's wasteful and causes visual flicker from the `slide-in` animation replaying on all items.

---

## Rank 12 — Remove unused `tauri-plugin-opener`
**Saves: ~50–100KB binary size + one IPC handler registration on startup**

[lib.rs L84](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L84) initializes `tauri_plugin_opener` but no frontend code uses it. Dead weight.

**Why it's #12:** Free binary size reduction with zero risk.

---

## Summary Table

| Rank | Optimization | Primary Metric Improved | Estimated Gain |
|------|---|---|---|
| 1 | Throttle `renderProgress()` | CPU during work session | -98% progress render calls |
| 2 | Slim `render()` tick path | CPU during work session | -70% DOM ops per tick |
| 3 | Self-host Google Fonts | Startup latency | -200–800ms cold start |
| 4 | Defer YouTube iframe | Startup latency + bandwidth | -300KB + -50–150ms parse |
| 5 | Cache `getLibrary()` | CPU on video operations | -90% JSON parse overhead |
| 6 | Remove small-element `backdrop-filter` | GPU during hover + video | -3–5 compositing layers |
| 7 | Static ring glow instead of animated | GPU during work session | -60 repaints/sec |
| 8 | Add Vite build step | Startup + parse time | -30–40% asset size |
| 9 | Cargo release profile | Binary size + cold start | -30–50% binary size |
| 10 | `preload="none"` on video | Startup I/O | Eliminates early file read |
| 11 | Differential todo DOM updates | CPU on task interactions | -80% DOM work per toggle |
| 12 | Remove unused plugin | Binary size | -50–100KB |

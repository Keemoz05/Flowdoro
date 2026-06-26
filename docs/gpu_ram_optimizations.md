# Pomobodo — GPU & RAM Optimization Guide (Ranked)

> Focused exclusively on GPU utilization and memory footprint. Estimates are based on WebView2 (Windows Tauri) behavior during a typical 25-minute work session with video playing.

---

## GPU Optimizations

### GPU #1 — Video decoding runs continuously during the entire work session
**GPU cost: ~5–15% of integrated GPU, constant**

The `<video>` element ([index.html L31](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L31)) plays a looping local video for the full duration of each work session. Hardware video decoding (DXVA on Windows) occupies a dedicated GPU decode engine and keeps a continuous pipeline of:
- Decoding compressed frames (H.264/VP9) → GPU decode engine
- Uploading decoded frames to GPU texture memory → GPU copy engine
- Compositing the texture into the WebView layer → GPU 3D engine

This is the single largest GPU consumer in the app. For a 1080p MP4, this alone uses ~30–80MB of GPU VRAM for decode buffers + display textures.

**Fix options:**
- **Use lower-resolution videos** — 720p or even 540p is plenty for an ambient background. Halving resolution cuts decode workload by ~75%.
- **Reduce framerate** — Ambient videos don't need 30fps. Re-encode at 15fps to halve decode operations.
- **Pause video when window is minimized** — Currently nothing detects window visibility. Add a `document.visibilitychange` listener to pause/resume.

---

### GPU #2 — YouTube iframe is a full second rendering context
**GPU cost: ~10–20% additional GPU on top of main WebView, constant while loaded**

When a YouTube video is active, [loadEntry()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L84-L93) loads a full YouTube embed into the iframe. This creates a **completely separate GPU-composited rendering context** with its own:
- Video decode pipeline (YouTube's adaptive player, often VP9/AV1)
- Separate compositing layer tree
- YouTube's own CSS animations and overlays (even with `controls=0`)

Two simultaneous video rendering contexts (main WebView + YouTube iframe) can double the GPU compositing cost versus a local-only video.

**Fix options:**
- **Defer iframe load** until timer start (saves GPU while idle)
- **Set `elYoutube.src = 'about:blank'`** when switching to local video ([video.js L97](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L97) currently sets `''` which may not fully unload)
- **Destroy and recreate the iframe** when switching away from YouTube to force full GPU resource release

---

### GPU #3 — Animated `filter: drop-shadow()` on timer ring during entire session
**GPU cost: forces continuous repaint at 60fps for 25+ minutes**

[ring-glow animation](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1017-L1024) runs `infinite` on `#ring-progress` whenever `.running` is active:
```css
@keyframes ring-glow {
  0%, 100% { filter: drop-shadow(0 0 8px ...); }
  50%      { filter: drop-shadow(0 0 18px ...); }
}
```

`filter: drop-shadow()` on an SVG element is extremely expensive because:
1. The browser must rasterize the SVG path to determine the shadow shape (not a simple box)
2. Apply a Gaussian blur kernel to the rasterized alpha mask
3. Composite the shadow + the original element
4. **Repeat all 3 steps on every animation frame** — that's 60 times/second, for 25 minutes straight

This single animation can consume 3–8% of GPU or cause frame drops on integrated GPUs when combined with video decoding.

**Fix:** Replace with a **static** `drop-shadow` (no animation). Or better — wrap the SVG in a `<div>` and use `box-shadow` which is much cheaper (simple rectangle, no path tracing). If you want a glow pulse, animate `opacity` on a separate blurred pseudo-element instead of the `filter` property itself.

---

### GPU #4 — Static `filter: drop-shadow()` on progress ring (always rendered)
**GPU cost: 1 additional compositing layer permanently, with continuous repaint during stroke-dashoffset transition**

[progress-ring-fill](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1192-L1201) has:
```css
filter: drop-shadow(0 0 6px var(--color-break-glow));
```

Unlike the timer ring glow, this one doesn't animate. But the `filter` property still forces the element onto its own GPU compositing layer. And because `stroke-dashoffset` is transitioning with `transition: stroke-dashoffset 1s linear`, the browser must **re-rasterize the drop-shadow** during every frame of that transition (once per minute when progress updates).

**Fix:** Same as GPU #3 — use `box-shadow` on a circular wrapper `<div>` instead. `box-shadow` doesn't require SVG path tracing and is handled entirely by the compositor.

---

### GPU #5 — 5 elements with `backdrop-filter: blur()` (3 visible simultaneously on hover)
**GPU cost: each blur element = 1 compositing layer + Gaussian blur shader pass**

| Element | Blur radius | When visible | Location |
|---|---|---|---|
| `#video-settings-overlay` | `blur(16px)` | Settings open | [L224](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L224) |
| `#btn-video-settings` | `blur(8px)` | Video hover | [L463](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L463) |
| `#btn-volume-toggle` | `blur(8px)` | Video hover | [L494](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L494) |
| `.video-num-btn` (×8 max) | `blur(10px)` | Video hover | [L537](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L537) |
| `.toast` | `blur(12px)` | On notification | [L1314](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1314) |

When the user hovers over the video panel during playback, up to **10 blur elements** become visible at once (settings btn + volume btn + 8 dot buttons). Each one requires the GPU to:
1. Render the content *behind* the element into an offscreen texture
2. Apply a multi-pass Gaussian blur shader
3. Composite the blurred texture under the element

With a video playing behind them, the "content behind" changes every frame, so the blur must be **recomputed every frame** — not cached.

**Fix:** Remove `backdrop-filter` from buttons and dots (28×28px and 10×10px elements — blur is invisible at this size). Use `background: rgba(0,0,0,0.6)` instead. Keep blur only on the settings overlay where it's visually impactful and only shown on demand.

---

### GPU #6 — `overlay-in` animation transitions `backdrop-filter` from 0 to 16px
**GPU cost: brief but intense — every frame must compute an increasing blur radius**

[overlay-in animation](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L233-L236):
```css
@keyframes overlay-in {
  from { opacity: 0; backdrop-filter: blur(0); }
  to   { opacity: 1; backdrop-filter: blur(16px); }
}
```

Animating `backdrop-filter` is one of the most expensive CSS animations possible. Each frame interpolates between blur radii (0px → 16px), requiring a fresh Gaussian blur pass at each intermediate radius. Over 0.25s at 60fps, that's ~15 frames of progressively more expensive blur computations on top of a playing video.

**Fix:** Don't animate the blur. Animate only `opacity` on the overlay. The blur should simply snap to `blur(16px)` when the element appears:
```css
@keyframes overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

---

### GPU #7 — Two concurrent CSS opacity animations during work session
**GPU cost: 2 elements repainted at 60fps, low individual cost but additive**

While running:
- [timer-pulse](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1007-L1014) — animates `opacity` on `#timer-time`
- [ring-glow](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L1017-L1024) — already covered in GPU #3

`opacity` animations are cheap individually (handled by the compositor without repaint) but each animated element is promoted to its own compositing layer, consuming GPU memory for the layer backing store.

**Fix:** Keep `timer-pulse` if desired (cheap), but consider making it CSS `will-change: opacity` to pre-promote the layer and avoid the promotion cost on start.

---

### GPU #8 — `@property` typed CSS custom property transitions
**GPU cost: minimal but measurable during work↔break mode switch**

The [4 @property declarations](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/styles.css#L59-L78) enable smooth color interpolation on `--color-accent` and related vars during mode transitions. This forces the CSS engine to maintain typed property registrations and interpolation state for these custom properties, adding overhead to every style recalculation.

**Fix:** Low priority. Only fires on mode switch (rare). Could replace with simple class-based color transitions on the actual `stroke`, `background`, `color` properties.

---

## RAM Optimizations

### RAM #1 — YouTube iframe spawns a separate renderer process
**RAM cost: ~50–120MB additional**

When a YouTube embed loads in the iframe, WebView2 (Chromium-based) spawns a **separate renderer process** for the cross-origin iframe. This process includes:
- V8 JavaScript engine instance (~20–30MB)
- YouTube player JS runtime (~15–25MB)
- DOM tree for the YouTube player UI (~5–10MB)
- Video decode buffers (shared with GPU, but process overhead remains)
- Network stack state for YouTube CDN connections

This is the single largest RAM consumer beyond the base WebView. A local-only video setup avoids this entirely.

**Fix options:**
- **Don't load YouTube until user presses play** — defer `elYoutube.src` assignment to `playVideo()`
- **Fully unload when switching away** — set `src = 'about:blank'` to trigger process teardown instead of `src = ''` ([video.js L97](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L97))
- **Destroy and recreate the iframe element** for guaranteed cleanup

---

### RAM #2 — Local video decode buffers held in memory
**RAM cost: ~20–80MB depending on resolution and codec**

The `<video>` element with a looping local file maintains decode buffers:
- **Forward buffer**: Several seconds of decoded frames kept ahead for smooth playback (~10–30 decoded frames × frame size)
- **Back buffer**: Recently decoded frames for potential seek-back
- **Compressed source buffer**: Chunk of the compressed file read from disk

For a 1080p H.264 video, each decoded frame = ~6MB (1920×1080×4 bytes RGBA). Even with only 5 frames buffered, that's ~30MB.

**Fix:**
- **Use 720p or lower** for ambient videos — a 720p frame is ~3.7MB, so 5 frames ≈ 18MB (40% reduction)
- **Set `preload="none"`** ([index.html L31](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L31)) to prevent early buffer allocation before the timer starts
- **Pause video on app minimize** via `visibilitychange` — paused videos eventually release most decode buffers

---

### RAM #3 — Video `preload="metadata"` causes early buffer allocation
**RAM cost: ~2–10MB allocated before user does anything**

With `preload="metadata"`, the browser immediately reads the video file header and allocates initial buffers to parse container format (MP4/WebM), extract codec parameters, and cache keyframe index. For large files (up to 200MB limit), the container metadata + initial read buffer can be several MB.

**Fix:** Change to `preload="none"`. One attribute change, zero risk:
```html
<video id="video-player" loop muted preload="none" tabindex="-1"></video>
```

---

### RAM #4 — AudioContext and oscillator nodes never disconnected
**RAM cost: ~1–3MB after many notification sounds, gradual leak**

[playNotificationSound()](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L88-L115) creates 3 oscillators + 3 gain nodes per chime. While `osc.stop()` is called, the nodes are never `disconnect()`ed from the audio graph. The AudioContext retains references to stopped-but-connected nodes indefinitely.

Over a long work day with many sessions (say 10+ completed pomodoros), that's 60+ orphaned audio nodes accumulating in the AudioContext's internal graph. Each node retains its processing buffer allocation.

**Fix:** Add cleanup after each note finishes:
```javascript
osc.onended = () => {
  osc.disconnect();
  gain.disconnect();
};
```
Or close and recreate the AudioContext periodically.

---

### RAM #5 — Unused `tauri-plugin-opener` loaded into process
**RAM cost: ~1–3MB (plugin runtime + IPC handler registration)**

[lib.rs L84](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L84) initializes `tauri_plugin_opener` but no frontend code ever invokes it. The plugin registers IPC command handlers and may allocate runtime state that sits unused for the app's lifetime.

**Fix:** Remove from [Cargo.toml L22](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/Cargo.toml#L22) and [lib.rs L84](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/src/lib.rs#L84).

---

### RAM #6 — No `strip` or LTO in Cargo release profile → larger binary mapped into memory
**RAM cost: ~5–15MB additional memory-mapped pages**

Without a `[profile.release]` section in [Cargo.toml](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src-tauri/Cargo.toml), the release binary retains debug symbols and unoptimized code sections. The OS memory-maps the entire binary on startup — larger binary = more virtual memory pages reserved and more physical pages faulted in during execution.

**Fix:** Add to Cargo.toml:
```toml
[profile.release]
strip = true
lto = true
codegen-units = 1
opt-level = "s"
panic = "abort"
```

---

### RAM #7 — Google Fonts loaded from network cached in WebView memory
**RAM cost: ~1–2MB (font file data + glyph rasterization cache)**

The Inter (5 weights) and JetBrains Mono (2 weights) fonts fetched from [Google CDN](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/index.html#L8-L10) are held in the WebView's HTTP cache and font subsystem. The font files themselves are ~135KB total, but the glyph rasterization cache (rendered at various sizes for different UI elements) can grow to 1–2MB.

**Fix:** Self-hosting doesn't reduce RAM, but **subsetting** does. Use tools like `glyphhanger` or Google Fonts' `&text=` parameter to include only the characters actually used (Latin, digits, punctuation). This can reduce font file size by 60–70%, which proportionally reduces glyph cache size.

---

### RAM #8 — Duplicated `showToast()` creates unbounded DOM nodes
**RAM cost: small per-toast, but unbounded accumulation**

Two separate `showToast()` implementations exist ([timer.js L336-349](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/timer.js#L336-L349) and [video.js L367-379](file:///c:/Users/deter/MyProjects/BetterPomodoro/Pomobodo/src/video.js#L367-L379)). Each creates a DOM element, appends it, and sets a `setTimeout` to remove it. If toasts fire faster than the timeout (3s), they accumulate. Each toast element + its backdrop-filter blur (GPU #5) + the closure retained by `setTimeout` = ~2–5KB per toast.

**Fix:** Consolidate into one function. Cap at 3 visible toasts and remove older ones immediately when the limit is exceeded.

---

## Combined Summary

| Rank | Category | Item | Estimated Savings |
|------|----------|------|-------------------|
| GPU #1 | Video decode | Continuous video decoding | 5–15% GPU, 30–80MB VRAM |
| GPU #2 | YouTube iframe | Second render context | 10–20% GPU additional |
| GPU #3 | CSS animation | Animated `drop-shadow` on timer ring | 3–8% GPU, 60 repaints/sec |
| GPU #4 | CSS filter | Static `drop-shadow` on progress ring | 1 compositing layer |
| GPU #5 | CSS filter | 5+ `backdrop-filter: blur()` elements | 3–10 compositing layers on hover |
| GPU #6 | CSS animation | Animated `backdrop-filter` on overlay | Intense burst on open |
| GPU #7 | CSS animation | 2 concurrent opacity animations | 2 compositing layers |
| GPU #8 | CSS engine | `@property` typed transitions | Minimal, style recalc cost |
| RAM #1 | Process | YouTube iframe renderer process | 50–120MB |
| RAM #2 | Video | Local video decode buffers | 20–80MB |
| RAM #3 | Video | Early `preload="metadata"` buffers | 2–10MB |
| RAM #4 | Audio | Leaked AudioContext nodes | 1–3MB over time |
| RAM #5 | Tauri | Unused opener plugin | 1–3MB |
| RAM #6 | Binary | No strip/LTO in release profile | 5–15MB mapped pages |
| RAM #7 | Fonts | Google Fonts cache + glyphs | 1–2MB |
| RAM #8 | DOM | Unbounded toast accumulation | ~5KB per toast |

> **Biggest wins:** GPU #1–3 and RAM #1–2 account for the vast majority of GPU and memory usage. These are all related to video playback — the heaviest workload in the app by a wide margin.

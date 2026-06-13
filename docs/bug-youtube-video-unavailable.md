# Bug Report: YouTube Embed — "Video Unavailable" Error

**Date:** 2026-06-13  
**Status:** ✅ Resolved  
**Severity:** High — YouTube playback completely broken in both dev and production builds

---

## Symptom

When a user added a YouTube video URL to the video library and selected it for playback, the embedded YouTube player displayed a **"Video unavailable"** error instead of playing the video. This occurred in both `cargo tauri dev` (development) and the production `.exe` build.

---

## Root Cause Analysis

Three issues in the original implementation combined to cause the failure:

### 1. Use of `youtube-nocookie.com` embed domain

The embed URL was constructed using `https://www.youtube-nocookie.com/embed/...`. This privacy-enhanced domain has **stricter embedding policies** in non-browser environments like Tauri's WebView2. It is more aggressive at rejecting requests that lack standard browser context (cookies, referrer chains, etc.).

**Before:**
```javascript
const embedUrl = `https://www.youtube-nocookie.com/embed/${entry.youtubeId}?...`;
```

### 2. Missing `referrerpolicy` attribute on the `<iframe>`

The `<iframe>` element had no `referrerpolicy` attribute. Without it, the WebView defaulted to a restrictive referrer policy, causing the `Referer` header to be either absent or set to a non-standard value (e.g., `tauri://localhost`). YouTube's embed player validates the `Referer` header and rejects requests from unrecognized origins.

**Before:**
```html
<iframe id="youtube-player" allow="autoplay; encrypted-media" allowfullscreen></iframe>
```

### 3. Missing `origin` parameter in the embed URL

The YouTube IFrame Player API (`enablejsapi=1`) requires an `origin` parameter to establish trusted postMessage communication. Without it, YouTube may reject the embed entirely in strict environments.

Additionally, the deprecated `modestbranding=1` parameter was present, which YouTube no longer supports (deprecated 2023).

---

## Fix Applied

### File: `src/index.html` (line 33)

Added `referrerpolicy="origin"` to the YouTube iframe element so the WebView sends the page origin in the `Referer` header.

```diff
- <iframe id="youtube-player" allow="autoplay; encrypted-media" allowfullscreen></iframe>
+ <iframe id="youtube-player" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="origin"></iframe>
```

### File: `src/video.js` (line 88)

Three changes to the embed URL construction:

1. **Switched domain** from `youtube-nocookie.com` → `youtube.com`
2. **Added `origin` parameter** using `window.location.origin`
3. **Removed deprecated `modestbranding`** parameter

```diff
- const embedUrl = `https://www.youtube-nocookie.com/embed/${entry.youtubeId}?autoplay=0&mute=${isMuted ? 1 : 0}&loop=1&playlist=${entry.youtubeId}&enablejsapi=1&modestbranding=1&rel=0&controls=0`;
+ const embedUrl = `https://www.youtube.com/embed/${entry.youtubeId}?autoplay=0&mute=${isMuted ? 1 : 0}&loop=1&playlist=${entry.youtubeId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&controls=0`;
```

### File: `src-tauri/tauri.conf.json` (no changes needed)

The existing CSP already allowed both YouTube domains in `frame-src`:

```
frame-src https://www.youtube-nocookie.com https://www.youtube.com
```

---

## Verification

- ✅ YouTube videos load and play correctly in `cargo tauri dev`
- ✅ No "Video unavailable" error on valid, embeddable YouTube URLs

---

## Notes

- If a specific YouTube video still shows "Video unavailable", it likely has **embedding disabled** by the video owner (YouTube Studio → Video details → Allow embedding).
- The `youtube-nocookie.com` domain remains in the CSP `frame-src` allowlist for forward compatibility but is no longer used in embed URLs.

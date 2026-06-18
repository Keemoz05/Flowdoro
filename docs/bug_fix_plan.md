# Pomobodo Bug Fix Plan — Build v1.0.0

## Summary of Issues

Three bugs to fix, plus a version bump procedure:

| # | Issue | Root Cause | File(s) |
|---|-------|-----------|---------|
| 1 | "Today" stats equal "Total" stats | Stats rendering shows the same counters for both sections | `timer.js` |
| 2 | Long video file name breaks UI layout | Video card name has `overflow: hidden` but card doesn't constrain width | `styles.css` |
| 3 | How to update the build version | Version is set in two places | `tauri.conf.json`, `Cargo.toml` |

---

## Bug 1 — "Today" Stats = "Total" Stats

### Root Cause

In `timer.js`, the **stats section** (`#timer-stats`) displays `stat-work-done` and `stat-breaks-taken`:

```js
// timer.js line 207–208
elStatWork.textContent   = state.workCount;   // ← TOTAL all-time count
elStatBreaks.textContent = state.breakCount;  // ← TOTAL all-time count
```

The **daily stats** section (`#daily-stats`) separately shows:
```js
// timer.js line 211
elDailyStats.textContent = `Today: ${state.todayWork} work, ${state.todayBreaks} breaks`;
```

The problem is that `state.workCount` / `state.breakCount` are the **all-time totals**, yet the labels on those stat items say **"Work Done"** / **"Breaks Taken"** — which users read as today's stats. Meanwhile `todayWork` / `todayBreaks` are only shown in the small `#daily-stats-text` footer, which duplicates rather than separates the two.

> [!IMPORTANT]
> The fix is to make the **large stat boxes** show today's values and the **small footer** show the all-time totals (or vice-versa with updated labels). The most intuitive UX is:
> - Big stat boxes = **Today** (`todayWork` / `todayBreaks`)
> - Footer line = **All time** (`workCount` / `breakCount`)

### Fix

**In `src/timer.js`**, update the `render()` function (lines 206–211):

```diff
-  elStatWork.textContent   = state.workCount;
-  elStatBreaks.textContent = state.breakCount;
-
-  // Daily stats
-  elDailyStats.textContent = `Today: ${state.todayWork} work, ${state.todayBreaks} breaks`;
+  // Big stat boxes = today's sessions
+  elStatWork.textContent   = state.todayWork;
+  elStatBreaks.textContent = state.todayBreaks;
+
+  // Footer = all-time totals
+  elDailyStats.textContent = `All time: ${state.workCount} work, ${state.breakCount} breaks`;
```

**In `src/index.html`**, update the stat labels to clarify they are "today" values (lines 169, 174):

```diff
-              <span class="stat-label">Work Done</span>
+              <span class="stat-label">Today's Work</span>
```
```diff
-              <span class="stat-label">Breaks Taken</span>
+              <span class="stat-label">Today's Breaks</span>
```

**In `src/index.html`**, update the daily-stats icon tooltip to reflect all-time (line 183):

```diff
-            <span id="daily-stats-text">Today: 0 work, 0 breaks</span>
+            <span id="daily-stats-text">All time: 0 work, 0 breaks</span>
```

---

## Bug 2 — Long Video Name Breaks Layout

### Root Cause

The `.video-card-name` element already has:
```css
/* styles.css lines 372–381 */
.video-card-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```

However, `.video-card` itself uses `flex-direction: column` with `align-items: center`. When `align-items: center`, flex children are sized to their *content* by default — so `max-width: 100%` resolves to 100% of the *content width*, not the card width. The card can then grow beyond its grid cell to accommodate a very long name.

### Fix

**In `src/styles.css`**, add `width: 100%` to constrain the name span, and add `min-width: 0` + `overflow: hidden` to the card so it cannot overflow the grid column:

```diff
 .video-card {
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
   gap: 4px;
   padding: 10px 6px;
   background: rgba(255, 255, 255, 0.05);
   border: 1px solid rgba(255, 255, 255, 0.08);
   border-radius: var(--radius-md);
   cursor: pointer;
   position: relative;
   transition: background var(--transition-fast), border-color var(--transition-fast), transform 0.2s var(--ease-elastic);
   min-height: 64px;
+  min-width: 0;
+  overflow: hidden;
 }
```

```diff
 .video-card-name {
   font-size: 10px;
   color: var(--color-text-secondary);
   text-align: center;
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
-  max-width: 100%;
+  width: 100%;
   line-height: 1.3;
 }
```

---

## Bug 3 — How to Update the Build Version

The version string lives in **two places** that must both be updated before rebuilding:

### 1. `src-tauri/tauri.conf.json` (line 4)
```json
"version": "1.0.0"
```
Change to, e.g.:
```json
"version": "1.1.0"
```

### 2. `src-tauri/Cargo.toml` — the `[package]` section
```toml
version = "1.0.0"
```
Change to match:
```toml
version = "1.1.0"
```

> [!NOTE]
> Keep both in sync. Tauri reads `tauri.conf.json` for the installer/bundle metadata. `Cargo.toml` is the Rust crate version shown in `cargo` tooling. They should always match.

### 3. Rebuild command
After bumping both files, run:
```powershell
npm run tauri build
```
This will compile a fresh release bundle with the new version string embedded in the `.exe` and installer.

---

## Implementation Order

1. Fix **Bug 1** in `timer.js` + `index.html` (stats logic)  
2. Fix **Bug 2** in `styles.css` (card layout)  
3. Bump version in `tauri.conf.json` + `Cargo.toml`  
4. Run `npm run tauri build`

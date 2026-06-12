# Pomobodo — Design Discussion Log

> Chat session recorded on 2026-06-11. This documents the full review, debate, and decision-making process for the Pomobodo app redesign.

---

## Phase 1: Initial Review of Changes.md

**User** provided `Changes.md` containing:
- Design changes (Inter font, dark color palette with orange-red accent)
- Layout changes (remove navbar, remove sessions, replace Work/Short/Long tabs with Work/Break, only Pause and Restart buttons)
- Timer: user sets manually, default 10 min, alarm on completion
- Video player: 3 local videos with numbered icons, random default on launch
- Replace done/streak with work done + breaks taken counters (persistent)
- User asked: "let me know of additional logic features that can be implemented or logic flaws within these changes"

**AI Review** identified:

### Logic Flaws & Ambiguities

| # | Issue | Explanation |
|---|---|---|
| 1 | "Break count increases when timer starts" | Every Start press (including first work session) would increment breaks. Incorrect. |
| 2 | No explicit Work/Break toggle logic | No spec for how user switches or whether it auto-cycles. |
| 3 | Timer duration scope | Unclear if separate durations for Work and Break, or one shared duration. |
| 4 | Alarm/song — what file? | No specification for which sound plays. |
| 5 | Persistence mechanism unspecified | "Persist throughout multiple sessions" needs a concrete storage strategy. |

### Additional Features Suggested

| # | Feature | Rationale |
|---|---|---|
| 1 | Auto-cycle Work ↔ Break | Automatic switching after timer completion. |
| 2 | Keyboard shortcuts | Space for pause/resume, R for restart — essential for a focus app. |
| 3 | Session history / daily stats | "Today: 4 work sessions, 2 breaks" tracking. |
| 4 | Native notifications | Tauri OS notifications when timer ends (for minimized windows). |
| 5 | Always-on-top toggle | Pin window above other apps. |
| 6 | Video mute/volume control | Independent volume for ambient videos vs alarm. |
| 7 | Reset counters | Daily auto-reset or manual reset for work/break counters. |

---

## Phase 2: User's Initial Responses

The user addressed each issue:

> **1. Break count:** Break count should increase when it is break mode and the timer starts
>
> **2. Auto-cycle:** It should auto cycle
>
> **3. Timer durations:** Set timer manually separately. For now, work 15 minutes, break 10 minutes as default
>
> **4. Sound:** Any placeholder sound for now works. Customisable in the future
>
> **5. Storage:** Simple local storage

For additional features, the user accepted Features 1, 2, 3, and 4 (auto-cycle, keyboard shortcuts, session history, notifications).

The user then asked: **"Debate or argue on my explanations. Recommend solutions."**

---

## Phase 3: AI Debate & Pushback

### Issue 1: Break Count Trigger — Pushed Back

**User's position:** Increment break count when break mode starts.

**AI argument:** If the user starts a break and then *restarts* it mid-way, the counter increments again for the same break. Same problem applies to work sessions.

**Recommendation:** Increment on **completion only** — for both work and break. Counts reflect actual completed sessions, not just attempts.

**Verdict:** ✅ User accepted recommendation.

---

### Issue 2: Auto-Cycle Behavior — Agreed with Nuance

**User's position:** It should auto-cycle.

**AI argument:** Two sub-decisions needed:

- **Should the next timer auto-start or wait?** Recommendation: Auto-start breaks (user earned it), but pause before work (show "Ready to focus?" state). This is industry standard (Focus To-Do, Pomotodo, etc.).
- **Should there be a Skip button?** Allows skipping current phase. Low effort, prevents frustration.

**Verdict:** ✅ User accepted both recommendations.

---

### Issue 3: Default Durations — Pushed Back Hard

**User's position:** Work 15 min / Break 10 min.

**AI argument:** 15/10 is a 60/40 work-to-rest ratio. Compared to:

| Technique | Work | Break | Ratio |
|---|---|---|---|
| Classic Pomodoro | 25 min | 5 min | 83/17 |
| Common short variant | 15 min | 3 min | 83/17 |
| User's spec | 15 min | 10 min | 60/40 |

In a 1-hour session, the user would work 36 minutes and rest 24 minutes — nearly half the time resting.

**Recommendation:** Default to **15 min work / 5 min break** (75/25). Consider making 10-min breaks a "long break" every 3-4 cycles instead.

**Caveat noted:** If the app's philosophy is anti-hustle/relaxation-focused (which ambient videos suggest), 15/10 could be a deliberate choice.

**Verdict:** ✅ User accepted 15/5 recommendation.

---

### Issue 4: Placeholder Sound — No Argument

**AI note:** File must be accessible to Tauri webview. Place in `public/` or `assets/` directory for correct bundling.

**Verdict:** ✅ Agreed as-is.

---

### Issue 5: localStorage — Mild Pushback

**User's position:** Simple localStorage.

**AI argument:** In Tauri, webview localStorage can be wiped if the user clears browser data or the webview storage location changes across updates. Alternative: `tauri-plugin-store` (file-backed JSON).

**Recommendation:** Use localStorage for now (data is trivial — two counters + settings). Migrate to `tauri-plugin-store` when session history is added.

**Verdict:** ✅ User accepted phased approach.

---

### Feature Details

**Keyboard Shortcuts:** Space = pause/resume, R = restart, S = skip. Must not conflict with video player — video player should not capture keyboard events (it's ambient, not interactive).

**Session History:** Minimal — daily counter display, auto-reset at midnight or manual reset. Stored in localStorage.

**Notifications:** Use `tauri-plugin-notification` for OS-level notifications alongside alarm sound. Critical for minimized/background usage.

---

## Phase 4: Final Decision

User accepted **all recommendations**. Final spec recorded in `Recommended Changes.md`.

---

## Key Takeaways (Prompt Engineering Notes)

1. **Asking for debate/critique** on your own spec before implementation catches logic flaws early (restart double-counting, missing skip button, ratio analysis).
2. **Specifying defaults explicitly** (even if customizable later) forces concrete thinking about UX intent.
3. **Incremental storage strategy** (localStorage now → plugin later) avoids over-engineering while maintaining a migration path.
4. **Counter logic** (increment on completion vs. start) is a subtle but important distinction that affects data accuracy.

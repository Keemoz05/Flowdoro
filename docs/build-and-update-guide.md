# Pomobodo — Build, Update & Data Persistence Guide

## Overview

This document explains what happens to user data when a new version of Pomobodo is built and deployed, how the update process works from a developer's perspective, and the critical rules to follow to avoid data loss.

---

## Where Pomobodo Stores Data

Pomobodo stores **all persistent user data** in two locations that are completely separate from where the `.exe` lives. The app uses the `identifier` field in `tauri.conf.json` (`com.pomobodo.app`) as the folder name.

```
C:\Users\<username>\AppData\Roaming\com.pomobodo.app\
    ├── videos\                  ← local video files copied by the Rust backend
    └── EBWebView\               ← Tauri's WebView storage (holds localStorage)
```

### localStorage Keys

| Key | Contains |
|-----|----------|
| `pomobodo_stats` | `workCount`, `breakCount`, `todayWork`, `todayBreaks`, `todayDate` |
| `pomobodo_settings` | `workMin`, `breakMin` |
| `pomobodo-video-library` | video metadata array (name, type, youtubeId, filename) |
| `pomobodo-video-muted` | mute preference (`true`/`false`) |
| `pomobodo-active-video` | ID of the last active video |

Because this data lives in `AppData` — **not** inside the `.exe` or installation folder — it survives uninstalls, reinstalls, and version upgrades automatically.

---

## What Happens After `npm run tauri build`

Running `npm run tauri build` **only produces new output files**. It does not touch anything on the user's machine.

```
src-tauri\target\release\bundle\
    ├── nsis\Pomobodo_1.1.0_x64-setup.exe   ← NSIS installer
    ├── msi\Pomobodo_1.1.0_x64_en-US.msi    ← MSI installer
    └── Pomobodo.exe                         ← portable executable
```

The old installed version continues to run untouched until the user installs the new one.

---

## Data Flow: Old Version → New Version

```
┌─────────────────────────────────────────────────┐
│  User runs Pomobodo v1.0.0                      │
│  Writes data to:                                │
│  AppData\Roaming\com.pomobodo.app\              │
└───────────────────┬─────────────────────────────┘
                    │  data stays here
                    ▼
┌─────────────────────────────────────────────────┐
│  Developer runs: npm run tauri build            │
│  → New .exe produced in target\release\bundle\  │
│  → Old .exe and AppData untouched               │
└───────────────────┬─────────────────────────────┘
                    │  data still untouched
                    ▼
┌─────────────────────────────────────────────────┐
│  User installs / runs Pomobodo v1.1.0           │
│  Reads from same:                               │
│  AppData\Roaming\com.pomobodo.app\              │
│                                                 │
│  ✅ Stats intact                                │
│  ✅ Task list intact                            │
│  ✅ Video library intact                        │
│  ✅ Local video files intact                    │
└─────────────────────────────────────────────────┘
```

No migration script needed. No data loss. The new version picks up exactly where the old one left off.

---

## Practical Example — Deploying an Update to an App Store

> **Scenario:** Pomobodo v1.0.0 has been published. You have fixed the stats display bug and the long video name layout bug. You now need to ship v1.1.0.

### Step 1 — Fix the bugs in source code

Apply all code fixes to `src/timer.js`, `src/index.html`, and `src/styles.css` as documented in `bug-fix-plan.md`.

### Step 2 — Bump the version in both required files

Tauri reads the version from `tauri.conf.json` for the installer metadata (window title, add/remove programs entry, bundle filename). `Cargo.toml` holds the Rust crate version. **Both must match.**

**`src-tauri/tauri.conf.json`**
```json
{
  "productName": "Pomobodo",
  "version": "1.1.0"
}
```

**`src-tauri/Cargo.toml`**
```toml
[package]
name = "pomobodo-tauri"
version = "1.1.0"
```

### Step 3 — Build the new installer

```powershell
npm run tauri build
```

This produces the new versioned installer:
```
src-tauri\target\release\bundle\nsis\Pomobodo_1.1.0_x64-setup.exe
```

### Step 4 — What the user experiences

1. User still has v1.0.0 installed and has been using it. Their stats, tasks, and videos are saved in `AppData`.
2. They download and run `Pomobodo_1.1.0_x64-setup.exe`.
3. The NSIS installer automatically **uninstalls v1.0.0** and **installs v1.1.0** in its place.
4. `AppData\Roaming\com.pomobodo.app\` is **not touched** by the installer — it is only managed by the app itself.
5. User opens v1.1.0. All their data is exactly as they left it. The fixed bugs are now live.

> The user sees no difference in their data — only the bug fixes take effect.

---

## ⚠️ Critical Warning — Never Change the App Identifier

The `identifier` field in `tauri.conf.json` is the cornerstone of data persistence.

```json
{
  "identifier": "com.pomobodo.app"
}
```

Tauri uses this string to:
- Name the `AppData` folder (`AppData\Roaming\com.pomobodo.app\`)
- Scope the WebView's localStorage (so no other app can read it)
- Register the app in Windows' Add/Remove Programs with a unique ID

### What happens if you change it?

If you rename the identifier — even slightly — across a version bump, Tauri treats the new version as a **completely different application**.

```
Before: identifier = "com.pomobodo.app"
After:  identifier = "com.pomobodo.v2"        ← ❌ Never do this for an update
```

| Effect | Result |
|--------|--------|
| AppData folder | A brand new `com.pomobodo.v2\` folder is created — empty |
| User stats | Gone — the new app cannot see the old folder |
| Video library metadata | Gone — stored in old localStorage scope |
| Local video files | Orphaned — files still exist in the old `com.pomobodo.app\videos\` folder but the app has no record of them |
| Old installation | Treated as a separate app — both versions appear in Add/Remove Programs |

### The safe rule

```
identifier must NEVER change between versions of the same app.
```

The only time you would intentionally change it is if you are publishing a genuinely separate product (e.g. a "Pro" edition that keeps different data from the free edition). In that case, you must also write a one-time data migration script that copies data from the old `AppData` folder into the new one on first launch.

---

## Version Checklist Before Every Build

- [ ] Bug fixes / new features applied to source files
- [ ] `src-tauri/tauri.conf.json` → `"version"` bumped
- [ ] `src-tauri/Cargo.toml` → `version` bumped to match
- [ ] `identifier` in `tauri.conf.json` is **unchanged**
- [ ] Run `npm run tauri build`
- [ ] Test the installer on a machine that has the old version installed
- [ ] Verify user data is intact after upgrade

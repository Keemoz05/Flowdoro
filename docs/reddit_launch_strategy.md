# Flowdoro — Reddit Launch Strategy

---

## Post Titles (pick per subreddit)

| Subreddit Type | Title |
|---------------|-------|
| **Project showcase** | I built a free desktop Pomodoro timer that plays ambient videos while you work — Flowdoro [open source] |
| **Productivity** | I couldn't find a Pomodoro app that didn't feel like homework, so I built one with ambient video backgrounds |
| **Developer/tech** | I built a Pomodoro timer in Tauri + vanilla JS with ambient video sync, daily streaks, and zero dependencies — looking for feedback |
| **Casual/short** | I made a free Pomodoro app where your background video plays while you focus and pauses when you take a break |

> [!TIP]
> **The hook that makes Flowdoro different:** "ambient videos that sync with your timer." Lead with that — it's the one thing no other Pomodoro app does, and it's immediately visual.

---

## Demo Video Script (30–45 seconds)

Record your screen at 1920×1080 using OBS or Windows Game Bar. No voiceover — use text overlays and let the visuals speak. Add a lo-fi track if you want.

### Shot List

| Time | What's on screen | Text overlay |
|------|-----------------|-------------|
| **0:00–0:03** | App opens. Panels fade in with the staggered entrance animation. A lo-fi YouTube video is already loaded. | `Flowdoro` (centered, large) then fade to `Focus in motion` |
| **0:03–0:06** | Cursor types "Finish landing page design" into the task input, presses Enter. Task appears with slide-in animation. Adds 1-2 more tasks. | `Track what matters` |
| **0:06–0:10** | Cursor clicks the Play button (or presses Space). Timer ring starts animating. The ambient video begins playing simultaneously. | `Press play. Your scene comes alive.` |
| **0:10–0:18** | Let it run for a few seconds. Show the timer counting down, the ring depleting, the ambient video loop in the background. Check off one task — show the strikethrough animation. | *(no text — let the atmosphere breathe)* |
| **0:18–0:22** | Click Pause. Video instantly pauses. Click Play again — video resumes. Show the sync. | `Video syncs with your timer` |
| **0:22–0:27** | Open the Video Library overlay (click gear icon). Show the grid of video cards. Paste a YouTube URL — show the title auto-fetched. Close overlay. | `Add any YouTube video as your backdrop` |
| **0:27–0:32** | Fast-forward or cut to timer completion. Chime plays. Toast notification: "Break time — you earned it." Color shifts from orange to teal. Break timer auto-starts. | `Auto-cycles between focus and breaks` |
| **0:32–0:37** | Show the daily progress widget: completed minutes bumping up, streak counter, goal ring filling. | `Track your streaks` |
| **0:37–0:42** | Pull back to show the full app. End card. | `Free · Open Source · Built with Tauri` / `⭐ GitHub link in comments` |

> [!IMPORTANT]
> **Do NOT** show the onboarding overlay in the demo — it makes the app look like it's not ready. Start with a pre-configured state (a video loaded, a few tasks already in).

### Recording Tips
- Set timer to **2 minutes** (not 15) so the ring moves visually fast during recording
- Use a visually appealing YouTube ambient video (rainy café, fireplace, ocean waves)
- Record at native resolution, export at 1080p 30fps
- If adding music, use the ambient video's own audio — it reinforces the "ambient" concept
- Keep the mouse movements deliberate and slow — fast cursor flicking looks amateur

---

## Post Description (r/SideProject version — adapt for others)

```markdown
Hey everyone 👋

I've been using Pomodoro timers for years, but they all felt... clinical. A countdown 
and a ding. I wanted something that actually made focusing *feel* good.

So I built **Flowdoro** — a free, open-source desktop app that combines:

- ⏱️ **Pomodoro timer** with auto-cycling (work → break → ready to focus?)
- 🎬 **Ambient video backgrounds** that play when your timer runs and pause when you stop
- ✅ **Built-in task list** so everything's in one window
- 📊 **Daily progress tracking** with goals and streaks

The ambient video sync is the thing I'm most proud of — you paste any YouTube URL 
or import a local video, and it becomes your focus backdrop. It even auto-fetches 
the video title.

**Tech stack:** Tauri (Rust backend) + vanilla HTML/CSS/JS. ~3MB installed. 
No Electron bloat, no account needed, no telemetry.

🔗 **GitHub:** [link]
📥 **Download (.exe):** [link to Releases if available]

I'd really love feedback — especially on:
- Does the workflow make sense on first use?
- Any features you'd want added?
- Bugs on your machine?

If you find it useful, a ⭐ on GitHub means a lot. Thanks for checking it out!
```

### Adaptation Notes

| Subreddit | Adjust |
|-----------|--------|
| **r/productivity** | Remove tech stack details. Focus on the *workflow* and how it changed your study/work habits. Add a personal anecdote. |
| **r/opensource** | Lead with tech stack and architecture decisions. Mention it's Tauri v2, vanilla JS (no framework), MIT license. Ask for contributors. |
| **r/rust** | Frame as a Tauri project. Mention the Rust backend commands (file copy, video library path). Keep it technical. |
| **r/webdev** | Emphasize the zero-dependency vanilla JS approach. Mention the CSS design system, SVG ring animations, Web Audio API chime. |

---

## Subreddit Targets (ranked by expected ROI)

| # | Subreddit | Subscribers | Why it fits | Post type | Best time (UTC) |
|---|-----------|-------------|-------------|-----------|----------------|
| 1 | **r/SideProject** | ~200K | Exactly what it's for — showcasing personal builds | Video + text | Mon–Thu, 14:00–17:00 |
| 2 | **r/opensource** | ~500K | Open-source desktop app, invite contributors | Video + text | Tue–Wed, 15:00–18:00 |
| 3 | **r/productivity** | ~2M+ | Largest target audience — people who actually use Pomodoro | Video + text | Mon morning, 13:00–15:00 |
| 4 | **r/coolgithubprojects** | ~30K | Direct fit — they want to discover GitHub repos | Link post to repo | Anytime |
| 5 | **r/rust** | ~300K+ | Tauri + Rust angle, dev community loves seeing real projects | Text + screenshot | Tue–Thu, 15:00–18:00 |
| 6 | **r/webdev** | ~2M+ | Vanilla JS, CSS design system, no-framework approach | Video + text | Wed–Fri, 14:00–17:00 |
| 7 | **r/tauri** | ~10K | Niche but highly relevant — they want Tauri showcases | Text + screenshot | Anytime |
| 8 | **r/StudyTips** | ~200K | Students are heavy Pomodoro users | Video + text | Sun–Mon, 13:00–16:00 |

> [!WARNING]
> **Subreddits to avoid:** r/programming (too broad, will get buried), r/software (strict self-promo rules), r/apps (mobile-focused). Don't cross-post to more than 3-4 subs on the same day — it looks spammy and Reddit's algorithm deprioritizes it.

---

## Posting Schedule

| Day | Action |
|-----|--------|
| **Day 1 (Tuesday)** | Post to **r/SideProject** (your home base — friendliest to makers). Engage heavily in comments for 2-3 hours. |
| **Day 2 (Wednesday)** | Post to **r/opensource** with a slightly more technical angle. Link to your r/SideProject post in comments for social proof. |
| **Day 3 (Thursday)** | Post to **r/productivity** — this is the big swing. Use the casual title. No jargon. |
| **Day 5+ (following week)** | Post to r/rust, r/webdev, r/tauri as follow-ups only if Day 1-3 got traction. |

---

## Comment Engagement Playbook

Reddit rewards authentic engagement. Prepare answers for these likely questions:

| Likely question | Suggested response |
|----------------|-------------------|
| "Why not just use a browser Pomodoro?" | "I wanted the video to sync with the timer — browsers can't do that without leaving a tab open. Plus Tauri keeps it at ~3MB vs Electron's 150MB." |
| "Does it work on Mac/Linux?" | "Currently Windows only, but Tauri supports cross-platform. If there's interest I'll set up CI builds for Mac and Linux." |
| "Can I add Spotify integration?" | "Not yet, but that's a great idea. The ambient video acts as a pseudo-music player for now. I'll add it to the roadmap." |
| "Why no long break?" | "I kept it simple — Work and Break. The goal adjustment lets you customize the break length. Would a separate long-break mode be useful for you?" |
| "Nice project! How long did it take?" | Be honest. Mention it's a learning project. People love authenticity. |

> [!TIP]
> **Golden rule:** Reply to EVERY comment in the first 3 hours. Reddit's algorithm heavily weights early engagement velocity. A post with 10 comments in the first hour outranks a post with 50 upvotes and 2 comments.

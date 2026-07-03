# Pomobodo

---

Minimalist desktop Pomodoro. Distraction-free task list. Ambient video backgrounds.

![alt text](image.png)

### What it is
Pomobodo is a lightweight desktop productivity application built using Tauri, HTML, CSS, and JavaScript. It combines three productivity pillars—a Pomodoro timer, a task manager, and ambient video loops—into a single distraction-free mosaic layout.

### Explanation of its features
- **Customizable Pomodoro Timer**: Switch between focus and break modes, customize duration times, and track progress using an interactive SVG progress ring.
- **Built-in Task Manager**: Organize and check off items directly in the dashboard, complete with task counters and empty-state feedback.
- **Ambient Video Player**: Load and control ambient looping videos or customize your backdrop using a built-in library slot manager with support for custom YouTube URLs.
- **Daily Progress Tracker**: Monitor daily streaks, compare today's session minutes against yesterday's, and dynamically adjust daily focus goals.

### How to run
1. Ensure you have **Node.js** and the **Rust** toolchain installed.
2. In the project root, install the dependencies:
   ```powershell
   npm install
   ```
3. Run the application in Tauri's development mode:
   ```powershell
   npm run tauri dev
   ```

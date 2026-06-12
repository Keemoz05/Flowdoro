# Candidate Layouts

Three shortlisted layout options for the BetterPomodoro app.
Each layout supports three views: **Todo**, **Video Player**, and **Timer**.

---

## Layout 6 — Floating Overlay (Immersive)

The video player fills the entire screen as a background.
The timer floats as a transparent widget in the top-right corner.
The todo list slides in from the right as a translucent side drawer when triggered, and collapses back when dismissed.
Maximizes video real estate.

```
+------------------------------------------+
|  [00:25] <-- floating timer      (close) |
|                                          |
|         VIDEO PLAYER (fullscreen)        |
|                                          |
|                          +-----------+   |
|                          |   TODO    |   |
|                          | [ ] T1    |   |
|                          | [ ] T2    |   |
+------------------------------------------+
```

---

## Layout 8 — Pomodoro Mode (Timer-Centric)

A large centered timer dominates the top half of the screen.
Below it, the screen splits: the video player on the left and the todo list on the right.
Everything revolves around the timer as the primary focus element.

```
+------------------------------------------+
|                                          |
|          TIMER  ( 00:25:00 )             |
|                                          |
+--------------------+---------------------+
|                    |                     |
|   VIDEO PLAYER     |   TODO              |
|                    |   [ ] Task 1        |
|                    |   [ ] Task 2        |
+--------------------+---------------------+
```

---

## Layout 9 — Mosaic (Asymmetric Grid)

An asymmetric mosaic: the video player takes a large rectangular region on the left (~60% width).
The timer is a tall, narrow strip on the far right.
The todo list sits below the video player as a wide, short horizontal band.
Feels dynamic and editorial.

```
+-----------------------------+--------+
|                             |        |
|                             | TIMER  |
|      VIDEO PLAYER           |        |
|                             |00:25:00|
|                             |        |
+-----------------------------+--------+
|   TODO  [ ] T1  [ ] T2  [ ] T3      |
+--------------------------------------+
```

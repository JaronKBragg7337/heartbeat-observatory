# space-fix: pilot panel and compression in the climb and the landing (2026-10-01)

`f01_pilot_panel_and_compression.mjs` (needs `PORT=8423 node server.js`; images stay in the worktree, `.gitignore` excludes jpgs): a hired crew flies Mars -> Phobos -> port.
Measured (phone tier, software GL): climb 4.8 min -> **21 s real at x20**; Mars descent from 120 km -> **51 s real at x60** (about 5.5 min before),
touching down at 2.07 m/s, hull 100; Phobos 1.8 km descent 27 s. Effective compression by height in the descent: x60 above 6 km, x10, x4 under 1.5 km, **x1 under 400 m**.
Pictures: f01_a pilot's Talk panel in the climb (phases with time left, x buttons, Cancel course); f01_b x20 in the climb; f01_c in the drive; f01_d Mars descent at x60.
Not measured: GPU/CPU cost of 120 flight sub-steps a frame on a real phone (the cap keeps it to at most 120; x60 only above 6 km).

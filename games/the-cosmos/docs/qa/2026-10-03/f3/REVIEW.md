# F3 the long-range drive: review (2026-10-03)

What was run: `node test/pkg-longrange.mjs` (47 checks: the maths, a moving target, the compression ladder and its real-time estimate against a brute-force tick loop, the nav rows,
free flight at the hold, and the real authority flying Earth, the Moon, Callisto (cancelled mid-cruise, saved and restored mid-cruise), Ceres by the drive, the Ore Lane unchanged, a 400 t hull refused);
`node test/longrange-browser.mjs` (real server, iPhone-sized Chromium: nav sheet, mirrored long drive at x5400, half way, slowing for the drop-out, holding off Earth);
`node test/longrange-solo-browser.mjs` (solo play, engine stepped by hand, a save restored mid-cruise).

Screenshots: `01-nav-sheet.png` (the new rows: Ore Lane and long-range drive for Ceres), `02-longdrive-accelerating.png` (phases, ladder, the explanation),
`03-longdrive-half-way.png` (day 8.7 of 15.9, 324 km/s, turn-over), `04` and `05` (the slow-down and the hold), `06` (solo).

Works: Earth 16.0 days of flight (9 real minutes with the legs at the top compression), Callisto 27.7 days, Ceres 13.2 days; the estimate matches the flown trip; the server stays light
(one multiplication a tick); the world state with a ship mid-cruise is 28 kB.
Not done / unverified: the sky during the cruise is just stars (the planets are below a pixel at those distances, and F2 owns the sky); real iPhone Safari (Chromium with an iPhone
viewport and the WebKit profile only); the new voice lines are Kokoro clips generated here and not listened to; free flight's target list does not include the far worlds.
F2 (spin and orbits) had not landed when this was written: the drive reads `worldCentre(id, t)` and a `CLOCK` hook, which is the whole interface it needs.

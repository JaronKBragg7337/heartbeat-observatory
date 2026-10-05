# Fix round 2: triage of the playtester report (run 2026-10-04 23:50 UTC, 22 problems)

Method: read each screenshot; reproduced on a local server in iPhone WebKit (real keyboard walking with the walker's own collision, plus
`test/fix-r2-browser.mjs` before/after captures). Verdict: **real game bug** (fixed), **bot** (its steering / timing; game is fine), or **by design**.

| # | Problem | Verdict | Why / what changed |
|---|---|---|---|
| 1 | Stuck walking to Shift runner | Bot | Screenshot shows the white lift-car wall at close range, `Lift to lobby (E)` button up. The bot rode the lift to the cab, then pushed west into the car wall (-61,-41 is inside the car footprint) instead of leaving by the door. From the open cab floor the same walk reaches the runner (0.14 m). |
| 2 | Stuck walking to Lookout at the glass | Bot | Same spot, same cause (-59,-41, still inside the car). Note for playtester: leave the lift through the south door first. |
| 3 | Stuck walking to the amber weigh bay | Bot | Bot at (-92,36) in the arrivals hall wedge between the world board and the north wall, steering straight NE into them (screenshot: a close pillar). Weigh bay is reachable from N, W, E and S (all four probes reached it at 0.0 to 0.5 m). Walking out of the wedge works. |
| 4 | Stuck walking to the ship ramp | Bot | Same hall wall/board pocket; a path from just east of the hall to open ground walks fine (18 m in 12 s). Planner starts inside a blocker. |
| 5 | Dig button never appeared on open ground | Bot, plus a message fix | The screenshot shows `Dig · hold to drop` on screen. The "Drop" label is correct when no ground is within reach (shovel 3.6 m). The spot is the port concrete walkway, which the game refuses to cut; see #7. |
| 6 | "Nothing in reach" repeated 4+ times | **Real** | Fixed: the 3rd identical refusal inside 45 s becomes advice ("Look down at the ground near your feet, then dig."). |
| 7 | "Structural concrete will not cut." repeated | **Real** | Fixed the same way ("That is port concrete. Step onto the dust past the kerb to dig."). Also covers "Nothing there to dig." and "The mantle will not cut." |
| 8 | Dig tap in the opening made no cut | **Real** | The Dig button showed within 4 m of the crate but a cut only lands where you LOOK within 3.2 to 3.6 m, so a player looking at the horizon cut nothing. Now: the tap turns the head to the crate first, and Dig only shows within 2.8 m (3 to 4 m says "Closer to the crate, then Dig."). |
| 9 | Close X overlaps tool selector | Mostly bot / partly real | Heading is opaque and the X is the top element at its point (`elementFromPoint`), so a geometric overlap is only the select scrolling under the sticky heading. But the real defect: iOS Safari drew the selects as a native white box with pale, near-unreadable text, painted above the sticky heading. Fixed: own select look (`appearance:none`, dark, arrow), heading z-index 5 + isolate, 44 px select. Settings also opens under the status card on phones now. |
| 10-12, 21, 22 | Frame-time spikes | Bot / headless | Software-rendered headless WebKit; spikes of 1 to 10 s at stage loads. Not a phone problem; spike on the opening's first frames is the wreck build (already under the crash black). Not changed. |
| 13, 16 | "No start button / black 3D" on first screenshot | Partly real | It is the boot splash (the game starts by itself; no start control exists by design), caught while the 15 s headless load ran. Added a pulsing "Loading the port..." line so a slow load does not look dead, and balanced the tagline wrap (orphan "size."). |
| 14, 17 | Black viewport, no Kestrel prompt (opening stage 2) | Real (small) | The black is the designed crash blackout (60 to 70 s of the Kestrel clock; the wreck is built behind it). The "You are aboard the Kestrel" prompt is the first 4 s only, so it is correctly absent. But ten black seconds with nothing on screen read as a freeze; now shows "Impact. Hold on, the cabin is going dark." |
| 15 | Websocket closed at load | Bot | The page reload / load race of the test (`?qa=1`), reconnected within 1 s. |
| 18 | Dialog covers HUD info card | **Real** | Reproduced (panel top 68 px, card bottom 148 px). The panel now starts 8 px under the card's real bottom (`--hud-bottom`). Test: `dialog panel starts below the HUD card`. |
| 19, 20 | "Game said" refusal text flags | By design | The lines flagged are normal dialogue ("Welcome to Mars...", "Weather sensors are offline..."), not refusals. |

Counts: 22 listed problems. Real game bugs: #6, #7, #8, #14/#17, #18, and the select/readability half of #9 (plus the loading line for #13/#16). Bot limits: #1-#5, #10-#12, #15, #21, #22, and #19/#20 (by design).

## For the playtester (not game changes)
- After riding the lift to the cab, step out through the car's south door before walking to the runner or the lookout (the CAB route treats the car as a wall but may start inside it).
- Do not start walks from the pocket between the arrivals-hall world board and its north wall; plan from the hall's south side.
- A frame spike that matches a stage load in headless WebKit is not a finding.
- Dates in the report/timeline were UTC; fixed to Fort Wayne local time in `tools/playtester` (`fortWayne()` in `lib/core.mjs`).

## Evidence
`*-before.png` / `*-after.png` captures and `checks-*.json` in this folder (test: `node test/fix-r2-browser.mjs before|after`).

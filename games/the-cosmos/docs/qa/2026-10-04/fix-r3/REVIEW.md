# Fix round 3: playtester run 2026-10-04 21:01 (19 listed problems, iPhone WebKit)

Screens before/after (iPhone 393x852, WebKit): `boot-NN-before|after.png`, `settings-390x844|375x667-before|after.png`, `marker-*-before|after.png`, `dig-*-before|after.png`. Tests: `test/fix-r3-boot.mjs`, `test/fix-r3-settings.mjs`, `test/fix-r3-dig.mjs` (each `before|after`; JSON beside the pictures).

| # | Problem | Verdict | What changed |
|---|---|---|---|
| 8 | Settings close X overlaps cinema toggle (33%) | Real (layout) | Close X row is now its own fixed heading; only `.settings-body` scrolls, so no setting ever slides under the X. Checked at 390x844 and 375x667 over the whole scroll: before = overlaps with 4 to 6 controls (worst 100%), after = none (`settings-after.json`). The playtester's overlap audit also ignored nothing about clipping; it now skips elements scrolled out of their panel. |
| 18, 13, 19 | Empty dark rounded button bottom right; black screen with "Walk (Q)" | Real | The empty button is the opening's own `#opening-action`, and "Walk (Q)" its `#opening-walk`: both were shown (empty) for about 3 s between the boot splash going and the opening's first update. Not the site phone launcher (the page opts out with `hb:no-phone`). Both now start hidden, and the caption "Preparing the opening..." shows from the first frame. Timeline (`fix-r3-boot`): before, t=3.5 s shows both buttons and no text; after, no buttons and the caption. |
| 14-16, 20-22 | Black/near-black "no start button, no loading sign" at boot | Mostly by design | What a phone sees: boot splash (title, tagline, pulsing "Loading the port...") until the game is ready (~3 s here), then the opening starts by itself with "Preparing the opening..." and a Skip intro button once it has been played. There is no start button by design. The frames flagged were that splash. The vision reviewer is now told these frames are deliberate. |
| 23 | Black viewport with caption "Impact. Hold on, the cabin is going dark." | By design | The crash blackout, caption and Skip intro are showing. Reviewer told. |
| 7 | Opening Dig tap made no cut (cuts stayed 4) | Real, hardened | With a real tap from five looks (horizon, sky, sideways, back turned, far down, at feet) every tap cut. The probable loss: fix-r2 left the aim alone when the look already had some ground in reach, so a cut could land in a hole already dug. Now every tap turns the head to the dirt still covering the crate first. Before: 6 taps to expose; after: 5, each tap one cut (`dig-after.json`). |
| (Jaron) | No aim ring in the opening dig; cut landed under the crate | Real | The opening now shows the same amber dig ring as the ordinary game (shared `src/player/aimMarker.js`) on the dirt the button will cut. The tap aims at the highest dirt still over the crate (top and sides), never at the crate's underside. `marker-*-before` has no ring; `marker-*-after` has it. |
| 6 | Dig button never appeared on open ground | Bot | Standing at -82,35 inside the arrivals hall (floor, not open dirt); screenshot is the dark hall interior, no ground in reach, so no Dig. Not changed. |
| 9-12 | Frame-time spikes | Bot / headless | Software-rendered WebKit at stage loads. Not changed. |
| 1-5 | "Stuck while walking to ..." | Bot only | The bot's own steering (run-up jumps and sidesteps). The report now says so in its header. Nothing changed in the game unless a human also gets stuck. |
| 17 | websocket closed at load | Bot | Reload race of the test. |

Not verified: a real iPhone (only WebKit emulation); the opening's dirt is partly hidden inside the crate's mesh at the low graphics tier, so on the phone the ring sits partly over the lid.

## Playtester (AI-Shared/tools/playtester)
- `lib/vision.mjs`: both prompts now list the deliberate frames (boot splash; opening loading and crash blackout with a caption) and say to flag a black frame only if it has no caption or loading text.
- `lib/core.mjs`: layout audit ignores controls scrolled out of their panel's visible area.
- `lib/report.mjs`: header says "Stuck while walking" items are bot-only unless a human also gets stuck.

---

# Added mid-round from Jaron's live iPhone play (Skiff pilot seat, landed on Ceres Pad 02)

Test: `test/fix-r3-ship.mjs <before|after>` (iPhone 390x844 WebKit; real server; player finishes the opening for Ceres, reloads as the Skiff player, sits in the pilot seat with engines at 0 like a drained boat, taps COURSE with a real tap). JSON in `ship-before|after.json`. Pictures: `ship-pilot-seat-before|after.png`, `ship-course-sheet-before|after.png`, `ship-arrival-before|after.png`, `cockpit-from-*-before|after.png`.

| # | Report | Cause | Fix | Before / after |
|---|---|---|---|---|
| 1 | Tapping COURSE freezes the game | Two real bugs. (a) On Ceres the Course list threw `legs[1].sys` (a destination in the world's own region has one leg, the list code assumed two); the sheet redraws every 0.4 s from the frame loop, so the error stopped the loop: the freeze. (b) With engines at 0 (the drained boat) every short course was "flown" 345,600 steps to estimate it, per destination, per redraw. | `spaceSystem._destinations` handles a one-leg route; `spaceUI.draw` catches a list error and shows a line instead of stopping the game; `transit.estimateTrip` answers at once when there is no thrust. | Before: tap took 5.4 to 6.7 s of frozen page and the sheet stayed empty with the TypeError. After: 0.2 to 0.4 s, the sheet lists Marineris Port, Mars orbit, Phobos. |
| 2 | Red "CANN..." cut off behind Ramp and Course | The text was the last words of a no-wrap, clipped one-line read-out. | Its own full-width wrapping row under the bar (`#fl-warn`). | After: whole line readable at 390 wide. |
| 3 | Cannot lift, no idea why | Guidance gap. | Red line now says the reason: "Can't lift: no power cell / fuel coupler fitted" (or "parts bought but not fitted, tap Fit"). The status card carries a plain **NEXT** line from the moment you land: who sells each part, where, 300 marks each, "stand up (E), leave by the ramp", then "walk to the boat and tap Fit". It changes as parts are bought. Already there and unchanged: the ship's spoken arrival note and the late edge arrow (after a minute away from the goal). A lit path or sign in the world was not added; the status line is what a phone always shows. | `ship-pilot-seat-after.png` |
| 4 | When and where to hire crew | Nothing said it. | After the lifeboat is fitted, NEXT says: hire a crew at the Crew Hall at Marineris Port (Mars), six people, talk and tap Hire; World / crew lists them. Crew hiring exists only at Mars today (the pool and hall are in the port). | text in the status card (`nextGoal` in `src/opening/repair.js`) |
| 5 | Skiff cockpit: something goes through the seats | `seatReach` (shipProps.js) drew a head post at each seat's centre (x 0, z 0): a rod in front of a seated head, inside the air of the cushion. | The post now stands behind the back shell and is thinner; the floor rails (outside the frame, on the floor) are unchanged. All four seat types (captain, pilot, nav swivel, gunner) share it. | Not verifiable by picture: headless WebKit draws the cockpit dark; the cabin and bunk render, the chairs do not reliably. Geometry change only; check on the phone. |
| 6 | What are the first missions? | See below. | The same NEXT line: after hiring, it names the first job. | |

## What the first missions actually are today
- **Mars (and any player): the lifeboat.** Buy the power cell (Salvage trader, the Exchange) and the fuel coupler (Field kit trader, the Exchange), 300 marks each, fit both at the boat. Then it flies.
- **Mars job 1: "A tonne for the foundation".** Talk to the depot supervisor in the tower (Marineris Port), accept, dig one tonne of raw regolith, weigh it at the amber weigh bay: 400 marks. It is the only scripted job in the economy file.
- **Mars job 2: Phobos core samples.** Course, then Jobs: fly to Stickney East on Phobos, take up to three cores, land at the port: 300 credits each. Also a salvage module and raider bounties (25 credits).
- **Ceres:** the same lifeboat chain (power cell from Marta Voss at the foundry, fuel coupler from Doctor Roth, Occator Works). There is **no job board on Ceres yet.** The NEXT line says so and sends the player to dig and sell at Occator Works or fly home for the Mars jobs. This is a content gap, not a bug: BIBLE 10.2 says missions come after the full world.
- Faction jobs and the main arc are not built.

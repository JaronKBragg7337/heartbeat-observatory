# Round 7 (2026-10-03): tap losses, kerb, HUD stack, ground-level look, trip estimate, craters, playtester

Branch `cosmos-round7`, two publishes to main. Pictures and scripts are in this folder. Real taps = Playwright WebKit iPhone profile `page.touchscreen.tap` (the held move stick is a second synthetic pointer on the canvas: Playwright cannot hold two real fingers).

## 1. "Possibly-real tap losses on Talk and Dig"
Reproduced with `test/tap-browser.mjs` (20 taps each, with and without the stick held, isolated authority so poses are server-true).
* **Dig: not reproduced.** 40 of 40 real taps cut ground (20 still, 20 stick held). The playtester's "Dig made no cut" reports were the bot tapping before the server's reply was in, or tapping Dig at the crate from too far ("Move closer." is the game's own answer), or on port concrete (a scoop cannot cut structural pavement).
* **Talk: one real mechanism found and fixed, rare.** The button is drawn from the last 0.2 s tick, but the tap handler re-picked "who is nearest" at the instant of the tap. If the walker had moved on (a thumb on the stick) or two people stand close (the tower cab's pad controllers are about 1 m apart), a visible button did nothing. Proved deterministically (engine stopped, walker 3.8 m from the clerk, real tap): old code `open:false`, new code opens the clerk. Fix in `src/crew/crewUI.js`: the tap acts on the person the button showed; the target is kept while within 4.5 m unless someone else is clearly closer (0.4 m); an open conversation stays with its person while they are within reach (it used to swap or close when you walked past someone else).
* In a stable position old and new both took 40 of 40. So: the loss was real but only in motion or next to a second person; it was not a general dead Talk button.
* Not tested: a real iPhone (frame rate, a real second finger).

## 2. Port kerb
The side kerbs (x = +-103, z -80..84) were an unbroken 0.62 m wall; a walker steps 0.35 m. Pads sit at x 150..342. Six 8 m dropped-kerb openings per side now (`KERB_GAPS` in `portSystem.js`, centres z -56, -32, -8, 16, 40, 64). New check in `port-checks.mjs`: a 1 m flood fill with a 34 cm body against every solid above a 35 cm step, from the middle of the port to the foot of each of the first twelve pads: all reachable, no detour over 20%. It fails with the gaps removed (pad 08: 203 m walk for 157 m straight) and passes with them.

## 3. Free-flight HUD / strip overlap (`freeflight-*-sheet-open.png`)
Cause: the pilot strip (`#ship-panel`) was pinned at `top: 70px`, the status box (`#hud`) grew to four lines and ran under it; the nav sheet pinned at `top: 96px` covered the Range / Course / Jobs chips; the free-flight read-outs assumed a 46 px strip. Now `phoneLayout.js` stacks from the measured bottoms: status box, then strip (`--hud-bottom` + 8), then a sheet under the strip (`--strip-bottom` + 8), then the free-flight read-outs. `phone-check.mjs` has `noBlockOverlap` (status box, strip, sheet, free-flight bar pairwise, plus "the read-outs start below everything above them"), run in free flight at four viewports with the Course sheet open and closed, on iPhone WebKit and Android Chromium. Green: 27 PASS, 0 FAIL.

## 4. Ground-level look (`sheet-mars.jpg`, `sheet-moons.jpg`: before | after)
New `src/world/groundDetail.js` (three draw calls, about 4,600 pebble triangles, 0.01 ms a frame measured on desktop CPU):
* **Pebbles**: real shadow-casting little stones (2-22 cm out to 12 m, 0.7-4 cm gravel out to 5 m), sunk a fifth into the ground, on a fixed latitude/longitude lattice so they are where they were when you come back. Placed from the same ground the walker stands on and re-checked a few a frame (the 48 m near patch lags a jump); worst offset measured 1.2 cm. None on port concrete, pads, or dug ground.
* **Boot prints**: every 0.8 m on foot, left and right, 120 kept per world and saved on the device. Mars and both moons.
* **Contact shadows**: soft blobs under you (third person) and the port people and crew within 30 m.
* **Micro grain** in the regolith shader (4 cm crumbs, 1.4 cm grain, fading out before a pixel gets as big as half a feature so it cannot moire; my first version did and made rings, found in the screenshot and fixed). The old 33 cm pebble speckle aliased into black sparkle from 30 m out; it now fades 10-60 m.
* Phone tier: pebbles do not cast sun shadows on `tier=low`, 230 stones instead of 380.
* Honest: it is better, not film-grade. The grain is subtle at walking height, stones are sparse and rust-on-rust on Mars, the prints are decals not dents. Not done: real normal-map textures (procedural only, no download), ship landing-gear contact shadows. The Phobos pad apron in the sheet is flat graded ground, so the moon pictures show grain and prints rather than a boulder field; `ground-browser-phobos-iphone.png` is further out.
* Tests: `test/ground-browser.mjs` (iPhone WebKit: stones on open ground, within 6 cm of the ground, same stones after walking away and back, none on the port, prints appear and stay and are saved, at most 3 draw calls, blobs near people, and the same on Phobos).

## 5. estimateTrip and crater cell walls
* **estimateTrip** stepped in whole seconds; the controller is only stable at 0.25 s. A standoff point 3 m higher never "arrived" (ETA 400,000 s) and other heights gave 1,996 s for 1,801 s. Now 0.25 s steps and, if a flight really cannot arrive, a plain flip-and-burn figure with `arrived:false`. Check: 161 standoff heights from -40 to +40 m on both moons all arrive and agree within 1%.
* **Crater cell walls**: a point looked only at the craters of its own cell, so every rim and ejecta tail ended at the cell wall; the named craters' blanket ended at 60 degrees as a 9 m cliff. Now the neighbouring cells within reach are included (pruned per axis without hashing), the ejecta tail fades smoothly before its cut, the named blanket is gone before 90 degrees. Biggest ground jump per 1.15 m step round Phobos 9.4 m to 5.1 m (steep natural bowl walls remain), Deimos 4.0 m to 0.8 m. New check: no jump over 6 m (Phobos) / 3 m (Deimos). Cost: crater relief about 1.6x slower in Node (0.32 s to 0.53 s for 160,000 samples); not measured on a phone.

## 6. Playtester (`AI-Shared/tools/playtester`)
* Tap checks now wait for the shared world's reply (the game's own `cosmos-request` / `cosmos-receipt` events) before calling a tap dead; a request never answered is its own finding.
* Wander points are checked against the game's ground height (no wall or cliff in a 1.6 m step) before walking.
* Websocket "closed" findings ignore closes caused by the bot's own refresh (all 8 in the 09-52 run were its refreshes: 8 refreshes, 8 closes); the repeated-message counter resets on refresh and random refreshes are 2 minutes apart ("Down at Deimos (pad 04)." was one announcement per page load, 4 loads in a minute).
* Desktop "Climb out stalled 93 s": the bot clicked the canvas, which locks the mouse, then tried to click a button; a person presses Esc. The bot now releases the lock first. Opening completes on desktop in 3 minutes.
* A sticky heading over a scrolled button is no longer "covered"; the "stuck" finding now prints the game's own view of the opening.

## The coordinator's extra list (09-52 report)
* **(a) Hiring**: root cause was duplicates. A dismissed hire walks back to the hall while `refill()` had already made her replacement: two open Adas (and two Zuris) on the same spot, the panel naming one while you stood in front of the other. `Authority.dedupePool()` keeps one open candidate per post (the one furthest along), retires the rest; runs on load, so it heals the live world. "Meet" instead of "Hire" is by design (a candidate inside the hall must be called out first); the playtester did not wait. Check in `round7-checks.mjs`.
* **(b) Name tags**: world-sized 3.6 m banners; at 4 m they filled the screen. Now one on-screen size (about 22 px), hidden past 30 m. Verified numerically (1.2-1.9 m wide tags at distance); I do not have a before/after picture of the hall (the candidates stay inside until called). The big "CREW HALL / CANTINA" sign is a world sign and is unchanged.
* **(c) "Down at Deimos (pad 04)." repeating**: not a loop; see the playtester notes.
* **(d) Course/Jobs sheet covering the strip and speed buttons**: fixed with item 3.
* **(e) Websocket closed 8 times**: all 8 were the bot's own refreshes.
* **(f) Desktop "Climb out" stall**: bot artifact (mouse lock), above. A real desktop player who clicks the 3D view and then wants a button has the same lock; the button says (E), Esc releases it. Not changed in the game.
* **(g) "Durable storage failed" sticking**: cannot stick: the checkpoint tick retries a save every 2 s and clears the flag on success; an action retries first. New check: simulated outage, health 503, database back, flag cleared by itself in 2.2 s, health 200.
* **Found by this round's live playtest and fixed**: "Walk to that place." on the phone (seen at 12:34 in the dig phase). `updatePose` refused a pose further than a person can walk, and a refusal rolled the server pose back, so every later pose was refused too (the same wedge the opening had). It now pulls the pose back to the furthest reachable point and the player catches up (3 m or more per pose); check added. I did not find what first made the client so far from the server; the mechanism is closed whatever started it.

## Live playtest after the first publish (`state/playtest/2026-10-03_12-00`)
28 minutes, iPhone and desktop: 16 problems, 0 blockers (the run before: 4 blockers on the opening). Triage: the opening finished on both devices. Left over, all judged bot-side or noise: "stuck walking" to the tower cab runner and lookout (the bot's target sits on a console 0.9 m high) and to the ship ramp (a parked ship in the way; the bot's route does not know it); "Dig button never appeared on open ground" (the bot dug on port concrete); frame spikes (headless software rendering); settings "overlap" (sticky header while scrolled); "Weather sensors are offline" (the weather officer's own line). Not investigated: "Delivering to the weigh bay paid nothing" and "No survey rover found" in the 09-52 run.

## Live playtest after the second publish (`state/playtest/2026-10-03_13-49`, iPhone, 15 min)
11 problems, 1 flagged blocker, none confirmed real. The blocker ("an action stays pending forever", opening step 0) was the opening's pose saves running one after another against a slow database (commit time was 1.7 s just after the restart): the busy flag stays on while answers keep coming. It went on to finish the opening, and every later phase ran. The bot now calls it stuck only if no answer came back for the whole window. "Hiring Ada Chen 1 did not work" was the server's own "Walk over to them first." (she walks out of the hall after Meet and the bot stood still); the duplicate Adas and Zuris are gone and Zuri was hired. The bot now follows her. The tower-cab walks, settings overlap, frame spikes and the opening Dig notes are as above (the opening Dig is covered by the phone check: every tap with the thumb held makes one cut).
Two more things that I did not run down: the crew hall candidates' own name tags were never in a picture, and `live-iphone-ground.png` is a live iPhone-profile shot of the new ground detail (156 stones, build 2cbecfe27c8269d7480d).

## Verified / not
* Local: `node test/validate.mjs` 1045 passed, 0 failed, `node test/phone-check.mjs` 27 PASS 0 FAIL, `node test/tap-browser.mjs`, `node test/ground-browser.mjs`.
* Live: build id and server health checked after the second publish (see the final report).
* Not verified: a real iPhone, real thumbs, the phone's frame time with the new ground detail and crater relief.

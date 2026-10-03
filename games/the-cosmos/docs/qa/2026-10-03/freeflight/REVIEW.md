# Free flight (Claude Sonnet 5.5, 2026-10-03, branch `cosmos-freeflight`)

Jaron: "That's a must. So many people will want to see they can fly wherever however whenever." Between worlds you could only pick a
destination and the autopilot flew a fixed course. Now you fly her yourself; the courses are still an option. Description and
controls: README "Free flight". Ownership and state: WORLD-STATE "Free flight".

## What was built

* `src/space/freeflight.js`: the ship as a body in Mars's frame under Mars, Phobos and Deimos (real masses); main drive (13 m/s2, fuel), RCS jets, attitude control
  (turn-rate limited; assists prograde / retrograde / target; BRAKE = flip and burn); a tank of delta-v with refuel on your pad at the port; Mars's air as drag brakes;
  time compression x1 / x5 / x20 / x60 / x500 that drops itself near bodies, on a collision course, near raiders and other ships; hand-over to the existing lift-pod flight
  (landing anywhere) low over Mars or a moon, and back up again. Pure; the browser (solo) and the authority run the same file.
* `src/space/freeflightUI.js`: the phone-first HUD: one bar (FREE FLIGHT, ASSIST, TARGET, THR, RCS, x1..x500; one row in landscape), THRUST and BRAKE on the existing LIFT / SINK buttons, four lines of read-outs
  (speed, height, orbit Pe / Ap / period, target distance / closing / ETA, fuel and delta-v), and a sky overlay (nose, prograde, retrograde, target marker with edge arrows, predicted path with "IMPACT in ...").
* Server: the authority steps the same physics, takes only clamped intent (the stick on the pilot's one-second lease; `ff-set` bridge-only and validated), owns the pose, saves/restores it, advances a flying ship after a restart.
* Small marked `FREEFLIGHT` edits in `shipSystem.js`, `spaceSystem.js`, `spaceSpec.js`, `multiplayerView.js`, `remoteWorld.js`, `motionBuffer.js`, `phoneLayout.js`, `authority.mjs`, `simulation.mjs`.
* Six new voice clips for the new ship messages (`node tools/gen-voices.mjs`), because the voice check wants every ship line to have one.

## Verified here

* `node test/validate.mjs`: **1028 passed, 2 failed** on the first run of the rebased tree. One was mine (six new ship lines had no voice clips: generated, now 343/343); the other
  (`holding Talk ... real audio packets`, fake microphone) failed under load and passes when `node test/voice-browser.mjs` is run alone (148 packets). Not re-run in full after the clips; the free-flight sections (60-61, 40 checks) were re-run on their own after the rebase: 40/40.
* Sections 60-61 (`test/freeflight-checks.mjs`, 30 s): orbit energy to 2e-9 over 4 orbits at x500, period = 2 pi sqrt(a^3/mu); the Hohmann burn costs the vis-viva delta-v (650 m/s, 5.4% of a tank);
  compression drops to x1 452 km out with 278 s to impact (more than the 238 s the brake needs); BRAKE stops 1.6 km/s inside 3 m/s; assists align to under 1.2 degrees; jets 1.2 m/s2 without turning; fuel accounting; the drive refuses in the air;
  orbit-to-ground at Mars (157 m/s deorbit, peak 4.8 g, handed to the flight assist at 284 m/s and 10 km, lands intact); armed climb from the pad to 100 km in 35 s of play at x60; four **landings that are not on pads** (three on Phobos, one on Deimos) and a take-off that returns the ship to free flight; a
  too-fast arrival hurts the hull; server: the pilot's thrust moves the ship by the drive's acceleration, no step larger than her speed allows (no teleports), junk input clamped, a passenger's stick ignored, bad requests refused, passenger rides with the hull, x60 really runs 60x, **two clients see her free flight** (state, attitude, speed), a restart keeps her flying and conserves orbital energy.
* `test/freeflight-browser.mjs` (real taps and held fingers, iPhone-profile WebKit as the pilot, Chromium as a second client, isolated authority): bar taps change the authority (assist, target, throttle); a held THRUST burns (+38 m/s in 3 s, 0.33% of a tank) and stops when released; the held thumb turns her 52 degrees and she stops when it lifts; x60 flies 4.6 degrees of orbit in 1.5 s (expected 4.6); BRAKE took 3401 -> 3278 m/s;
  client B sees her ff state, her moving at 3.28 km/s and **draws her hull** (57 meshes visible, screenshot); SINK lands her on Phobos intact in 29 s, LIFT takes her up and free flight takes her again in 60 s, client B sees it. No page errors. Phone layout: 17 buttons, none overlapping or off screen, every one at least 40 px tall, HUD above the bar.
* `test/phone-check.mjs` has a new step "FREEFLIGHT" (a fresh page at the pilot seat in orbit): real taps on the bar, a held THRUST, a held thumb, and `noOverlap` at 393x852, 375x667, 852x393 and 667x375 (and 360x740 / 740x360 on Galaxy). Final run on the stamped tree: **27 steps passed, 0 failed, both devices** (`docs/qa/phone-check/2026-10-03/RESULTS.md`).
* Cost: 24 ships in free flight take the server **1.6-1.8 ms** a tick (24 resting ships: 3.8 ms; budget 33 ms; `test/perf-freeflight.mjs`). The overlay costs **0.88 ms a frame on average** in software-rendered headless WebKit (`cosmos.space.ffUI.stat`; max 37 ms once, at start). Real-phone frame rate was not measured.

Screenshots (this folder): `phone-1-orbit-hud`, `-2-thrust`, `-3-stick`, `-4-warp60`, `-5-over-phobos`, `-6-landed-on-phobos`, `-7-free-again`, `client-B-sees-A-flying`. Phone-check pictures are in `docs/qa/phone-check/2026-10-03/*freeflight*`.

## Honest notes

* **The moons are parked** in this build (nothing spins). A ship at rest next to one would fall away at Mars's 0.49 m/s2, so inside 400 km of a moon I cancel Mars's pull at the moon's centre (fading out by 500 km). That is a fudge; the tide that is left is real (a ship at rest 300 km out drifts away slowly).
* A real orbit transfer works as in life: from 400 km the Hohmann to Phobos costs 650 m/s and you arrive at 1.6 km/s, so you must BRAKE (1.6 km/s, 13% of a tank); the compression comes down by itself and says so. A round trip surface-Phobos-surface is most of a tank: "fuel matters a little".
* Mars's air is a drag law with deployable brakes, no heat. Steering in the air is by the jets only. The drive will not light under 100 km (the existing rule).
* Refuel is free, on your own Mars pad only. Courses still cost no fuel. No fuel price: that is the economy's decision.
* Landing on a steep slope: the legs cannot level, she hovers a few metres up (and says "too uneven: slide to flatter ground"); two of the four test sites needed one slide. That is the existing gear's limit, not new.
* A restart advances a flying ship at x500 (nobody is at the stick): after a long outage she is wherever her orbit took her, and if the orbit dips into Mars she lands/crashes by the usual rules.
* The ship HUD box and the pilot status strip overlap a little on a phone when the box is tall (pre-existing: four lines of box against a strip pinned at 70 px); free flight keeps its own lines out of the box for that reason.
* Not verified: real iPhone Safari / Android (WebKit and Chromium emulation only), Supabase persistence of the new `ff` fields (they ride in the ship's JSON record, no schema change; the file-adapter restart check passes), the public Cloudflare path (checked after publishing: see the report).

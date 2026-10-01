# Space travel: review, 2026-10-01 (Claude Sonnet 5.5, branch `cosmos-space`)

What was built is described in [the README's "Space travel"](../../../../README.md#space-travel). This file is what was looked at, how, what
was found along the way, and what is still unverified.

**Images are kept in the worktree only** (the project's `.gitignore` excludes `docs/qa/**/*.jpg`, as for every earlier QA set):
`games/the-cosmos/docs/qa/2026-10-01/space/*.jpg`, 55 of them. The scripts that made them are committed here. Everything was
taken in headless Chromium on software GL (SwiftShader) through the real game code, with a local `node server.js` (the scripts use
`PORT=8421`; change `port` in `_sp.mjs`). The ship and the walker are stepped in game time without drawing between pictures (a 30-minute
transit is about two minutes of wall time at x60), then one real frame is drawn and photographed. "Still" shots from outside the ship
use a free camera, which pauses the flight for that frame only.

## What each script shows

| Script | Viewport | Pictures (`s0N_*.jpg`) |
|---|---|---|
| `s01_journey.mjs` | desktop 1280x720, high tier | Phobos from the port through a 5-degree lens; the pilot seat; the nav sheet's course list and the jobs board; the climb at 900 m, 1.8 km (neutral line), 30 km and 95 km, each from the cockpit and from outside; the main drive lit with its panel; the ship burning; the observation lounge window at x5 and x20; mid-transit from outside; the turn-over and 20 s into it; over Phobos at the standoff point; the descent through the canopy; down on the Stickney East pad |
| `s02_phobos_ground.mjs` | desktop 1280x720, high tier | the cargo bay and the ramp (walked off with the real keys); the ground in every direction; Mars over Phobos; toward Stickney; a hop; a sample beacon; the Take core sample button; the sealed sample; a bucket pit and a poured heap; stowing; the distress beacon's cargo module; the salvage |
| `s03_phone.mjs` | phone portrait 390x844, low tier | the port; the navigation seat's panel with the Course and Jobs chips; the course list; the jobs board; the drive burning at x20; Phobos from outside, on foot, the action button, digging |
| `s04_crew_orbit_raiders_deimos.mjs` | desktop 1280x720, high tier | talking to the pilot: the "Other worlds" list; holding over Mars at 400 km; a raider 70 m off the side; over Deimos; on Deimos; Mars from Deimos |
| `s05_survey_job_end_to_end.mjs` | (prints) | the whole survey job flown in the real game: pad to Phobos, three samples, bucket, stow, salvage, home, paid 900 + 150 credits, the ledger |
| `s06_trips_regression.mjs` | (prints) | moon to moon both ways; cancelling in transit (brakes, holds), then a new course from open space; the stick during a fast climb (refused with the reason); engines low |
| `s07_costs.mjs` / `_costs.json` | phone 375x740, low tier | draw calls, triangles, build times |
| `s08_precision.mjs` / `_precision.json` | phone-size, low tier | the numbers the GPU is handed at 23,455 km from Mars's centre |

## Numbers measured

* **Validator:** `node test/validate.mjs` from `games/the-cosmos`: **390 passed, 0 failed** (the old 331 plus 59 new, sections 12-17).
  `node test/_space-only.mjs` runs just the new ones in about 7 s.
* **Flight times** (ship time, default 40% engine share = 13 m/s2): pad to the 120 km gate under the lift pods **4.8 min**; gate to the Phobos standoff
  point **30 min** (7,667 km, peak 9.3 km/s); Deimos **53 min in all** (peak 15.6 km/s); landing ~1 min. x60 makes Phobos a 90 s skip. Engine share 20% -> 41 min, 80% -> 25 min.
* **Raiders:** in the climb they appear from 1.5 km; in orbit and over the moons they attack (shield 172 -> 150 in 40 s in one run); in transit they are suspended.
  The crew gunners' kills pay the bounty too (a hired crew earned 50 credits in one orbit run).
* **Precision:** in the Deimos frame, 23,455 km from Mars's centre, the ship's draw position differs from the f64 truth by **1.6e-9 m**; the 48 m terrain
  tile is drawn 15-33 m from the camera; Mars's shell is 23,455 km away and the Deimos shell 6 km. Camera far plane 1e9 m, 24-bit depth here, logarithmic.
  No flicker, no jitter, no z-fighting was seen at Deimos, on the pad, in the cabin or on the stairs (`s04_e`, `s04_f`).
* **Phone-tier cost** (`s07_costs.mjs`, 375 x 740): the port scene is 316 draw calls and 441 k triangles (the existing Mars scene, which this work added to by
  20 k triangles: Mars's whole-planet shell went from 128 x 64 to 192 x 96 on the phone tier so the limb from orbit is not faceted). On the Phobos pad it is 131 calls and 367 k triangles; on foot
  190 calls and 432 k. Phobos's shell is 65 k triangles close up and **4.6 k** when it is a few pixels across (it was 65 k all the time before the LOD was added:
  found in this review). Phobos builds in 190 ms (desktop software GL), when the browser is idle a few seconds after load; Deimos in about 310 ms, when a course to it is engaged;
  all four terrain tiers rebuild at once in 150 ms (arrival); the nav list costs 2.4 ms and is cached for 1.5 s; `space.late()` is 0.02 ms a frame.
  **No physical phone was available**: frame rate, heat and GPU cost of the star dome and the atmosphere shell are unmeasured.

## What was found and fixed along the way (honest log)

| Seen | Cause | Fixed |
|---|---|---|
| Phobos from the port was a pale beige disc | Mars's dusty fog applied to a body 6,000 km away | fog off on every moon material; now a dark silhouette against the sky |
| Black horizontal dashes on the regolith | the walking-scale pebble term darkens by a fixed amount: on dark soil it reads as black slivers | `installRegolith` got a pebble strength; moons use 0.22 |
| A darker square 880 m across in views from above | the grain shader darkens the albedo to about 0.8 on the walking-scale tiers; the shell and far tier had no such factor | the walking-scale tiers base colour is lifted by 1.22 on moons |
| Coloured blurry squares by the ramp, and a blurry pad | the pad texture had random coloured specks at 0.12 m per texel, magnified when the eye is 1.7 m from it | 1024 px, neutral grit, finer |
| Landing on Phobos at 4.2 m/s | the flare's gain was tuned for Mars's weight | gain 4.5 while descending under the vacuum thrusters: 1.4 m/s (Mars: 2.1 for comparison) |
| Descent from 1.8 km took 13 minutes | the pods only push up; Phobos's pull is 0.0056 m/s2 | the pods push down too in vacuum (`thrustDown`); 40 s |
| A jump on Phobos did not leave the ground | the ground snap (4 cm) is bigger than a frame's rise at 0.25 m/s | rising faster than 2 cm/s is a jump |
| A low-power trip never arrived | the first braking rule assumed the velocity was already toward the goal | a braking envelope in 3-D with a committed turn-over: every acceleration arrives (validator) |
| **Cancel course in transit sent the ship down at Mars** | after the stop the trip fell through to "descent" | a stop (and orbit) holds; descent only for a moon or the port |
| The sky, fog and star dome cost | 81 hash evaluations a pixel | one per layer; the galaxy only inside its band |
| Raiders paid on the crew's kills too | (intended, noted) | |
| The cargo module's shadow side was pure black | no light reaches it in a vacuum | a Marsshine fill that lights only what faces Mars, and a faint emissive on the module |
| Ship hit-and-run text said "Mars neutral airspace" over Phobos | text | generic over a moon |

## What looks wrong or is unverified (not hidden)

* **A faint dotted outline** where the 8 km tier meets the whole-moon shell is visible in views from a few km (`s01_o`, and the 30 km shot of Mars's own tiers). It is the skirt and
  the shell's flat triangles; Mars's tiers morph their edges into each other, the last step to the shell does not.
* **The distress beacon's cargo module is a plain box with a stripe**: a placeholder prop, not a modelled hull. The sample beacons are poles with a lamp.
* **Phobos's terrain near the pad is smooth at the eye**: the grain is fine and low-contrast; there are no boulders, and craters do not shadow each other
  (the sun's shadow map covers 120 m round the camera).
* **Mars from orbit** has soft dark and bright provinces and polar caps, not a mapped albedo; the real Valles Marineris is still the procedural canyon.
* **The jump on Phobos** (0.6 m/s) is a design choice, stated in the README, not a measurement of a suit.
* **Not verified on a real phone:** frame rate, thermals, audio on iOS during the burn, and the star dome's GPU cost. The phone-width pictures are a 390 x 844 desktop Chromium.
* **The hired pilot flies the course end to end** (`s04`, and a separate run of `crew.order('goto', {id: 'sp:phobos'})`), but the crew's own Talk panel redraws on a phase change, not every frame.
* **Persistence and the server:** none. A refresh puts you back at the port.
* **Money:** only the hooks; the default ledger is a counter on the Jobs tab.

## Reproduce

```
cd games/the-cosmos
node test/validate.mjs                    # 390 checks, ~2.5 min
node test/_space-only.mjs                 # the 59 space checks, ~7 s
PORT=8421 node server.js &                # then, from docs/qa/2026-10-01/space:
node s01_journey.mjs                      # ~3 min each; s02 .. s08 likewise
```

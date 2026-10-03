# F2 review: real time and sky (2026-10-03)

Package F2 of The Cosmos: Mars turns, the moons orbit, the Sun crosses the sky, frames move and turn, courses and free flight chase moving
worlds, every player reads the server's clock. Worktree `ho-f2` (branch `cosmos-f2`). Screenshots are in this folder; numbers are in
`results.json` and `sync-results.json`; tests are `test/pkg-f2-time.mjs` (runs inside `validate.mjs`), `test/f2-browser.mjs`, `test/f2-sync-browser.mjs`.

## What I chose (Jaron asked me to say)

* **The calendar is NOT compressed.** Game time is real UTC (epoch 2026-10-03 00:00 UT = the ephemeris `START_JD`), rate 1. A Martian sol at the
  port is 24 h 39.6 min of real time; the sunset takes real hours; Phobos goes round in 7 h 39 min. Reason: the ship's physics, the moons' real speeds
  (Phobos 1.47 km/s through the turning frame, the drive tops out at 30 km/s) and the sky must be one clock, or a ship could not match a moon's speed.
  Time compression stays where it was, on the ship (x5 to x500): it runs the ship's own clock (`flight.epochS`) ahead of the world's while she is in
  space (a x60 trip to Phobos is 49 min of ship time in 49 s), and she rejoins the world's clock on a pad or in a moon's frame. A player who
  wants to see a sunset in a short session warps a course, or uses `?sky=dusk` (review links).
* **A `?dev=1` session without `?sky=` keeps the old fixed mid-morning Sun**, so the existing browser checks see one lighting at any hour.
  A normal session is always live. `?sky=live|noon|morning|afternoon|sunset|dusk|dawn|sunrise|night|midnight|fixed` and `?skyshift=<s>` choose.
* The planets move too (`worldCentre(id, t)` for Mercury to Neptune, Earth, the Moon from the JPL elements) and the Sun's direction comes from
  Mars's real position and pole. Checked: the declination is 1.2 degrees just after the Mars equinox of 30 Sep 2026 and 24.8 degrees a quarter-year on.
  The other planets are not drawn (they are placeholders); only their places are live.

## How it is built (short; the long form is `docs/ADD-A-WORLD.md`, "Orbits and rotation")

* Two sets of axes, one clock. The ground frame (Mars's body-fixed axes) TURNS; ground, port, players, holes, pads and ships on pads are body-fixed, so
  they are consistent by construction. A moon's frame is those axes translated to the moon's centre and turned by a yaw (locked: one face to Mars).
  The engine draws any frame through its translation and turn (`core/engine.js`, `core/frameMath.js`); a ship, bolt or player carried between frames keeps its
  position, velocity and attitude (`carryFlight`).
* The drive (`transit.js`) flies in inertial axes against a goal that moves (`goalFn` gives position, velocity, acceleration): it burns to where the goal is, brakes
  the speed relative to it and arrives at rest relative to it. The nav list, the trip plan and the flight share one estimator, so the estimate is the flown time.
* Free flight (`freeflight.js`) integrates in the turning frame exactly (Coriolis and centrifugal terms), the moons pull from where they are (the old
  "cancel Mars's pull near a moon" trick is gone: a ship riding with a moon rides with it because the physics says so), prograde / retro / brake work against the
  body that matters, and the TARGET assist steers for the intercept point, not the point the target is at.
* Sky (`spaceSky.js`): the Sun follows the clock; day, dusk (blue), night (black, stars turning with the planet, Milky Way), the key light fades as the Sun goes under the horizon,
  Mars's shadow in space, and the sunlit moons stay lit seen from a night sky. Port: four apron floodlights come on as the Sun sets (a fixed pool of 2 lights on the phone
  tier, 3 on high, never a different count), and the helmet lamp comes on away from the port.
* Server (`server/simulation.mjs`): each ship has its own clock; frame switches carry state; a clock offset is measured from the server's `serverAt`.

## Measured

| What | Result |
|---|---|
| Mars->Phobos, Mars->Deimos, Deimos->Phobos, Phobos->port, real authority (`pkg-f2-time`, `moons-trips`) | all end landed in the right frame on the player's own pad (2.5 m from the pad point, 0.000 m/s over the ground); the moon moved 1,000 to 7,000 km while she flew |
| The same in the real game in a browser, solo (`f2-browser`, results.json `trips`): Phobos, Deimos, Phobos, then **Ceres across the Ore Lane (world 2) and back to the port** | all five end landed in the right frame, speed 0, ship clock back on the world's |
| Arrival of the drive on a moving standoff point (Phobos 49 min, Deimos 51 min of ship time) | 0.00 m off, 0.000 m/s relative to it; the estimate equals the flown time to the second |
| A static goal flies as before | 1554.8 s with and without a goal function |
| Server tick | 1.48 ms flying a course at x60 and 0.88 ms in free flight at x500 (a whole authority tick with raiders, in Node; live idle tick averages 1.9 ms) |
| Client CPU per frame, phone tier (`tier=low`, render stubbed) | 0.53 ms by day, 0.56 ms by night; `updateFrames` 0.004 ms. **GPU time on a real phone was NOT measured** (SwiftShader here). The night adds 2 point lights on the low tier |
| Sky clock sync | two browsers whose clocks were 3 min fast and 40 min slow read the same game time as the server to 0.003 s (`sync-results.json`) |
| Free flight, circular 400 km orbit at x500 | energy drift 5.5e-9, still circular; the ship's own clock runs 500x |

## Screenshots

`01` noon (sun 75 deg), `02` morning (25), `03` sunset (0.4: dim and blue), `04` dusk, `05` night (stars, apron floodlights), `06` night sky, `07` dawn,
`08`/`09` the same patch of sky three hours apart (the stars turn), `10-phobos-over-the-port-*` Phobos through a 4-degree field at three moments 20 min apart in
sunlit dusk sky (it is 0.2 degrees across: a dot at the normal view), `20-*` the ship on a course to each world, `21-*` landed on Phobos and Deimos, `22` back at the
port at night, `23` Mars seen from Phobos (locked: it hangs in one place; the terminator is the real day and night), `30/31` the two synced browsers.

## Merged with world 2 (Ceres, the Ore Lane) and F0

The branch was rebased onto world 2 and F0 before publishing. World 2 flies a far world as its own region (its own frame, its own star, a jump at the lane mouth). F2 leaves that
alone: a leg in a far region is flown as it was (in the world's frame, static goals, no ship clock, its own `def.sky`, no live Sun); a leg in Mars's region (the climb, the lane mouth, a moon, the port)
is flown in inertial axes against its moving goal, the mouth included (it turns with Mars, so it moves at 4 km/s through inertial space: the drive matches it).
`test/pkg-ceres.mjs` and `test/_world2-only.mjs` (the real authority flies Mars -> Ceres -> Mars) pass on the merged tree, and the browser flew Mars -> Ceres -> port (`21-landed-on-ceres.png`).

## Honest limits and what is not verified

* **Verified locally:** everything in the table; `node test/validate.mjs` (see the run in the handoff); `node test/phone-check.mjs`.
* **Not verified:** a real phone's frame time (only CPU time was measured); the live site until it is published and checked at phone width; two real people in a shared world watching the
  same sunset (two scripted browsers were).
* **The phases of Phobos and Deimos are invented** (the registry's parked shorthand gives the longitude at the epoch); their periods, distances and speeds are real. They move on circles in Mars's equatorial plane; no libration.
* **Frames turn about Mars's pole axis only.** A world's axial tilt is data, not yet a tilted frame; a world reached by a jump lane (F3) will need its own orientation.
* **A moon's own ground ignores its spin forces.** Walking and the flight assist on Phobos do not feel the centrifugal and Coriolis terms of the moon turning once an orbit (about 10 percent of its gravity at the equator).
* **Shared world and warp:** a ship under time compression has her own clock. Other players see her where her own clock puts her until she lands or leaves space; the moons they see are at world time. A ship that lands snaps back to world time (the ground has no clock of its own).
* **Light:** one fixed Sun strength (no 1/r^2 over the year), Mars's shadow is applied to the camera and to moons seen from afar, not to the surface of Mars by a moon's shadow. A moon patch's baked shadows follow the Sun by rebuilding when it has moved 4 degrees; the whole-moon shell is baked without the Sun's crater shadows (it is seen at every hour).
* **Landing on a moon:** the flight assist takes over holding the ground's speed (a drift under 10 m/s across the ground, from the moon turning under a ship that rode in with it, is taken out). On slopes a ship may touch down at about a metre a second and hop on her springs in 5.6 mm/s2: that is the existing landing model, now met more often because the ground is no longer where she aimed (tens of km off, the moon turned during the fall).
* **Old saves:** a ship saved before F2 mid-way through a drive course is held where she is (the course cannot resume); one in free flight keeps her orbit (the old velocity is read as inertial).
* **Tests I changed because they encoded a parked sky:** `freeflight-checks` (a circular orbit is now circular in INERTIAL velocity; the encounter is set up relative to the moving moon; the cancelled-pull checks became real-physics checks; the landing check allows a hop), `space-checks` (moons seen over a week, frames turned, the Phobos drive flown against a goal asked once), `worlds-orbits-checks` (switches on; static checks switch them off for a moment), `grok4-checks` (the goal is the moon's point at one time).
* **Pre-existing:** `twoplayer-browser` timed out in the baseline run before my changes (the F1 handoff also notes one two-player scenario timeout); in my runs it passed.

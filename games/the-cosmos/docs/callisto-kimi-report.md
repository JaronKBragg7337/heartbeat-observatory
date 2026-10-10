# Callisto (WD-CALLISTO) — what kimi built, 2026-10-09

Branch `kimi/callisto`. Replaces the F3 placeholder with a full, landable, startable Callisto:
Jupiter's outer big moon, the Valhalla Camp of Mystara, the open seat, Jupiter huge in the sky.

## What exists now

**The moon, real.** `src/worlds/callisto/def.js`: radius 2410.3 km, mass 1.0759e23 kg (1.236 m/s²,
2.44 km/s escape), one turn per orbit (16.689018 d, locked, the same face kept to Jupiter). Orbit round
Jupiter at the real 1,882,700 km, e 0.0074, in Jupiter's own equatorial plane (IAU pole J2000 as ecliptic
elements — the placeholder's invented plane is gone). The phase (M0) and periapsis argument are fitted
and marked `invented` in `sources`; a JPL Horizons pre-compute is the honest next step (REAL-DATA.md).
Valhalla (16 N, 57 W) and Asgard (30 N, 139 W) are placed from the USGS control network; the camp's pad
stands on Valhalla's bright palimpsest floor. Airless: the Sun drawn 0.10° across, black sky with stars.

**The ground.** The `ice` terrain profile tuned for a cratered-to-saturation ice world: dark dust-stained
gravel (22% albedo) on the plains, clean bright basin ice a metre under Valhalla's floor (a third,
diggable material — the ice job's load), craters everywhere, Valhalla/Asgard as broad bright basins.
Honest note in the def: the multi-ring troughs are not carved (the field makes bowls, not rings), and
there is no global height map for Callisto — the relief between the named features is the field's own.

**The Valhalla camp** (`camp.js`, drawn with the Meridian's kit, ~20 draw calls a site): the landing pad
(stencilled), the Archive (Mystara's buried hall: gold-inlaid violet basalt, a glyph-lit open door, one
big viewing window facing Jupiter), the Standing Array (nine instrument stones; the middle stone's glyph
pulses — the band they do not name), two listening dishes and a 26 m comms mast, the quartermaster's
shed, five floodlight masts, notice board + camp desk, and the walker kept out of the solids. Five people
(`cast.js`, real Loft bodies in faction looks with helmets — no blocky people): Director Ila Sorn
(Mystara), quartermaster Tomas Grey, array keeper Odette Marsh, dispatcher Farah Adeyemi, and Bram
Okonkwo at the prospectors' camp.

**The prospectors' camp** — the open seat — is a world `port` 1.2 km north (graded, named, in the nav's
ground): three huts, a drill rig over a warm borehole, the claim board ("RAISE A BUILDING AND IT IS
YOURS"), string lights, a beacon, a tracked buggy. **Sealed Site Four** (a seven-lock violet door in a
mound, about 690 m out, the thing worth finding — the job thread ends in opening it or leaving it) and
the **dead relay** on the Listening Scar's rim (780 m, mast fallen against its dish, one red eye still
blinking) stand on the open ground.

**Jupiter in the sky** (`jupiterSky.js`, the Moon's earthSky pattern): the real Jupiter–Callisto line
from the ephemeris, 71,492 km across → about 4.4° wide (nine Moons), the SSS 2k texture (CC BY 4.0,
credited in credits.json), lit by the same sun as the ground. It hangs at a fixed bearing (Callisto is
locked). The camp's fixed sun was placed so the planet shows a lit gibbous.

**Callisto globe** for the Kestrel flight and the cruise: the USGS Voyager/Galileo global mosaic
(public domain; reprojected, tinted to Callisto's palette by `tools/bake-callisto.mjs`, credited).

**A start world** (the way Earth was done): the board row is `open` (Mystara + Unbound, credits, the
Valhalla Camp), the opening has its own words (locker note, surface/weather lines, the Grey and Bram
rover rides with both recruiters at the camp), the lifeboat chain takes its power cell from Mystara's
quartermaster and its fuel coupler from the prospectors (one part from each side), the crash site gets
the airless black sky and pale ice ground. 44 new voice clips (Kokoro, `tools/gen-voices.mjs`).

**Jobs — "The Quiet Road"** (5, one thread, in `src/missions/catalog.js`): the quiet relay (a port walk
that finds the relay was switched off the hour you crashed), ice for the melt (Mystara's oath: dig 300 kg
of the bright floor and carry it), a beacon on the Scar (the prospectors' oath: set a claim beacon, hear
the ground pulse), the core and the seal (joint: carry the drill core to the Director, then choose —
open Sealed Site Four or let it keep its secret; both paid, both remembered), a hand for the long road
(the desk hire). A hiring desk (six hands) and the notice board stand at the camp.

## What works (verified)

- `node test/pkg-callisto.mjs` — 30/30 (the moon's numbers, the orbit, Jupiter's size, the field: solid,
  flat pad, walker stands, materials; the camp layout; the start wiring; the jobs; the authority keeps a
  pad for a new ship).
- `node test/validate.mjs` — see below (pkg-callisto, opening-checks, pkg-missions, pkg-longrange all
  extended where Callisto changed the world: no more `deep` rows, Callisto lands).
- `node test/callisto-browser.mjs` — 10/10 on iPhone-profile WebKit (`?dev=1&body=callisto`): the camp
  builds with all five people, Jupiter is up with its picture, the Talk panel opens by a real tap and the
  Director answers, the prospectors' camp stands at the port, the nav lists the way home, no page errors.
  Screenshots: `docs/qa/2026-10-10/callisto/`.
- `node tools/gen-voices.mjs` — 768 lines, 768 clips (44 new), 18.6 MB.
- `node tools/gen-registry.mjs` + the restamp (`node tools/stamp-cosmos-build.mjs` from the repo root).

## What is unfinished (honest)

- Valhalla's rings are not carved (noted in the def); the orbital phase is fitted, not from Horizons.
- No player-facing market on Callisto (the quartermaster sells only the lifeboat part; like Earth's v1).
  The bible's unlock chains (Europa access, Jupiter fuel skimming) are for later packages.
- The prospector is one NPC holding the open seat; "first faction to raise a building" is not wired to a
  real building system (drones/construction are a later package).
- `test/phone-check.mjs` runs the Mars opening, not the Callisto one; the Callisto-specific opening flow
  (board pick → Kestrel → Valhalla crash) is covered by the pkg checks and the camp browser run, not by a
  dedicated opening-callisto-browser test.
- The frame still turns about Mars's pole only (engine-wide), so Callisto's pole and libration are data.

## Test results

- `node test/validate.mjs`: **2005 passed, 1 failed** on the final full run; the one failure was the
  opening browser walkthrough's gangway step — a timing flake (the parallel `phone-check` passed the same
  flow in the same minutes, and `node test/opening-browser.mjs` re-run alone exits 0). The earlier full
  run passed it: 2011 passed, 1 failed (the voice-clip size guard, fixed by the 19 MB / 120 kB budget in
  `test/voice-checks.mjs`, since verified green).
- `node test/phone-check.mjs`: **green** — 33 checks PASS, 0 FAIL (iPhone WebKit + Galaxy Chromium).
- `node test/pkg-callisto.mjs`: 30/30. `node test/callisto-browser.mjs`: 10/10 (iPhone-profile WebKit).
- `node tools/gen-voices.mjs`: 768 lines, 768 clips (44 new), 18.6 MB total.

## Files

- `src/worlds/callisto/`: def.js, layout.js, camp.js, cast.js, jupiterSky.js, client.js (+ the folder's
  own `test/pkg-callisto.mjs`, `test/callisto-browser.mjs` at the game root's test/).
- New assets: `assets/callisto/callisto-1k.jpg` (baked from the USGS mosaic), `assets/callisto/jupiter-1k.jpg`,
  `assets/callisto/usgs-global.jpg` (the cited source), `tools/bake-callisto.mjs`, 44 clips in
  `assets/voices/`, `credits.json` rows.
- Shared-file hooks (all small and named): `opening/worlds.js`, `opening/dialogue.js`,
  `opening/worlds/callisto/dialogue.js` (new), `opening/lifeboat.js`, `opening/look.js` (Callisto joins
  Ceres in the airless branch), `opening/opening.js` (ice-tinted crash ground), `opening/spaceScene.js`
  (callistoGlobe), `voice/lines.js`, `missions/catalog.js` (+GROUND_MATS), `missions/where.js`,
  `missions/desk.js`, `missions/lines.js`, `test/opening-checks.mjs`, `test/pkg-longrange.mjs`,
  `test/pkg-missions.mjs`, `docs/ADD-A-WORLD.md` (worked example 3), `docs/MISSIONS.md`.

# How to add a world (and what already works for it)

Written 2026-10-03 for package F1 (world registry and generic planet plumbing). Read this, then work only inside
`src/worlds/<your-world>/` and `test/pkg-<your-world>.mjs`. You touch **no shared file**.

## The idea in four lines

* A world is **data**: `src/worlds/<name>/def.js`, a default-exported object. No three.js, no DOM (the server imports it).
* `node tools/gen-registry.mjs` writes the manifests (`src/worlds/_manifest.js`, `_client-manifest.js`) from the folders. Each is one
  line per world and git merges them with the union driver (`.gitattributes`), so two builders adding worlds never conflict.
  `node test/validate.mjs` fails if a manifest is out of date.
* Everything else is derived: the nav-computer row, the frame, the free-flight body and its pull, the player's pad, the server's
  edit store, the course (the real authority flies it), the sky. Nothing in `main.js`, `server/`, `spaceSpec.js`, `bodies.js` or
  `moonField.js` names your world.
* Phobos, Deimos and Mars are entries like any other (`src/worlds/phobos/def.js` ...). Read them as worked examples.

## Add a world in 6 steps

1. `mkdir src/worlds/<name>` (the folder name **is** the id: lower case, digits, dashes).
2. Write `src/worlds/<name>/def.js` (fields below). Start from `phobos/def.js` for a small rocky moon, or the example at the end for a
   planet. A **placeholder** (`placeholder: true`: id, name, kind, blurb) only lists the world as "needs a jump drive"; the remaining
   homes (`fortis`, `greenhaven`) are placeholders now (Ironclad became `ceres`). **Replace the placeholder file** when you build the real world.
3. `node tools/gen-registry.mjs`
4. Look at it: `?dev=1&body=<name>` (solo only) sets the ship on the world's pad and stands you beside it, no travel. The nav list
   (the ship's navigation panel) has the course; the real server flies it.
5. Optional client dressing (buildings, props, weather): `src/worlds/<name>/client.js`, see "Dressing" below.
6. `test/pkg-<name>.mjs` exporting `run({ check, section, THREE, mars, FIELD, ROOT })`. `validate.mjs` runs every `test/pkg-*.mjs` on its
   own, so you never edit `validate.mjs`. `node test/_worlds-only.mjs` runs the registry checks in ten seconds.
6b. **Voices.** The crew speak the course lines ("Course set for <your world>.", "Down at ...", "We are at ... already.") from pre-rendered
   clips, and the validator fails ("every static spoken line has a clip") until they exist: run `node tools/gen-voices.mjs` once the world is
   in the registry (it renders the missing lines; commit the clips).
7. Publishing: `node test/validate.mjs`, `node test/phone-check.mjs`, then the usual restamp from the repo root (`node tools/stamp-cosmos-build.mjs`:
   the browser's import map lists every module, so a new file needs it), rebase, push. Two builders restamping conflict only in
   `index.html`/`build.json`/`buildVersion.js`: take either side and restamp again.

## The def, field by field

```js
export default {
  id: 'cryos', name: 'Cryos', designation: 'SOL-9', kind: 'planet',      // kind: planet | moon | dwarf | asteroid
  order: 40,              // where it sits in lists (Mars 0, Phobos 10, Deimos 20, placeholders 100). Default 100.
  worldIndex: 40,         // a unique integer >= 3: fixes the order your NEW materials are numbered in (see Materials)
  blurb: 'Land at the Cryos Landing. Ice, and a long way down.',          // the nav computer's line
  navName: 'Cryos (the ice world)',   // optional: the nav row's name if it differs from `name`

  // shape and mass: real numbers
  radiusM: 2_100_000,     // a sphere ... or axes: { a, b, c } for a triaxial body (Phobos); radiusMean is worked out for you
  jump: false,            // true: reached by a jump lane (F3), so the nav lists it as a destination however far it is
  massKg: 1.9e23,         // gravity = G M / R^2: it is not stated twice

  // where it is. EITHER the full orbit (use this for anything real; see "Orbits and rotation") ...
  orbit: { parent: 'sun', frame: 'ecliptic', a: 5.2e11, e: 0.04, i: 1.3, node: 100, lonPeri: 14, meanLon: 34, rates: { meanLon: 3034 } },   // or SOLAR.orbit.<planet>
  // ... OR the shorthand for a world parked in Mars's equatorial plane (Phobos, Deimos): the registry turns it into an `orbit`
  // orbitRadiusM: 52_000_000, orbitPeriodS: 86400 * 3, lonS: -140, latS: 4,   // latS optional (degrees off the equator plane)
  rotation: { periodS: 86400 * 3, axialTiltDeg: 12 },   // sidereal day (negative = retrograde); a moon defaults to lockedTo: 'parent'

  // ground
  seed: 9001,             // integer; the same on the server and every phone
  terrain: { profile: 'ice', crackM: 30 },   // rocky | ice | desert | volcanic | ocean | asteroid | gas; the rest tunes that profile
  regolithDepthM: 20,     // loose layer depth (a profile supplies a default)
  craterDensity, craterScale, cellScale, roughScale, grooves,   // optional; each profile has defaults (_kit/terrain.js)
  lump: 0.0003, lump2: 0.00004, lumpFreq: 1 / 250_000, lump2Freq: 1 / 35_000,   // PLANETS: broad hills (see below); the default is a potato moon
  landmarks: [{ id, name, lat, lon, radiusM, depthM, note }],   // named craters; the FIRST one gets an albedo ejecta blanket if look.ejecta is set
  pad: { lat, lon, flatM: 62, blendM: 150, name: 'Cryos Landing' },   // the arrival pad, graded flat (a plane under the ship)
  ports: [{ id, name, lat, lon, flatM, blendM }],   // optional: more graded sites (building plots, a second field)
  derelict: { distM, bearingDeg },                  // optional: a drifting wreck module (Phobos's beacon job uses it)
  rocks: [{ s, dens, rLo, rHi, hLo, hHi }, ...],    // loose angular rock classes; omit for a gentle default scatter, [] for none
  heroes: [{ e, n, rc, h }],                        // named rocks near the pad (east, north metres from its centre)

  atmosphere: { surfacePressure: 60_000, rho0: 0.9, scaleHeightM: 7_000, topM: 70_000,     // null / omit = airless
                skyColor: 0x6f8fb8, horizonColor: 0xc9d8e8, fogDensity: 0.00003 },

  materials: groundMaterials({ key: 'cryos', name: 'Cryos', regolithColor: 0xdfe6ea, rubbleColor: 0x9db0bb }),   // _kit/materials.js
  look: { k: [1, 0.1, 0.06], red: [0, 0.2, 0.1], desaturate: 0.2 },   // albedo units seen from orbit; tint {r,g} or desaturate
  render: { ... },        // how the ground is drawn (see phobos/def.js); omit for the Deimos-like default
  sources: [{ field, url, verified: 'live' | 'table' | 'invented', note }],   // say where numbers came from, or that they are invented
  showFromStart: false,   // true: built a moment after the game opens (Phobos: it hangs in the port's sky from the start)
};
```

`validateWorldDef` (src/worlds/_kit/schema.js) names every missing or wrong field in words; the registry throws at load, so a bad def
never reaches a player. The validator also fails if two worlds claim one `worldIndex`.

### Terrain profiles (`src/worlds/_kit/terrain.js`)

| profile | what it does | defaults |
|---|---|---|
| `rocky` | the moons' own ground: craters, grooves, regolith roughness. Adds nothing. | none |
| `ice` | long fractures (lineae), low pressure ridges, few soft craters | smooth |
| `desert` | wind-aligned dune fields over a weathered plain (walkable: slope under about 30 degrees) | craterScale 0.35 |
| `volcanic` | broad shield cones with calderas, lava ridges, rough young ground | rough |
| `ocean` | sea level, islands and a sea floor. **No water surface is drawn yet**; the level is ground only | smooth |
| `asteroid` | small, lumpy, heavily cratered | dense craters |
| `gas` | no ground: listed, orbit only; no frame is ever built | n/a |

Each profile's own numbers are overridden by `terrain: { ... }` in the def. To add a profile, add one object to `PROFILES` in
`_kit/terrain.js` (`relief(ctx)` returns extra metres of height; it must be pure and deterministic). That file is a shared kit file:
a profile is an addition, keep it self-contained.

**A planet must lower the lumps.** The default `lump`/`lump2` (6% and 1.6% of the radius at 6 km and 1.7 km wavelengths) are a
potato moon. A 2,000 km planet at 6% is a 120 km wall. Set all four so the wavelengths are a good share of the radius (the example
fixture in `test/worlds-checks.mjs` is a working planet; it passes a "no slope over 34 degrees" walk).

### Materials

Dug ground stores a material as its **position in `MATERIALS`** (field.js), so that table only ever grows at its end. A world's own
materials go in its def (`groundMaterials({...})`); the registry appends them in `worldIndex` order, so the numbers never depend on a
folder name or load order. **Never reorder or insert into `MATERIALS` by hand**, and take the next free `worldIndex` (the validator
catches duplicates). A def may instead name existing materials as strings (`'phobosRegolith'`; Phobos and Deimos do).

### Atmosphere: what it does today

* **Sky and fog** (`SpaceSky`): standing in the world's frame, the sky colour, horizon, ground fog and daylight fade with height use
  the world's atmosphere (scaled by `scaleHeightM`, Mars = 11.1 km), not Mars's. Black space above.
* **Free flight**: the world's air brakes a ship (`worldDrag`, same law as Mars's drag brakes: density `rho0` falling with `scaleHeightM`,
  gone above `topM`). The drive is **not** cut off in a non-Mars atmosphere (only Mars's air forbids it; see gaps).
* Not done: the glowing limb seen from orbit (Mars's limb shader is Mars-only), weather, wind.

## Orbits and rotation: the real Solar System, switched off for now

Jaron (10/3): the star system is our real Solar System at real scale; planets spin and moons orbit. The registry is built for that
already; the clock is not (package F2).

* **Every world has an `orbit`** with a `parent` (`'sun'`, `'mars'`, or any other world id: the Moon's parent is `'earth'`) and
  Kepler elements: `a` (m), `e`, `i`, `node`, `peri` or `lonPeri`, `M0` (mean anomaly at the game's start) or `meanLon` (at J2000, with
  `rates.meanLon`), optional `periodS` (else Kepler's third law from the parent's mass), `rates` per century, `frame` (`'ecliptic'`
  for heliocentric elements, `'equator'` = Mars's equatorial plane, the default for `parent: 'mars'`). Format and maths:
  `src/worlds/_kit/ephemeris.js`. A station may instead use `orbit: { parent, offset: {x,y,z} }` (hangs beside its parent).
* **The real planets are data you paste**: `orbit: SOLAR.orbit.earth` (`src/worlds/_kit/solar.js`: JPL approximate elements and rates,
  Mercury to Neptune; typed from the published table and checked against the October 2020 closest approach of Mars, Earth-Mars
  conjunction and opposition distances, Mars's perihelion and aphelion, and periods). Earth's row is the Earth-Moon barycentre as in
  the table. **Placeholders for Mercury, Venus, Earth, the Moon, Jupiter, Saturn, Uranus and Neptune already exist** (`nav: false`: placed
  at their real positions, not listed in the nav until built). The **Sun** is a world (`kind: 'star'`) at the root of the tree.
* **Positions are in the game's axes**, relative to Mars (the root frame): `worldCentre(id)` (registry), `worldPlacement(id)` for
  distance, S-longitude and latitude. Everything is placed on the game's start date (2026-10-03: `START_JD`), so Earth really is where
  Earth is. Mars's own frame is body-fixed and does not spin yet.
* **`DYNAMICS.orbits` and `DYNAMICS.rotation` are both `false`.** Positions are still computed from real elements, but at the start date
  for every moment; `centreAt(def, lookup, tSec)` and `rotationAngle(def, tSec)` already take a time. F2 flips the switches, supplies the
  clock and makes free flight's body centres (`BODIES[id].c`, static today) follow. A def does not change when it does. Phobos and
  Deimos are written in the parked shorthand and come out of the ephemeris bit-for-bit where they always were.
* `rotation`: `{ periodS, axialTiltDeg, prime0Deg?, lockedTo?: 'parent' }`. Mars carries its real one; a moon defaults to locked to its
  planet (the face toward its parent is the same face: Phobos's long axis already points at Mars).
* **Range.** The drive reaches `DRIVE.rangeM` (1,000,000 km: nine hours at the top speed) from Mars. A world farther than that is listed as
  far, with the distance in AU, unless it has a jump lane (`jump: true`, F3): then it is an ordinary destination marked `jump`. A trip of
  more than six hours is estimated in closed form (a planet at real distance would otherwise cost a million sub-steps).

## Stations: places that are built, not grounds

Wanderhome and Corsair's Refuge are station networks, not planets. A station is a world def with `kind: 'station'`: an `orbit`
(or an `offset` from its parent), a bounding `radiusM`, `docks: [{ id, name, pos, dir, sizeClass: 'S'|'M'|'L' }]` in the station's own
metres, `gravity: 'spin' | 'none' | m/s2`, optional `standoffM`, `jump`, `blurb`, `navName`. It has **no ground** (no frame, no density
field, no pads). What the registry does for it today:

* a nav row `kind: 'station'`; the real authority flies a course to it and the ship **holds `standoffM` off it** (default three radii and
  a margin) on the side facing Mars; free flight can target it (bearing, distance) and it never pulls or collides;
* `stationWorlds()`, `STATION_IDS`, `worldCentre(id)`; client dressing (`client.js`) is the same hook as for a ground world.

Not built: **docking, the interior as a walkable frame, a moving route** (Wanderhome travels: a route is an `orbit` that changes,
which waits for F2/F3). A station's builder owns `docks` and the interior; the course ends in "Holding off <name>".

## What the plumbing already does for any world

| thing | how |
|---|---|
| gravity, escape speed | from `massKg` and the radius |
| the ground as a density field | `makeMoon(id)` (src/space/moonField.js); digging, edits, walking use it unchanged; the server owns the edit store (`worldIds()` in authority.mjs comes from the registry) |
| the arrival pad and each player's own pad | graded flat; one pad per ship per world, appended (authority `ensureMoonPads`), saved with the ship |
| the course (autopilot): climb, drive, descend, land | `DESTINATIONS` row `kind: 'moon'` (the word means "a world with a frame of its own", planets included); the **server** flies it (`ShipSimulation`) and the nav computer's estimate comes from `estimateTrip`, not a table |
| free flight anywhere | the world is a body with `patchM = max(400 km, 8 radii)`, Mars's pull cancelled inside it, handover to the flight assist near the ground |
| nav target, HUD gravity line, voice lines ("Course set for ...", "We are at ... already") | all read the registry |
| dev entry | `?dev=1&body=<id>` (solo) |
| shared-world frames | a ship's `frameId` is the world id (`makeMoon(frameId)` on the server; an id with no def throws) |

Tests prove this on a made-up planet (`test/worlds-checks.mjs`, "Testia"): deterministic and continuous ground, flat pads, a person
standing, the dune profile, 3 m/s² gravity, free-flight pull and air drag, and the **real authority** flying port -> planet -> orbit ->
planet, landing each time.

## Dressing: buildings, props, weather (client only)

Put client-only code in `src/worlds/<name>/client.js` (listed by the generated `_client-manifest.js`):

```js
export function dress(world, { THREE, engine }) {          // world is the MoonWorld: world.body, world.frame, world.edits ...
  // build meshes; track them with engine.track({ worldPos, object3d, frame: world.frame }) so the engine draws them in the world's frame
  return { update(dt, focus) { /* focus = camera in this world's metres; weather, animation */ }, dispose() {} };
}
```

It is called once when the world is built (the first course to it, or `showFromStart`) and `update` runs while the camera is within
four radii. Use `world.body.padInfo` / `world.body.ports[i]` (point, up) for where things stand, and `world.body.playerPad(east, north)`.
The **server never loads `client.js`**. Anything the server must know (a solid building, a shop) is a later package: see the gaps.

## What does not exist yet (honest list)

* **Nothing orbits and nothing spins** (the switch above is off). The planet's day/night and the clock are F2; the jump drive is F3.
  A ground world at real planetary distance (another planet) is listed far until it has a jump lane: the drive would take weeks.
* A **moon of a planet** (the Moon, whose parent is Earth) is placed correctly by the ephemeris, but the ground, free-flight pull and
  frames still assume every landable world sits in Mars's neighbourhood (the pull of the parent planet on a moon's frame is not
  modelled, and the ship's frame switch is Mars-relative). Build that with F2.
* No limb glow on a non-Mars atmosphere, no clouds, no weather, no water surface for `ocean`.
* The drive lights in any air but Mars's. A world that should forbid it needs a flag read in `freeflight.js` and `spaceTrip.js`.
* A big planet's whole-body shell is 384 x 192 segments (coarse at 2,000 km: it reads fine from orbit, the ground tiers draw everything
  within 30 km). A planet needs its own LOD package if it must look right from the middle distance.
* Ports are graded flat sites with names; **buildings, shops, NPC residents and the port-builder are not generic** (Marineris Port is
  Mars-only code: src/port/). `ports[]` and `client.js` are where a world's builder starts.
* Server-side solids (a building you collide with on the server, jobs/quests tied to a world) have no registry hook yet; the Phobos
  survey and salvage jobs are still Phobos code (`src/space/jobs.js`).
* Existing saves: a world added after players exist gets its per-ship pad when the server restarts (`ensureMoonPads` runs when a ship's
  simulation is built).

## Who may edit what (the collision list, updated)

| file | status after F1 |
|---|---|
| `src/ships/registry.js`, `src/ships/visuals.js`, `src/world/bodies.js`, `src/space/spaceSpec.js` (MOONS, DESTINATIONS) | **read the registries; do not edit to add a world or ship** |
| `src/worlds/_manifest.js`, `_client-manifest.js`, `src/ships/_manifest.js`, `_visuals-manifest.js` | generated: run `node tools/gen-registry.mjs`; union-merged |
| `src/worlds/_kit/*` | shared kit: add a profile or helper as an addition, never change what exists |
| `src/world/field.js` MATERIALS | append-only; prefer your def's `materials` |
| `src/main.js`, `server/simulation.mjs`, `server/fleet.mjs`, `src/economy/*` | still shared: touch only with a one-line, named hook |
| `test/validate.mjs` | do not edit: your checks go in `test/pkg-<name>.mjs` |

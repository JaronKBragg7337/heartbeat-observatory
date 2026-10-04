# The Cosmos

A space game built on measurement. Owner: **Jaron K. Bragg**.

Live: https://www.heartbeatobservatory.com/games/the-cosmos/
Local: `node server.js` → http://localhost:8378/
Validate: `node test/validate.mjs`

**World 3 (Oct 3): the Moon, three landings of one real body (WD-MOON).** Real radius, mass, gravity (1.62 m/s2), a day that is the Moon's own orbit round the Earth, and the ground read from NASA's LRO LOLA (our own 280 KB copy, `tools/bake-lola.mjs`): the real Shackleton crater (4 km deep, its rim lit most of the year, its floor never), the real Daedalus and the real Apollo 11 site with its descent stage, flag, plaque and footprints behind a rope. Ice is ground: in the permanent shadows (worked out from the heights) it is lunar ice, dug as itself and sold at the Fortis dock or, for more, at the hub. **Tranquility Civil Hub** (neutral: both blocs recruit there), **Shackleton Base** (Fortis: wall, gate seven, searchlights, barracks, armoury, fleet command, ice dock, rim power towers, a mass driver) and **Daedalus Station** (Technos Prime: a smart-glass dome, glass towers, the Embassy Ring, Fab Floor 2, dishes that turn, the Quiet Dish) are three worlds on one body, one lane gate from Mars and free hops between them. Thirty-six people stand in them, lettered and dressed by F0's faction styles, holding F5's seats, selling at the Moon's prices, with voices and jokes; Earth hangs in the sky (never over Daedalus). Hooks for the new opening: `src/worlds/moon/crash.js`, `dialogue.js`, `startWorld.js`. See [docs/MOON.md](docs/MOON.md) and [the QA review](docs/qa/2026-10-03/moon/REVIEW.md). Tests: `test/pkg-moon.mjs` (in validate), `test/moon-trips.mjs`, `test/moon-browser.mjs`.

**World 2 (Oct 3): Ceres, with Occator Works on it.** The first world beyond Mars's moons is a real dwarf planet: Ceres at Dawn's radius, mass and gravity (0.284 m/s2) and its real 9.07-hour day, a black sky and a Sun 0.19 degrees across, on its real orbit, with the Industrial Miners' station (Ironclad, bible v3) on the salt flats of Occator crater: a foundry, ore bins and a moving belt, a supply desk, a bunkhouse, the lane office, haul trucks, seven Loft people, a terraced open-pit mine (The Cut), rust-red ore seams and white sodium-carbonate salt you can dig. You get there across the Ore Lane: the nav computer plots Ceres, the drive flies to the lane mouth, the jump coils spool 20 cabin seconds, the fee is 120 credits, and the server owns every step. Ore and salt sell at the foundry or (better) the Marineris depot; the Occator supply desk pays about twice Mars's price for supplies. Greenhaven (the pair) is left to its own builder. See [the QA review](docs/qa/2026-10-03/world2/REVIEW.md). A world is data: `src/worlds/ceres/` (def, layout, outpost, people, trade, client); tests: `test/pkg-ceres.mjs`, `test/world2-trips.mjs` (both in validate).

Before any publish: node test/phone-check.mjs must pass.

**Worlds and ships are data (Oct 3, F1):** add a world by dropping `src/worlds/<name>/def.js`, a ship by dropping `src/ships/<name>/def.js` + `visuals.js`, then `node tools/gen-registry.mjs`; no shared file changes. Guides: [docs/ADD-A-WORLD.md](docs/ADD-A-WORLD.md), [docs/ADD-A-SHIP.md](docs/ADD-A-SHIP.md). Dev entry: `?dev=1&body=<world>`.

**Real time and sky (Oct 3, F2):** Mars turns (sol 24 h 39.6 min of real time), Phobos and Deimos orbit at their real periods, the Sun crosses the sky (day, dusk, night, stars, the apron floodlights), frames move and turn with their worlds, courses and free flight chase moving worlds, and every player reads the server's clock. Game time is real UTC, uncompressed; ship time compression runs the ship's own clock. See [ADD-A-WORLD.md](docs/ADD-A-WORLD.md) ("Orbits and rotation") and [the F2 review](docs/qa/2026-10-03/f2/REVIEW.md). `?sky=noon|dusk|night|...` picks an hour for review; a `?dev=1` session keeps the old fixed Sun unless `?sky=` is given. Tests: `test/pkg-f2-time.mjs` (in validate), `node test/f2-browser.mjs`, `node test/f2-sync-browser.mjs`.

**Starter ship and the big transports (Oct 3, SH14 and SH15):** five more ships, all data (`src/ships/<type>/`): the **Skiff** lifeboat (11 m, three stations, one hull and five world paints: Mars, the Moon, Ceres, Earth, Callisto), the **Ares** passenger transport (120 m, a 64 m promenade, 300 seats, a lounge with a panoramic window, a cafe, a medbay, a boarding hall, a hold and ramp), the **Kestrel** descent transport (66 m, two cabins, a boat bay with a stern ramp), and the two huge neighbours that fly beside them in the opening: the **Long Haul** ore train (240 m) and the **Line Marshal** escort cutter (44 m). `src/ships/transport/convoy.js` is the formation the opening places around the player's transport; `def.passengerSeats` lists every seat so the opening can sit people in them. Shared builders are in `src/ships/_liner/`. Livery is F0's `mars` style, read live. See [the SH14 review](docs/qa/2026-10-03/sh14/REVIEW.md) and [the SH15 review](docs/qa/2026-10-03/sh15/REVIEW.md). Tests: `test/pkg-sh14.mjs` (in validate), `node test/_sh-only.mjs`, and `node test/sh-browser.mjs` (the real game on a phone profile). Thumbnails: `node tools/render-ship-thumbs.mjs thumbs`.
**Roles, NPC stand-ins and the balance (Oct 3, F5 + F4):** every seat is a server-owned role: NPCs (with names, tempers and voiced lines, some of them assholes) hold it by the book until a human shows up, earns it, or is voted in; Mars stays NPC. Each settled world has a balance and a home strength that jobs and projects move and that prices, raider spawns and unlocks read. See [docs/ROLES-AND-BALANCE.md](docs/ROLES-AND-BALANCE.md). Tests: `test/pkg-roles.mjs` (in validate), `node test/roles-browser.mjs`.
**Faction style sheet (F0, Oct 3):** `src/factions/<id>/style.js` is the look of every faction, the Unbound, neutral Mars and the alien ship (palettes, materials, signs and emblems, uniforms on Loft people, architecture, ship livery, the jokes). See [docs/FACTION-STYLES.md](docs/FACTION-STYLES.md); review it at `?dev=1&styles=1`. Tests: `test/pkg-factions.mjs` (in validate), `node test/styles-browser.mjs`.

**Long-range drive (F3, Oct 3):** Earth, the Moon, Ceres and Callisto are reachable from day one, slowly: a closed-form flip-and-burn at real distances with its own time compression (x1 to x5400), server-owned, correct for moving targets, and the Ore Lane stays as the paid shortcut. See [docs/LONG-RANGE-DRIVE.md](docs/LONG-RANGE-DRIVE.md) and [the QA review](docs/qa/2026-10-03/f3/REVIEW.md). Tests: `test/pkg-longrange.mjs` (in validate), `node test/longrange-browser.mjs` (real server, phone), `node test/longrange-solo-browser.mjs`.

**Cargo (Oct 3):** the Drayman hauler (a ship class that is data, bought at the shipyard kiosk), rovers that drive up its wide ramp and lock into berths for flight, and player shops at Marineris Port. See [docs/WORLD-STATE.md](docs/WORLD-STATE.md) ("Cargo") and [the QA review](docs/qa/2026-10-03/cargo/REVIEW.md). Tests: `test/cargo-checks.mjs` (in validate) and `node test/cargo-browser.mjs` (two iPhone-profile WebKit phones).

**Round 7 (Oct 3):** the ground up close has real pebbles, boot prints that stay, and contact shadows (`src/world/groundDetail.js`); the port's side kerbs have walkable openings; the pilot strip, status box and nav sheet stack from the real status-box bottom (free flight too); one open candidate per crew post; the trip estimate no longer depends on the exact height of the standoff point; moon craters no longer end in cliffs at cell walls. See [the round 7 review](docs/qa/2026-10-03/round7/REVIEW.md). Tests: `node test/tap-browser.mjs`, `node test/ground-browser.mjs`, `test/round7-checks.mjs` (in validate).

The opening is implemented for new players. Returning players resume their saved world; unfinished openings resume their own progress. Shared multiplayer keeps each opening private and joins players into the shared world when it finishes. Desktop and phone controls use the same progression rules. See [world ownership and persistence](docs/WORLD-STATE.md) and [opening QA](docs/qa/2026-10-02/opening/REVIEW.md). This worktree is awaiting publication.

---

## The one rule this project is built around

**The planet comes first.** Not a test level that gets wrapped onto a sphere
later. Not a character controller written on flat ground. The planet's
coordinate frame, its real scale, and its material model exist before anything
stands on them, and everything else is built *into* that frame.

This is not a preference. It is the specific failure that ended the previous
attempt: a planet stored as one ground height per direction renders fine, and
can never contain a cave, because there is no second surface along that line.
Fixing it is not a patch — it is a rewrite of terrain, collision, the player's
feet, the ship's landing clamp, and navigation, all at once.

So the ground here is a **3D material field**:

```
density(p) < 0   solid rock
density(p) > 0   open air
```

A cave is not a special case. It is a region where the field went positive
underground. Verified: 2.7% of vertical rays through the crust pass through an
enclosed void, 13–352 m tall, under at least 45 m of rock roof.

---

## What is real

| | |
|---|---|
| Mars radius | 3,389,500 m — the actual number, not a compressed one |
| Gravity | 3.72076 m/s², inverse-square above the surface, linear below |
| Shape | Real oblate spheroid; the poles are 20 km closer in than the equator |
| Addressing | Every point has a latitude, longitude and altitude; round-trips to under 1 mm |
| Jump | 1.32 m measured against a 1.291 m theoretical apex — the same jump is 0.49 m on Earth |
| Strata | Regolith → duricrust → basalt, with ore veins, buried ice at real latitudes, and an unmineable mantle |

Sources and what could not be verified live: [docs/PROVENANCE.md](docs/PROVENANCE.md).

---

## Controls

**Phone.** The left half of the screen *is* the stick — it appears under your
thumb wherever you touch and vanishes when you lift. Nothing sits on screen
waiting to be used. Drag the right half to look; tap it to jump.

**Desktop.** WASD, shift to run, space to jump, mouse to look. `V` toggles
first/third person, `G` toggles the debug layer.

**Space.** Seated at navigation, pilot, captain or comms: tap **Course** (desktop `N`) to plot a course to Mars orbit, Phobos or Deimos; on a moon
the action button offers **Take core sample**, **Salvage** and **Stow** where they apply. See "Space travel".

**Free flight.** Seated at the pilot or captain seat, the **FREE FLIGHT** bar is on screen. Switch it on and climb above the air (100 km over Mars, 3 km over a moon): the ship is yours. Left thumb turns her (**RCS** makes it slide her instead), **THRUST** is held, **BRAKE** is held and turns her retrograde and burns the speed away, **ASSIST** points the nose at prograde / retrograde / the target for you, **TARGET** cycles Phobos / Deimos / Mars, **THR** is the throttle, **x5 ... x500** is time compression. Desktop: `W/S` pitch, `A/D` turn, `Q/E` roll, `Space` thrust, `C` brake, `J L I K U O` the jets. See "Free flight".

**Digging.** Look where you want to cut and tap the action button (`E`) to dig; hold it to put loads down (`Q` drops one).
**Drop all** (`R`) pours everything you carry as one heap on clear ground. Underground it tries your current floor, then clear ground by the connected hole mouth. The small
chip above the button (or `1` `2` `3`, or Settings) changes tool: hand spade, shovel, excavator bucket. The amber ring is
where the next bite goes (it lies on the surface you are aiming at and is as wide as the bite); the cyan ring is where the
next load will land. Look down for a pit, level for a tunnel, up for a ceiling. Normal walking steps up to 0.35 m. Face a reachable ledge and use **Climb** (`C` outside the ship): 0.35 s to brace, 0.85 s to pull up, maximum 1.5 m from the starting feet. Higher walls need a ramp you dig.

---

## The debug layer

Settings → **Dev / debug layer**. It draws:

- a latitude–longitude graticule painted onto the real terrain, so a grid line
  bending over a ridge tells you the ground's shape as well as its address
- a floating bubble over every registered asset showing its ID, coordinate,
  measured size, mass, collision type and material
- a readout of exactly where you are standing, plus a **Copy my position**
  button

That turns "there's a rock stuck in a hill somewhere" into
`COS-MARS-PRP-0042 @ mars:-14.0031,-59.1988,+1216.4` — an address, an identity,
and a reproduction step.

**The goal is to never need it.** `test/validate.mjs` is the first line of
defence and runs without anyone looking, covering placement,
collision, dimension drift, physics correctness, determinism, the ship, digging and spoil, the port and its tower.

---

## Layout

```
src/world/bodies.js      real measured worlds, every number sourced
src/world/geodesy.js     lat/long/alt on a real spheroid; the address book
src/world/field.js       the 3D material field — the world's actual truth
src/world/edits.js       the dug-and-dumped ground: a 0.1 m lattice in 3.2 m bricks, exact matter, spoil that settles
src/world/excavation.js  draws the lattice (brick meshes) and tells the heightfield tiers where to stand aside
src/world/planetMesh.js  pictures of the ORIGINAL geology: shell, three far tiers, mid and near
src/player/digging.js    the tools, where a bite lands, what you carry, where a load is put down
src/core/registry.js     stable asset IDs and measured records
src/player/walker.js     a body standing on a planet
src/ui/touch.js          the stick that isn't there until your thumb is
src/dev/debugLayer.js    graticule, ID bubbles, coordinate readout
src/ship/                the MSV Meridian: see "The ship" below
src/space/               leaving Mars: the sky, the drive, Phobos and Deimos, the jobs: see "Space travel" below
src/ships/               the fleet: ship definitions by type, the first raider class (src/ships/raider/): see "The fleet" below
test/validate.mjs        the checks that mean nobody has to go looking
test/ship-checks.mjs     the ship's share of them
test/dig-checks.mjs      digging, spoil, the drawn ground, walking in it, the tiers that tile the rest
test/port-checks.mjs     the port's share, including the control tower elevator and cab
test/leftovers-checks.mjs deliberate Climb, cached port workers and protected tunnel/mouth pours
```

---

## Digging

*Rebuilt 2026-10-01 by Claude Sonnet 5.5 after Jaron played it: "Digging is still broken. I was able to actually get deep but
the holes aren't wide enough plus just the placing and everything... it's just weird."*

The ground is a solid object you take pieces out of and put pieces back on, any direction you point. A bite has a measured
volume, that volume has a mass from the real density of what it cut, and that mass is in your hands or in a heap on the ground.

### How the ground works now

```
phi(p) < 0   solid       phi(p) > 0   open air        (field.js's sign rule, everywhere)
```

* **The changed ground is a lattice** (`edits.js`): signed distances 0.1 m apart in 3.2 m bricks, created only where somebody
  touched the planet. `density()` reads it; so do the collider, the ray caster and the mesher. A hole is the same hole to all of
  them and costs the same however many bites made it. (It used to be a list of spheres asked at every sample.)
* **Matter is exact.** A lattice point holds a fraction of solid, `content(phi) = clamp(0.5 - phi/0.1, 0, 1)`. A dig or a drop is
  a measured change in the sum of those, the lot is that change to the last bit, and `edits.fieldDeltaM3()` re-adds the whole
  lattice and must equal the ledger. Litres and kilograms both balance to zero.
* **Spoil settles.** A load is poured as a cone at the angle of repose (33 degrees, no free side steeper than 36) with a rounded
  tip, onto whatever surface is there: lawn, the lip of a hole, an earlier heap. The apex height is found by bisection until the
  heap holds exactly the lot. The next load pours onto the SAME heap, so it grows outward at the same slope; it is never
  stacked into a pillar. `dumpPlan()` puts it beside the hole on the side you stand, clear by the heap's own radius (wider if the
  hole is downhill of it), and starts a new heap round the hole when the old one would reach the rim.
* **Spoil is not bulked.** The old model made a dumped pile 25% bigger than the hole it came from. A lattice cannot hold a pile
  whose solid fraction differs from the ground's without a second field, and a second field is how mass goes missing when the heap
  is dug again. Spoil keeps the density it came out at; every lattice point carries its own density and material.

### Tools, aim, and getting out

| Tool (keys 1 2 3, or the chip above the button) | Bite | Lifts |
|---|---|---|
| Hand spade | r 0.09 m | ~3 L, ~5 kg: detail, corners, steps |
| Shovel | r 0.17 m | ~21 L, ~31 kg: the everyday bite |
| Excavator bucket (a machine, 48 t hopper) | r 0.70 m | 1.44 m3, 2-4 t: a hole you can stand and turn in, a tunnel you can walk upright |

The bite is a sphere centred half a radius INTO the material along the way you are looking (`digTarget` steps the look ray through
the field itself, not the drawn mesh). Look down: a pit. Level: a tunnel. Up: a ceiling. A walkable tunnel is two rows of
bucket bites; a person fits through a 1.4 m hole.

The hand tools load a **powered hauling cart**, rated at 400 kgf: **1054 kg on Mars**, ten times the old limit.
The bucket loads a **48,000 kg hopper**, four times its old bed capacity. These are fictional assisted transport ratings,
not human lifting strength; there is no cart vehicle model yet. The HUD always shows kilograms / capacity and a load bar.
A bite that would exceed capacity is refused before changing any ground, with a message offering Drop all or a single drop.

Drop all combines the lots (including their material composition) and calls the existing cone pour once. The heap planner
sizes its clearance from the entire load. It checks port pavement, structures, equipment and the moving ship, and the deposit solver checks every proposed lattice write before applying any of them. Underground pours start at the local floor and stop beneath its roof. If the load will not fit, the search follows connected cuts to a surface opening. Failed pours retain the inventory.
The ledger sums binary lot quantities as integers, so mixed single drops and whole-hopper pours balance to **exactly zero**
in both kilograms and cubic metres; the lattice itself is still independently audited at its existing floating-point precision.

### Distant terrain and browser review

The old 880 m patch ended about 440 m away, then jumped to a 128-segment planet shell with vertices about **166 km apart**.
There was no mesh capable of showing kilometre-scale hills in between. Fog at density 0.00016 also erased 92% of contrast
at 10 km. Three new field-sampled patches span **8, 64 and 320 km**; phone spacing is **125 m, 1 km and 6.67 km**.
Their outer edges blend into the actual coarser triangles, skirts close residual seams, and each coarse tier discards under
its finer neighbour. Fog density is now 0.000012 (94% contrast at 20 km, 38% at 82 km). Logarithmic depth supports the
distance range, including the 16-bit emulation. Climbing alone no longer rebuilds the heightfields.

Review locally with `?tier=low&terrainView=120` or `?tier=low&terrainView=1000`; add `&terrainBefore=1` for a shell/fog
comparison. These pause the player. Console: `cosmos.horizonView(1000, { before: false, yaw: 0 })`; yaw is radians,
zero faces north. `cosmos.freeCam.off()` returns to play. Original before screenshots, after screenshots, validator
output, browser checks and measured budgets are in [the carry/terrain review](docs/qa/2026-10-01/carry-terrain/REVIEW.md).

The field at Valles is **procedural geology, not a surveyed canyon model**. This change reveals the existing ridges;
it does not supply mapped canyon walls. Faint LOD transition bands remain. Phone GPU performance has not been measured
on physical hardware, and a large one-pour heap can pause the main thread (23 tonnes took ~0.8 s in Node).

The body is more than the feet (`walker.js`): four rings of probes and one over the crown keep it out of rock.
Normal walking has a **0.35 m** step limit; steep wall contacts cannot push it upward like a ladder. **Climb** (`C`,
or its separate phone button) requires grounded feet, a ledge in front, a clear body-sized landing and a clear route.
It braces for **0.35 s**, pulls up over **0.85 s**, and reaches at most **1.5 m from the starting feet**. Jumping is still
Mars gravity. A higher wall needs a ramp you dig; no ladder/tool system was added.

### How a hole is drawn (and what was wrong)

Found by walking it, 2026-10-01:

| Seen | Cause | Now |
|---|---|---|
| A big flat lighter "layer" over the hole, ringed by a seam; "paper-thin" ground | One mesh covered a box around EVERY edit ever made, so two digs 40 m apart made a 40 m box at 0.8 m cells; its sides were open; the heightfields could yield only in whole 0.6 m / 6.7 m quads, so a narrower hole was covered by the quad or left a ring of nothing | One watertight mesh per touched 3.2 m brick, built from the lattice (`meshBrick`). The heightfield tiers draw only the original geology and DISCARD per pixel under every built brick (a 3-D occupancy texture), stopping 0.15 m short of an open face so the two overlap and no crack can open |
| A hole "covered over again by this layer" after walking away and back | The mid-distance patch yielded round the NEAR patch, not round the dig | The discard follows the bricks, wherever they are within 90 m (56 m on the phone tier); beyond that the original ground shows and the bricks return when you do |
| A heap that was a "giant pillar" | One more sphere stacked on the last | Cone at the angle of repose, grown outward (above) |
| Heaps and walls in two chessboard colours | Material of the nearest lattice point | Decided over the eight points round the vertex, weighted by how much solid each holds |
| A pit that was black at 5 m | Ambient sky light came from the planet's +Y (nearly horizontal at the spawn latitude) | Sky light comes from local up, and rises with the depth below the original ground |
| Digging at spawn cut basalt (2900 kg/m3) | The graded apron exposed the bedrock the cut found | The apron is engineered fill: 1.2 m of regolith over duricrust |

The patch tiers were also re-sampled in one go (about 100 ms on a desktop for the wide one, every 13 m of walking): now only when
you have walked 250 m, and in 2.5 to 4 ms slices a frame.

### What the validator proves (sections 7b-7f, `test/dig-checks.mjs`)

A scoop's volume and mass are real and balance in litres and kilograms; the lattice re-added from scratch lost exactly what the lot
carries; a buried sphere of 0.5 m comes out at its true volume within 3%; the same dig is the same lattice bit for bit; every face
of the dug ground points out of the rock; every vertex lies on the field's zero surface; no crack between bricks (open edges: 0)
and shading agrees across seams; looking at the hole from above and from inside, the drawn surface is where the field says (8 cm,
312 rays); a hole shows its strata; every changed lattice point is under a brick the heightfields discard beneath, and ground
nobody touched is never discarded; a poured heap is low (height under 0.8 of radius), grows outward as ONE heap, stands no
steeper than 39 degrees, sits on the ground with no air under it, and the books balance; a dig-and-dump shift with the bucket gets
past 3 m and the spoil never refills the hole; you can stand in a pit and turn through a full circle without any part of you in
rock; walking cannot scramble out of a 1.8 m pit and a 3 m shaft remains a shaft; a bite aimed level goes into the wall; a tunnel can
be walked; aiming up finds the ceiling; the near and mid tiers together draw every point within 80 m; nothing within 60 m is
paper-thin.

### Known weak points

* Spoil over a hole is a cone about a vertical axis, so on a steep slope it runs further downhill than up; the heap planner
  accounts for slope but only roughly.
* Digging is spheres: no square-cut trench or flat floor, no digging while the machine moves, no ladder. A very deep shaft
  traps you (by design, until there is a ladder).
* Materials mix only by lattice point; a heap of mixed lots takes the lot's mean density, not a layered fill.
* The first dig into untouched ground creates a brick (about 12 ms on a desktop) and meshes it (about 11 ms); on a phone that
  is a visible frame. Not measured on a real phone.
* The regolith shader's normal-mapped streaks can read as stripes on a steep heap seen at a grazing angle.

## The ship

*Built by Claude Sonnet 5.5 on 2026-09-29.*

**MSV Meridian** (`COS-MARS-VEH-0001`) is a 46-tonne gunship, 49 m long and 24.5 m across the wings, landed
at Marineris Port. You walk up its boarding ramp, through
its rooms, sit in its seats, and fly it off the real planet. It is the same Mars: real 3.72 m/s^2 gravity,
the same drawn ground for landing legs and bolts as for boots.

### What is aboard (every dimension is in `src/ship/shipSpec.js`)

Human scale throughout: 1.78 m avatar, 2.7 m clear deck height (3.0 m deck pitch), 1.0 x 2.1 m doors, 1.6 m
corridors, stairs at a 0.1875 m riser.

| Deck | Rooms |
|---|---|
| **Upper (y = +6 m)** | Bridge with raked canopy: captain's chair on a dais, pilot and navigation consoles, comms station, holo table. Dorsal turret nest (above the hull deck, reached by ladder). |
| **Main (y = +3 m)** | Corridor with handrails, conduits, extinguishers and first aid. Medbay (2 beds, scanner arch, monitors). Crew quarters A and B (4 bunks each). Galley and mess. Captain's cabin with an en-suite head. Workshop. Turret ladder niche. The corridor runs straight to the cargo door at its aft end and up a stair to the bridge at its fore end. |
| **Lower (y = 0)** | Engineering (reactor core, coolant tanks, pumps, racks, the engineering station). Cargo bay (crates, drums, a six-wheel rover, the boarding ramp, and the way up to the main deck: a stair up the west wall to a gantry along the fore wall, with the corridor door at the gantry's end). Airlock with a cycling inner and outer door and a lowering gangway. EVA locker with suits. Ventral turret access, hatch and ladder down into a glass-floored pit. |

Real stairs and ladders: you walk up the stair (a smooth ramp under closed-riser treads); you climb a ladder
by walking into it. Sliding doors open as you approach; airlock doors only when the airlock says so.

### Seats are how you use the ship

Walk up to a seat and the contextual button offers **Sit** (`E` on desktop). You cannot use a station unless
you are sitting in it; **Stand** (`E`) lets go, and the flight computer holds a hover.

| Seat | What it really does |
|---|---|
| **Captain's chair** | Flight **and** the main guns (twin chin cannons, gimbal +/-28 deg, aimed where you look). |
| **Pilot** | Flight: lift, thrust, turn, land. |
| **Navigation** | A live terrain scanner (hillshaded map of the ground around the ship from the real field, 0.6 / 2.5 / 9 km), your lat/long/elevation/heading, the nearest landmark, and contacts. |
| **Communications** | The ship log (real events, timestamped) and a beacon. Honest: Mars has no relay network. |
| **Engineering** | Routes 100 reactor units between engines, guns and shields. It changes real performance: engine share sets lift and drive thrust (below ~19% the ship cannot leave the ground), gun share sets rate of fire and damage, shield share sets the shield cap and recharge. |
| **Dorsal / ventral turrets** | Aim by looking, fire twin barrels. Only from their own seat. |

**Controls (flying by hand, FLIGHTFEEL, 10/3).** A person at the pilot's or captain's stick flies in **ASSIST** by default (`src/ship/flightAssist.js`): point and go.
The stick says where you want to be going and the flight computer gets her there; let go and it kills the drift and holds a hover. There are no low caps:
speed, climb and agility **scale with height** (about 50 m/s with the legs on the ground, 400 m/s at 1 km, 1.8 km/s at the top of the air, 6 km/s in space), so she is a
hover-car near the ground and fast in the air. A **boost** (a charge that drains in about 5 s and refills in about 9), a nose that **eases back to the horizon**
and is held near level close to the ground, **terrain following** (she climbs over rising ground ahead), and a **landing assist**: hold DOWN low, or tap LAND, and she sets
down softly from any height (a pad within 150 m pulls her in, slow and low with nothing asked she settles by herself). A push on the stick on the pad takes her off.
The **NEWTON** chip is the expert's mode: the stick is thrust at the engines' real rated numbers, she keeps whatever speed you give her, nothing brakes or lands her
(the hover trim still carries her weight). The power split still decides whether she flies at all (below ~19% engines she cannot lift, by hand either).
Free flight (the **FREE FLIGHT** bar) is the other, orbital, Newtonian system and is unchanged. Autopilots (a course, a crew pilot, an escort) fly the old law.

*Phone:* the invisible left-half stick (up = go, sideways = turn), a drag on the right half steers the nose (yaw and pitch), **UP / DOWN** and **BOOST** buttons (the boost
button fills with its charge), chips **ASSIST / NEWTON**, **CHASE / COCKPIT** and **LAND**, and a strip that reads speed, height and vertical speed. The camera rides behind
and above the hull in CHASE, trails further back the faster she goes, the field of view widens, and streaks of dust (stars in space) stream past.
*Desktop:* `W/S` go, mouse or `A/D` steer, `Space` up, `C` / `Ctrl` down, `Shift` boost, arrows slide, `L` land, `R` hold the nose where it is, `V` view, `M` mode, click or `F` fire, `E` sit / stand / use.
The authority validates intent only (clamped levers, a boost flag, a mode name: never a position or a speed) and runs the same law the browser does; see `test/flightfeel-checks.mjs`
and `docs/qa/2026-10-03/flightfeel/REVIEW.md`.

### Real people, and hiring a crew (src/crew/)

Every person is a real person: the Loft's MetaHuman people (`homes/people/*.glb`, Idle / Walk / Sit) are loaded through
`personRig.js` and are your third-person body (the one you picked in the Loft, `hb-look`; Isaiah by default) and the crew.
On the live site they are read from `/homes/people/`; `server.js` serves the same path locally.

**Marineris Port.** Five people wait by the hiring board near the Meridian's ramp: a **pilot** (Ada), **captain** (Zuri),
**navigator** (Jorge) and a **dorsal** (Sunita) and **ventral** (Walter) gunner. Walk up (the **Talk** button, or `T`), read what
they are, **Hire**. They work at 70-85% of a good hand (reaction delay and aim error come from that, `crewSpec.js`). A hired
person walks up the ramp, the cargo-bay stair, the gantry, the corridor, and up the bridge stair or a ladder, sits at their
station (the route is planned over the same walkable zones your own body uses, `shipPath.js`) and works while you walk about.
The ramp has to be down for them to board. Where you sit, they give up the seat; stand and they sit back down. **Dismiss** at the port.

**Orders.** Talk to whoever is flying (the pilot, or the captain if there is none): **Fly to** (the three pads, the depot
apron, over the tower; places too far to reach at 40 m/s are listed with honest distances and refused), **Hunt hostile drones**
(Mars is neutral: the pilot climbs out of its airspace first, closes on raiders, the gunners shoot only raiders, and the pilot breaks
off and comes back under the line if the hull falls below 35%), **Get supplies** (depot apron, load, back to pad 01), **Roam and explore**
(low flying; the navigator calls out ridges, drops and cuts), **Land here**, **Hold position**, **Return to port**. Touch the stick in
the pilot's or captain's chair and the order is cancelled ("You have the controls"). The crew will not lift off unless you are aboard.

**Looking out.** Crew quarters B is now the **observation lounge**: a 4.4 m panoramic window, two seats facing it, and binoculars on a
stand at the glass (the action button: 3x zoom, look slows to match; walk away and they come down). Every window now cuts the hull
skin away in its opening, so a window shows Mars and not grey plating. The ventral gunner no longer sees their own chair when
looking down through the glass.

### Flight, guns, shields

* **Real gravity**: 171 kN of weight on Mars against 300 kN of vertical thrust at the default split. The
  flight computer holds a hover when you let go, flares the last metres of a landing from the height of the
  feet, and folds the ramp before it lets you lift.
* **The person stays on the deck.** Everyone aboard lives in a **ship-local frame** (`shipWalker.js`): their
  position is a point on the hull, and their world position is *derived* every frame as
  `ship.position + rotate(ship.orientation, local)`. Deck plating carries its own gravity, so the floor is
  always down while the hull leans, banks and lifts. The planet walker (`walker.js`) is untouched.
* **Guns**: bolts inherit the ship's velocity and stop at the drawn surface (impact dust, sparks, scorch
  marks). Three practice targets stand ahead of the bow.
* **Mars is neutral, so there are no drones in its airspace** (Jaron, 2026-10-01: they should STAY, but Mars is the game's
  neutral planet). Three hostile drones exist only beyond `NEUTRAL_AIRSPACE_M` (1500 m above the ground, one named constant
  in `guns.js`, with a 100 m margin so riding the line does not flicker). Climb through it and the HUD says
  "Leaving Mars neutral airspace. Hostile contacts inbound.", the raiders arrive at the edge of sight and fire slow bolts at where
  the ship will be; the shield takes the hit first (a ripple spreads from the impact point), what is left goes to the hull, and a
  battered hull gives up thrust. Come back under it ("Entering Mars neutral airspace") and they break off and are gone, and not
  one more bolt flies. Below the line nothing fires at the ship however low and however long it flies. (The "two things flying
  around" Jaron saw from the ground were the old patrolling drones; they no longer exist down here. The drone is now a ducted
  quad-rotor with a twin cannon; `cosmos.drones().debugPose(i, worldPoint)` places one for review shots.)

### What the first real phone showed (2026-09-29) and what was done

Jaron played it on an iPhone. Five things, and their causes:

| Seen | Cause | Fix |
|---|---|---|
| Walls and stairs breaking into flickering white blocks | Not the depth range: **two faces written on exactly the same plane** (the old engineering stair's step boxes and the wall quad beside them; every tread plate over its box top). It reproduces on a desktop; a 16-bit phone buffer only makes the blocks bigger. | The stair is rebuilt with one riser and one tread per step. Then a general fix: `resolveDepthLayers` (shipKit.js) finds every pair of flat faces within 3 cm of the same plane, gives the one that should win a small layer number, and the vertex shader pulls layer-n faces n depth-buffer steps toward the camera. The step is read from the real buffer's bit count. About 2,800 faces carry a layer, maximum 3. |
| The room you just walked through, or the corridor ahead, replaced by raw Mars | The phone tier drew "your room and its neighbours". A room two open doors away was skipped, the sliding door leaves and the stair block were filed under a room that was skipped, so they vanished with it. | shipVisibility.js: a room is drawn when a chain of open, in-view (or within 3.4 m) openings leads to it. A shut door hides what is behind it. Door leaves, stairs and ladders belong to the ship and are drawn when either room they touch is drawn. At most 8 rooms are ever drawn. |
| Walking "through" the stairs | The old engineering stair was a solid block standing in engineering; its walls were one-way (no inward face, so from the stair you looked straight out into engineering) and the block disappeared with the corridor. The collision itself was already solid: nobody could stand in it. | Inward walls, and the block is drawn with the room. The validator now proves nobody can walk into a stair's side. |
| Driving covered by things | The flight consoles' screens ended at 7.5 m, across the horizon; the phone's station panel took a quarter of the screen. The dorsal turret was a closed box with glass drawn over solid wall, and the ventral pit was a shaft of panelling. And the top of the bridge stairwell stood out of the hull, so looking down it you saw the hull's own roof plate. | Low consoles (screens end just under the seated eye), a one-line flight strip on a phone, a nest with a waist-high parapet and real glass on four sides, a swivelling gunner's chair, an open glass ventral pod, and an armoured saddle over the stairwell. |
| "It depends how far you stand" | The same culling and the same coplanar faces. Lights: a phone pools four, so its ambient is a little higher. | As above. |

`?depth=16` (or `?depth=12`) makes every standard material round its depth to that many bits, so this class of
fault can be reproduced on a desktop. `cosmos.depthBits` reports what the device really gave.

### The stairs (changed 2026-09-30)

The first layout put the way between decks at the aft end of the main corridor: a stair 1.6 m wide and 4.5 m long
that filled the whole end of the corridor. Its top step sat beside the workshop and cabin doors, its foot stood 0.5 m
in front of the cargo door in engineering, and the one-way side walls and a 0.3 m gap beside its lowest steps made
it a block you could only squeeze round. Jaron: "right in the doorway, and also blocks a room".

Now there is exactly one stair between the main and lower decks and it stands in the biggest room on the ship: the
**cargo-bay stair** runs up the west wall (x -5.6 to -4.0, 16 risers of 0.1875 m) to a **gantry** at main-deck height
along the bay's fore wall. A door at the gantry's end opens into the main corridor, which now simply runs to that
door. The engineering door to the cargo bay moved to x = +3.4, so the way into engineering is beside the gantry,
not under it. The bridge stair is unchanged (its two ends are its own doors). The validator checks that no stair
stands within 0.6 m beside or 1.0 m in front of any door but its own, that nothing solid stands in front of any
door, that the foot of the cargo stair has a clear landing, and that nobody can walk off the gantry's open edge.

Also found by walking it (2026-09-30): every door frame was filed under one of its two rooms, so when that room was
not drawn the frame vanished and the wall opening showed the sky; there was a 0.2 m slot in the floor at every
doorway; each door leaf left a 1 cm slit above and below; the airlock hatch had no frame; the bridge stair arrived 0.6 m
from the captain's dais; and a roof plate and the hull's own deck plate cut across the bridge stairwell. All fixed
(door frames are one set on the ship's root with threshold plates, leaves overlap floor and lintel, the dais moved
0.6 m fore, the hull plate is cut away over the stairwell). `cosmos.auditGaps([...rooms])` (src/dev/gapAudit.js) draws
the interior alone on magenta from many viewpoints and counts holes; it now reports none in any enclosed room.

### How it is built

```
src/ship/shipSpec.js      every measurement: rooms, doors, stairs, ladders, seats, props, lights, gear, guns
src/ship/shipWalker.js    ship-local walking: zones, stairs, ladders, ramps, furniture (pure, tested in Node)
src/ship/shipFlight.js    thrust, gravity, landing gear springs, power split, shields (pure)
src/ship/shipStations.js  the one rule: no station unless seated in its seat (pure)
src/ship/guns.js          bolts, drones (pure)
src/ship/shipSite.js      picks the flattest ground in sight (pure)
src/ship/shipVisibility.js which rooms can be seen through which openings (pure)
src/dev/depthEmu.js       ?depth=16: pretend the depth buffer is 16 bits deep
src/ship/shipInterior.js  walls, floors, doors, stairs, ladders, signs, posters from the spec
src/ship/shipProps.js     furniture and machinery
src/ship/shipExterior.js  the lofted armour hull, wings, gear, guns, engines
src/ship/shipKit.js       merges primitives into one mesh per material
src/ship/shipTextures.js  every texture painted in code (metres, not pixels), PBR materials
src/ship/shipScreens.js   the lit screens and the terrain scanner
src/ship/shipSystem.js    build, board, fly, camera, lights, ramps, airlock, per-frame order
src/ship/shipUI.js        the station controls that appear when you sit
src/ship/shipAudio.js     synthesised engines, guns, doors
test/ship-checks.mjs      section 9 of the validator
```

* **Two scenes, one depth buffer.** Nothing in three.js lets an object ignore the world's lights, and no sun
  reaches inside a hull. So the interior is a second scene with its own lights, drawn after the world into the
  same depth buffer (`Engine.overlayScenes`). Walls occlude terrain, the canopy glass shows it.
* **Phone budget.** Geometry is merged (about 7 draw calls a room); on a phone the tier drops to four pooled
  point lights, smaller textures, no shadow map, and only the rooms within one door of you are drawn. Desktop
  adds one shadow-casting spot over whichever room you are in. `?tier=low` forces the phone tier.
* **No downloads.** All textures, geometry and sound are generated in code. Nothing to license.

### What the validator proves (section 9, 55 checks)

Human scale; no overlapping rooms or furniture; every room, seat and ladder reachable **on foot** by the
real walker (flood fill, plus actual ladder climbs, stair walks and door crossings); 9,000 frames of random
walking never end inside a wall; every station command refused while standing and each seat unlocking only
its own; a standing person keeps the exact same deck coordinates through lift-off, cruise, banking and turning;
free fall at 3.72 m/s^2; 300 kN lifts 171 kN and below ~19% engine share it cannot; landing under control with
all four legs carrying load and the keel in open air and feet on solid ground in the 3D field; bolts land on the
surface to within 5 cm; a shield spends first; drones ignore a parked ship and hit a hovering one; every room
fits inside the hull with 8 cm to spare; ship and all seven stations register with stable IDs and measure
within 5 cm of their design size.

### Known gaps

* **Verified in a desktop Chromium emulating 375 px, not on a real phone.** Frame rate, heat and the audio
  autoplay rules on iOS are unmeasured.
* The interior and exterior were tuned by eye in screenshots; some props are simple. Six rooms have real windows.
* The hull is a solid shape: legs and the keel touch the ground, but a wing or the nose can pass through a
  hill you fly into.
* The airlock's outer hatch is a lit recess on the hull, not a hole cut through the plating.
* You cannot leave the ship while it is off the ground (no EVA). Low flight is still atmosphere scale (cruise 40 m/s,
  climb 12 m/s); leaving Mars is the nav computer's job (see "Space travel").
* Terrain around a fast-moving ship is rebuilt by the patch system in 2.5-4 ms slices (it no longer freezes a frame),
  but a ship at 40 m/s outruns the near tier's 13 m margin on a slow device.
* One ship, one player, no persistence or multiplayer.

## Space travel

*Built by Claude Sonnet 5.5 on 2026-10-01 (branch `cosmos-space`). Review pictures and the walk-through notes:
[docs/qa/2026-10-01/space/REVIEW.md](docs/qa/2026-10-01/space/REVIEW.md).*

The Meridian leaves Mars. Climb out of the air under the lift pods, light the main drive above it, cross to Phobos or
Deimos at their real distances, set down on a surveyed pad, walk, hop, dig, take samples, fly home and be paid.
There is no loading screen anywhere: the same frame loop runs the whole way.

### How you do it

| You do | What happens |
|---|---|
| Sit at **Navigation**, **Pilot**, **Captain** or **Comms**, tap **Course** (or press **N**) | The nav computer's sheet: Mars orbit, Phobos, Deimos, the port, each with its distance and flight time from where you are *now* at the present engine share. The home worlds of the bibles are listed greyed out ("needs a jump drive"). |
| Tap a destination | The ship lifts (the ramp folds first, as always), climbs, burns, turns over, brakes and lands. Any seat, or none: the computer flies it; you can walk the ship the whole time. |
| Talk (**T**) to the hired pilot -> **Fly to...** | The same list, under "Other worlds". The pilot says what he or she is doing. |
| Tap **x5 / x20 / x60** (nav sheet, or the **pilot's Talk panel** while a hired pilot flies) | Time compression for the climb, the burn and the landing. Near the ground it is held down by a cap (x4 under 1.5 km, x1 for the last 400 m); the flight model still sub-steps at 1/120 s, so every contact check is exact. The panels list each phase (climb, drive, descent) with its real time left. The cabin, the crew and the doors keep real time. |
| **Cancel course** | In transit the computer brakes to a halt and the ship holds where it stopped. In the climb below the air it is refused above 60 m/s: the lift pods only push up. |
| Touch the stick in the pilot's or captain's chair during the climb or the descent | "You have the controls": the course ends and you fly. |

### The flight, in numbers (all in `src/space/spaceSpec.js`)

* **Lift pods to the gate.** Straight up on the flight assist (climb cap raised to 1.5 km/s above 200 m). 120 km takes
  4.8 minutes and ends at about 840 m/s. Weight falls with the real inverse square all the way (it is 93% at 120 km).
* **The main drive** (twin engines, 600 kN at full share) is vacuum-only and lights at the gate, 120 km up. Acceleration
  is `600 kN x engine share / 46 t` = **13 m/s2** at the default 40% share, and **engine share is the drive**: route power in
  Engineering and the trip changes (20% share: 41 min for Phobos; 80%: 25 min). Thrust acts **only along the nose**, the hull
  turns at 0.12 rad/s (a turn-over takes 26 s), and thrust is scaled by how well the nose is lined up, so a ship that has not
  finished turning is not pushing hard.
* **Flip and burn** (`src/space/transit.js`, pure, flown whole in Node by the validator): burn toward the point, follow the
  braking envelope (the fastest speed from which the ship can still stop, after the turn-over it will have to make), turn over
  once and commit, brake, and finish on the manoeuvring jets within 2 m of the standoff point at rest. If the line would pass
  through Mars (a 60 km safety shell) the course is two legs, each a full stop. Mars's pull is ignored in transit (stated, not hidden).
* **Real distances.** Phobos 9,376 km from Mars's centre, Deimos 23,459 km (NSSDC). From the gate: Phobos 7,667 km,
  **about 30 minutes** at x1 (peak 9.3 km/s) plus 5 for the climb and 1 for the landing; Deimos 20,583 km, **about 53 minutes**
  (peak 15.6 km/s). x60 makes Phobos a 90-second skip. Nothing is cut: the cabin is an ordinary walkable ship all the way.
* **Time compression is not a different flight.** The trip is integrated in sub-steps of at most 0.25 s of ship time, so x60 and
  x1 arrive within 2% of each other (a check).
* **Raiders** (the drones) keep Mars neutral below 1.5 km. Beyond it they attack, in the climb, in Mars orbit and over the moons
  (not while landed). They cannot keep up with a ship doing km/s: during a transit they are not there, and they come again when it slows.
  Each one brought down outside neutral space pays a bounty through a hook (below), including the crew gunners' kills.

### Frames: how the ship leaves one world and stands on another

A moon's field, walker and digger all take coordinates with the moon's centre at the origin (`digging.js` and `edits.js` are
unchanged). So the engine has **frames**: translated copies of Mars's body-fixed frame (axes parallel). One is *active*; the camera,
the ship, the walker and the drones live in it. Anything else is drawn at `worldPos + its frame's origin - the active origin -
the camera`, all in f64 before the GPU ever sees a number, which is why 23,459 km from Mars is as precise as the pad
(a check proves a 0.1 m offset survives where float32 subtraction would lose it). The camera far plane is 1e9 m on the same
logarithmic depth buffer; the Sun disc sits at 3e8 m. A frame switch happens only when the ship is hovering or just stopped
(transit is always in Mars's frame), so no velocity is ever touched. `cosmos.space.frameId` says which one you are in.

### Phobos and Deimos (`src/space/moonField.js`, `moonWorld.js`)

* **A volume, like the planet.** `density = |p| - R(direction)`: a real triaxial ellipsoid (Phobos 13.03 x 11.40 x 9.14 km semi-axes,
  NSSDC; NASA says 27 x 22 x 18 km across, fetched 2026-10-01) with a lumpy departure from it, craters at nine scales from 4 km to
  16 m (deterministic hashing, no `Math.random`), 16 broken grooves parallel to the long axis, regolith roughness, and **Stickney** (9 km
  across, 1.7 km deep, with a rim and an ejecta blanket). Deimos has the same machinery with half the craters, smaller cells and
  a third of the roughness: NASA's 100 m of regolith is why it looks smooth, and the validator measures that it is.
* **Real gravity from real mass.** 0.0056 m/s2 on Phobos (G M / R2 of the NSSDC mass, a check), 0.0026 on Deimos; escape
  velocity 11.2 and 5.6 m/s. A jump at 3 m/s would be a 15-minute flight, so a push-off on a moon is 0.6 m/s (a 32 m, 3.5-minute
  hop, measured within 12% of the formula). The walker was changed in one place for this: rising at more than 2 cm/s is a jump, not
  a bump to stay glued to (on a moon a jump leaves the ground at less than the 4 cm a frame the snap reaches).
* **Digging works because it is the same ground.** Phobos regolith 1150 kg/m3 over rubble at 1860, deeper; the bucket, the
  hopper, the heap at the angle of repose and the books balancing to the last bit are the planet's own classes (checked on Phobos).
  A hauling cart is rated 400 kgf by inertia, so its capacity is held at the Mars figure, 1,054 kg.
* **Drawn the way Mars is:** a whole-moon shell (184 m between vertices; phone 270 m) and three tiers under the camera (8 km,
  880 m, 48 m; 62 m / 6.7 m / 0.6 m between vertices) with the same per-pixel handover, plus the dug-ground brick meshes. A moon has
  no air, so Mars's dusty fog is switched off on it (otherwise Phobos from the port is a washed-out disc).
* **The pad.** `Stickney East survey pad` is a real plane in the field (flat to 5 cm within 55 m, perpendicular to local up, in
  regolith) with a painted disc and four lamps. Both pads are in sunlight (a check).
* **Parked, not orbiting.** Mars does not spin in this build, so each moon is parked over a fixed spot of the sky at its real
  distance: Phobos 19 degrees above the port's horizon, Deimos higher. Phobos is tidally locked, so the face you see is the real face
  toward Mars; the missing part is its 2.1 km/s orbital motion. The Sun is the one world direction the spawn's mid-morning sun
  always was (a check); it blends from the ground game's local sun to that world direction between 20 and 80 km up.

### The sky (`src/space/spaceSky.js`)

Nothing changes on the ground: below 6 km the blend is exactly 1. Above it the dusty daylight sky thins with a 14 km scale and is
gone by 100 km: background, fog, ambient and the Sun's strength follow. The star dome is procedural (three star layers, one hash
per layer per pixel, and a mottled Milky Way with dust lanes; no texture download). Mars's limb is an atmosphere shell integrated
along the view ray (dust warm and low, gas faintly blue and higher). The Sun is a hot disc and a wide glow. Mars gets polar caps and
planet-scale dark and bright provinces (waves thousands of kilometres long, so walking-scale ground barely changes) and its whole-planet shell is
now 288 x 144 (phone 192 x 96) so the limb from orbit is not faceted. The ship's reflections of a dusty sky are turned down with the sky.

### Reasons to go (`src/space/jobs.js`)

1. **Survey (played end to end).** The Marineris Survey Office pays a standing 300 credits for each Phobos core sample, up to three. Fly to
   Phobos, walk to the cyan beacons (184 m, 680 m, 1.29 km from the pad), tap **Take core sample** at each (a real spade bite, sealed as
   cargo), fly home, land at the port: **paid 900 credits**, automatically (no accept button, no hand-in button).
2. **Resources found only off Mars.** Dig Phobos regolith, or the hydrated-clay pockets under the Stickney ejecta (**game fiction**,
   marked as such in the material record: water-bearing clay is a hypothesis for Phobos, not an established fact). Walk within 38 m of the
   ship and tap **Stow**: the hopper's lots move into the hold as matter (the ground's books still balance) and the cargo hook is told the kilograms by material.
3. **A distress call.** Landing on Phobos, Comms reports a beacon about 800 m south-west of the pad: a drifting cargo module
   (plated, dogged door, broken hazard stripe, scorch, a blinking lamp). Walk up and **Salvage**: 1.8 t of alloy plate comes aboard and a 150 credit claim is paid, once.
4. **Raiders.** 25 credits each outside neutral space (above), in orbit and over the moons.

### The hooks for money (the economy / port builder wires these)

`cosmos.space.hooks` (defaults keep a tiny local ledger, shown on the Jobs tab, so the loop works before the economy is wired):

```js
space.hooks.award(credits, reason)          // survey payout, salvage claim, raider bounty
space.hooks.addCargo(item, kg, meta)        // sample canisters, phobos-regolith, phobos-hydrated-clay, salvage-alloy, deimos-regolith...
space.hooks.removeCargo(item, kg)           // samples delivered
space.hooks.onArrive(destId)                // a trip ended (a quest event)
space.hooks.cargoKg(item)                   // what the hold has
```

Pass your own in the `SpaceSystem` options (`hooks: {...}` in `main.js`), or assign over them at runtime. Item names are plain strings; prices are not set here.

### Files

```
src/space/spaceSpec.js    the numbers: drive, moons (NSSDC / NASA), destinations, the Sun, bounty (pure)
src/space/moonField.js    a moon as a field.js body: ellipsoid, craters, grooves, strata, the pad, loose rock on Phobos, sample sites (pure)
src/space/transit.js      the drive: flip and burn, braking envelope, legs round Mars (pure)
src/space/spaceTrip.js    one journey: lift, ascent, transit, settle, descent; what the ship says
src/space/spaceSystem.js  frames and the switch, destinations, hooks, the per-frame sky/moon update
src/space/moonWorld.js    a moon's shell, tiers, dug-ground meshes, ground samplers
src/space/spaceSky.js     the sky, stars, Sun, Mars's limb
src/space/jobs.js         samples, stow, salvage, bounty, the markers on Phobos
src/space/hardware.js     the survey beacons and the drifting cargo module (panels, latches, damage, decals, lights)
src/space/spaceUI.js      the nav computer's sheet (Course / Jobs)
test/space-checks.mjs     sections 12-17 of the validator; test/_space-only.mjs runs just those (7 s)
```

Small edits elsewhere, each marked in place: `core/engine.js` (frames, far plane), `world/field.js` (one edit store per body, a
body may supply its own field, the moon materials), `world/planetMesh.js` (moon colours, Mars's albedo), `world/regolith.js` (a pebble
strength), `player/walker.js` (the jump rule), `ship/shipFlight.js` (climb cap, override, attitude, vacuum descent), `ship/shipSystem.js`
(the trip's controls, HUD, telemetry), `ship/guns.js` (raiders suspend, the bounty event), `ship/shipUI.js`, `crew/crewSystem.js`,
`crew/crewUI.js`, `dev/debugLayer.js`, `main.js` (wiring blocks, Mars's ground only updated while Mars's ground is near).

### What the validator proves (sections 12-17, 59 checks)

The moons' numbers against the published ones (gravity from mass, escape velocity, orbit period from Mars's pull); the field's sign
rule, its exact surface solve against ray marching, its determinism; Stickney's depth; strata and clay; the pad flat to 5 cm; Deimos
smoother than Phobos; a person running 90 s on Phobos stays on the ground and out of the rock; the hop against its formula; digging on
Phobos and the books; the ship resting on four legs on 0.0056 m/s2, lifting off, and landing softly on the vacuum descent; the climb from
Mars's pad to the gate under the lift pods alone; whole trips to Phobos and Deimos arriving within 2 m at rest, in the right order of phases,
thrust only along the nose, the turn rate respected, never near Mars, the far side of Mars routed round, engine share changing the trip,
cancelling brakes to a stop; frame shifts and f64 round trips; the sky blend; raiders suspended for a transit and returning; the bounty
paid once; samples as real lots; stowing; the survey payout once; the salvage once.

### What this does not do (and what could not be verified)

* **Verified in a desktop Chromium on software rendering (SwiftShader), at 1280x720, 750x470 and 390x844, on the phone tier
  (`?tier=low`) and the high tier, not on a phone.** Frame rate, heat, memory and GPU cost of the star dome (about 4 hash evaluations a
  pixel plus noise in the Milky Way band) and of the atmosphere shell are unmeasured on a real device.
* **No orbital mechanics in a course.** A course is a commanded flip and burn, not a Kepler orbit (free flight, below, is: real gravity, coasting, a tank). The moons do not move. Mars does not rotate.
* **Mars's pull is ignored in transit; the drive's thrust is the Meridian's own number** (fictional). Distances, sizes, masses and gravity are real.
* **Cosmetic:** a faint dotted outline can show where the 8 km tier meets the whole-moon shell when you look down from a few km. Phobos
  carries loose rock in the density field off the pad (mounds, boulders, stones), and crater floors are darkened in the vertex colour
  where a rim blocks the sun. The sun's shadow map still only covers about 120 m round the camera, so a rim beyond that does not cast a
  live shadow. Deimos is still the smooth one.
* **No persistence and no server:** a refresh puts you back at the port, the moons forget the holes (as Mars does).
* The jobs' prices are mine and small; the economy owns the real ones. No second planet and no jump drive: Fortis and Greenhaven are listed and refused; Ceres is the one world reached across the Ore Lane.
* The cargo module of the distress call is a plated pod (seams, a dogged door, a broken stripe, scorch, skids, a blinking lamp). The sample beacons are staked instruments: a mast, a coring head, a latch, a lamp.
* Ground view of Phobos at the pad is lit by one Sun at about 30 degrees: shadows are long; the Mars-lit side has only a faint ambient (no real Marsshine).

## Free flight (2026-10-03)

*Jaron: "That's a must. So many people will want to see they can fly wherever however whenever."* Between worlds you used to pick a
destination and the autopilot flew a fixed course. Now you can fly her yourself, anywhere, and the courses are still there as an option.
Branch `cosmos-freeflight`; marked `FREEFLIGHT` where it touches a shared file. Review: [docs/qa/2026-10-03/freeflight/REVIEW.md](docs/qa/2026-10-03/freeflight/REVIEW.md).

### What you can do

| You do | What happens |
|---|---|
| Sit at the pilot or captain seat, tap **FREE FLIGHT** | Armed. Fly up by the stick (the climb cap is lifted to 40 m/s low down, then up to 1.5 km/s once clear of the ground; **x5-x60** compress it by the same height bands as a course). At 100 km over Mars (or 3.1 km over a moon) free flight takes the ship. |
| Hold **THRUST** | The main drive burns along the nose at the throttle (**THR** 25 / 50 / 100%): 13 m/s2, fictional, the Meridian's own number. It costs fuel. |
| Left thumb | Turns her: up/down pitch, left/right yaw (the jets change the turn rate at 1.6 rad/s2, to at most 0.6 rad/s; let go and she stops turning). **RCS** switches the thumb to slide her sideways and up/down (1.2 m/s2 a side) and THRUST/BRAKE to forward/back. |
| **ASSIST** | Off, **prograde**, **retro**, **target**: the jets point the nose for you (and keep it there). |
| Hold **BRAKE** | Turns her retrograde and burns the speed away, easing off so it never overshoots zero. The flip-and-burn in one finger. |
| **TARGET**, **x1 x5 x20 x60 x500** | The marker, distance, closing speed and ETA follow the target. The compression runs the physics faster while you coast; a burn is held to x20, anything you steer by hand to x1; it also drops by itself near a body, on a collision course (it works out how long a turn-over and a burn would take, adds half as long again, and leaves you eight real seconds), near a raider (20 km) or near another ship (5 km). |
| Fall toward a moon | Within 400 km of one, Mars's pull is cancelled at the moon (see below), so a ship that matches it stays with it. Under 2.5 km (higher if she is coming in fast, up to 12 km) the flight assist takes her: the ordinary lift-pod flight that hovers, slides and settles on her four legs **anywhere**. Ground too uneven for the legs to level on: she hovers a few metres up and says so; slide to flatter ground. |
| Land and take off again | LIFT from a moon's surface, armed, and above 3.1 km free flight takes her again. Mars: LIFT to 100 km, or fall back through the air (below). |
| A course from the nav sheet | Free flight lets go and switches itself off; the autopilot flies as before (a course costs no fuel). |

The HUD (a phone fits it: four lines of read-outs, a sky overlay, one bar): speed, height over the nearest body and whether you are falling or rising, the
**orbit** (periapsis, apoapsis, period, round Mars, or round a moon inside its patch), the target's distance / closing speed / ETA, **fuel and delta-v**. The
overlay draws the **nose**, **prograde** and **retrograde** markers, the **target marker** (an arrow at the edge of the sky when it is off screen) and the **predicted
path** (dashed; it ends in "IMPACT Mars in 12 min" if it hits). LIFT and SINK read **THRUST** and **BRAKE** while she is yours.

### The physics (`src/space/freeflight.js`; the numbers are `FREE` in `spaceSpec.js`)

* **Gravity:** Mars (a point mass, G M = 4.28e13), Phobos and Deimos (point masses from their real masses: 5.6 and 3.0 mm/s2 at their surfaces) pull on the ship every
  sub-step; kick-drift-kick integration with a step of a fiftieth of the local dynamical time, at most 5 s, and a quarter of the time left to the ground. A circular
  400 km orbit holds its energy to 2e-9 over four orbits at x500, and its period is 2 pi sqrt(a^3/mu) (118.0 min). The Hohmann burn to Phobos's distance costs the vis-viva delta-v (650 m/s).
* **The moons are parked** (this build's frame does not spin, so the moons do not orbit: `spaceSpec.js` says why), so a ship at rest beside one would fall away from it
  at Mars's 0.49 m/s2. **Inside 400 km of a moon, Mars's pull at the moon's centre is cancelled** (fading to nothing by 500 km): the ship rides with the moon as she would if the
  moon were carried along its orbit. What is left is the moon's own pull and Mars's tide (the real thing: a few mm/s2 at tens of km, so a ship at rest 300 km out drifts away slowly; inside
  Phobos's 17 km Hill sphere she is bound). This is a stated fudge, not a hidden one.
* **Fuel:** a tank of delta-v (12 km/s), burned at acceleration x time; the jets burn a hundredth as hard. Not a mass: she does not get lighter. **Refuel on your pad at the port**
  (landed within 60 m of it: 2% of a tank a second, free: a price is an economy decision this build does not make). A course costs no fuel. Dry: only the attitude jets work.
* **Mars's air** (exponential, 0.020 kg/m3 at the surface, 11.1 km scale height) below 100 km: **deployable drag brakes** (ballistic coefficient 40 kg/m2) bring a ship down from orbit
  speed (a 157 m/s deorbit burn from 400 km peaks at about 4.8 g and is through the air in about 10 minutes); above 6 g the hull suffers. The drive will not light in the air (the DRIVE rule). Under 10 km and slower than
  300 m/s the flight assist takes her. No heat model. A ship that is too fast when the assist takes her hits the ground and the hull pays.
* **Multiplayer: the authority owns the pose.** The browser sends *intent* (a stick: thrust 0..1, six axes -1..1, a brake flag) on the same one-second lease as the old stick, from the pilot or captain only;
  `ff-set` (on/off, assist, target, throttle, compression) is checked and bridge-only. `server/simulation.mjs` runs the same `FreeFlight` the browser does; nothing a client sends can place the ship.
  Other players are sent her pose, attitude and `ff` state; `MotionBuffer` is told the compression so a x500 ship is drawn without lag. Crew aboard ride in her ship-local frame, as always.
  A saved ship keeps flying where she was: a restart advances her along her orbit (at x500, because nobody is flying her).
* **Performance:** 24 ships in free flight cost the server 1.6-1.8 ms a tick (`test/perf-freeflight.mjs`); the overlay costs the phone about a millisecond a frame
  (`cosmos.space.ffUI.stat` in `?dev=1`).

```
src/space/freeflight.js      the physics, the assists, fuel, handovers, compression, read-outs, predicted path (pure)
src/space/freeflightUI.js    the bar, the sky overlay, the text lines
test/freeflight-checks.mjs   sections 60-61 of the validator; test/_freeflight-only.mjs runs just those (30 s)
test/freeflight-browser.mjs  a WebKit iPhone and a Chromium client against one authority: real taps, held thumb, a landing and a take-off on Phobos, the other client sees her
test/perf-freeflight.mjs     the server's cost
```

Not done / not verified: no heat model; the air is a drag law, not a flight model (steering in the air is by the jets only); moon pads are not refuel points; fuel is not
priced; a ship cannot be refuelled by another ship; the tide near the edge of a moon's patch is approximate (a non-rotating frame); real iPhone Safari and an Android phone were not available (WebKit and Chromium emulation only).

## The fleet (2026-10-01)

*Jaron: "the Meridian was the proof; now a fleet."* A ship is a **type**, a string on its record that the server holds and saves. The type
selects a **ship definition** (`src/ships/registry.js`): layout, seats, gear, guns, ramps, flight numbers, hull table, crew posts, dock
points. The walker, the flight model, the guns, the stations, the interior builder, the crew's routes and the server's board, leave, seat,
hire and fire rules all take the definition; none of them names a ship. The Meridian is one entry (built from `src/ship/shipSpec.js`, which
stays the one place its numbers are written); the first raider class is another, written the same way in its own folder.

```
src/ships/registry.js        shipDef(type): the fleet
src/ships/layoutKit.js       the room/door/prop/lamp vocabulary a layout is written in (pure)
src/ships/hullLoft.js        a hull as a table of cross sections (pure)
src/ships/visuals.js         how each type is drawn, apart from its data so the server never loads a renderer
src/ships/shipyard.js        where a ship can be bought
src/ships/meridian/def.js    the Meridian, as an entry
src/ships/raider/            spec.js (rooms, hull, gear, guns, flight), exterior.js, interior.js, props.js,
                             crew.js, brain.js (how it flies and fights), escorts.js (its three drones), stats.js, def.js
server/fleet.mjs             the raiders of the shared world: spawning, the tick, damage both ways, claim and capture
```

**The Shrike** (`src/ships/raider/`): 36 m long, 18 m across the wings; a fast, hard-hitting boat for four. Walk-through rooms fore to aft:
cockpit (captain and pilot seats under the canopy), main corridor, crew quarters and mess, the airlock (with a gangway) and the armoury, the
ladder niche up to the dorsal turret, the engine room (reactor, engineer's station), the cargo hold with the stern boarding ramp. Same Kit,
same textures, same depth-layer solver as the Meridian, so the same level of detail. Four people drawn from the Loft's seven sit at the four stations. Each raider crew rotates which bodies it uses and wears its own duty cloth, hair and skin, plus a helmet and visor, so those four never read as Ada, Zuri, Jorge or the other hall faces.
It lifts 16 m/s, cruises 52, turns 1.05 rad/s; shield 240, hull armour 0.22.

**Raiders in the shared world**: one high over the port, one over Phobos, one abandoned hull adrift near Deimos (`server/fleet.mjs`). They
fly outside Mars neutral airspace only and fight only a crewed ship that is in hostile air: strafing runs with the nose guns and the turret,
three escort drones on their quarters, a break away after each pass. A raider at 35% hull is **disabled** (the crew surrender); at none it is
**abandoned**. **Players can take one** from their own ship within 160 m (World / crew): a prize crew brings a disabled raider home (its crew sign on, helmets and all) or an abandoned hull, or you board the prize where it hangs and fly it while your own ship holds station or follows with whoever stayed at the helm. Buy one at the shipyard kiosk at the port (2,400 credits); make any ship you own your flagship. See
[docs/WORLD-STATE.md](docs/WORLD-STATE.md) for the rules and what the server keeps, and
[docs/qa/2026-10-01/fleet/REVIEW.md](docs/qa/2026-10-01/fleet/REVIEW.md) for what was verified and what was not.

Offline solo keeps the old three drones and has no raiders (`?ship=raider` lets solo fly a Shrike, but nothing attacks it).

**Adding a class**: write `src/ships/<type>/` (spec and def), add it to the registry and its visuals to `visuals.js`; nothing else changes.
Validator sections 20-26 (`test/fleet-checks.mjs`) prove the registry, the raider's rooms, hull, flight, guns, brain and escorts, the world's
fight, capture, claim, buy and flagship rules, persistence, and two clients seeing the same raider and the same damage.
Section 28 (`test/grok2-checks.mjs`) proves boarding a prize in space (the hull stays put, one flyer holds or follows, the rest come aboard) and that a raider crew never wears an unmodified hall face.

## Marineris Port (local review build, 2026-09-30)

New players start beside the Meridian at **Marineris Port**. Three landing pads,
concrete taxi lanes, a supply depot with sliding doors, an open market, control
lobby/tower, fuel farm, cargo staging and a lit sign stand on an apron flattened
in the planet's density field. Landing samples the field and accounts for the
actual rubber soles; boarding and stepping off a ramp share a supported,
directional handoff. Cargo crates leave both control panels and screens clear.

The second visual pass shares Meridian's PBR maps and prop kit, adds ribbed architecture, roof equipment,
furnished interiors, four distinct traders, pavement wear and retaining works. Phone FPS and the final interior visual grade
still await Claude's review. Use `cosmos.portTour()` to cycle 45 fixed review cameras, `cosmos.portTour('list')` to list them and
`cosmos.portTour('off')` to return to play. Full causes, limits, registry IDs and viewpoints:
[Mars Port review](docs/MARS-PORT-REVIEW.md).

### The tower elevator and port workers (uncommitted review, 2026-10-01)

The tower now has a two-stop elevator. Call it at the lobby or glass cab with the contextual button / **E**,
step inside, then press **Lift to control cab** or **Lift to lobby**. Landing doors and the car door close before
travel; the sill light curtain holds them open if a body is in the doorway. A **2.2 x 2.6 m** car carries the real
walker to the unchanged **22.5 m** cab floor. Rails, brackets and shaft markings remain visible through its grille.
Travel peaks at **2.2 m/s**, accelerates at **1.4 m/s?**, and doors take **0.8 s** to open or close.

All ten stair flights, their soffits, the central spine and intermediate landings are removed. The solid underside
of the cab deck is cut round the shaft too. The cab retains its glazing, consoles, chairs and eight worker spots.
Five controllers sit facing their consoles; three cab staff stand, with a depot clerk, reception clerk, arrival guide
and four market traders elsewhere. They use the Loft's existing **Sit / Idle** clips and the crew's **Talk / T** panel,
with short role-specific lines. The depot clerk's marked spot moved 1.4 m toward the worktop so it is usable from the counter.

**Download reuse:** all 15 workers clone models already requested by the player/crew `PeopleLibrary`. No extra GLBs
or textures are requested for them. Phone workers stop animating/drawing beyond 56 m and cast no sun shadows.
This adds people rendering and animation work; it does not make those costs zero. The architecture alone measures
**35,426 triangles / 19 calls / 3.25 MB geometry** on the low tier. The separate people costs and browser evidence
are in [the leftovers review](docs/qa/2026-10-01/leftovers/REVIEW.md).

`cosmos.portTour('list')` still lists **45** cameras. The five stair views are replaced by
`tower-elevator-call`, `tower-elevator-car`, `tower-elevator-shaft`, `tower-elevator-cab-door` and `tower-elevator-exit`.
Tours pause physics, show a review pose of the lift, and restore the original player/lift state on `portTour('off')`.
`node test/validate.mjs` now includes the leftovers regressions (and, since the space work, 59 more: **390 checks** in total). The **49** focused
worker, Climb and protected/tunnel-pour checks can also run with `node test/leftovers-checks.mjs`. All changes remain local and uncommitted for Claude/Jaron review.

## Voices (2026-10-03)

Everyone who talks is heard, from where they stand, and the subtitle stays. Two parts.

**People.** Every line a person says on screen (the opening's port control, cabin crew, flight deck and driver; port workers, traders and the tower; hire candidates' pitches; your crew's replies and barks; the pilot's trip lines) is a small mp3 clip played through a Web Audio panner that follows the speaker's body: it comes from their side, fades out by 45 m, and is silent past it. Each person is cast to fit their Loft model (`src/voice/cast.js`: Kokoro voices, Apache-2.0). The ship log is the one place all crew and trip lines pass, so `ship.stations.onNote` is the hook; the talk panel and the opening speak their own lines. A line with no clip (ones with free numbers: "Contact at 412 metres") is spoken by the browser's own `speechSynthesis` instead, in a voice of the right gender, unplaced.

- Clips live in `assets/voices/<hash>.mp3` (`hash = clipKey(voice, text)`), indexed by `manifest.json` (what the browser loads) and `lines.json` (hash to voice and text, for people).
- **New lines get voices automatically:** `node tools/gen-voices.mjs` reads the game's own dialogue data (`src/voice/lines.js`: catalog, worker lines, crew lines, the opening's `dialogue.js`, plus `tools/scan-lines.mjs` which finds crew, trip and job sentences in the source), and voices whatever has no clip yet with Kokoro-82M on this machine (no key, no network once the model is cached). `--check` lists lines without clips; `validate.mjs` fails on any.
- **iPhone:** audio unlocks on the first tap (`voice.unlock()`, every pointer/touch/key event); the page asks for a "playback" audio session so the silent switch does not mute it.

**Players.** `src/voice/proximity.js`: WebRTC audio between players in the shared world, handshake carried by the authority (`server/voiceRelay.mjs`, message type `voice`; it only relays offer/answer/ICE/bye, bounded and rate limited, to a named online player). Players connect inside 40 m (let go past 50 m); players aboard the same ship are one crew channel, heard everywhere on it. Volume follows distance and the voice is panned to the speaker's body. You hear everyone near you with no setup. To talk: hold **Talk** (phone) or **B** (desktop). The mic is asked for the first time, after a plain-words explanation, and is only live while the button is held (released a few seconds after). Settings: voice volume, player voice chat on/off, mute my microphone. STUN only, no TURN: two players behind strict mobile or office networks may not connect.

## What is not done yet

Stated plainly, because a known gap is cheaper than a surprise:

- **Caves have no geometry.** The field knows they are there and collision
  respects them, but the renderer only draws the outermost surface. Closing
  this is a marching-cubes pass over the local patch, not a redesign.
- **No textures.** Surfaces are shaded from material records. CC0 sources are
  approved and recorded; nothing has been downloaded yet.
- **One planet, two moons.** Phobos and Deimos are walkable bodies on the same density-field model, reached by a
  continuous flight with no loading screen (see "Space travel"). A second *planet* is still not here: the SYL home
  worlds are listed in the nav computer and refused (they need a jump drive the Meridian does not have).
- **No server.** Everything is local. There is no authority, no persistence,
  and no multiplayer yet.

# The Cosmos

A space game built on measurement. Owner: **Jaron K. Bragg**.

Live: https://www.heartbeatobservatory.com/games/the-cosmos/
Local: `node server.js` → http://localhost:8378/
Validate: `node test/validate.mjs`

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
defence and runs without anyone looking: 123 checks covering placement,
collision, dimension drift, physics correctness, determinism, and the ship.

---

## Layout

```
src/world/bodies.js      real measured worlds, every number sourced
src/world/geodesy.js     lat/long/alt on a real spheroid; the address book
src/world/field.js       the 3D material field — the world's actual truth
src/world/planetMesh.js  pictures of the field; never a second source of truth
src/core/registry.js     stable asset IDs and measured records
src/player/walker.js     a body standing on a planet
src/ui/touch.js          the stick that isn't there until your thumb is
src/dev/debugLayer.js    graticule, ID bubbles, coordinate readout
src/ship/                the MSV Meridian: see "The ship" below
test/validate.mjs        the checks that mean nobody has to go looking
test/ship-checks.mjs     the ship's share of them
```

---

## Digging

The ground is a solid object you take pieces out of. A scoop has a measured
volume, that volume has a mass from the real density of the rock it came from,
and that mass has to be somewhere — in your hands or in a pile on the ground.

Tap the action button (or `E`) to dig, hold it (or `Q`) to drop. A spade bite
is ~3 litres and ~4.4 kg of regolith, which is what a real spade lifts.

Matter is conserved to floating-point zero: `edits.ledger()` reports
removed − deposited − carried and the validator asserts it is 0.

**The one thing that does not work yet: you cannot SEE the hole.** The ground
mesh samples every 6.72 m and a spade bite is 0.18 m across — 37 bites fit
inside a single mesh cell, so the hole is far below what the surface can draw.
Everything else about it is real: the field knows, collision knows, the mass is
in your hands, and the validator proves the rendered surface drops when the cut
is big enough to reach a vertex.

The fix is a third LOD level — a fine detail mesh, sub-metre, around edited
ground — not a change to how excavation works.

## The ship

*Built by Claude Sonnet 5.5 on 2026-09-29.*

**MSV Meridian** (`COS-MARS-VEH-0001`) is a 46-tonne gunship, 49 m long and 24.5 m across the wings, landed
a few dozen metres from where you spawn (the spawn now faces it). You walk up its boarding ramp, through
its rooms, sit in its seats, and fly it off the real planet. It is the same Mars: real 3.72 m/s^2 gravity,
the same drawn ground for landing legs and bolts as for boots.

### What is aboard (every dimension is in `src/ship/shipSpec.js`)

Human scale throughout: 1.78 m avatar, 2.7 m clear deck height (3.0 m deck pitch), 1.0 x 2.1 m doors, 1.6 m
corridors, stairs at a 0.1875 m riser.

| Deck | Rooms |
|---|---|
| **Upper (y = +6 m)** | Bridge with raked canopy: captain's chair on a dais, pilot and navigation consoles, comms station, holo table. Dorsal turret nest (above the hull deck, reached by ladder). |
| **Main (y = +3 m)** | Corridor with handrails, conduits, extinguishers and first aid. Medbay (2 beds, scanner arch, monitors). Crew quarters A and B (4 bunks each). Galley and mess. Captain's cabin with an en-suite head. Workshop. Turret ladder niche. Stairs up to the bridge and down to engineering. |
| **Lower (y = 0)** | Engineering (reactor core, coolant tanks, pumps, racks, the engineering station). Cargo bay (crates, drums, a six-wheel rover, gantry, the boarding ramp). Airlock with a cycling inner and outer door and a lowering gangway. EVA locker with suits. Ventral turret access, hatch and ladder down into a glass-floored pit. |

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

**Controls.** Phone: the invisible left-half stick flies (up = thrust, sideways = turn), right-half drag looks,
LIFT / SINK / FIRE buttons appear only when you are in a seat that uses them, the station panel sits at the top
so thumbs keep the bottom. Desktop: `W/S` thrust, `A/D` turn, hold `Space` up, `C` down, click or `F` fire,
mouse looks and aims, `E` sit / stand / use.

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
* **Three hostile drones** wake when the ship is airborne within 750 m and fire slow bolts at where the ship
  will be. The shield takes the hit first (a ripple spreads from the impact point); what is left goes to the
  hull, and a battered hull gives up thrust. Land and they lose interest; the crew patch the hull on the ground.

### How it is built

```
src/ship/shipSpec.js      every measurement: rooms, doors, stairs, ladders, seats, props, lights, gear, guns
src/ship/shipWalker.js    ship-local walking: zones, stairs, ladders, ramps, furniture (pure, tested in Node)
src/ship/shipFlight.js    thrust, gravity, landing gear springs, power split, shields (pure)
src/ship/shipStations.js  the one rule: no station unless seated in its seat (pure)
src/ship/guns.js          bolts, drones (pure)
src/ship/shipSite.js      picks the flattest ground in sight (pure)
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

### What the validator proves (section 9, 54 checks)

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
* The interior and exterior were tuned by eye in screenshots; rooms still lack windows (only the bridge, the
  nest and the ventral pit look out), and some props are simple.
* The hull is a solid shape: legs and the keel touch the ground, but a wing or the nose can pass through a
  hill you fly into.
* The airlock's outer hatch is a lit recess on the hull, not a hole cut through the plating.
* You cannot leave the ship while it is off the ground (no EVA); there is no orbital flight, only atmosphere
  scale (cruise 40 m/s, climb 12 m/s).
* Terrain around a fast-moving ship is rebuilt by the existing patch system, which hitches every few hundred
  metres (a known limit of the ground, not of the ship).
* One ship, one player, no persistence or multiplayer.

## What is not done yet

Stated plainly, because a known gap is cheaper than a surprise:

- **Dug holes are invisible** until a fine detail mesh exists. See above.
- **Caves have no geometry.** The field knows they are there and collision
  respects them, but the renderer only draws the outermost surface. Closing
  this is a marching-cubes pass over the local patch, not a redesign.
- **No textures.** Surfaces are shaded from material records. CC0 sources are
  approved and recorded; nothing has been downloaded yet.
- **Patch rebuild costs ~230 ms** and happens every ~250 m of walking. It is a
  visible hitch. The fix is to spread the rebuild across frames or move it to a
  worker.
- **One planet.** The second one gets added only after the transition between
  them is provably clean — that failure is the reason this project exists.
- **No server.** Everything is local. There is no authority, no persistence,
  and no multiplayer yet.

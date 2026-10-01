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

**Digging.** Look where you want to cut and tap the action button (`E`) to dig; hold it (`Q`) to put a load down. The small
chip above the button (or `1` `2` `3`, or Settings) changes tool: hand spade, shovel, excavator bucket. The amber ring is
where the next bite goes (it lies on the surface you are aiming at and is as wide as the bite); the cyan ring is where the
next load will land. Look down for a pit, level for a tunnel, up for a ceiling. Walk into a wall about shoulder high to
scramble over it.

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
defence and runs without anyone looking: 228 checks (2026-10-01, about 80 s) covering placement,
collision, dimension drift, physics correctness, determinism, the ship, digging and spoil, the port and its tower.

---

## Layout

```
src/world/bodies.js      real measured worlds, every number sourced
src/world/geodesy.js     lat/long/alt on a real spheroid; the address book
src/world/field.js       the 3D material field — the world's actual truth
src/world/edits.js       the dug-and-dumped ground: a 0.1 m lattice in 3.2 m bricks, exact matter, spoil that settles
src/world/excavation.js  draws the lattice (brick meshes) and tells the heightfield tiers where to stand aside
src/world/planetMesh.js  pictures of the ORIGINAL geology: shell, mid and near heightfield tiers
src/player/digging.js    the tools, where a bite lands, what you carry, where a load is put down
src/core/registry.js     stable asset IDs and measured records
src/player/walker.js     a body standing on a planet
src/ui/touch.js          the stick that isn't there until your thumb is
src/dev/debugLayer.js    graticule, ID bubbles, coordinate readout
src/ship/                the MSV Meridian: see "The ship" below
test/validate.mjs        the checks that mean nobody has to go looking
test/ship-checks.mjs     the ship's share of them
test/dig-checks.mjs      digging, spoil, the drawn ground, walking in it, the tiers that tile the rest
test/port-checks.mjs     the port's share, including the control tower stair and cab
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
| Excavator bucket (a machine, 12 t bed) | r 0.70 m | 1.44 m3, 2-4 t: a hole you can stand and turn in, a tunnel you can walk upright |

The bite is a sphere centred half a radius INTO the material along the way you are looking (`digTarget` steps the look ray through
the field itself, not the drawn mesh). Look down: a pit. Level: a tunnel. Up: a ceiling. A walkable tunnel is two rows of
bucket bites; a person fits through a 1.4 m hole.

Hands carry 105 kg on Mars (40 kgf is 105 kg of rock at 3.72 m/s2); the bucket has a machine's bed.

The body is more than the feet now (`walker.js`): four rings of probes (shin, hip, chest, head) and one over the crown keep you
out of rock, so tunnel walls are walls and a roof is a roof; the feet step up a ledge of 0.5 m; and walking into a wall whose top
is within 2.2 m scrambles you over it (for about 1.3 s of effort). A shaft deeper than about 3 m is a shaft: dig a ramp or pile
spoil to climb out.

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
rock; the wall of a 1.8 m pit can be scrambled over and a 3 m shaft cannot; a bite aimed level goes into the wall; a tunnel can
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
a few dozen metres from where you spawn (the spawn now faces it). You walk up its boarding ramp, through
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
* You cannot leave the ship while it is off the ground (no EVA); there is no orbital flight, only atmosphere
  scale (cruise 40 m/s, climb 12 m/s).
* Terrain around a fast-moving ship is rebuilt by the patch system in 2.5-4 ms slices (it no longer freezes a frame),
  but a ship at 40 m/s outruns the near tier's 13 m margin on a slow device.
* One ship, one player, no persistence or multiplayer.

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

### The control tower can be climbed (2026-10-01)

Jaron: "The tall tower you can go in the bottom but I can't actually go up the tower and look around... eventually certain
people or NPCs will be at the top 'working'." Now you can, on foot, and the top is a real room.

* **The way up.** From the lobby the stair core stands straight ahead of the entrance (a 1.2 x 2.3 m door). Inside it: five levels
  of two switchback flights, 120 risers of 0.1875 m (the Meridian's riser) over 0.27 m treads (34.8 degrees; 2R+T = 0.645), a 0.3 m
  spine between the flights, a landing at every turn, closed risers with a painted nosing, a handrail each side, a lamp over
  every landing, 2.2 m of headroom or more everywhere. The core goes up through the lobby roof (the roof is cut round it) as a
  slim white mast with three aviation bands and lit windows. About 25 s at a run.
* **The cab** at 22.5 m: 12.8 m square, glazed all round (24 panes) above a 0.9 m console ledge, an eave over it, standing
  on struts down the mast. The stair core stands in the middle of the room with its door facing the room and status screens on
  its sides. Seven consoles along the glass (three facing the pads, two a side for approach and weather) with a swivel chair
  behind each, a deck floor with a hazard edge, ceiling lamps, roof gear (radar housing, mast with beacon, dish).
* **People who will work here.** `TOWER_SPOTS` (portSpec.js) lists eight places, port-local with the way they face: five seats at
  the consoles, a supervisor and a runner and a lookout standing. The validator proves each is reachable on foot with a body-sized
  clearance, that the standing ones are clear of every solid within 45 cm, that each seat is a real chair with a console in front
  and a way to its back, and that from every seat the way out through the glass is open at a seated eye.
* **One truth for the floor.** `TOWER` and `towerFloorAt()` in `portSpec.js` say where every step and landing is; the drawing,
  the collision boxes and the walker's ground sampler (`PortSystem.towerFloorRadius`, called first by main.js's ground
  sampler) all read it. The validator walks it with the real planet walker: lobby door, ten flights, the cab, in under 80 s.
* **Budget.** The tower went from 5.5k to 9.6k triangles on the phone tier (the cab furniture is box-built there and uses the
  ship's chair at eight cushion segments on desktop). Port totals: phone 36.4k triangles / 13 calls / 3.3 MB (cap raised
  from 35k / 12 / 4 MB to 40k / 13 / 4 MB: one call is the cab glass), desktop 61.5k / 13 / 5.6 MB (cap 65k / 13 / 6 MB).
  The old tower's tapered instrument shaft, braces, gallery rails and opaque window band were replaced, not kept.

## What is not done yet

Stated plainly, because a known gap is cheaper than a surprise:

- **Caves have no geometry.** The field knows they are there and collision
  respects them, but the renderer only draws the outermost surface. Closing
  this is a marching-cubes pass over the local patch, not a redesign.
- **No textures.** Surfaces are shaded from material records. CC0 sources are
  approved and recorded; nothing has been downloaded yet.
- **One planet.** The second one gets added only after the transition between
  them is provably clean — that failure is the reason this project exists.
- **No server.** Everything is local. There is no authority, no persistence,
  and no multiplayer yet.

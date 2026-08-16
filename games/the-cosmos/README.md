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
defence and runs without anyone looking: 54 checks covering placement,
collision, dimension drift, physics correctness, and determinism.

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
test/validate.mjs        the checks that mean nobody has to go looking
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

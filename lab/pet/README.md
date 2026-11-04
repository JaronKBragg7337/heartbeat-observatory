# The Pet (lab/pet)

A small pet made of soft cells. It is not an AI and you cannot talk to it. It wanders, naps, eats the berries you
drop, and grows: every few bites a new cell buds off its body and settles in. It is script-driven all the way down.

Live page: `/lab/pet/` (phone-first, 375 px). Jaron's idea, 11/3. Built as a module so the same pet can later live
in a loft, a farm, or any other three.js scene.

## What you can do
- **Tap the grass**: a berry falls. The pet goes to it and eats it (gulp wave through the body).
- **Tap the pet**: it squishes and wiggles, happy.
- **Hold a finger on the grass**: it follows your finger (drag to lead it).
- **Two fingers**: turn the camera and pinch to zoom. Mouse: right-drag turns, wheel zooms.
- **Every 3 berries** it grows one cell. It starts at 24 cells and stops at 110 (the phone frame-rate cap).
- **Tummy** goes down slowly (full to empty in ~30 minutes of play; away time counts a little, never below "a bit
  hungry"). A hungry pet droops: flatter, slower, half-lidded eyes, flat mouth.
- **Day and night** follow the clock on your phone: warm sun by day, lantern, fireflies and a stronger inner glow at
  night. It naps more at night and after ~75 s of being left alone. Test a time with `?hour=22`.
- **First run** asks for a name and a colour (six). The gear (top right) renames, recolours, or starts over.
- **Save**: `localStorage` key `hb-pet:v1` (name, colour, cell count, bites, hunger, born time). Wrapped in try/catch
  so private mode just means it forgets.

## Files
| file | what |
|---|---|
| `index.html` | the page: markup, CSS, importmap (three 0.160.0 from jsdelivr, same as the other lab pages) |
| `world.js` | the cozy world: grass patch, props, sky, day-night, camera, touch, name card, save loop |
| `pet.js` | **the module**: `createPet(scene, options)` - the body, face, berries, drawn from the core |
| `pet-core.js` | the pet with no three.js in it: cells, springs, growth, hunger, behaviour, save shape |
| `test/pet-sim.test.mjs` | node test: 10 simulated minutes, must never NaN or explode, must grow and stay under the cap |
| `test/browser-check.mjs` | headless Chromium at 375 px with a local three.js copy: hatch, feed, grow, poke, lead, screenshots |

## The module: `createPet(scene, options)`
```js
import { createPet } from "/lab/pet/pet.js";

const pet = createPet(scene, {
  name: "Pip",            // 18 chars max
  colour: "mint",         // "peach" | "mint" | "sky" | "lilac" | "lemon" | "rose" | or a "#rrggbb"
  cells: 24,              // at hatch (20-40 is the sweet spot); ignored when `save` is given
  position: { x: 0, z: 0 },
  save: savedObject,      // restore one: the object from pet.save()
  onEvent: (name, pet) => {},   // "eat" | "grow" | "poke" | "sleep" | "wake"
  // tuning (all optional, see DEFAULTS in pet-core.js): maxCells, cellRadius, worldRadius, growEvery, gravity ...
});
```
Each frame: `pet.update(dt)` (seconds; it clamps to 50 ms). Returns the events since the last call.

| call | does |
|---|---|
| `pet.feed(x, z)` | a berry falls at that ground spot (group-local) and it goes to eat it |
| `pet.poke()` | squish + happy wobble |
| `pet.follow({x, z})` / `pet.follow(null)` | lead it with a held finger / let go |
| `pet.facePerson({x, z})` | where its person is (usually the camera); when idle it turns and looks that way |
| `pet.hitTest(ray)` | `true` if a `THREE.Ray` (group space) hits the body - use for "did they tap the pet" |
| `pet.setNight(0..1)` | more inner glow, more naps |
| `pet.setColour(id)`, `pet.setName(s)` | live |
| `pet.save()` | the plain object to store; pass it back as `options.save` |
| `pet.dispose()` | removes it from the scene and frees the GPU objects |
| `pet.group` | the `THREE.Group` holding everything - move it, scale it, parent it |
| `pet.center`, `pet.radius`, `pet.count`, `pet.hunger`, `pet.state`, `pet.ageText` | read-only |

`worldRadius` (default 2.7 m) is how far from the group's origin it will wander or be led. In a loft, set it to the
room's free radius and put `pet.group` where the floor is. The host owns lights, shadows and the environment map; the
body is one `InstancedMesh` (one draw call) with `castShadow` on.

States (`pet.state`): `idle`, `wander`, `sleep`, `eat`, `follow`, `poked`. Hunger 0..1 (`pet.hunger`); below 0.4 it
droops, and `droop` (0..1) is what the face and the body use.

## How the body works (pet-core.js)
Every cell is a soft ball with a rest offset in the body's own frame. Three forces: a shape spring pulls each cell to
`centre + rotate(rest, heading)` (gravity's sag is paid back so it sits round, not as a puddle); springs to its 4
nearest neighbours keep it one jelly; overlapping cells push apart. Add gravity, a floor with a little bounce,
damping, a speed cap and a leash to the centre, and it wobbles like jelly but can never fly apart. It moves by hopping:
a target velocity is spread over every cell and a small upward impulse fires whenever it means to move and is on the
ground. Growth scales every rest offset to the new body radius, buds the new cell out from the side, and relaxes the
rest offsets for 2.5 s so the newcomer settles in. 120 Hz substeps, at most 6 per frame.

## Tests
```
node --check lab/pet/pet-core.js lab/pet/pet.js lab/pet/world.js
node lab/pet/test/pet-sim.test.mjs                       # 40 checks, ~1 s
THREE_DIR=/path/to/three node lab/pet/test/browser-check.mjs   # 43 checks + screenshots in lab/pet/test/out
```
`THREE_DIR` is a local copy of the three package (`npm pack three@0.160.0`, untar). The browser check serves the repo
on a local port and rewrites the importmap to that copy, so it runs offline.

## Not yet verified
- A real phone: frame rate and the thumb feel of hold-to-lead next to two-finger orbit. Headless software GL gave
  ~20 fps, which says nothing about an iPhone; the budget (one instanced body, ~35 draw calls, 1024 shadow map) is well
  inside what the Seam Room already runs.
- The CDN path (the check used a local three copy; the page uses the same jsdelivr URL as every other lab page).

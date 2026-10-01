# Marineris Port — local review handoff

Built by Codex, 2026-09-30. Local work only; Claude must walk and inspect it before release.

The port is a 210 × 176 m surveyed apron centred on the Meridian's original
field-selected landing site near Valles Marineris. A 160 m quintic blend grades
its perimeter into natural terrain. This changes the planet's density volume,
with caves still evaluated beneath the new rock roof. The render patches solve
that same field. The flat apron has solid ground underneath, rather than a
floating slab. Concrete pavement occupies the upper 0.5 m and cannot be broken
with the scoop shovel; loose soil remains diggable.

Pad 01 is 38 × 64 m for the 49 m Meridian. Pads 02 and 03 are 30 × 38 m and
26 × 32 m. All have numbers, boundary/centre markings, lights, drainage rails,
tie-down sockets, expansion seams and blast wear. Concrete taxi lanes connect
them. New players arrive beside the ship's aft ramp.

The supply depot has a clear sliding entrance, shelves, stores and a counter.
Port control has an enterable lobby under the tower. An open market has four
canopied stalls. A fuel farm, perimeter fuel header, two delivery pedestals,
cargo containers and a lit port sign complete the first facilities. Geometry
has bevels, seams and dust textures. One nearby unshadowed practical light
serves the depot, tower lobby or market; edge lamps use emissive geometry.
Four named future NPC spots remain clear, with no placeholder people.

Stable IDs: port `COS-MARS-STR-0100`, pads `STR-0101`–`STR-0103`, depot
`STR-0110`, market `STR-0111`, tower `STR-0112`, fuel `PRP-0113`, cargo
`PRP-0114`, sign `STR-0115` (all with prefix `COS-MARS-`). Geometry bounds are
measured before static meshes are merged, and retained in the registry.

## Sink and repeated handoff causes

The old ship sampler preferred moving near/mid render patches. Their triangles
could disagree with the density field and change when patches rebuilt. Springs
were evaluated before integration, without a final hull penetration clamp.
They sampled the foot attachment rather than the rubber sole 25 cm below it.

The old boarding trigger accepted shoulders within 5 cm of a ramp edge, while
the ship walker required 25 cm of inset. It could board into unsupported space.
The end was similarly inset, and boarding forcibly moved the feet up to 32 cm
inward. Exiting handed the planet walker back a point still inside the entry
trigger; a timeout temporarily hid the overlap, then standing/walking away
could board again. Boarding also returned the old frame ownership value, so
the planet walker could tick during the frame that had just put the person
aboard. These are code-derived failure mechanisms, not a replay of Jaron's
specific iPhone session.

Landing now reads the field, checks soles and underside support after motion,
levels a parked hull and shares its real weight between telescopic legs.
Boarding requires supported shoulder clearance, step-height proximity and
inward movement. Ramp support reaches its physical tip; handoff preserves
horizontal position. Walking away cannot reboard. Ownership changes in the
same frame. Cargo crates were moved clear of the ramp console and cargo wall
screen, while preserving the stair landing and rover space.

## Validation and limits

`node test/validate.mjs`: **165 passed, 0 failed**, including all original 143.
New checks cover field flatness, solid depth, both graded seams, material and
excavation rules, measured geometry/foundations, all three pad landings, every
built exterior hardware vertex after landing, repeated actual walker round
trips on both ramps, same-frame ownership, door traversal, panel/screen
clearance, future NPC spaces and the render budget. Exhaust effects are not
physical hardware and are excluded from the vertex clearance check, just as
they are excluded from the ship's runtime hardware bounds.

Low tier adds **11 draw calls, 13,086 triangles, 1,193,828 geometry bytes**,
plus one unshadowed point light and two small procedural texture atlases.
These are geometry budgets, not measured iPhone frame rates. No browser walk,
screenshots, real-device thermal test or night review was performed here.
The house rule therefore still requires Claude's visual review.

The upper control cab is scenery; only its lobby is enterable. Fuel, market
and supply trading are scenery, with no transactions or refuelling yet.
There is no NPC population or persistence. Hull protection uses an underside
sampling grid, not a complete continuous collision solver against arbitrary
cliffs or buildings. All built hardware clears the field on the pads; narrow
terrain obstacles between probes and flight into structures remain limits.
Outside the earthworks the planet walker retains the existing render-patch
contact fallback. Port visuals, decals and door animation still need a human
look, including `?tier=low&depth=16`. All assets are procedural.

## Camera tour

Open the local build with `?tier=low`. `cosmos.portTour('list')` returns the
names below. `cosmos.portTour()` advances to the next view;
`cosmos.portTour('depot-door-inside')` selects one directly. It pauses physics
and holds the camera, including aerial views. `cosmos.portTour('off')` restores
play. Run a normal walk after the tour to review movement and automatic doors.

| Viewpoints | Purpose |
|---|---|
| `pad-01-eye`, `pad-01-above` | Meridian pad and ship from ground/aerial views |
| `pad-02-eye`, `pad-02-above` | Shuttle pad |
| `pad-03-eye`, `pad-03-above` | Courier pad |
| `depot-door-outside`, `depot-door-inside`, `depot-interior` | Door opening, threshold, stores and counter |
| `tower-door-outside`, `tower-door-inside`, `tower-interior` | Control lobby and tower entrance |
| `market-eye` | Four open stalls and clear future trader space |
| `fuel-eye` | Tanks, lines and service bases |
| `containers-eye` | Cargo staging |
| `sign-eye` | Marineris Port sign |
| `ship-ramp-ground` | Approach from the ground |
| `port-edge-flat`, `port-edge-grade` | Flat apron and natural-terrain blend |
| `ship-ramp-looking-out` | Cargo bay looking out of the ramp |

There are 20 viewpoints. Also walk to the ramp control console at ship-local
`(-5.0, 0, 20.1)` and inspect the cargo wall screen at `(-5.77, 1.7, 16.4)`.
Use both ramps in both directions, land again, and repeat. Compare phone frame
times with `cosmos.port.root.visible = false` and then restore it to `true`;
the budget alone cannot establish the requested small FPS cost.

Commit attempt blocked: `git add` could not create
`C:\Users\lilli\Projects\heartbeat-observatory\.git\worktrees\ho-sol\index.lock`
because that Git metadata directory is outside the writable workspace. **No
commit was created.** The changes remain in this worktree, entirely inside
`games/the-cosmos/`. No push or deployment was attempted.

Intended local commit message for Claude:

```text
Build Marineris Port and repair Meridian ground handoffs

Add field earthworks, three pads and first port facilities. Align landing
soles and hull clearance with the field; repair directional ramp handoffs
and clear cargo controls. Add 20 review cameras and validation checks.

Validation: 165 passed, 0 failed. Browser walk and iPhone FPS remain unverified.

Co-Authored-By: Codex <noreply@openai.com>
```

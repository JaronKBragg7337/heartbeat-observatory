# The wreck and the opening's looks, 2026-10-02

Jaron's notes from his iPhone run: the back of the ship "looks like random places pieces rather than a wrecked ship. Things are
floating. Not connected to things", and the rest of the opening "could be touched up a bit". This pass rebuilds the freighter as
one torn hull, builds the crash site so everything rests on the ground, rebuilds the cabin at Meridian-level detail, and gives
the whole opening a storm and dusk look. Art and scene files only. Input and touch handling, the ride flow, save and resume,
vehicles and the rover were not touched.

## What changed

Files: `src/opening/art.js` (cabin entry point, supply crate, aurora shader), `src/opening/opening.js` (builds the look, one
call per frame, the old unlit port-light boxes removed, wreck height constant), and new `wreckKit.js`, `freighterHull.js`,
`freighterInterior.js`, `wreckSite.js`, `wreckFx.js`, `look.js`. The capture tools in this folder are `shoot.mjs` (every
scene), `peek.mjs` (a few views fast), `sheet.py` and `compare.py` (contact sheets, before | after).

**The hull.** Before: a flat box with four slabs and some prisms, pieces that touched nothing. Now one shell built from a real
cross-section (floor, belly curve, windowed walls, shoulder, crown). Bent plating is a displaced surface: dents, buckling
toward the stern, oil-canning. Tears are cut by a signed field, so every hole has a ragged edge with real thickness, a bare
inner face and a scorched rim. The roof is torn open aft, the high wall is slit low, the roof is punched at the door end,
and the stern is peeled into petals that curl outward and rest on the dirt. Ribs and stringers are built only where the
skin is open or ragged, so you see frames through the holes and nowhere else. Soot is painted around every tear, a livery
stripe runs along the shoulder, the belly is dusted. The hold behind the stern bulkhead is crushed and open: wedged
containers, girders, sagging cargo net.

**The site.** Before: a few pieces floating. Now the hull sits in a plowed trench: a churned channel with heaped berms on both
sides runs about 60 m back along the slide path and fades into the plain, with dirt heaped against the hull. Every piece of
debris is placed from the real terrain height and rests on it: torn plates (ragged, bent, lip and inner face), ring frames,
seats ripped off their rails, luggage thrown clear, scrap thinning out along the scar, rocks (also round the crate). An engine
pod lies about 55 m back along the scar, still burning (flickering light, smoke and flame). Contact-shadow blobs sit under the
big masses so they are grounded on the phone tier, which has no real shadows.

**The cabin.** Before: bench blocks under a flat ceiling. Now Meridian-level: seats with life-vest pouches, armrests, cushion
fabric and back screens in three conditions (ripped cover with foam showing, sheared off the rails and lying on the floor,
folded or leaning backs, one missing); dropped oxygen masks on cables; ceiling panels sagging and torn where the roof is open;
a half-fallen light strip; cable bundles hanging from the exposed duct and ending frayed or sparking; insulation; exit sign;
bent door frame with the hatch hanging off one hinge; an extinguisher on its bracket and one on the floor; luggage lying
low-side in the aisle, some open and spilled; bottles; a lit tablet; windows cracked, starred or blown out; emergency floor
strip lights. Before the crash the same cabin is whole and bright, and the opening switches to the wreck at the impact.

**Lighting and atmosphere.**
- Storm descent: warm cabin light and the sunset through the windows, aurora ribbons with ray structure, lightning flashes,
  a red alarm strobe, dust shaken from the ceiling, sparks near the end.
- Dusk sky: a sky shader with a small cold sun and blue halo, dust bands on the horizon, stars, warm horizon.
- A low sun on the port side. The wreck is rim-lit, throws a long shadow across the plain, and shafts of light fall through the
  left-hand windows into the cabin.
- Warmer haze, and a vignette over the whole opening.
- The supply crate is a proper hard case (ribs, corner guards, latches, stencil, antenna, a blinking beacon so it can be found
  at dusk).
- The way to the port: lit pylons with a chasing pulse lead toward the port, whose lights are now soft halos in the haze instead
  of hard unlit boxes.
- Smoke from the stern and roof, a plume from the pod, dust motes, sparks with a flash light.

## Evidence in this folder

`before-*.jpg` and `after-*.jpg` are numbered captures of every scene, desktop (1280x720) and phone (390x844, `tier=low&depth=16`).
`compare-*.jpg` are before | after pairs. Regenerate with `node docs/qa/2026-10-02/wreck/shoot.mjs after`.

| Scene | Desktop | Phone |
|---|---|---|
| Storm descent, seven moments, several look angles | `after-desk-descent-1..7` | `after-phone-descent-1..7` |
| Cabin, eight views (fore, aft, aft far, left, right, ceiling, door, seats with people) | `after-desk-cabin-1..8` | `after-phone-cabin-1..8` |
| First view outside, the hatch | `exit-1..2` | same |
| The wreck from eleven angles: front, both sides, rear, stern close, trail, aerial, engine pod, dusk wide, debris | `wreck-1..11` | same |
| The crate wide and close | `crate-1..2` | same |
| The port horizon, the rover, the ride, the walk | `port-1`, `rover-1..2`, `ride-1..3`, `walk-1..3` | same |

The `before-*` set was shot from the same commit this work started from (5d3652d), with a smaller set of angles.

## Numbers (headless Chrome, software GL, so a relative guide only)

| Phone tier | after |
|---|---|
| Cabin and hull triangles, intact and wreck variants together | about 44k (the existing test caps this at 50k) |
| Draw calls, wreck site in view | 98 |
| Scene triangles, wreck site in view | about 201k |
| Time to build the opening | about 0.8 to 1.0 s here |

Desktop: 163 draw calls and 318k triangles in the busiest capture. The five particle systems are a handful of draw calls, updated
on the CPU. "Before" numbers were not measured, so there is no honest delta; the old cabin was a few thousand triangles and the
new one is not. To keep the phone inside the cap the low tier uses plain boxes instead of chamfered ones, fewer sides on
round parts, coarser plating, half the particles, and no beam light.

## Checks run

- `node test/validate.mjs`: **741 passed, 0 failed** (`validate-output.txt`). It includes the opening's rule checks and the
  Chromium walkthrough of scenes 1 to 6 on desktop and phone with the real controls, safe mode resume, reconnect, refresh restore.
- The capture run itself had no page errors and no console errors on desktop or phone.
- Safe mode (the existing reduced fallback) resumed and rendered a real frame inside that walkthrough.

## Not verified, and rough edges

- No physical phone. Everything is desktop Chrome on software rendering with phone viewport and the phone tier switches. Real
  iPhone frame rate, heat and Safari's handling of the sky and particle shaders are untested. The `depth=16` captures show no
  z-fighting I could see, but a thin hull on a real 16-bit buffer might still shimmer in places.
- Digging and carrying were exercised by validate with the real actions; I did not play them by hand for feel.
- Stills do not show the animation: the crate beacon, pylon pulse, strobe, flicker, sparks and smoke.
- The cabin collision is unchanged, so the walkable space is the old rectangle and each seat is still one block. Some
  seat backs lean into the next row without blocking.
- The sky ribbons overhead are flat additive strips, not volumetric.
- Rocks near the camera are still faceted at close range.
- The people are the existing real-looking characters; I did not change them.
- Before this work the opening review pictures in `docs/qa/2026-10-02/opening/` were made by Codex; I left those untouched
  (validate rewrites them, so I restored them), which means that folder shows the old look.

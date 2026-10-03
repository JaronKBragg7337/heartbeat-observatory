# Phobos and Deimos, second looks pass (2026-10-03)

Branch `cosmos-phobos2`. Client files plus `src/space/moonField.js` (the shared field, so the server sees the same ground). Flight, arrival and server code untouched.

Pictures: `sheet-*.png` are before | after (desktop 1280x720, phone sheets are `tier=low&depth=16` 390x844 in desktop Chromium). "Before" is a pristine checkout of origin/main (f90f98b) served on its own port. Harness: `lib.mjs`, `views.mjs` (every stage, both moons, desktop and phone width, relaunches a dead browser and resumes), `webkit.mjs` (iPhone WebKit), `perf.mjs`, `sheet2.py`. Stages: orbit (whole moon, low orbit over the grooves), approach (700 m, final), landing (ship, wide), ground (pad, rocks, pad-edge aerial), cargo module, Mars in the sky, and the aerial that used to show the hexagon.

## The black hexagon: found and fixed
Not a mesh, a shadow or a rock. It was a patch of the 880 m ground tier drawn black. `LocalPatch._computeNormals` took vertex normals from the quads currently drawn. The tier hands a hole to the finer tier and the hole moves every time the finer tier re-centres (`setExcluded` re-cuts the index, it does not re-sample). Vertices that sat inside the old hole had no normal (length 0, found by reading the normal buffer: 4 of 17,948), so when the hole moved on, the quads that came back drew black. One ~16 m polygon per re-centring, visible whenever the camera was not on the near tier (aerials, free camera, low flight). Fix: normals come from the whole grid, so they never depend on where the hole is. Same class is used by Mars, so it fixes the same thing there. Before/after: `sheet-phobos-orbit-approach.png`, last row.

Also: the mid tier now lies on the near tier's surface under it (`blendEdgeTo(coarse, fine)`), so square cells of the coarse tier no longer poke through round the near patch.

## Light and colour
* Moon fill (`spaceSky.js`): the dark side used to get 5% of a hemisphere light pointing along the planet's up. Now on a moon: a rust-coloured sky fill plus warm grey ground bounce, oriented to the moon's own up; Mars-shine lifted (0.34 to 0.62); Sun 2.4x1.45 to 2.4x1.55. The salvage cargo module is no longer black on its shaded side (`6-cargo-module`).
* Honest note: from the Phobos pad Mars is on its night side relative to the Sun, so the physical Mars-shine is about zero. The fill is for the camera, not a measurement. The ground in direct sun is only a little brighter than before; the pad, ship and ground-level shots barely changed (see the sheets). I did not get "dark and plain" fully solved at ground level.
* Albedo: red and blue units, brighter ejecta round Stickney, dust drifts, a bright rim on Voltaire; steep slopes (crater walls, groove banks) lighter and bluer, measured over a fixed 70 m baseline so the tiers agree. Deimos: paler, less orange, smoother (bump 0.55 to 0.3, fewer flecks).
* Far tier (8 km, what you see from 300 m up to orbit) had no detail at all. It now has regolith mottling and a lumpy normal, matched in colour to the tier under it, and real Sun shadows from its own heights like the tier under it. Fine regolith octaves fade with distance (they aliased into hatching at orbit).

## Grooves, pit chains, rocks
* Grooves wider (70-155 m) and deeper (8-22 m), shaded as dark lanes; a third carry chains of round pits. Readable from orbit (`1-orbit-whole`, `1-orbit-low-grooves`).
* Ejecta blanket no longer switches on at a fixed radius (a 49 m step round Stickney, a ring cliff at 1.2 radii on every crater).
* Rocks near the pad: ankle-high stones from 26 m out, ten named angular blocks round the pad's edge (up to 3 m tall), a few low blocks and stones on Deimos. Deterministic, same field the server uses. Honest: seen from the ground they read as modest low blocks; I did not get a hero rock shot I am proud of.
* Faceted flat shading is now only on rock faces (`rockness` vertex attribute). On a crater wall a 0.6 m grid of flat triangles had read as a staircase, which was the "cliff" beside the cargo module.

## Test race
`test/opening-bugs-browser.mjs` polled `cosmos?.crewUI` before `cosmos` existed. Already fixed upstream in c4be51c (`window.cosmos?.crewUI`); I checked every remaining poll in that file and found none unguarded. Run results below.

## Cost (phone tier, `perf.mjs`, desktop CPU, ratio only)
Tier rebuild at `tier=low`: far 18.7 to 21.0 ms, mid 68.5 to 83.0 ms, near 25.4 to 34.4 ms; world build 246 to 285 ms (Phobos). Triangle counts unchanged (shell 65,024, far 8,704, mid 35,344, near 12,800). Rebuilds are time-sliced (2.5 ms a frame on the phone tier), so this lengthens a rebuild, not a frame. Not timed on a real phone.

## Found, not fixed (flight owner)
* `estimateTrip` is chaotic in the goal height: moving the Phobos standoff point by 3 m or 6.3 m (either way) in the pristine tree makes the ETA come out 400,000 s (6667 min) and fails three `space-checks`. Any terrain change that moves the pad height can trigger it. I kept the pad height identical (11852.788 m) so the checks stay green; I did not touch flight code.
* `moonField.js` truncates each crater's rim shoulder and ejecta tail at its (cubic) cell wall: straight steps up to a few metres for the biggest craters. Fading them out moved the pad 6 m and tripped the above, so it is left.

## Verified / not
See the end of this file for results of the final runs. Not verified: a real phone (frame rate, heat); live URL (checked after push, see below); Mars-ground rendering after the shared `LocalPatch` normal change was only covered by validate and the phone check, not by new pictures.

## Test results (final tree)
* `node test/validate.mjs`: 943 passed, 0 failed (includes opening-bugs-browser and the WebKit/Chromium graphics matrix).
* `node test/phone-check.mjs` (iPhone-15 WebKit and Galaxy-S9 Chromium, local): 25 PASS, 0 FAIL.
* `test/opening-bugs-browser.mjs` run alone three times: passed 3 of 3.
* `webkit.mjs` (iPhone WebKit, both moons, ground and low orbit): shaders compile and draw, only the usual 404s on the console.
* One earlier validate run (before the pad height was restored) failed `space-checks` "time compression ... within 2%": see "Found, not fixed".

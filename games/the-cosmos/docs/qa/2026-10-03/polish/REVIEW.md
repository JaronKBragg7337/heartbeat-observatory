# Looks polish: survey rover, Phobos ground, raider helmets, cargo module (2026-10-03)

Branch `cosmos-polish`. Client only: nothing under `server/` was touched, no server restart needed. Ships, economy and the cargo hauler (the other builder) were left alone.

Pictures: `sheet-*.png` are before | after contact sheets (committed). The 1280x720 and 390x844 JPEGs they are cut from (`before-d-*`, `after-d-*`, `before-p-*`, `after-p-*`) are gitignored like earlier QA sets. Harness: `lib.mjs`, `rover.mjs`, `rover-hold.mjs`, `phobos.mjs`, `helmets.mjs`, `cargo.mjs`, `sheet.py`. "Before" was shot from a second worktree at origin/main (5a232b8) on its own port. Desktop Chromium on SwiftShader only; `p-` frames are 390x844 `?tier=low&depth=16` in desktop Chromium, not a phone.

## 1. Survey rover (`src/vehicles/survey/mesh.js`, `view.js`, `def.js`, opening files)
* New body: a real pressurised cab built from thin walls (so the camera can sit inside): raked windscreen, A/B/C pillars, door and quarter glass, roof liner with cabin lamps, light bar, beacon, dish, whip, sample tube, roof rails. Dash with tilted bezelled displays, steering yoke, toe board and pedals, four seats with headrests and belts, rear stowage deck (crates, gas bottles), winch bumper, tail lamps, livery stripe, wheel arches.
* Six wheels: lathe tyres with sidewall and staggered tread lugs, dished rims with nuts, slots and brake discs. High tier has wishbones and coil-over dampers that follow the wheel through `sync()`.
* Dust: a plume simulated in the rover's frame (rises, spreads, fades, trails behind the rear wheels), replaces the old fixed sprite ring. Lamp cones only at dusk (opening); the SpotLight stays on high tier.
* Heights (the "heavy" fix): floor 0.555 m, cushion 1.0 m, eye 1.80 m (`def.eye` 1.05 -> 1.08; seat x/z/y unchanged, so server seat poses are unchanged). The opening seats the driver's head at 1.76 m (was 2.0 m, above the cab) and the passenger eye is the full 1.80 m (was 1.455 m). The windscreen top is 0.27 m ahead of the passenger's eye, so the view is out of a windscreen, not over slabs of glass.
* Budget: 11,368 triangles high (limit 12,000), 5,056 low (limit 6,000); phone tier uses plain boxes, 12-segment tyres, no spring/dampers.
* Fixed on the way: offline (solo) boarding from inside the ship threw (`ship.seat` is a getter) so Drive did nothing; removed the assignment.

## 2. Phobos ground (`moonField.js`, `planetMesh.js`, `regolith.js`, `moonWorld.js`, `field.js`)
* Rocks are still in the density field (walking, digging, ground sampling unchanged): now angular blocks: 5-7 sided footprint, straight walls at most ~39 degrees, top cut by two tilted planes (a ridge). Boulders use 48 m cells and are up to ~3 m tall and ~a dozen across; none within 17 m of the cargo module.
* Walking-scale patch shades steep ground with each triangle's own normal (flat faces, hard edges); gentle ground stays smooth. Near patch only.
* Crater-on-crater shadow is no longer a statistical vertex darkening on the walking-scale patches: each rebuild marches 22 taps toward the Sun over the patch's own heights, so a rim shades the floor behind it and a rock throws a shadow, with a little ambient occlusion in crevices and a lift on convex edges. Rays that leave the patch early are trusted less so a rebuild does not pop. The far tier and whole-moon shell keep the old cavity shading.
* Regolith is a warmer dark brown-grey, rock a cooler darker stone (near patch).

## 3. Raider helmets (`src/crew/personRig.js`)
Measured the head on ada.glb (X up, -Y face, Z lateral; hair reaches 20.6 cm up). The old helmet was a 14 cm sphere the hair poked through. New: an ellipsoid shell that clears head and hair, cut below the jaw, crest, ear pods, lamp, chin guard, neck seal and ring, and a curved visor in a bezel with a glint. Same `helmet-shell/-visor/-seal` names; `grok2-checks` now compares the visor's centre, not its origin.

## 4. Cargo module (`hardware.js`, `jobs.js`, `moonField.js`)
It rested on one edge over a groove. `settle()` fits a plane to six skid points, tilts the pod to it (clamped at 9 degrees; the ground there is ~20), lifts until nothing is below ground, and puts a post and foot under every skid point left in the air (5 props, gaps up to 1.4 m). Rocks keep clear of it.

## Verified / not
See the end of this file for the test results run after the rebase. Not verified: a real phone (frame rate, heat, Mali); the horizon-shadow cost on a phone (it is ~22 taps per vertex per rebuild; not timed on a device); Phobos before/after pairs are different rocks because the layout changed; the Phobos change is the weakest of the four (rocks read angular up close, the wide views are still dark and plain, the black hexagon in the aerial frames is in both before and after and is not explained); the cargo module is still lit almost black by the low Sun.

## Test results (after rebase onto 8125e18, build restamped)
* `node test/phone-check.mjs`: 0 FAIL (iPhone-15 WebKit and Galaxy-S9 Chromium, local), including the opening ride on the new rover and the no-overlapping-buttons check.
* `node test/validate.mjs`: 846 PASS, 1 FAIL. The one failure is `opening-bugs-browser.mjs` (section 33): its fallback page polls `cosmos?.crewUI`, which throws `ReferenceError` if the page has not defined `cosmos` yet. It passes on some runs (one with my stamp stashed) and fails on others, and it fails before reaching anything this change touches. Not fixed here. Earlier in the work validate also failed three of my own checks (rover triangle budget, driver head height 2.0 assumed by `opening-browser.mjs`, a hard-coded boulder position in `grok4-checks.mjs`); all three are fixed and now pass.
* Live URL not checked yet at the time of writing.

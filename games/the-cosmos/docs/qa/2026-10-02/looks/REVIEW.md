# Looks: salvage hardware, Phobos ground, the Shrike's own paint (2026-10-02)

Client-only. Branch `cosmos-looks`. The other builder's multiplayer collision, smoothing and safe-graphics work was left alone (`server/`, `src/world-state/`, the walker, the renderer setup).

## What was built

* **Salvage hardware** (`src/space/hardware.js`, placed by `jobs.js`). The distress cargo module is a plated pod: panel seams, a dogged door, latches, a broken stripe, scorch and a torn corner, skids, a vent, an antenna, a blinking amber lamp. Each survey beacon is a staked instrument: foot, mast, collar, coring head, sample port, latch, antenna, a small solar fin, a cyan lamp and a halo. The stencil plate is painted in the browser and a flat plate in Node, where the validator's stand-in canvas cannot read pixels. Phone tier merges the shells and stays under 2,000 triangles (beacon) and 4,000 (cargo).
* **Phobos ground stays a density field.** Loose rock is a radial bump on Phobos only, after the pad blend, so the boot meets the same stone the mesh draws. Nothing inside about 58 m of the pad; full strength by about 86 m. Three cell sizes (about 72 m, 16 m, 7 m). A stone whose centre would leave its cell is skipped, and the slope is capped so the 90 s walk still stays on the ground. Crater floors and groove troughs are darkened in the vertex colour (`cavityShade`). The regolith shader for Phobos only desaturates toward grey and streaks across the grooves. Material colours are the darker grey (`0x464b4e` regolith, `0x34383b` rubble). Deimos is unchanged. The sun shadow map was not touched.
* **The Shrike's own finish** (`src/ships/raider/exterior.js`). Cloned materials, so the Meridian built afterwards keeps the shared pale set. In the browser the hull map is mismatched dark plates, red primer and scorch; in Node (no real canvas) the hull is a flat dark metal and the scorched look is the vertex colour. Red and black markings, one amber lamp left at the airlock, engine glow pulled toward flame. Extra pieces (sawtooth spine, cheek plates, a chin, one wing fence) stay inside the existing envelope. Interior walls, deck and hazard tape are dusk and blood-red. Rooms and layout are the same.

## What was verified

`node test/validate.mjs` from `games/the-cosmos`: **620 passed, 0 failed**. Section 27 checks the beacon and cargo parts, the phone triangle caps, Phobos rock in the density field (a stone of at least 0.25 m between 90 m and 400 m, none on the pad, none on Deimos, solid inside the stone and air above it), crater shade off the pad and not on it, the Shrike's scorched vertex colour, the scars, the envelope within 5 cm, the shared Meridian material left untouched, and the dusk interior palette. The earlier sections, including the 90 s Phobos walk and the pad flat to 5 cm, still pass.

## Pictures

Playwright, Chromium, SwiftShader, the dev server on port 8442. Script: `shoot.mjs` (the 2026-10-01 harness, its own port and this folder). JPEGs are gitignored, same as the earlier QA sets. `d_` is 1280×720 high tier. `p_` is 390×844 with `?tier=low&depth=16`. `r_` is the Shrike on the Mars pad (`?ship=raider`).

* Pad and ground: `d_pad_eye_east`, `d_pad_regolith_underfoot` (the painted Stickney East disc), `d_boulder_16m` (a real mound, 0.94 m, 106 m east of the pad), `d_boulder_7m`, `d_boulder_underfoot` (standing on that crest, looking down: the peak fills the frame). Phone copies: `p_pad_*`, `p_boulder_*`.
* Cargo module: `d_cargo_quarter`, `d_cargo_door` (panels, broken stripe, rusted door, lamp, antenna; the salvage prompt is up), `d_cargo_other_side`, `d_cargo_lamp`. Phone: `p_cargo_*`.
* Beacon: `d_beacon_6m`, `d_beacon_close` (mast, head, cyan lamp, halo; "Take core sample (1/3)"). Phone: `p_beacon_*`.
* Shrike: `r_front_quarter`, `r_side` (the name SHRIKE and the patch plates), `r_rear`, `r_top`, `r_nose`, `r_cockpit`, `r_hold`. Phone: `p_raider_side`, `p_raider_cockpit`.

Each page load logged three resource 404s and no page error: `/favicon.ico`, `/_vercel/insights/script.js`, and `/hb-editor.js`. The pages came up, landed, and took the shots.

## What does not work, and what is not verified

* **The loose rock reads as low swells, not as a field of jagged boulders.** The tallest stone found near the pad in these shots is 0.94 m, spread over a wide base, because the slope is capped so walking and the 5 cm surface check still hold. The 16 m frame shows that mound. The smaller stones are in the same field and are easy to lose in the groove texture. `d_boulder_underfoot` is the surface under the camera, not a rock silhouette.
* **Crater-on-crater shade is a vertex darkening, not a cast shadow.** The graded pad is left bright. Off the pad the field runs from about 0.62 to 1. These eye-level frames show the grooves more clearly than a dark bowl. The sun's shadow map still covers only about 120 m, and the terrain still does not cast into it.
* **The props are kit hardware.** At a few metres the cargo module reads as panels, a door, a stripe and a lamp. It is still built from boxes and cylinders. It is not a scanned module.
* **The Shrike's rooms are the old rooms with a dusk tint.** The hold in `r_hold` is darker ribbed plating. The cockpit screens and the door art are the shared set. Layout was not moved.
* **Not a phone.** Every frame is desktop Chromium on SwiftShader, including the 390×844 low-tier loads. Heat, frame rate and a Mali GPU were not measured.
* **Remote raiders in the shared world** still take their materials from the player's exterior set (`fleetView.js` was not edited). A raider you look at online can still wear the Meridian's pale hull. The solo `?ship=raider` boat is the one painted here.

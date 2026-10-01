# Carry capacity and distant terrain — Codex review, 2026-10-01

Changes are **uncommitted**, restricted to `games/the-cosmos/`. The site has not been published.

## Carry and pouring

* Hand tools: 105 kg → **1054 kg**, modelled as a powered hauling cart rated at 400 kgf on Mars.
* Bucket: 12,000 kg → **48,000 kg**, an assisted machine hopper. No cart/hopper vehicle model was added.
* HUD: persistent kg / capacity and a bar, including when empty. Ship notifications sit below it.
* **Drop all**: one phone tap or **R**. Combines the inventory and pours one cone through the existing deposit solver.
  **Q** and the original hold-to-drop interaction still drop individual loads.
* Over-capacity bites refuse before modifying the ground. The message offers both ways to empty the carrier.
* Deep-hole dumping now starts its ground search above the original rim, instead of starting underground and finding no surface.
* Binary lot accounting uses integer sums, retaining the original constituent quantities through combined pours. No epsilon
  is used to declare the ledger balanced. Lattice geometry is independently re-summed at its existing floating-point precision.

Measured validator example: **15 connected bucket bites**, **22,981 kg**, **14.907 m³**, followed by **one pour**, one low heap
of radius **3.09 m**, zero carried loads, and `unaccountedKg === 0`, `unaccountedM3 === 0`. The independent lattice audit
balances within `1e-8 m³`. Single drop followed by Drop all also leaves both ledgers exactly zero. A failed pour preserves inventory.
The 23-tonne pour took **784 ms in Node** in the final run. It is synchronous; a large pour can visibly pause a phone.

## Why far terrain looked flat

The original near/mid/shell hierarchy had **no distance tier between ~440 m and a global grid with ~166 km spacing**.
Its shell triangles could not express the field's 9 km hills or 900 m ridges. The old source comment called that spacing
83 km, but a 128-segment circumference on this Mars is about 166 km. Fog density 0.00016 erased **92.3% of contrast at 10 km**.

Three new patches sample the same original geology; Mars' radius and terrain amplitudes are unchanged:

| Tier width | Phone spacing | Desktop spacing |
|---|---:|---:|
| 8 km | 125 m | 83.3 m |
| 64 km | 1,000 m | 666.7 m |
| 320 km | 6,666.7 m | 5,000 m |

Coarse shaders hand over their tangent-plane squares per pixel. Fine edges blend into the actual coarser triangles;
skirts close remaining edge differences. The mid tier's collision radii follow its blended geometry. Far tiers do not
read excavation edits. The near/mid excavation cover continues to reveal the same brick meshes.

Fog density 0.000012 preserves **94.4% contrast at 20 km** and **38.0% at 82 km**. Logarithmic depth supports the long view
with the close near plane; the existing 16-bit emulation now quantizes logarithmic depth too. Rebuilding depends on surface
travel rather than altitude. Ordinary far sampling receives **2 ms/frame on low**, **3 ms/frame on high**, shared among all
three tiers. Mesh swaps, normals and edge blending still add work outside that sampling budget; forced review builds are synchronous.

Drawn height standard deviations on low-tier rings: **94.3 m at 2 km**, **205.7 m at 20 km**, **616.2 m at 100 km**.
Validator thresholds are >25 m, using the sampled drawn surface and geodetic altitude, so planetary curvature does not fake relief.
Far perimeter vertices meet the actual coarser triangles within 2 cm. Outward normals are checked on every far surface vertex.

## Rendering costs

Terrain index budget: **63,224 → 86,672 triangles** on low (+23,448 / 37.1%). Of the increase, **22,400** are the three
far meshes including skirts; **1,048** are mid-edge skirts. **Three added draw calls**. High adds 48,152 terrain triangles.

Matched scene measurements below include shadow and overlay passes. Headless Edge Chromium, **SwiftShader**, 750×470,
DPR 1, `tier=low`, 15 timed frames after five completed warmup frames. Completion is measured with a synchronous one-pixel
readback after `engine.step()`; CPU submission time alone would conceal most rendering cost.

| View height | Before / after frame triangles | Before / after calls | Completed median ms | Completed p95 ms |
|---|---:|---:|---:|---:|
| 120 m | 236,751 / 260,199 | 74 / 77 | 50.4 / 69.6 | 54.2 / 76.1 |
| 1,000 m | 170,341 / 193,789 | 57 / 60 | 29.5 / 49.4 | 32.1 / 52.6 |

These paired runs toggle the new tiers/skirts and original fog with matched loaded assets, restoring the original mid
positions. **Both states use logarithmic depth**, so this isolates the terrain/fog cost, not the full depth-buffer change.
The original, genuinely pre-edit captures are preserved separately in `before.json` and the before PNGs. Their raw JS
submission times were 0.4 / 0.9 ms at 120 / 1000 m, but asset loading changed the scene between shots; they are not comparable
to the matched completed-frame timings. Final after submission medians are 1.7 / 1.5 ms. Forced far sampling takes ~40 ms
total on this desktop, plus swaps and blending; ordinary rebuilds spread sampling over frames.

**This is not a physical-phone benchmark.** The software renderer is expensive, and the ~20 ms added completed-frame cost
must not be presented as proven phone usability. Actual mobile GPU/DPR performance remains to be checked by Claude/Jaron.

## Checks and screenshots

* [`validation.txt`](validation.txt): **281 passed, 0 failed** (`node test/validate.mjs`), 20 additions to the original 261.
* [`ui-check.json`](ui-check.json): eight passing browser checks — phone tap, load HUD, notification overlap, Q/R, full message,
  16-bit shader, JS/shader errors. The full-message check deliberately sets capacity to the currently carried mass.
* Local-only resource warnings: `/_vercel/insights/script.js` and `/hb-editor.js` return 404 under the standalone server.
  No JS or shader errors were reported. Those site integration paths were not changed.
* [`after.json`](after.json): actual renderer statistics, sampling times and paired completed-frame timings.

| Height | Original before | After |
|---|---|---|
| 120 m | [before](before-120.png) | [after](after-120.png) |
| 1,000 m | [before](before-1000.png) | [after](after-1000.png) |

Phone: [loaded hopper](phone-loaded.png), [after Drop all](phone-dropped.png), [16-bit horizon](phone-depth16-horizon.png).

The current review server is `http://localhost:8393/`. Native screenshot views:

* `http://localhost:8393/?tier=low&terrainView=120`
* `http://localhost:8393/?tier=low&terrainView=1000`
* Add `&terrainBefore=1` to emulate the original shell/fog presentation. This leaves the current depth buffer and mid-edge
  rendering in place; use the original before PNGs for the actual pre-edit image.
* Console: `cosmos.horizonView(1000, { before: false, yaw: 0 })`. Yaw is radians; zero faces north.
  `cosmos.freeCam.off()` resumes play. Screenshot HUD coordinates are the player's ground coordinate, not the review camera.

Reproduce using the existing local Playwright installation and Edge:
`node docs/qa/2026-10-01/carry-terrain/capture.mjs` and `node docs/qa/2026-10-01/carry-terrain/ui-check.mjs`.
The capture script preserves the original before evidence. Its Playwright path follows the existing project screenshot harness.

## Still weak

* **Valles is a coordinate and procedural geology in this field, not a mapped canyon.** There is no actual Valles canyon
  profile in `elevationAt()`, and its generated spawn elevation is ~+2.2 km. The new tiers reveal existing hills and broad
  ridges; they cannot supply real canyon walls. That needs a sourced terrain model, beyond repairing the LOD presentation.
* Faint transition bands remain visible at tier boundaries, especially at 1,000 m. The seams' geometry agrees at the tested
  perimeter vertices; lighting/material interpolation and boundaries crossing coarser triangles can still reveal the join.
* Large Drop all pours and their subsequent brick meshing can pause the main thread. No asynchronous pour or new vehicle was added.
* Spoil planning on steep slopes is still approximate, and materials in a mixed heap use mean density and one dominant material,
  following the existing deposit model. No layered spoil representation was added.
* Physical phone performance and true mapped Valles relief remain unverified/unimplemented, respectively.

Authored by Codex; left uncommitted for Claude's browser review.

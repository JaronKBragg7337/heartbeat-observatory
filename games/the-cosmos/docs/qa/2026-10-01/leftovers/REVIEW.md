# Mars leftovers — Codex review, 2026-10-01

Changes are local, **uncommitted**, and restricted to `games/the-cosmos/`. Nothing was published. Claude/Jaron review remains pending.

| Issue | Cause found in code | Change |
|---|---|---|
| Tower access / angle-dependent layers | Ten flights, large side/soffit plates, a continuous centre spine and intermediate floor slabs; a solid underside plate also crossed the cab's shaft opening. No before screenshot was captured, so the precise face responsible for Jaron's angle-dependent artifact is not proven. | Removed the flights, spine, landings and the plate across the opening. Kept the shaft envelope, glass cab, furniture and worker spots. Added a guided car with visible rails/markings, separate car/landing doors, call panels and moving-floor contact. |
| Empty port jobs | `NPC_SPOTS` / `TOWER_SPOTS` were placement data; only the player and hireable crew actually spawned Loft rigs. | 15 workers: five seated cab controllers, three standing cab staff, depot and reception clerks, arrival guide, four traders. Reused the existing PeopleLibrary and Talk panel. |
| Walking felt like a ladder | `stepM = 0.5`; wall contact automatically called `_mantle`, which granted upward velocity for walls up to 2.2 m. Ground snap could also accept unlimited negative distances; body contact gradients could lift feet along a steep wall. | 0.35 m walking step, bounded ground snap, horizontal push from steep wall contacts. Climb is deliberate, with landing/path clearance and a limit measured from the starting feet. |
| Underground spoil appeared above land / on equipment | Ground rays were raised above the original surface regardless of the player's depth. No pad/structure/ship exclusion. The surface planner could return its first candidate even without safe rim clearance. | Try connected air at the player's floor, with a ceiling cap. Otherwise trace joined cuts to a real surface opening and search clear ground beside it. Protect pavement, buildings, port equipment, workers, targets and the ship/ramp envelope. Check every proposed lattice write before applying any of them. Refusals retain the complete inventory. |

The depot clerk's spot moved from z=15.5 to **z=16.9** (x=-65) to stand at the back of the counter and be reachable by Talk from its customer side. The canonical marked spot and actual placement agree. All other cab/reception/arrival spots remain as authored; four individual trader positions replace the single market placeholder.

The continuation also corrected mirrored elevator door instances: a negative X scale reversed one leaf's triangle winding. Both leaves now use a right-handed transform, with a validator assertion for it. The ship/equipment exclusion callback lives in `src/player/spoilProtection.js`, so tests exercise the same guard used by the planner and final lattice writes.

## Controls and measurements

* Lift: contextual button / **E** near a call panel; step inside and press **Lift to control cab / lobby**. Stops at **0 / 22.5 m**. Car **2.2 × 2.6 m**, **2.6 m** headroom; doorway **1.2 × 2.3 m**. Peak speed **2.2 m/s**, acceleration **1.4 m/s²**, doors **0.8 s** each way. Doors stay open until a trip is requested. A body on the sill inhibits closing; the other landing stays locked.
* Climb: separate phone button / **C outside the ship**. Grounded feet, a ledge ahead, clear landing and route. **0.35 s brace + 0.85 s pull-up**, maximum **1.5 m** from the starting feet. Held keyboard repeat does not start another climb. Normal Mars jump physics remains. Higher walls require a dug ramp.
* Drop one / Drop all: **Q / R**, existing tap/hold behavior and Drop all button. Failed or protected pours change neither terrain nor inventory. The mouth search is local to joined cuts, rather than selecting an unrelated old pit. Local pours cannot sample through a roof to another surface.

## Checks and numbers

* `node test/validate.mjs`: **331 passed, 0 failed**. The previous 281-case suite plus 50 additional regressions run in this single command, with `runLeftoversChecks` wired unconditionally into the validator. Replaced the seven obsolete stair-specific assertions with car dimensions, removed stairs, empty-shaft support, sill interlock, real-walker ascent/exit, empty recall and return-ride checks. The obsolete automatic 1.8 m pit scramble assertion now requires walking to remain in the pit. Other checks remain, including cab reachability, seating/sight lines, ship boarding and crew routes.
* `node test/leftovers-checks.mjs`: **49 focused checks passed** (also included in the main validator). Walking passes a **0.3 m** ledge and stops at **0.5 m**; a **1.24 m** vertical ledge offers Climb, braces without displacement for 0.3 s, then finishes the pull-up. **1.85 m** and airborne starts refuse. Tunnel-floor pours leave the roof/surface alone; protected footprints refuse atomically. New continuation checks cover worker count, cached-only spawns, facing/poses, phone visibility and Talk reach; moving ship/ramp exclusion, equipment, workers and crew; wrong-facing and low-roof Climb refusal; and a partly clear pour footprint refusing before any write or mass change.
* Nearly full tunnel hopper: **45,924.67260324108 kg**, **30.102518623405683 m³** (~95.7% of the 48 t capacity), poured beside an actual connected mouth. **unaccountedKg = 0**, **unaccountedM3 = 0**. Independent lattice volume matches deposited minus removed to **1e-8 m³**. Test excavation-construction lots remain accounted separately; they are not fictional inventory losses.
* Browser: desktop **750 × 470**, touch-enabled phone emulation **375 × 740**, low tier and **16-bit depth emulation**. All 15 workers loaded, with Sit/Idle poses. Talk opens a short worker line with no hiring/order controls. The browser harness asserts these results and captures errors from both desktop and phone contexts. The actual phone contextual button calls the car to **22.5 m**. Real moving-car sample: car **9.729722 m**, feet **9.749722 m**, doors closed, phase moving. Keyboard C takes the browser walker from **-1.219982 m** to **+0.019928 m**. A browser bucket pour placed **1,842.414872 kg** on the tunnel floor at **-5.000445 m**.
* Browser JS errors: **0**. Local server 404s remain for the pre-existing host-only `/_vercel/insights/script.js` and `/hb-editor.js`. No worker GLB failed.

Raw outputs: [validator.txt](validator.txt), [focused-checks.txt](focused-checks.txt), [browser-results.json](browser-results.json). Reproduce with `node server.js` on port 8392 (`PORT=8392`), then `node docs/qa/2026-10-01/leftovers/browser.mjs`. The agent-browser CLI was unavailable, so the harness uses installed Chrome and the same local Playwright runtime used by earlier QA; it stops and manually steps the simulation for captures. Review holes in the harness are constructed through EditStore and are ephemeral in that browser session.

## Phone costs

| Cost | Measured |
|---|---:|
| Low-tier port architecture, including car and doors | **19 calls**, **35,426 triangles**, **3,254,988 geometry bytes** |
| Port-owned textures (shared ship maps excluded) | **3,844,776 bytes** |
| Port lights | **2 pooled point lights**, no fixture shadow maps |
| GLB requests for player + crew + port together | **6 files**, **13,181,144 bytes** (~12.57 MiB) |
| Additional port GLB/texture requests | **0** |
| All 15 worker clones if all were drawn | **153 meshes**, **313,819 triangles** |
| Unique worker geometry (shared with existing loaded people) | **61 geometries**, **7,527,882 bytes** |

Worker skeletons and mixers are cloned, geometry/materials/textures are shared. Workers beyond **56 m** on low tier (120 m on high) stop drawing and animating, and phone workers cast no sun shadows. Captured low-tier views had **5–10 workers** within that distance. Full scene counters, including terrain, ship, crew, workers and overlays, ranged **187–236 calls / 390,784–479,845 triangles**; the 19-call number is architecture only. These are counters, not a physical-phone FPS claim.

## Dev views and screenshots

`cosmos.portTour('list')` lists **45** views; `cosmos.portTour('off')` restores play and the original lift state. Five old stair names were replaced with:

* `tower-elevator-call` — lobby call panel and open doorway ([capture](tower-elevator-call.jpg)).
* `tower-elevator-car` — grille, shaft markings and floor ([capture](tower-elevator-car.jpg)).
* `tower-elevator-shaft` — review pose at 12 m; the separate [actual ride capture](elevator-riding.jpg) was simulated with the real walker and lift.
* `tower-elevator-cab-door` — upper call panel / landing doors.
* `tower-elevator-exit` — car to cab threshold.

Worker views: [cab looking in](tower-cab-looking-in.jpg), [cab facing pads](tower-cab-south.jpg), [depot clerk](depot-service.jpg), [trader 1](market-trader-1.jpg), [trader 4](market-trader-4.jpg), [Talk panel](cab-talk.jpg). Phone captures: [cab](phone-cab.jpg), [trader](phone-trader.jpg), [call lift](phone-call-lift.jpg). Movement/dirt: [Climb offered](climb-offer.jpg), [after Climb](climb-after.jpg), [local tunnel pour](tunnel-local-pour.jpg). Captures use the actual loaded models; no mock people or composited screens.

## Weak spots for Claude/Jaron

* No physical iPhone/Android FPS, heat or input test. The cloned workers add substantial rendering/animation work despite zero extra model downloads. Duplicate appearances are deliberate reuse of six existing models.
* Existing Sit/Idle clips make the controllers present at work; there is no typing animation, live traffic job simulation, or new commerce system. Workers remain at their posts.
* Climb follows a tested lift-then-pull path; the Loft rig has no matching hand-grip/climbing clip. Small/rounded ledges and tight roofs can conservatively refuse. No ladder, tool, persistence or multiplayer was added.
* Spoil planning is conservative. Joined-cut discovery uses cut bounding radii with 0.1 m tolerance; irregular multi-mouth excavations may need further playtesting. It searches a finite number of clear candidates and can retain the load when no safe pour is found. A slope's spread estimate is approximate; the actual-write guard can still reject it. This is safer than depositing an unsafe partial load.
* Large pours remain synchronous and can pause a phone; no asynchronous solver was introduced. Mass ledgers balance exactly, while the independently audited float lattice has its existing numerical precision.
* The shaft is an industrial grille car in the existing mast, without elevator sound effects. The geometry causing the old stair overlap was removed, but the exact original angle-dependent visual fault was not captured before editing. Screenshots are review evidence, not a claim of final visual approval.

Prepared by Codex for Claude/Jaron review; no commit or deployment created.

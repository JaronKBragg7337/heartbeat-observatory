# Marineris Port polish (2026-10-03, Claude Fable 5.1)

Branch `cosmos-port-polish`. Art and lighting only: `src/port/portArt.js`, `portBuildings.js`, `portSpec.js` (one building row, one
floodmast coordinate), `portSystem.js`, `portTour.js`, a 4-line change in `src/world-state/multiplayerView.js` (the old box hall), and
`test/port-checks.mjs` (counts and budgets). No server file, no walker, no touch input, no collision rule changed; the new building's walls
and furniture use the same `box` blockers every other building uses. Pictures: `sheet-*.png` are before | after contact sheets
(committed); the 1280x720 and 390x844 JPEGs they are cut from are gitignored. Harness: `shots.mjs` (desktop, phone Chromium, iPhone
WebKit), `perf.mjs`, `sheet.py`. "Before" is a second worktree at origin/main `63f8b0e` on its own dev server.

## What changed

**The crew hall / cantina is a real building** (`sheet-crew-hall.png`). It was four boxes and a sprite that read "CREW HALL / CANTINA",
built in multiplayerView and only in the shared world. It is now `BUILDINGS` kind `hall` in portSpec, same footprint (24 x 14 m at
-28, -68) and the same door the server uses (`CREW_HALL` in authority.mjs), so hiring is untouched: the six candidates still stand along
the hall's centre line, now at a 16 m bar with stools behind them, and walk straight out of a real sliding airlock. Inside: back bar with
bottles on two shelves, chalkboard menus (Regolith Red, "it is chili. it is always chili"; the Pad 02 Special, "you do not want to know";
NO TABS. NO, NOT EVEN YOU, DEV.), coffee urn, hot trays under heat lamps, till, tip jar, pendant lamps, four mess tables with benches and
the trays left on them, lockers, a cork notice board (LOST: one left boot, size 11, reward: a right boot; SOLS WITHOUT AN INCIDENT: 0;
lift inspection due 3 sols ago, "it is fine. probably."), the hiring desk by the door with its screen, a sofa corner, a jukebox, a
dartboard with a wrench in it, a clock stuck at quarter past, and THE plant under a pink grow lamp. Outside: benches, bins, gas bottles,
a hose reel, a string of bulbs across the front, a vent stack, a dish, cones, a boot grate, "wipe your boots - mgmt" stencilled by the
door. The hall exists in solo mode now as well (it is scenery; hiring stays a shared-world thing).

**Every module got the lived-in layer** (`sheet-buildings.png`): dust drifts blown against the wall feet (lit alpha decals), rust streaks
under the roof pipes and windows, conduit to a wall lamp either side of each airlock, a cable tray round the base, a boot grate and scuffed
ground at every door. Depot: an HVAC pack with a fan on the west wall, a crate stack under a tarp, chained bottles, cones, and a homesick
stencil on the east wall: EARTH 225,000,000 KM, an arrow, "THAT WAY (ISH)". Tower: bench, bin, hose reel, and because the weather officer's
sensor is offline, a windsock on a mast by the door.

**Market** (`sheet-market-fuel-yard.png`): string lights between the stalls, a lantern under every canopy, a trader's stool and change
crate, tarps over the back stock, scuffs where the queue stands, a notice board at the salvage stall. **Fuel farm:** a NO FLAME plate on
every tank ("there is no air out here to burn. it will find some."), hand wheels and sight-glass gauges on the risers, a knee-high bund
wall, an extinguisher rack, a pump, an earthing post, oil on the slab. **Cargo yard:** a ladder up a container, a tarp lashed over the
middle one, a yard floodlamp, tyre stack, pallets, chocks, dust at the doors.

**Apron** (`sheet-apron.png`): pad boards on posts at every pad (pad 01: NO STANDING UNDER THE HULL / ENGINE WASH 40 M - EARS COVERED),
a yellow tug with a tow bar by pad 02, a mobile stair by pad 03, a fuel bowser trailer by the header, cable trays from the floodmasts to
the buildings with junction boxes, cones, boot scuffs where people stand. The north-west floodmast moved from (-32,-64) to (-50,-62): it
was standing inside the crew hall's footprint (the hall was a sprite when it was placed).

**Light in the dust** (`haze` material, additive, one draw call): pools under the floodmasts and market lamps, halos at the lamp heads,
spill from lit windows, lintels and the port sign. Its opacity follows the Sun's elevation (read from the scene's own sun light), so it is
nearly off at noon and comes up at dusk and night. The dusk sheet was shot with a hand-applied version of the cinema's dusk grade (low
sun, warm key, dim sky); the real day/night cycle is F2's package and nothing here touches the Sun.

**Atlas:** 4x4 -> 4x6 cells (1024x768 low, 2048x1536 high; +1.4 MB of texture on the phone tier). New cells: hall sign, menu, notice
board, warning plate, graffiti, pad board, scuff and drift decals. F0's faction style sheet is not on main yet; the port keeps its
existing neutral-Mars finishes, which F0 lists as the `mars` look.

## Budget (phone tier, measured)
`perf.mjs`: 393x852, tier=low, solo, 4x CPU throttle, SwiftShader (GPU time meaningless; JS time and the port's own counts are real).

| | before | after |
|---|---|---|
| port draw calls (merged) | 19 | 21 (hall door leaf + haze bucket) |
| port triangles | 34,298 | 54,782 |
| port geometry | 3.14 MB | 4.85 MB |
| port textures | 3.84 MB | 5.24 MB |
| sun-shadow casters | 6 | 7 |
| depth lift layers | 4 | 4 |
| JS step p50 / p95, port-from-ship | 0.6 / 2.4 ms | 0.5 / 1.5 ms |
| JS step p50 / p95, pad-01-eye | 1.4 / 2.2 ms | 0.8 / 1.6 ms |
| JS step p50 / p95, hall door | 0.4 / 1.2 ms | 0.8 / 2.1 ms |

JS cost is unchanged within noise (the port is static geometry; the hall adds one door to tick and 51 collision boxes to the AABB
sweep). The extra 20k triangles are two more merged meshes on a phone that already draws ~40k for the ship alone; the test budgets in
port-checks were raised (21 calls, 60k, 5.5 MB phone; 21 / 100k / 9 MB high) with the numbers above as the reason. Not measured on a real
phone (no device here): the honest unknown is GPU fill from the additive haze quads at dusk on a Mali/Apple GPU; they are a few dozen
quads and nearly transparent at noon.

## Verified
* Locally: 49 desktop / phone / iPhone-WebKit review shots from the tour's named cameras, before and after; the hall's door, bar line and
  corridor are clear of blockers where the server stands and walks the candidates (`future NPC spaces stay clear` and the pad-walkability
  flood fill in port-checks both pass); `node test/_port-only.mjs` 46/46.
* Test results after rebase: see the end of this file.

## Not verified / honest notes
* Not seen on a real iPhone (only Playwright WebKit on the MSI). Live URL checked only after the push (noted below).
* The dusk sheet is a hand grade, not the game's own dusk; the haze will look different under F2's real sky.
* The scuff / streak decals are alpha-tested (no blending, like the pad scorch marks), so each texel is either there or not: at a few
  metres they read as dust, up close they are flecks. The first pass was too dark and too big; the shipped one is thinned twice.
* The hall interior is noon-lit through the roof like every other module (no interior-only lighting exists in the port); the pendant
  lamps are in the practical light pool (2 lights on the phone), so only the two nearest are lit at a time.
* Wide shots (port-from-ship, one-km) change little: this pass is at the walking scale, which is where the trailer's opening shots live.

## Test results (this worktree, before the rebase)
* `node test/validate.mjs`: **1137 passed, 0 failed** (a first run was cut by my own 40-minute shell timeout before its RESULT line; the
  full run above is complete).
* `node test/phone-check.mjs`: Galaxy-S9 Chromium all PASS; iPhone-15 WebKit had one FAIL on the first run ("port control line was never
  sent to the voice system", the opening's 10-second caption check) while the WebKit review shots were queued behind it; re-run with
  `PHONE_ONLY=iPhone` immediately after: **14/14 PASS**. Treated as a load flake, not a port change (the opening does not touch the port).
* `node test/_port-only.mjs`: 46/46 (seven structures registered, walkability flood fill to every pad, NPC spots clear, envelopes within
  5 cm, phone 21 calls / 54.8k tris / 4.85 MB, depth layers 4).

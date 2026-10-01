# Marineris Port - pass 2 review handoff

Built by Codex, 2026-09-30. **Uncommitted, only `games/the-cosmos/`.**
The dedicated local server for this worktree runs at `http://localhost:8380/?tier=low`.
Claude should review the named cameras and walk the port before committing.
This is a visual rebuild on top of the landing/boarding pass at `7218d05`.
It does not claim that Jaron's Meridian-level visual bar has been approved.

## What changed

The port now shares the Meridian's **actual texture objects** from `matsExt`,
including hull albedo/normal/roughness/metalness, machined metal normals,
corrugated cargo walls, deck plates and woven fabric. `PortKit` extends
`shipKit.js`; stocked crates and drums call `shipProps.js` directly. The repair
screen uses `shipScreens.js`'s schematic painter. The production path builds
the ship first so a second set of ship PBR maps is not allocated for the port.
The headless/standalone path can still generate its own material set.

- **Depot:** a curved sandwich roof with pressure ribs and an interior skin;
  prefab wall seams, framed glowing windows, an airlock hood, seals, bumpers,
  utility pipes and rivets; rooftop fan plant, ducts, radio aerial and solar
  panels. Six rack bays contain strapped cases, drums, varied stock heights
  and shelf labels. A reception counter has a framed terminal, keyboard and
  parcels; a manual pallet lift has forks, rollers, hydraulic pump and handle.
  Deck plate floors, aisle markings and suspended light housings complete it.
- **Tower (rebuilt 2026-10-01, Claude Sonnet 5.5):** a 31 m control tower you can climb. Lobby with reception, padded seats and
  live pad displays; a stair core straight ahead of the entrance (door 1.2 x 2.3 m) with five levels of two switchback flights
  (120 risers of 0.1875 m), landing lamps and a handrail each side; the core rises through the lobby roof as a white mast with
  aviation bands and lit windows; at 22.5 m a 12.8 m glass cab on struts, 24 panes, consoles with chairs along the glass, deck
  floor, ceiling lamps, roof radar, beacon mast and dish. Eight worker places (`TOWER_SPOTS`). See the README section "The
  control tower can be climbed".
- **Market:** four coloured fabric awnings with lower faces, scalloped
  valances, support tubes, signs, practical lamps and price displays.
  Ares Provisions has ration trays, tins, coffee dispenser and cups; Second
  Orbit Salvage has valves, copper fittings and circuit boards; Blue Well has
  sealed bottles and drums; Ridgeline has rolled fabric and hanging field kit.
  Individual cases and work clutter surround the counters.
- **Apron:** four feathered engine wear stamps per pad, curved tyre tracks,
  oil stains, chipped numbers/paint, textured aggregate and expansion joints,
  recessed lights and drainage/tie-down details. Wear uses opaque alpha-tested
  surfaces, so empty edges are discarded without transparent decal sorting.
  Four 12 m floodlight masts add a distant silhouette.
- **Earthworks:** segmented retaining kerbs with caps, fixings, marker lights
  and triangular banked dust deposits at the flat perimeter. They sit inside
  the surveyed plane; the original 160 m graded density blend is retained.

Static geometry remains merged by material, including the small fittings.
Low tier omits tiny bracket chamfers, uses bevelled-top prisms for small cases,
uses fewer pipe/rivet segments and lower-resolution cushions. Important shell
and furniture silhouettes retain bevels. Painted stripes/scuffs are quads,
rather than six-faced boxes. Near-ground hidden undersides are omitted;
lights and overhead shelf faces remain visible from below. Geometry depth
layers use Meridian's depth-buffer separation shader, including merged decals.

Two unshadowed point lights on low tier (three on high) serve the nearest real
fixtures. Architecture and metal fittings cast into the existing world sun
shadow map. There are **no new per-fixture shadow maps**. Only pad occupancy
changes the display atlas, at most once per second; stock and prices are set
dressing. The weather panel explicitly says its dust/wind sensors are offline.

## Render costs

Counts below are the authored port mesh totals, measured in the actual builder.
They include both moving door leaves and all static details. They are not FPS
measurements. `cosmos.port.stats` exposes the counts plus actual new texture
bytes in a browser and whether the ship maps were shared.

| Port contribution | Pass 1 low | Pass 2 low | Pass 2 high |
|---|---:|---:|---:|
| Primary mesh draw calls | 11 | **12** | **12** |
| Primary triangles | 13,086 | **32,282** | **53,298** |
| Geometry attribute/index bytes | 1,193,828 | **2,930,748** | **4,777,244** |
| Potential existing sun shadow calls | 0 | **6** | **6** |
| Potential existing sun shadow triangles | 0 | **28,788** | **49,128** |
| New unshadowed point lights | 1 | **2** | **3** |
| Additional fixture shadow maps | 0 | **0** | **0** |
| Port-only RGBA texture bytes, estimated with mipmaps | ~786,432 | **~3,844,776** | **~15,379,112** |

Low adds one primary call, 19,196 triangles and 1,736,920 geometry bytes over
pass 1. When the sun shadow pass runs, its port meshes can add another six calls;
reporting only 12 would hide that cost. Actual frame counts depend on culling,
shadow enablement and whether the ship interior overlay is also rendering.

New texture allocations are one 1024 x 512 atlas and three 256 x 256 pavement
maps on low; high uses a 2048 x 1024 atlas and three 512 x 512 maps. The texture
estimates assume RGBA8 plus a full mip chain. Ship maps and the ship sky
reflection environment are reused, so their existing memory is not counted
again. Approximate new GPU geometry plus texture data is **6.78 MB low** /
**20.16 MB high**. Typed geometry arrays also occupy CPU memory (~2.93 / 4.78 MB),
and source texture canvases occupy ~2.88 / 11.53 MB before temporary generation
buffers and driver overhead. These are allocation estimates, not a GPU/heap
profiler reading. The headless validator has no canvas and correctly reports
zero generated texture bytes; use the browser's stats for those allocations.

The original phone limit remains **12 primary calls / 35k triangles / 4 MB
geometry**. Its test was not relaxed. High stays below 12 primary calls / 60k
triangles / 5 MB geometry. A real iPhone frame-time and thermal comparison is
still needed, especially with sun shadows enabled.

## Validation

`node test/validate.mjs`: **172 passed, 0 failed**. Complete output:
[`qa/2026-09-30/port-pass2-validation.txt`](qa/2026-09-30/port-pass2-validation.txt).
All prior field, material, landing, ramp handoff, collision, door walking,
registry sizing, footing and clear-NPC-space checks remain green. New checks
verify shared texture identity, texture mip budget accounting, phone depth
layers capped at four, fixed light
pool, taller equipment silhouettes, high-tier budget and held-open tour doors.

Browser sanity check on the final low build: it loads, displays the ship,
pavement and new masts, and captured console warnings/errors are empty.
**Interior/distant visual approval remains unverified in this session.** Raw
browser execution to select a `portTour` camera was rejected by automatic
approval review because permission was declined. It was not retried via an
indirect route. Normal reload/screenshot checks succeeded; Claude must select
and inspect the review cameras in their browser session.

## Camera tour: 35 views

All 20 original names remain available. `cosmos.portTour('list')` lists them;
`cosmos.portTour('depot-service')` selects a view;
`cosmos.portTour('off')` restores play. Physics pauses, and **both sliding
entrances now remain open even during distant aerial views**.

| Added view | Purpose |
|---|---|
| `depot-stock` | Industrial racks, varied stock, labels and panel texture |
| `depot-service` | Counter, terminal, deck markings and overhead fixtures |
| `depot-lift-cart` | Manual pallet lift and strapped load |
| `depot-roof` | Curved shell, pressure hoops, rooftop plant and solar cells |
| `tower-reception` | Desk, seating and pad/weather displays |
| `tower-stair-door` | The stair core's door, straight ahead of the entrance |
| `tower-stair-foot`, `tower-stair-landing`, `tower-stair-back-landing` | Inside the stair: a flight, a landing, the turn |
| `tower-stair-top` | Arriving in the cab: the stair door looking out over the consoles |
| `tower-cab-south`, `tower-cab-west`, `tower-cab-east`, `tower-cab-north-walk`, `tower-cab-looking-in` | The cab from the floor and from a corner |
| `tower-mast-from-the-apron` | The mast, its bands and the cab on its struts |
| `tower-cab` | The cab and roof gear from outside |
| `market-trader-1` through `market-trader-4` | Each trader's goods, signs and awning |
| `port-from-ship` | Exterior silhouette above the ship |
| `port-one-km` | Readability at approximately one kilometre |
| `pad-02-wear` | Tyre/skid wear, scorch, oil and scuffed paint |
| `earthworks-detail` | Retaining blocks, caps, fixings and banked dust |

Prior critique views remain especially important: `market-eye`,
`tower-door-inside`, `tower-interior`, `depot-interior`, `port-edge-grade`.
Review both `?tier=low` and `?tier=high`, then `?tier=low&depth=16`.
Run a normal walk after the tour, use both ship ramps, and land again.
Compare real-device frame times with `cosmos.port.root.visible=false`, then
restore `true`. A render budget alone cannot establish a small FPS cost.

## Known weaknesses and limits

These are known modelling shortcuts, not a claim that the unseen interior
screenshots passed a visual review. Windows are framed, illuminated **opaque
panes**, not transparent openings with visible occupied rooms (the tower cab is
the exception: real glass). There is no cab lift; the tower is climbed by stair
(about 25 s at a run). No NPCs yet: the cab has marked places for them.
Crate/label patterns and engine wear stamps repeat. The depot ribs are a broad
curved prefab roof rather than fully rounded pressure-vessel end caps. Some
small trader goods and hanging field kit remain simple bevelled forms. Practical
pools have no fixture shadows, and lights on the far masts/cab are emissive
geometry rather than extra realtime lights. There is no NPC population,
transaction/refuelling gameplay or simulated weather. Night lighting and phone
FPS/thermals were not measured. Jaron's final visual acceptance is pending.

The pass-1 field foundation and landing/boarding fixes are retained. Concrete
occupies the top half metre of a solid graded volume and cannot be scooped.
Ship soles and underside support still sample the density field, and both
ramps keep supported, directional, same-frame handoffs. No new flight or
boarding model was introduced. Arbitrary flight into buildings/cliffs remains
outside the ship's complete continuous collision coverage, as in pass 1.

No commit, push or deployment was attempted. Proposed commit text for Claude,
after their review and any corrections:

```text
Add Meridian materials and architectural detail to Marineris Port

Rebuild the depot, tower lobby and market with shared ship PBR maps,
stocked furnishings, practical lights and roof equipment. Add apron wear,
retaining works, 15 review views and explicit primary/shadow/memory budgets.

Validation: 172 checks passed. Phone FPS and final visual approval pending.

Co-Authored-By: Codex <noreply@openai.com>
```

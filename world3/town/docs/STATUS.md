# Status

Honest state of the repo. Update this in the same commit as the work — a status
file that lags the code is worse than none.

Legend: **works** = implemented and verified · **stubbed** = interface exists,
no behaviour · **faked** = returns plausible output that isn't real ·
**untested** = written but never run.

---

## Scaffold — as handed over

| Thing | State | Verified how |
|---|---|---|
| Town copied verbatim from `Online-NPC-City-` | **works** | `node tools/baseline.js` — all 14 contract lines hold |
| Layer directories `sim/` `world/` `render/` | **works** | `node tools/layers.js` passes |
| Layer boundary enforcement | **works** | proven by writing a violation and watching it fail |
| Regression harness | **works** | reproduces all 14 numbers headlessly; proven non-vacuous by shrinking downtown lots and watching it report `no lot fits Chapel (12×20 m) — not placed` |
| `sim/` — simulation state | **slice works** | `tools/slice.js`: clock, ids, people, organisms (trait inheritance), jobs (seats + labor), demand, day pipeline, digest-verified snapshots |
| `world/` — spatial state and growth | **slice works** | registry (seed + records + change log), growth lot/type choice, bootstrap composition shared by headless and browser |
| Persistence | **works (local)** | world state + sim snapshot in `localStorage` (`world/registry.js`); headless uses an injected Map. Supabase-shaped, not yet Supabase |
| Vertical slice: birth → demand → growth → labor → validation | **works** | `node tools/slice.js` — 20 checks, all green; deterministic across runs (digest `b756dfb4dfff1ae9`; re-recorded at D14: resources are core state now — stocks, hardship and three utility businesses legitimately moved the digest. The chain itself is unchanged: 6 conceptions, 3 births, B50+B51 grown and validated) |
| Self-expanding town | **works** | 400-day catch-up: 6 conceptions, 3 births, B50+B51 grown and validated, zero overlap — no script places them, demand does. Limited by the founding plat: only ~4 free lots exist, so growth beyond that needs new land (see gaps) |
| Jobs: seats and hiring | **works** | builder seats are vacatable plain data; idle adults are hired daily; labor gates construction |
| Role-swapping (player takes a seat, NPC reclaims) | **works** | `tools/ambient.js` check 7: `ensurePlayer`/`playerTakeSeat` displaces the NPC, `playerWorkShift` pours player labor, 4 silent days → NPC reclaims (`seat-reclaimed`); player state survives snapshot/restore. Player entity is optional state kept out of `state.people` (D12) |
| Pets | **works** | `sim/pets.js` — deterministic pet per ~55% of households (dog/cat, name, coat, bond trait); yard loops and owner-following poses verified in `tools/ambient.js` check 6 |
| Town resources (food, water, energy) | **works** | `sim/resources.js` + engine step 8 (D14): `state.stocks`/`state.hardship` are core state (schema 2); three founding utilities staffed by ordinary hiring; a fully staffed town is surplus on all three (net food +1, water +4, energy 0); shortfall clamps at 0, counts hardship, emits `shortage`; conception gated while food/water hardship stands. `node tools/resources.js` — founding, exact drain rates, shortage days, hardship reset, player seat production and reclaim, the gate, snapshot round-trip; sim schema moved to 2 (pre-D14 snapshots refound) |
| Settings panel | **works** | `render/settings.js` + ⚙ button: mouse/touch sensitivity, invert-Y, quality (`?q=low`/`high`, applies on reload), HUD clock toggle, night mode, NPC layer toggle, reset-world danger zone (keeps furniture edits). Persisted to `ashgrove-settings-v1`. Optically verified 2026-08-05 via headless Chrome/SwiftShader CDP screenshot; real-device look unverified |
| Town status panel | **works** | ≡ TOWN button / hotkey J: day, population, households, buildings, food/water/energy stocks with net/day rates derived live from engine step 8, utility seat staffing, recent events. Pauses pointer lock while open. Optically verified 2026-08-05 via headless Chrome/SwiftShader CDP screenshot (live body read back over CDP matched sim state); real-device look unverified |
| Dashboard snapshot feed | **works** | `node tools/dashboard_snapshot.js` — founds the world exactly like tools/slice.js, catches up to day 400, prints one JSON object to stdout (schema, day, people, households, buildings, grownBuildings, stocks, hardship, netPerDay from engine step 8's production−consumption, seats, last 12 events, digest) in ~2 s; validated by piping through a JSON parse |
| Ambient visible life (NPCs walk the town) | **works** | `tools/ambient.js`: sidewalk graph from `world/streets.js`, door-to-door itineraries from `sim/ambient.js` (work/school/errands/park on a 24-min town day, D11), 0 path/footprint violations, deterministic digests; rendered by `render/npcs.js`. Optically verified 2026-08-04 via headless Chrome/SwiftShader screenshots driven over CDP: commuter + 4 pets out at 08:00, 7 people at 12:05, yard loops clear fences |
| Browser wiring of the slice | **loads on real devices** | owner-verified 2026-08-04 on PC and mobile. NPC layer optically verified headlessly (above); the touch quit path now has the ✕ MENU button (own row); real-device look and z-fighting remain open |
| Stable building identity | **works (world side)** | D15: the founding 49 are world records (`doc.founding`) seeded from `hash(townSeed \| id)` via `ASH.buildingSeed` — byte-identical to render's `idSeed`, verified against the render source — sorted so enumeration order cannot leak in; pre-D15 saves backfill, drift logs `founding-drift`. `node tools/growth.js` §1–2. Render half (consuming the seeds for founding buildings, moving appearances/baseline) remains the render layer's own commit |
| Incremental town growth mid-session | **works** | D15: `ASH.worldSession(...).advanceDay()` (and `bootWorld(...).session`) commits growth live through the same `tryBuild` gate and engine labor gating as catch-up; optional `adapter.onGrowthCommitted(record, { day, records })` fires once per live commit, never during replay. `node tools/growth.js` §3–6: live session with snapshot/restore between days grows B50+B51 mid-session and reaches the byte-same digest as catch-up. Render spawn: `render/main.js` keeps the boot's session and ticks `ASH.catchupDays` every 20 s (≤1 day per tick so validated rebuilds never chain); on a live commit, `tryBuild` has already rebuilt the town WITH the record through the exact load path (`Town.build`'s growth branch — same key → type → mesh construction, same `idSeed` identity seeding), the hook only resyncs render caches (stale camera subject, edit selection, cached interiors) and old chunk/interior GL buffers are freed on every rebuild. No double-spawn: the hook provably never fires during catch-up replay. Browser path verified statically + all harnesses green; watching a building rise on a real device unverified |
| Mobile quit/menu button | **works** | `index.html` `#bMenu` (✕ MENU, same `.btn` style as ≡ TOWN / ⚙ SETTINGS), visible only when `render/main.js` sets `body.coarse` (`T.mobile` or `matchMedia('(pointer: coarse)')`); a tap exits pointer lock and opens the settings panel — the touch stand-in for Esc. Verified statically (markup, CSS gate, wiring) + harnesses green; real-device look unverified |
| Indoor↔outdoor NPC stitching | **works** | `render/npcs.js` `stitchedPose` wraps `ASH.poseAt`: indoor intervals are derived from consecutive legs (a leg's arrival → the next leg's departure, plus the overnight interval before the first leg); the NPC lingers visible at the destination door `ENTER_MIN` (1.6 town-min) after arrival and reappears at the departure door `EXIT_MIN` (1.6) before the next leg; windows scale to zero when legs chain with no gap, so chained walks are byte-identical to before. Display-only — `sim/ambient.js` untouched and the ambient digest is unchanged (`node tools/ambient.js`: `77336ad6e882b8c4`, still green); pets keep raw poses. Real-device look unverified |
| Multiplayer / networking | **not started** | the player is still a module-level singleton |
| State-authority map (all three systems) | **works** | `docs/STATE-AUTHORITY.md` filled from live donor source: the-current @ `1126dec`, livi-organism @ `2dfcfe7`, implementation files not READMEs; coverage and gaps listed at the top of that file |

## The town itself, inherited

Everything the town could do on 2026-08-04 it still does. 13 house types × 3, 10
civic types, walkable interiors, 1414 movable furniture items, edit mode, the
orbit/roof-inspection camera, the scripted tour, the inspection layer with permanent
asset IDs on a 4 m grid.

Known-good on a real iPhone at 59–60 fps, ~290 draw calls, 42.9 MB at `?q=low`.
**Not re-verified in this environment** — no GPU here.

## Known gaps in the town, carried forward

Listed with detail in `docs/DECISIONS.md` (P1–P3) and `world/README.md`:
no persistence, no clock, interiors freed when unobserved, positional seeding,
immutable chunk meshes, no outdoor navmesh, singleton player.

Roof geometry is deliberately minimal — a Cape Cod's entire roof including three
dormers is 44 triangles. It reads well because of the shingle texture, not the
geometry. Lowest priority; the gaps may be useful for surfacing bugs once NPCs are
walking around.

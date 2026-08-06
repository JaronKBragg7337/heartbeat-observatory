# Decision log

Every non-obvious choice, and what was rejected. Append; don't rewrite history.

---

## Decided at scaffold time

**D1 — The repo starts as a verbatim copy of the town, committed unchanged first.**
Source: `Online-NPC-City-` at `f3b41ce9c26365d230b01376896519273f34d8ff`. The town
is the hardest part and it works; rebuilding it would be throwing away eight fixed
defects. The first commit is the copy with nothing altered, so any later
regression is bisectable.
*Rejected:* rebuilding the world layer from scratch; forking with shared history.

**D2 — Fresh git history and its own remote.** No origin here points at
`Online-NPC-City-`, so no accident can push into it. The three source repos are
reference material and are never modified.

**D3 — Three layers, with `sim/` forbidden from touching `render/`.** Enforced
mechanically by `tools/layers.js`. The town frees building interiors when the
camera leaves; if simulation state is reachable only through meshes, NPCs stop
existing when unobserved. This is the single most important structural decision
here.
*Rejected:* one flat codebase with NPCs attached to scene objects.

**D4 — Persistence is a seed plus a delta log, never geometry.** The town is
regenerated from one integer in 2–4 s. Store the seed, the building records, and an
append-only change log. `render/edit.js` already proves the pattern for furniture.
Fits Supabase directly.
*Rejected:* serialising world geometry or scene graphs.

**D5 — The regression contract is a command, not prose.** `node tools/baseline.js`
re-measures 14 guarantees headlessly with no dependencies and no GPU. Verifying the
town still works used to cost a long manual session; now it costs one command.
Metrics needing real hardware (fps, draw calls, VRAM) are reported as inherited and
explicitly **unverified** rather than silently assumed.

**D6 — One ID namespace, decided before any system code.** Ashgrove's asset IDs
(`B07-L1-R03`) stay as spatial *addresses*. Entities (people, households,
organisms, businesses) get the-current's prefixed-counter shape
(`person:000123`), issued from a single registry in `sim/`, each carrying a
spatial address resolved by `world/`. Founding seeds come from the world's
derived RNG streams, never `Math.random()` (livi-organism's approach — rejected,
because multiplayer replay would diverge). Full reasoning in
`docs/STATE-AUTHORITY.md`, "Then answer this".
*Rejected:* livi's client-authoritative trust model for shared facts; three
independent ID spaces retrofitted later.

---

## Deliberately NOT done — with guidance

**P1 — Stable building identity.** Buildings are seeded by build-order index
(`seed + idx * 7919`, `render/town.js`), so inserting one re-rolls every later
building's colours, floorplan and props. This must change to an identity-derived
seed before any runtime growth.
Left undone because **it changes every building's appearance**, which moves the
baseline numbers. Do it in its own commit, re-run `tools/baseline.js`, and record
the new numbers as the new contract — deliberately, not as a side effect of other
work.
**DONE AT THE WORLD LAYER (2026-08-05, D15):** the founding 49 are now world
records with identity-derived seeds (`doc.founding`, `ASH.buildingSeed`) —
byte-stable regardless of enumeration order, with drift detected and logged.
What remains open from P1 is the render half: `render/town.js` consuming those
seeds for founding buildings, which changes every building's appearance and
therefore moves the baseline numbers — still its own commit with a re-recorded
baseline, still the render layer's.

**P2 — Chunk mesh rebuilding.** `Town.build()` nulls the builders after upload and
calls `W.reset()`, so there is no incremental path. Required before the town can
grow at runtime.

**P3 — Outdoor navigation.** Indoor is already solved: every building has a
room-to-room door graph from the reachability validator. Roads are literal
coordinate arrays plus an analytic ground height, so a road graph is cheap. The
genuinely missing piece is kerb-to-front-door — and even that has a hook, since
`yardFor()` already draws that path.
**DONE FOR NPCS (2026-08-04):** `world/streets.js` builds the sidewalk-lane
graph and door stubs; `sim/ambient.js` routes every NPC door-to-door over it,
with a harness check that no path crosses a footprint. What remains open from
P3: player-facing pathfinding (waypoint commands) and indoor↔outdoor stitched
routes for NPCs (they currently despawn at doors — honest, but visible).

---

## Open — must be decided, do not assume silently

**O1 — One shared world, or an instance per player?**
**ANSWERED FOR THE SLICE (2026-08-04): one shared world, one process.** One world
state, one clock, one ID registry. The world state (seed + records + change log
+ digest-verified sim snapshot, `world/registry.js`) is the seam where a server
slots in later; nothing in the slice depends on being single-process except the
absence of a server. Revisit when the second player arrives.

**O2 — Scale target.** Tens of concurrent players, or thousands? Same question for
NPC count. This decides whether the town needs exterior streaming: at current
density it costs ~1.8 MB per building on desktop and ~0.87 MB on mobile, so a phone
runs out somewhere around 300–500 buildings *before any NPCs exist*. Interiors
already stream; exteriors do not.
**ANSWERED FOR THE SLICE (2026-08-04): tens.** Founding population is 12 NPCs,
one business, two job seats; growth is one house at a time against real lots.
No exterior streaming work is justified at this scale, and the baseline harness
will say so long before a phone runs out.

**O3 — Does the world simulate when nobody is watching, or only when observed?**
This is the fork that decides almost everything downstream.
**ANSWERED FOR THE SLICE (2026-08-04): the world advances unobserved.** One world
day per real day measured from genesis — the-current's clock discipline — applied
lazily as a catch-up on next load, livi-organism's mechanism. Nothing ticks
while unwatched; the elapsed days are replayed deterministically. The whole
answer lives behind `sim/clock.js`; changing it touches one module.

Until these are answered: pick the simplest option that lets a slice run, state the
choice loudly, and isolate it behind one module so it can be swapped without a
rewrite. Record the choice here when you make it.

---

## Decided at slice time (2026-08-04)

**D7 — Growth replays at load; no incremental mesh surgery yet.** A committed
growth building is a *record* (`{ id, key, lot }`) in the world change log. The
grown town is regenerated from `seed + records` on every load — the persistence
model this repo was scaffolded on — so P2 (immutable chunk meshes) never blocks
the slice: growth happens inside `Town.build()`, before chunks upload. Mid-session
growth (watching a house rise while you stand there) still needs P2.
*Rejected:* incremental chunk rebuilding for the slice — a bigger change than the
slice is allowed to risk.

**D8 — Growth buildings are identity-seeded from birth; the founding 49 stay
positional.** A growth building's seed is `hash(townSeed | buildingId)`
(`idSeed`, `render/town.js`) — P1's required end state, applied only to buildings
born after the decision. Adding building fifty leaves the first forty-nine
byte-identical, which the slice harness proves (`same record, same building:
identity-seeded replay is byte-stable`). P1 remains open for the founding 49,
and doing it still moves the baseline numbers and still wants its own commit.

**D9 — Commit only what the validators pass.** There is exactly one path from "the
world wants a building" to "the building exists": `world/bootstrap.js` calls the
host's `tryBuild(records + candidate)`, which rebuilds the town with the
candidate and reports the town's own issues plus an independent overlap scan.
Only on a clean pass does `worldCommit` append the record. On failure the record
is dropped, the sim is told (`rejectGrowth`), and the change log says why.
*Rejected:* trusting the lot-fit pre-check in `world/growth.js` — it exists only
to make failure rare, not to make validation optional.

**D10 — Growth fills the founding plat before new land is platted.** The founding
town leaves only ~4 free lots, so self-expansion is honest but bounded: when
lots run out, demand logs `growth-unplaceable` and waits. Plating NEW land
(new roads and blocks) would change the founding geometry and the baseline
contract, so it is deliberately not smuggled into the growth path — it wants
P1's own commit and a re-recorded baseline, same as any founding-town change.
*Rejected:* silently extending the road grid as a side effect of growth.

---

## Decided at population time (2026-08-04)

**D11 — Ambient life runs on a visible clock and is never persisted.** The
authoritative clock stays one world day per real day (O3). On top of it, a
*presentational* town clock runs 1 real second = 1 town minute (a town day =
24 real minutes), and each NPC's day — work, school, errands, the park — is a
plan derived fresh from `(seed, personId, day)` by `sim/ambient.js`, routed
door-to-door over the sidewalk graph in `world/streets.js`. Plans are pure
functions of state: nothing about where an NPC is walking is ever saved, so a
reloaded world re-derives the same streets, the same plans, the same poses.
*Rejected:* persisting positions (state bloat for zero truth); coupling NPC
schedules to the demographic clock (a baby every 24 minutes would be a lie the
other way).
*Fixed same day:* leg travel time is `pathLength / speed` with NO `/60` — on
the visible clock, seconds and town-minutes are the same number; the original
division compressed every walk to ~2 real seconds, so the population flashed
door-to-door invisibly and the town read as empty. Sessions also open at 07:45
town time (`DAY_START_MIN`, `render/npcs.js`) rather than midnight, so the
first minutes show the morning commute instead of a sleeping town.

**D12 — The player is an entity, kept OUT of `state.people`.** Role-swap is
real: `playerTakeSeat` displaces the NPC holding the seat (recorded on
`seat.displacedId`), `playerWorkShift` pours the player's labor, and four
silent days hands the seat back to the displaced NPC (`seat-reclaimed`). The
player record is optional, lazily created state that household, hiring and
digest logic never see — old snapshots load unchanged and the slice digest
does not move. Inactivity is measured in WORLD days (one per real day), so the
reclaim fires on a later boot's catch-up, not mid-session.
*Rejected:* adding the player to `state.people` (perturbs founding households,
hiring order, and the digest); mid-session timers for reclaim (the world only
advances on load, O3 — pretending otherwise would be faked urgency).

**D13 — Pets are deterministic household organisms, minimal bond loop.** Each
household deterministically has a dog, a cat, or no pet (`sim/pets.js`, stream
`(seed, "pet", householdId)`), with livi's bond principle reduced to honest
data: a fixed bond trait at creation, yard wandering, and per-outing follow
rolls. No needs, no decay — a pet cannot starve while unwatched because it has
no simulated hunger yet. That is the admitted stub boundary, stated here
instead of being smuggled in as a care system that doesn't care.
*Rejected:* porting livi's full bond/care loop before needs exist anywhere
else in the sim (it would be the only need in the world).

---

## Decided at resources time (2026-08-05)

**D14 — The town eats: food, water and energy are core state, produced by
seats.** `state.stocks` and `state.hardship` (consecutive shortfall days per
resource) live in the sim state, so snapshots and digests cover them and the
schema version moved to 2 — pre-D14 snapshots cannot advance (nothing to
settle) and are rejected and refounded. Three utility businesses are founded
AFTER the builders (General Store at the store building, grocer×2; the Diner,
cook; Water & Light at the town hall, waterkeeper×2 + lineman), their seats
staffed by ordinary daily hiring — a freshly founded town feeds itself from
day 1. Sustenance is pipeline step 8, appended after the player steps:
production from occupied utility seats (the player produces only via the same
show-up gate as builder labor), then consumption counted from live heads,
households and businesses; a shortfall clamps the stock at zero, counts the
hardship day and emits `shortage`. The rates are engineered so a fully
staffed founding town is surplus on all three (food +1, water +4, energy 0
net/day) — that is what keeps the vertical slice's growth chain firing under
the new gate: **a hungry town does not grow** (step 2b skips conception while
food or water hardship stands). Utility addresses are measured by the caller
like `businessAddress`; `world/bootstrap.js` resolves them through a new
OPTIONAL adapter method `buildingByKey(key)` and falls back to the business
address when the host doesn't provide it, so the browser adapter in
`render/main.js` keeps working unmodified.
*Rejected:* sim-side death/emigration from hardship (needs a mortality model
of its own first); persisting hardship as events only (the counters must be
replayable state, not a log-reading exercise).

---

## Decided at live-growth time (2026-08-05)

**D15 — The founding 49 become identity-seeded records, and growth commits
live mid-session.** Two halves, one commit, because the second wants the
first:

*P1 — founding identity.* The world doc now carries the founding plat as
records: `doc.founding = [{ id, key, lot }]`, captured once through a new
OPTIONAL adapter method `foundingRecords()`, sorted by id so the capture is
byte-identical no matter what order the host enumerates the buildings in.
`ASH.buildingSeed(townSeed, id)` (`world/registry.js`) is the identity seed —
FNV-1a of `townSeed|id`, byte-identical to `render/town.js` `idSeed`, now
defined for the founding 49 exactly as D8 defined it for growth — and
`ASH.worldIdentities(doc)` hands every host the full seeded list. First
capture is authoritative: pre-D15 saves backfill on next boot, and a
re-measured plat that disagrees is logged as `founding-drift`, never silently
rewritten. The slice digest did NOT move (`b756dfb4dfff1ae9` stands): the
sim's founding inputs are unchanged, and the render half — making
`Town.build()` consume these seeds for founding buildings — stays with the
render layer, where adopting it will move appearances deliberately, in its
own commit, exactly as P1 always warned.

*P2 — live growth.* `world/bootstrap.js` now steps one world day through a
single `stepWorldDay` used by BOTH load-time catch-up (D7) and a new live
entry point: `ASH.worldSession({ storage, seed, townSeed, nowMs, adapter,
tryBuild })` (plus `bootWorld(...).session` for continuing straight after a
boot). `session.advanceDay()` advances one day, drains demand →
growth-requested → labor-gated construction → growth-complete, commits
through the SAME `tryBuild` validation gate (D9) with the SAME engine labor
gating (step 3 — no second labor path exists), persists records + log +
digest-verified snapshot after every day, and fires a new OPTIONAL adapter
method once per live commit:

  `adapter.onGrowthCommitted(record, { day, records })`
  — record: the committed { id, key, lot }; day: the world day it committed;
    records: the full committed record list after the commit.

It never fires during catch-up replay (a load rebuilds the whole town with
all records anyway — firing there would double-spawn meshes). An adapter
that implements neither D15 method — today's `render/main.js` — founds,
grows, and replays exactly as before; `tools/growth.js` proves the live path
and the catch-up path reach the byte-same digest after 400 days, with the
hook firing exactly once per committed record.
*Rejected:* seeding founding buildings mid-commit inside the sim (identity
is world state, not sim state); a live path that skips `tryBuild` and trusts
the lot pre-check (D9 forbids an unvalidated placement path, watched or
not); firing the hook during catch-up and letting the render layer
de-duplicate (the no-double-spawn rule belongs at the source); sim-side
timers for "watching a house rise" (the world still advances one day per
real day, O3 — live growth is the day-step applied while watched, not a new
clock).

# State and authority map

The question that decides the architecture: for each system, **what is its
authoritative state, where does it live, what advances it, and is that
advancement deterministic?**

The Ashgrove column is filled in from the code, first-hand. The other two were
filled from the **live source** of `the-current` and `livi-organism`, not from
their READMEs:

- `the-current` @ `1126dec` (`main`, "Default every client to the live shared
  world and remove time controls (#16)") — read: `src/simulation/engine.ts`
  (`CurrentSimulation.create` / `restore` / `advanceDay` / `mixEntropy` and the
  ID-issuance functions), `src/simulation/rng.ts`, `canonical.ts`, `config.ts`,
  `placement.ts` (footprints and roads), `src/persistence/schema.ts`,
  `src/app/worldClock.ts`, `src/app/sharedWorldRuntime.ts` (full files unless
  noted), plus `scripts/run-simulation.ts` and `useSimulationRuntime.ts` for how
  worlds advance. Implementation code, not READMEs.
- `livi-organism` @ `2dfcfe7` (`main`, "Bound multi-year care memory and record
  the mobile decision") — read: `app/LiviCompanion.tsx` (`createOrganism`,
  `mulberry32` / `hashString`, `simulateElapsed`, `applyOfflineLife`, plus a
  full grep map of the 7,119-line file), `app/lifeData.ts`,
  `app/cloud.ts` (type surface and function signatures), `db/schema.ts`,
  `worker/index.ts`, `supabase/migrations/20260729115413_livi_revisioned_cloud_memory.sql`,
  and the test names in `tests/biology-lifecycle.test.mjs`.
  **Not read in full:** `app/cloud.ts` bodies (encryption/sync internals —
  signatures and types only), `LivingContinuity.tsx`, `CloudCommons.tsx`,
  `SimulationLab.tsx` bodies, and the commons migration
  `20260729055346_create_livi_commons.sql`. Nothing below depends on them.

> **Their READMEs are known to be out of date relative to the live code.** Where a
> README and the code disagree, the code wins. Do not record a principle here that
> you have not seen in an implementation file.

---

## Ashgrove — the town (verified from code, 2026-08-04)

| | |
|---|---|
| **Authoritative state** | A seed. Everything else is derived: 49 buildings, 4284 assets, 1414 furniture items, 3110 colliders, 863k triangles — all regenerated at load from `Town.build(seed)` in 2–4 s. |
| **Where it lives** | Nowhere. Not persisted. The only stored state anywhere is furniture edits in `localStorage`, held as deltas from the generated baseline and keyed by asset ID (`render/edit.js`). |
| **What advances it** | Nothing. There is no clock, no tick, no simulation. A render loop and a first-person camera, and that is all. |
| **Deterministic?** | Yes, completely — same seed, same town, byte for byte. But the determinism is **positional**: building seeds derive from build order (`seed + idx * 7919`), so insertion re-rolls everything after it. Deterministic, but not *incrementally* deterministic. |
| **Without an observer** | Building interiors are built lazily inside ~46 m of the camera and **freed** beyond it, capped at 16 live (`updateInteriors`, `render/main.js`). Exteriors are always resident. So an unobserved building has no interior at all. |
| **Addressing** | Every asset has a permanent ID on a 4 m grid: `B07-L1-R03` (building, level, room), `B07-L0-R03-F02` (a specific chair), `G14-09` (grid cell). Global namespace, already stable. |
| **What it validates** | Room area and minimum dimension, egress windows, hall width, reachability from the front door, stair fit and landing, door widths, float/bury against datum, building-vs-building separation, roadway overhang, degenerate polygons. Has caught 8 real defects. |
| **What it has that a simulation needs** | A room-to-room door graph per building (from the reachability validator), walkable surfaces and ramps, 3110 collision volumes, 1414 addressable furniture items with position and facing — usable as job stations, beds, seats. Roads are literal coordinate arrays, so a road graph is cheap to derive. |
| **What it lacks** | Persistence, a clock, multi-agent support (the player is a module-level singleton), an outdoor navmesh, incremental building, networking. |

---

## the-current — the economy (verified from code @ `1126dec`)

| | |
|---|---|
| **Authoritative state** | One full `WorldState` document: people, households, relationships, buildings, institutions, breakthroughs, the settlement's resource ledgers / prices / treasury, active signals, the event log, daily summaries, and counters — plus the RNG state itself, stored *inside* the state (`CurrentSimulation.create`, `src/simulation/engine.ts:438-514`). Integrity is a canonical FNV-1a-64 digest over sorted-key JSON (`canonicalDigest`, `src/simulation/canonical.ts`); restore refuses a snapshot whose digest doesn't match (`engine.ts:516-589`). |
| **Where it lives** | Local worlds: IndexedDB, five object stores — worlds, snapshots, event-chunks, external-inputs, preferences (`src/persistence/schema.ts`). The one shared authoritative world: a single Supabase row (`the_current_world`, holding `snapshot`, `digest`, `genesis_at`, `world_day_ms`), written server-side; every browser polls it read-only and projects it (`src/app/sharedWorldRuntime.ts:121-227`). |
| **What advances it** | `advanceDay()` — one world day per real day measured from genesis (`WORLD_DAY_DURATION_MS = 86_400_000`, `src/app/worldClock.ts`). Time is "a property of a world, never a control": no pause, acceleration, rewind, or hand-advance exists. Each day runs a fixed pipeline of ~27 phases in order — aging/deaths, births, migration, housing, employment, construction planning, tasks, movement, production, sanitation, consumption, encounters, partnerships, reproduction, construction progress, institutions, breakthroughs, growth, storage losses, prices (`engine.ts:599-653`). |
| **Deterministic?** | The past, yes — replay-exact. Seeded xorshift RNG (`DeterministicRng`, `src/simulation/rng.ts`), per-day per-domain derived streams (`deterministicStream(seed, 'construction-proposal', day, …)`), digest-verified snapshot round-trips. The future, deliberately **no**: each day hidden entropy folds into two chains — `surface` (reseeds ordinary randomness) and `deep` (rare high-impact draws) — via `mixEntropy` (`engine.ts:665-689`). The mix is recorded as an event, so history replays exactly while "the entropy for tomorrow does not exist yet anywhere." |
| **Without an observer** | It advances anyway. The shared world advances server-side whether anyone watches; clients are read-only witnesses polling a snapshot. A local world is no different in outcome: on reload it catches up to `worldDayAt(genesisMs)` — a backgrounded tab or closed laptop still costs the world its days (`useSimulationRuntime.ts`, `worldClock.ts`). |
| **Addressing** | Sequential counters per category, issued at creation: `person:000123`, `household:00045`, `building:00012` (`engine.ts:1007-1008, 1157-1178`). One settlement, `settlement:current`. Identity is the counter, **not** space: positions are plain `Position3` coordinates, buildings placed on a footprint table with road clearance (`src/simulation/placement.ts`). |
| **What it has that Ashgrove needs** | A working authoritative-document pattern with digest-verified save/restore; a day-pipeline shape that already sequences exactly the mechanics Ashgrove wants (housing assignment, employment, construction triggered by pressure, reproduction); derived RNG streams that keep each day's randomness reproducible yet unknowable ahead of time; the "time is a property of the world" clock discipline. |
| **What it lacks** | Any physical space beyond footprints and road polylines — no interiors, no rooms, no walkable geometry; embodiment (observers queue interventions, they are never residents); a spatial address namespace; sub-day state worth persisting (24 ticks/day is conceptual, the document moves at day boundaries). |

---

## livi-organism — pets and offspring (verified from code @ `2dfcfe7`)

| | |
|---|---|
| **Authoritative state** | One `Organism` document per account: a 35×35 cell body (alive, energy, health, age, phase, hue per cell), a seven-axis trait set (curiosity, sociability, appetite, resilience, playfulness, growthBias, locomotion), bond / trust / joy, `ageMinutes`, a rolled natural lifespan, episodic memories plus folded per-day care summaries, and lineage records across generations (`createOrganism`, `app/LiviCompanion.tsx:417-518`). Inheritance is real: a legacy generation carries bond, personality, achievements and formative memories into the next body (`legacyRecords`, `parentGenerationId`; tested by "legacy hatching resets the body while preserving relationship history"). |
| **Where it lives** | `localStorage` first, synchronously — play never waits for a login. With an account: immutable, client-side-encrypted save revisions in Supabase (`cloud_save_revisions`; PBKDF2-SHA-256-wrapped keys, 600k iterations — `app/cloud.ts`, migration `20260729115413`). **The server stores ciphertext and cannot read, let alone advance, the organism.** |
| **What advances it** | Real elapsed wall-clock minutes. Foreground ticks while observed; absence is fast-forwarded on return by `simulateElapsed(elapsedMinutes)` — energy drain, health decay, cell death, dormancy deepening, senescence, zero-cell collapse to a dormant seed — capped at 365 days per catch-up (`LiviCompanion.tsx:2781-2946`). Care history folds to bounded daily summaries so a multi-year life stays inside mobile storage (tests: "multi-year care detail stays bounded"). |
| **Deterministic?** | Per organism, mostly. The body plan comes from `mulberry32(seed)`; offline catch-up reseeds from `seed ^ ageMinutes ^ minuteBucket`, so the same absence replays identically. But the founding seed is `Math.random()` — an organism is not reproducible across installs — and the input is real elapsed time, so two devices holding the same organism diverge unless they sync revisions. |
| **Without an observer** | It does **not** tick continuously — but it does not pause either. Nothing runs while unwatched; on return, the full biological consequence of the elapsed time is applied as if it had kept living ("offline life"). A lazy middle point between Ashgrove (nothing exists unobserved) and the-current (everything advances always). |
| **Addressing** | Generation IDs `gen-N-{seed}`, lineage by `parentGenerationId`; friend / achievement / item IDs from fixed catalogues; memories by a per-organism sequence number. One organism per account — there is no spatial position and no shared world namespace at all. |
| **What it has that Ashgrove needs** | A lifecycle driven by *elapsed time* rather than ticks (cheap, and robust to gaps); traits as first-class heritable state with generation-over-generation inheritance; bounded long-run memory (fold detail, keep aggregates); and the discipline that money-like resources (Motes, serum doses) must survive restores without duplication — its test suite is mostly about closing those duplication holes. |
| **What it lacks** | Multiple organisms in one world, any spatial location, server-side authority (all biology is client-computed; the server holds ciphertext), deterministic identity (the seed is random), and an ID namespace compatible with a spatial grid. |

---

## Then answer this

**1. Which system owns which category of state in the new world?**

Three categories, three owners, matching the three proven models:

- **Land and buildings → `world/` (Ashgrove's model).** A seed, building records
  (id, lot, type, orientation, founded-at), and an append-only change log.
  Regenerate, replay deltas, validate everything placed. Nothing here ticks.
- **Population, households, employment, businesses → `sim/` (the-current's
  model).** One authoritative document advanced by a fixed day pipeline,
  digest-verified on save/restore, with derived RNG streams per day and domain.
  the-current proves this document shape holds up at 500-day scale
  (`benchmarks/reference/current-endurance-001-500d.json`).
- **Organism lifecycle (pets, children as creatures) → a `sim/` organisms module
  (livi-organism's model).** Traits as heritable state, lifecycle driven by
  *elapsed world time* not per-frame ticks, bounded memory, and
  generation-over-generation inheritance. But its clock input becomes world
  days from the `sim/` clock, not raw wall-clock minutes.

**2. Where do their models conflict?**

- **The clock.** Ashgrove has none. the-current advances one world day per real
  day, server-owned, unpauseable. livi-organism runs on raw wall-clock minutes
  with lazy catch-up. One clock must win; the other models must be expressed in
  its units. (Resolution owed under O3 in `DECISIONS.md` — do not assume it
  silently.)
- **Observer semantics.** Ashgrove frees what is unobserved (render residency).
  the-current simulates everything always, observer or not. livi-organism runs
  nothing unobserved but applies full consequences on return. These are three
  different answers to "what exists when nobody looks" and they cannot all hold
  for the same entity. Render residency and simulation residency must stay
  separate (D3 already forces this structurally).
- **Determinism vs unknowability.** Ashgrove is fully seed-deterministic.
  the-current is replay-deterministic but makes the future deliberately
  uncomputable via hidden daily entropy. livi-organism is seed-deterministic
  but seeds from `Math.random()`. Whether Ashgrove's world keeps a knowable
  future or adopts entropy-mixing is a real fork, not a detail.
- **Authority location.** livi-organism is client-authoritative — the server
  holds ciphertext and biology is whatever the client computes. the-current's
  shared world is server-authoritative — clients are read-only witnesses. A
  multiplayer town cannot be client-authoritative about shared facts (who holds
  a job seat), so livi's trust model does not transfer even though its
  lifecycle model does.
- **Spatial identity.** Ashgrove addresses *space* (`B07-L1-R03`). the-current
  addresses *entities* by counter and stores positions as bare coordinates.
  livi-organism has no space at all. "NPC #47 asleep in B07-L1-R03" requires
  entity IDs that resolve into Ashgrove's spatial namespace.

**3. Do all three agree on identity?**

No — and yes, they can, if decided now:

- Ashgrove's asset IDs (`B07-L1-R03-F02`) are spatial and stable; keep them as
  **addresses**, not entity identities.
- the-current's prefixed-counter pattern (`person:000123`, `household:00045`)
  is the right shape for **entities** — adopt it, but issue every category
  (people, households, organisms, businesses) from one registry in `sim/`, so
  no two systems can mint colliding IDs.
- Every entity carries a **spatial address field** that `world/` resolves into
  Ashgrove's grid. livi's generation IDs map cleanly onto organism entities
  (`org:000045`, lineage by parent pointer — same shape as its
  `parentGenerationId`).
- The one thing to reject: livi's `Math.random()` founding seeds. Entity
  creation draws from the world's derived RNG streams, or multiplayer replay
  diverges.

Retrofitting this shared namespace later is miserable; it is decided here,
before any system code.

# world/ — spatial state and the world contract

What exists *where*. Parcels, roads, building identities, validated footprints,
and the record of how the town got to be the shape it is.

Sits between `sim/` (which knows a job exists) and `render/` (which draws a desk).
`sim/` asks this layer to resolve `B07-L1-R03` into a place; `render/` asks it what
to draw.

## The persistence model — generated baseline plus delta log

The town is **not stored as geometry**. It is regenerated from a seed every load,
deterministically, in about two to four seconds. 863k triangles come out of a
number.

So the world persists as:

```
  seed                     one integer — reproduces the founding town exactly
+ building records         id, lot, type, orientation, founded-at
+ change log               append-only: what was added, moved, removed, when
= the world
```

Nothing else needs storing. This is small enough to live in a Supabase table and
cheap enough to replay. `render/edit.js` already proves the pattern at small scale:
furniture edits persist as deltas from the generated baseline, keyed by asset ID,
and replay over a freshly generated world.

**Do not store meshes, vertices, or chunk data.** If you find yourself serialising
geometry, the design has gone wrong.

## Building identity — read this before adding buildings at runtime

Buildings are currently seeded by **position in the build order**:

```js
new T.Building(def, id, ox, oz, yaw, (seed || 1337) + idx * 7919)   // render/town.js
```

Insert a building mid-sequence and every later building's colours, floorplan and
props re-roll. The town would visibly rearrange itself every time it grew.

Fix before any incremental growth: derive each building's seed from a **stable
identity** — its lot address, or a persistent id assigned once and stored in the
change log — never its index. Then adding the fiftieth building leaves the first
forty-nine byte-identical.

This is deliberately **not done yet**. Doing it changes every building's
appearance, which moves the baseline numbers. That is expected and fine, but it
should happen in its own commit with the baseline re-measured and re-recorded, not
smuggled in alongside other work. See `docs/DECISIONS.md`.

## Growth

Any building placed at runtime must pass the same validation as a founding one:
room reachability, egress windows, stair geometry, and the building-vs-building
separation check. `render/town.js` has `Town.checkSeparation()` and
`render/plan.js` has the rest. **There must be no code path that places a building
without validating it** — three buildings were once generated inside each other and
the panel still read "0 errors" because nothing checked buildings against each
other.

Known obstacle: chunk meshes are immutable once uploaded — `Town.build()` nulls the
builders after `ch.mesh = ch.base.build()`. Adding a building to an existing chunk
means rebuilding that chunk. `Town.build()` also calls `W.reset()`, which clears
every collider, surface, asset and item, so there is no incremental path today.

## Status

The vertical slice works and is enforced by `node tools/slice.js`:

- `registry.js` — the world state: seed + growth records + change log +
  digest-verified sim snapshot. Persisted through injected storage
  (`localStorage` in the browser, a Map in the harness).
- `growth.js` — lot and house-type choice by the allocator's own snug-fit
  principles, over plain site data.
- `bootstrap.js` — the one composition both hosts run: load, catch up elapsed
  world days, route growth requests to lot choice, gate every commit through
  the town's own validators via the host's `tryBuild`. **There is no code path
  that places a building without validating it** — `worldCommit` is only ever
  called after a clean `tryBuild`. Also exposes `worldSession(...)` for live,
  watched day-stepping (D15): one day at a time, same validation gate and
  labor gating as catch-up, optional `adapter.onGrowthCommitted` fired once
  per live commit so the render layer can spawn meshes without a reload.

Since 2026-08-05 (D15): the founding 49 are world records with identity-derived
seeds (`doc.founding`, `ASH.buildingSeed` — byte-identical to render's
`idSeed`), captured once, order-independent, drift logged. Growth commits
mid-session through `worldSession`; `node tools/growth.js` proves the live and
catch-up paths reach the byte-same digest. Still open at the render layer:
consuming the founding seeds in `render/town.js` (moves appearances and the
baseline — its own commit), and chunk mesh rebuilding (P2) to draw a live
commit without a full rebuild.

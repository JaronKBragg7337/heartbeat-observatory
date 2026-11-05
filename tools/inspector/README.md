# Building inspector

The inspector measures a world's 3D geometry. It does not just walk through it.
It answers five questions for every building: is the roof closed, can you get
through every doorway, is every stair legal (run, landings, headroom), can you
walk into every room, and is anything floating or clipping. It also writes an
inventory: what's built, what's planned, and what's in the files but never shown.

```bash
node tools/inspector/inspect.js ashgrove          # world3/town: full checks, ~25 s, no browser
node tools/inspector/inspect.js ashgrove --check  # exit 1 if any building has a problem
node tools/inspector/inspect.js world2            # /world2/: browser, read-only, roof holes + floating parts
node tools/inspector/inspect.js townsquare        # /engine/hub/: same
node tools/inspector/shoot.js <siteRoot> <outDir> # Ashgrove evidence shots + console-error check (1280 and 390x844)
```

Reports go to `tools/inspector/reports/<world>/`: `README.md` (summary),
one `Bxx.md` per building, `INVENTORY.md` and `report.json`.
`reports/ashgrove/BEFORE.md` is the same inspector run against the render code
as it was before the 2026-11-05 fixes (`--render-dir`).

## How it measures (Ashgrove)

`ashgrove.js` boots the real town generator in Node. It uses the same stub-GL
sandbox as `world3/town/tools/baseline.js`. Before the town builds, it wraps
`Builder.quad`, so every triangle the town emits is recorded in world space.
Each triangle is tagged with its building and its asset id/type
(`B12-K01 roof`, `B12-L1-W03 wall`, ...). Interiors are built too. `core.js`
then casts axis-aligned rays through that triangle soup. Every world on the
site is built on a 90° grid, so six ray directions cover every face, and
bucketing the triangles makes the 49 buildings take seconds.

| check | how |
|---|---|
| roof holes | a sky ray every 0.2 m over the footprint; if one gets below the wall tops, that's a hole |
| roof gaps | horizontal rays from all four sides, every 0.2 m × 0.1 m in the band between the wall tops and the ridge. A ray that gets 0.8 m inside the footprint without touching anything, below the roof surface there, is a sightline into the roof cavity. Clusters under 0.05 m² count as sampling noise |
| stairs | from the plan + colliders: clear landing in front of the first step and past the last one (IRC R311.7.6: ≥ stair width, 0.914 m), and headroom straight up from every tread (R311.7.2: 2.032 m) |
| doorways | clear floor on both sides of every door, probed at knee and chest height against every collider (walls, furniture, fences, steeples...) |
| rooms | flood-walked from the front door with the player's own `floorAt`/`blockedAt`. This is the same walk as `world3/town/tools/walkable.js`, which it imports. Each room is "no way in", "blocked by furniture" (reachable once furniture is removed), "cramped" (< 35% of the floor walkable) or "ok" |
| floating / clipping | the town's own float/bury audit (`render/debug.js`), plus solid colliders that interpenetrate by > 4 cm (furniture into walls, furniture into furniture) |

## World 2 and Town Square (read-only)

`threejs.js` opens the page in headless Chromium and serves three@0.182.0 from
a local npm install (set `INSPECTOR_THREE`, or `npm i three@0.182.0` next to this
file; the sandbox may not reach the CDN). It hooks `WebGLRenderer.render` to
catch the live scene, then bakes every visible mesh, instances included, into
the same triangle soup. Those worlds don't expose any building records, so
only the geometry-only checks run: roof holes (pits in the sky heightfield),
floating parts (separate meshes under 30 m with nothing under them), mesh
inventory and unreferenced files. To get stair, door and room checks there, write an
adapter like `ashgrove.js` that reads the world's own lot/building data.
`world2/city.js` builds from a kit with lots, so that's the natural next adapter.

## Limits

- It measures geometry and collision, not looks. A closed roof can still be ugly.
- Interior doors count as openable, because a player can open them.
- The stair checks use the plan's stair record. A stair built some other way
  (a prop, a ramp) isn't seen.
- SwiftShader screenshots are real renders, but their frame times mean nothing.

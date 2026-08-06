# Ashgrove — NPC & Online

A living town where NPCs and online players share one world. The town grows itself
as the population does. People hold jobs; so do NPCs — and a player who shows up
and does the work can take a seat from an NPC, or lose it back when they stop
showing up. Households keep pets and raise children.

**[▶ Walk the town](https://jaronkbragg7337.github.io/ashgrove-npc-online/)** —
works on phones.

Right now this repo is the town plus a scaffold. The systems above are the
destination, not the current state. `docs/STATUS.md` is honest about the
difference.

---

## What's here

```
render/    the town — generator, validator, renderer, camera, edit mode
world/     spatial state: growth records, change log, the world composition
sim/       authoritative simulation: people, jobs, organisms, the clock
tools/     the regression contract, the layer guard, the vertical slice
docs/      decisions, status, and the state-authority map
```

## The one architectural rule

**`sim/` must never depend on `render/`.**

The town builds a building's interior when the camera comes within ~46 m and frees
it when the camera leaves, capping live interiors at 16. If an NPC's existence runs
through a mesh, that NPC stops existing when you walk away. Simulation residency
and render residency are different things.

```bash
node tools/layers.js
```

fails if anything in `sim/` reaches for the renderer, a GPU or the DOM.

## The regression contract

The town holds 14 measurable guarantees. They are a command, not a promise:

```bash
node tools/baseline.js
```

## The vertical slice

One chain of cause and effect proves the town, the economy and the organism
lifecycle must interact — a birth overcrowds a house, demand starts a build,
a builder's labor completes it, and the town's own validators gate the commit:

```bash
node tools/slice.js
```

It runs both layers headlessly (the town in the same stub-device sandbox as the
baseline) and exits non-zero if any link breaks: the child's inherited traits,
the labor gating, address resolution (`B50-L0-R01`), identity-seeded replay
stability, and run-over-run determinism.

No dependencies, no browser, no GPU — it runs the real generator and the real
validators in Node against a stub device and re-measures everything:

| | |
|---|---|
| 49 buildings | 13 house types × 3, 10 civic |
| 0 errors, 0 warnings | from the town's own validator |
| 0 overlaps | closest pair 2.00 m apart |
| 22 / 22 | two-storey buildings walkable to the upper floor |
| 4284 assets · 1414 furniture items · 3110 colliders | |
| 863,160 triangles · 0 degenerate polygons | |

`--check` exits non-zero on regression; `--json` for tooling.

## The living town

The population is not a screenshot promise anymore. NPCs walk door-to-door
itineraries — work, school, errands, the park — routed over a sidewalk graph,
on a visible 24-minute town day. Households have dogs and cats that wander
yards and follow their people. And the job seats are real: walk up to the
builders' yard and take one, work shifts to keep it, or stop showing up and
walk the NPC you displaced reclaim it. The town eats, too: food, water and
energy are core state (D14), produced by real utility jobs at the General
Store, the Diner and Water & Light — press **≡ TOWN** (or **J**) to watch the
stocks drain, and **⚙ SETTINGS** for sensitivity, quality, night mode and
more.

```bash
node tools/ambient.js
```

verifies all of it headlessly: street graph vs. town source, door-to-door path
clearance, plan determinism, pet behaviour, and the full role-swap cycle.

Frames per second, draw calls and VRAM need a real device. They're reported as
inherited reference values and marked **unverified** rather than silently assumed.

## Where the town came from

Copied verbatim from
[Online-NPC-City-](https://github.com/JaronKBragg7337/Online-NPC-City-) at
`f3b41ce9c26365d230b01376896519273f34d8ff`, committed unchanged as the first commit
here. That repo, along with
[the-current](https://github.com/JaronKBragg7337/the-current) and
[livi-organism](https://github.com/JaronKBragg7337/livi-organism), is reference
material and is never modified by this project. Principles get re-implemented here;
code does not get imported.

## Why the town is worth building on

It doesn't place buildings randomly. It solves each floorplan against a code book of
real construction dimensions — door 813 × 2032 mm, bedroom ≥ 7.0 m² with an egress
window, hall ≥ 1067 mm, stair 190.5 rise / 254 run — then validates the result and
reports failures instead of shipping them. That validator has caught eight real
defects, including three buildings generated inside each other.

Every asset carries a permanent ID on a 4 m grid, so `B07-L1-R03` is a room you can
teleport to and `B07-L0-R03-F02` is a specific chair. That addressing is what makes
"NPC #47 is asleep in B07-L1-R03" a resolvable statement rather than a figure of
speech — and it's why this is the right foundation for the rest.

Full detail on the generator, the code book and the validator lives in `render/` and
in the [source repo's README](https://github.com/JaronKBragg7337/Online-NPC-City-).

## Running it

```bash
python -m http.server 8099
```

Then `http://localhost:8099`. It needs a server — `file://` blocks the script loads.

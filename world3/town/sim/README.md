# sim/ — authoritative simulation state

Everything that is true about the world whether or not anyone is looking at it.

People, households, jobs, businesses, organisms, unmet demand, the clock. Plain
data plus a deterministic tick. No geometry, no meshes, no DOM, no GPU.

## The one rule

**`sim/` must never depend on `render/`.** Enforced by `node tools/layers.js`.

This is not style. The town builds a building's interior when the camera comes
within ~46 m and **frees it** when the camera leaves, capping live interiors at
16. If an NPC's existence is tied to a mesh, that NPC stops existing when you walk
away. Simulation residency and render residency are different things and this
directory is the half that must not blink.

## What belongs here

| | |
|---|---|
| people | identity, age, household, needs, schedule |
| roles | a seat in a business: occupied by an NPC or a player, vacatable, reclaimable |
| businesses | what they consume, produce, employ |
| organisms | pets and children — traits, lifecycle, inheritance |
| demand | unmet housing and commerce pressure, the signal that grows the town |
| clock | how time advances, and whether it advances unobserved |

## What does NOT belong here

Anything you can see. Positions are *addresses* here, not coordinates —
`B07-L1-R03` rather than a vector. Resolving an address to a place in space is
`world/`'s job; drawing it is `render/`'s.

## What the slice deliberately stubs

- **Role-swapping.** Seats are vacatable and occupancy is plain data, and idle
  adults are hired into vacant seats daily — but no *player* can take one yet,
  and no NPC reclaims one from an inactive holder. There is no player entity
  and no activity tracking.
- **Pets.** Children run (birth, inheritance, aging). The pet organism —
  livi's bond/care/legacy loop as a town creature — does not exist yet.
- **Death, migration, needs (food/water/energy).** the-current's full loop is
  proven there; aging, conception and birth run here.
- **New land.** Growth fills the founding plat's free lots (about four). When
  they run out the world says so (`growth-unplaceable`) instead of breaking —
  but platted expansion (new roads, new blocks) is future work.

## Status

The vertical slice works and is enforced by `node tools/slice.js`: clock, IDs,
people and households, trait inheritance, job seats and labor, demand, the day
pipeline, and digest-verified snapshots. Everything above the "stubbed" list is
real; everything on it is labelled.

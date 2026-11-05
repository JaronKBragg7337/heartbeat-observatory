# ashgrove — inventory

## Built (placed in the founding town)

| type | kind | placed |
|---|---|---|
| Ranch (`ranch`) | house | 3 |
| Bungalow (`bungalow`) | house | 3 |
| Cape Cod (`capeCod`) | house | 3 |
| Colonial (`colonial`) | house | 3 |
| Farmhouse (`farmhouse`) | house | 3 |
| Victorian (`victorian`) | house | 3 |
| Tudor (`tudor`) | house | 3 |
| Modern (`modern`) | house | 3 |
| Split Level (`splitLevel`) | house | 3 |
| Cottage (`cottage`) | house | 3 |
| A-Frame (`aFrame`) | house | 3 |
| Townhouse (`townhouse`) | house | 3 |
| Duplex (`duplex`) | house | 3 |
| Town Hall (`townHall`) | civic | 1 |
| Chapel (`church`) | civic | 1 |
| Schoolhouse (`school`) | civic | 1 |
| Fire Station (`fireStn`) | civic | 1 |
| General Store (`store`) | civic | 1 |
| Diner (`diner`) | civic | 1 |
| Library (`library`) | civic | 1 |
| Clinic (`clinic`) | civic | 1 |
| Post Office (`postOffice`) | civic | 1 |
| Barn (`barn`) | civic | 1 |

## Defined in files but never placed (never shown)

None: every type in the library is in town.

## Files under world3/ that no page or script references

None.

## Planned (from the docs, not yet built)

- Growth buildings B50+ (world/growth.js): demand-driven houses appear as the town ages; only ~4 free lots in the founding plat (docs/STATUS.md)
- Multiplayer / one shared saved town (W-23; player is still a module-level singleton)
- Outdoor navmesh, persistent interiors, immutable chunk meshes (docs/DECISIONS.md P1–P3)
- Real-device checks: watching a building rise, z-fighting (W-21)

# ashgrove — building inspector report, BEFORE the 2026-11-05 fixes

Measured by running the inspector against the render/ files as they were at e662453 (`--render-dir`). Compare with README.md (after).

| measure | count |
|---|---|
| buildings | 49 |
| buildings with no problem | 2 |
| roof holes (from the sky) | 0 (0.00 m²) |
| roof gaps (from the side) | 96 (445.70 m²) |
| stairs with no landing at the first step | 22 of 22 |
| stairs with no landing past the top | 0 |
| stairs short of headroom | 22 |
| doorways obstructed | 4 of 422 |
| rooms with no way in | 35 |
| rooms blocked only by furniture | 0 |
| rooms cramped (< 35% walkable floor) | 46 |
| parts floating / buried | 0 |
| clipping pairs | 62 |

## Per building

| building | problems |
|---|---|
| B01 Town Hall | stair B01-L0-ST: first step 0.09 m from B01-L0-W03 (needs 0.914 m landing); stair B01-L0-ST: headroom 0.13 m over tread 17 (needs 2.032 m); 3 clipping pair(s): L0-R03-F03↔L0-W07, L1-R04-F03↔L1-W08, L1-R05-F02↔L1-W09 |
| B02 Fire Station | 2 roof gap(s), 2.6 m²; 1 room(s) cramped (<35% walkable floor): L0-R05 Store 28%; 1 clipping pair(s): L0-R04-F02↔L0-W08 |
| B03 Diner | 3 roof gap(s), 30.26 m²; 2 room(s) cramped (<35% walkable floor): L0-R03 Bath 34%, L0-R04 Store 24%; 1 clipping pair(s): L0-R03-F02↔L0-W07 |
| B04 Chapel | 2 roof gap(s), 17.88 m²; 1 doorway(s) obstructed; front door: front door opens onto something solid; 2 room(s) you cannot walk into: L0-R01 Lobby, L0-R02 Hall |
| B05 Library | pass |
| B06 Clinic | 2 clipping pair(s): L0-R04-F03↔L0-W08, L0-R05-F03↔L0-W09 |
| B07 Schoolhouse | 2 roof gap(s), 4.16 m²; 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B08 General Store | 1 room(s) cramped (<35% walkable floor): L0-R02 Store 28%; 1 clipping pair(s): L0-R03-F03↔L0-W07 |
| B09 Barn | 2 room(s) cramped (<35% walkable floor): L0-R02 Store 28%, L0-R03 Store 29% |
| B10 Post Office | pass |
| B11 Cottage | 3 roof gap(s), 4 m²; 2 doorway(s) obstructed; 1 room(s) cramped (<35% walkable floor): L0-R01 Living 25% |
| B12 Tudor | 3 roof gap(s), 7.38 m²; stair B12-L0-ST: first step 0.09 m from B12-L0-W03 (needs 0.914 m landing); stair B12-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 13%, L0-R07 Laundry 13%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B13 Ranch | 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B14 Cottage | 3 roof gap(s), 4 m²; 1 room(s) you cannot walk into: L0-R04 Bath; 1 room(s) cramped (<35% walkable floor): L0-R02 Kitchen 13% |
| B15 Tudor | 3 roof gap(s), 7.38 m²; stair B15-L0-ST: first step 0.09 m from B15-L0-W03 (needs 0.914 m landing); stair B15-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 13%, L0-R07 Laundry 13%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B16 Duplex | 2 clipping pair(s): L0-R07-F02↔L0-W11, L0-R08-F02↔L0-W12 |
| B17 Duplex | 2 clipping pair(s): L0-R07-F02↔L0-W11, L0-R08-F02↔L0-W12 |
| B18 Duplex | 2 clipping pair(s): L0-R07-F02↔L0-W11, L0-R08-F02↔L0-W12 |
| B19 Cottage | 3 roof gap(s), 4 m²; 1 room(s) you cannot walk into: L0-R04 Bath; 1 room(s) cramped (<35% walkable floor): L0-R02 Kitchen 13% |
| B20 Ranch | 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B21 Ranch | 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B22 Colonial | 3 roof gap(s), 3.34 m²; stair B22-L0-ST: first step 0.09 m from B22-L0-W03 (needs 0.914 m landing); stair B22-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 6%, L0-R05 Dining 18%, L0-R06 WC 16%; 3 clipping pair(s): L0-R01-F02↔L0-W05, L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B23 Colonial | 3 roof gap(s), 3.34 m²; stair B23-L0-ST: first step 0.09 m from B23-L0-W03 (needs 0.914 m landing); stair B23-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 6%, L0-R05 Dining 18%, L0-R06 WC 16%; 3 clipping pair(s): L0-R01-F02↔L0-W05, L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B24 Tudor | 3 roof gap(s), 7.38 m²; stair B24-L0-ST: first step 0.09 m from B24-L0-W03 (needs 0.914 m landing); stair B24-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 13%, L0-R07 Laundry 13%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B25 Colonial | 3 roof gap(s), 3.34 m²; stair B25-L0-ST: first step 0.09 m from B25-L0-W03 (needs 0.914 m landing); stair B25-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 6%, L0-R05 Dining 18%, L0-R06 WC 16%; 3 clipping pair(s): L0-R01-F02↔L0-W05, L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B26 Farmhouse | 3 roof gap(s), 4.8 m²; stair B26-L0-ST: first step 0.09 m from B26-L0-W03 (needs 0.914 m landing); stair B26-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 5%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B27 Bungalow | 3 roof gap(s), 3.74 m²; 1 clipping pair(s): L0-R05-F02↔L0-W09 |
| B28 Bungalow | 3 roof gap(s), 3.74 m²; 1 clipping pair(s): L0-R05-F02↔L0-W09 |
| B29 Bungalow | 3 roof gap(s), 3.74 m²; 1 clipping pair(s): L0-R05-F02↔L0-W09 |
| B30 Farmhouse | 3 roof gap(s), 4.8 m²; stair B30-L0-ST: first step 0.09 m from B30-L0-W03 (needs 0.914 m landing); stair B30-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 5%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B31 A-Frame | 2 roof gap(s), 12.88 m² |
| B32 Modern | stair B32-L0-ST: first step 0.09 m from B32-L0-W03 (needs 0.914 m landing); stair B32-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B33 Modern | stair B33-L0-ST: first step 0.09 m from B33-L0-W03 (needs 0.914 m landing); stair B33-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B34 Farmhouse | 3 roof gap(s), 4.8 m²; stair B34-L0-ST: first step 0.09 m from B34-L0-W03 (needs 0.914 m landing); stair B34-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 5%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B35 Modern | stair B35-L0-ST: first step 0.09 m from B35-L0-W03 (needs 0.914 m landing); stair B35-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B36 A-Frame | 2 roof gap(s), 12.88 m² |
| B37 A-Frame | 2 roof gap(s), 12.88 m² |
| B38 Townhouse | 2 roof gap(s), 4.92 m²; stair B38-L0-ST: first step 0.09 m from B38-L0-W03 (needs 0.914 m landing); stair B38-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 doorway(s) obstructed; 4 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Hall, L1-R03 Bedroom, L1-R04 Bath; 1 room(s) cramped (<35% walkable floor): L0-R03 Kitchen 29% |
| B39 Cape Cod | 3 roof gap(s), 4.96 m²; stair B39-L0-ST: first step 0.09 m from B39-L0-W03 (needs 0.914 m landing); stair B39-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 4 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom, L1-R04 Bedroom, L1-R05 Bath; 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 7%, L0-R05 Dining 7%, L1-R03 Hall 3%; 1 clipping pair(s): L0-R01-F02↔L0-W05 |
| B40 Cape Cod | 3 roof gap(s), 4.96 m²; stair B40-L0-ST: first step 0.09 m from B40-L0-W03 (needs 0.914 m landing); stair B40-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 4 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom, L1-R04 Bedroom, L1-R05 Bath; 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 7%, L0-R05 Dining 7%, L1-R03 Hall 3%; 1 clipping pair(s): L0-R01-F02↔L0-W05 |
| B41 Townhouse | 2 roof gap(s), 4.92 m²; stair B41-L0-ST: first step 0.09 m from B41-L0-W03 (needs 0.914 m landing); stair B41-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 room(s) you cannot walk into: L1-R01 Main Bed; 1 clipping pair(s): L0-R01-F02↔L0-W05 |
| B42 Cape Cod | 3 roof gap(s), 4.96 m²; stair B42-L0-ST: first step 0.09 m from B42-L0-W03 (needs 0.914 m landing); stair B42-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 4 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom, L1-R04 Bedroom, L1-R05 Bath; 3 room(s) cramped (<35% walkable floor): L0-R04 Kitchen 7%, L0-R05 Dining 7%, L1-R03 Hall 3%; 1 clipping pair(s): L0-R01-F02↔L0-W05 |
| B43 Victorian | 3 roof gap(s), 7.98 m²; stair B43-L0-ST: first step 0.09 m from B43-L0-W03 (needs 0.914 m landing); stair B43-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 10%, L0-R07 Laundry 9%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B44 Victorian | 3 roof gap(s), 7.98 m²; stair B44-L0-ST: first step 0.09 m from B44-L0-W03 (needs 0.914 m landing); stair B44-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 10%, L0-R07 Laundry 9%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B45 Townhouse | 2 roof gap(s), 4.92 m²; stair B45-L0-ST: first step 0.09 m from B45-L0-W03 (needs 0.914 m landing); stair B45-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 1 room(s) you cannot walk into: L1-R01 Main Bed; 1 clipping pair(s): L0-R01-F02↔L0-W05 |
| B46 Victorian | 3 roof gap(s), 7.98 m²; stair B46-L0-ST: first step 0.09 m from B46-L0-W03 (needs 0.914 m landing); stair B46-L0-ST: headroom 0.12 m over tread 14 (needs 2.032 m); 2 room(s) you cannot walk into: L1-R01 Main Bed, L1-R02 Bedroom; 2 room(s) cramped (<35% walkable floor): L0-R06 WC 10%, L0-R07 Laundry 9%; 2 clipping pair(s): L0-R06-F02↔L0-W10, L1-R05-F02↔L1-W09 |
| B47 Split Level | 4 roof gap(s), 76.46 m²; 1 room(s) cramped (<35% walkable floor): L0-R07 Bedroom 8%; 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B48 Split Level | 4 roof gap(s), 76.46 m²; 1 room(s) cramped (<35% walkable floor): L0-R07 Bedroom 8%; 1 clipping pair(s): L0-R06-F02↔L0-W10 |
| B49 Split Level | 4 roof gap(s), 75.88 m²; 1 room(s) cramped (<35% walkable floor): L0-R07 Bedroom 8%; 1 clipping pair(s): L0-R06-F02↔L0-W10 |



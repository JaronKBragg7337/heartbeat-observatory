# Fort Wayne — Phase 1 recognition lab

**Downtown Fort Wayne as an interpreted digital twin.** Lab world, solo preview, built
2026-06-12 in a Cowork run per the "FUTURE WORLD: FORT WAYNE" section of WORLD2-PLAN.md.
Walk it at `/worlds-lab/worlds/fort-wayne/`.

**The win condition is RECOGNITION:** someone from Fort Wayne walks in and says
"wait... this feels like downtown" from geometry alone. Not 1:1 realism — the road
skeleton, the three-rivers confluence, bridge positions, landmark placement, downtown
density.

## What is real data (OpenStreetMap, ODbL — see CREDITS.md)
- **The three rivers** — riverbank polygons plus buffered centerlines where OSM has no
  bank polygon (the St. Marys at the MLK bridge stretch exists only as a centerline).
  The confluence (St. Joseph + St. Marys → Maumee) is computed from the data: the
  shared endpoint of the named centerlines.
- **Every street** (453 clipped segments, true widths by class), **every block**
  (1,200 building footprints, extruded), **the rail line**, **17 parks**, **bridges**
  (tagged ones, plus inferred decks where a road provably crosses water — Clinton St's
  crossing carries no bridge tag in OSM; reality wins).
- **26 street labels + river + park names**, placed from the data.
- **146 named buildings, tappable** — tap any building and the HUD chip says what it
  is. 125 carry their own OSM name tag (Allen County Public Library, Taco Bell,
  Subway, McDonald's, Rally's, the YMCA...); 43 named POI nodes (storefronts) are
  point-in-polygon matched into the footprint that contains them, so one block
  building can answer with several businesses (e.g. PNC Bank · Full Circle Grill &
  BBQ). POIs inside no footprint are dropped, not guessed. Unnamed buildings answer
  "no name in OSM" — nothing is invented.

## What is interpreted (and why)
- **Scale**: 1 world unit = 2 m. Heights from `height`/`building:levels` tags where
  tagged; modest area-based defaults where not (most of downtown's mid-rises carry no
  tags — honest limitation, noted here rather than hidden).
- **Hand-anchored true heights** (sparse OSM tagging would flatten the skyline):
  - Lincoln Bank Tower — untagged/unnamed in the extract; anchored by a point inside
    its real footprint (mid-block, south side of E Berry between Calhoun & Clinton),
    height set to its true ~95 m / 22 floors.
- **Eight hand-built hero anchors** (LOOK.md doctrine — heroes carry recognition,
  everything else stays humble boxes): Allen County Courthouse (the green dome),
  Embassy Theatre (blade sign + marquee, lit at dusk), Lincoln Bank Tower (deco
  setbacks + gold crown), Indiana Michigan Power Center (135 m slab + blinking
  beacon), Cathedral of the Immaculate Conception (twin spires), Parkview Field
  (open bowl, field + light standards, walk in through the NE gate), Wells Street
  Bridge (the 1884 iron through-truss, now a footbridge — true in OSM: its way is
  tagged pedestrian), MLK Memorial Bridge (white arches, LED-lit at night like the
  real one).
- **Rivers sit below street grade** (the levee feel): water at −3.4 m, bed at −5.2 m.
  You can wade — banks slope, your eyes stay above water. Swimming is not built and
  nothing pretends it is.
- **The bbox** was widened ~300 m south of the plan's "roughly" spec because the spec
  edge clipped Parkview Field — a named hero. Final: (41.0690, −85.1480) to
  (41.0870, −85.1260).

## Honest empty states
- No doors lead anywhere — so there are no doors (and no dead ENTER button either).
- No shared presence; the HUD chip says `lab · solo preview`.
- District interiors, container buildings, the shell, multiplayer, and the gate are
  later phases (P2–P4 in WORLD2-PLAN.md), not faked here.

## How the data was built (worlds-become-data, city edition)
```
tools/overpass-query.txt   the exact Overpass query (bbox above)
tools/convert-osm.mjs      node, zero deps: clips to bbox, projects to meters,
                           stitches multipolygon rings, buffers bare centerlines,
                           infers untagged bridges from water crossings, finds the
                           confluence, anchors heroes, emits data.js
data.js                    generated output — do not hand-edit
```
Regenerate: fetch the query against any Overpass mirror, then
`node tools/convert-osm.mjs /path/to/extract.json`. OSM snapshot used:
2026-06-12 (timestamp in data.js meta). The query also pulls named POI nodes
(amenity/shop/tourism/office/leisure) for tap-to-identify.

## Phase plan (from WORLD2-PLAN.md)
- **P1 (this)** — recognition lab: rivers, roads, bridges, blocks, hero anchors. ✔
- **P2** — explorable districts + container buildings per WORLD-STANDARD.
- **P3** — promotion to real world: shell port, gate, multiplayer channel
  (`fort-wayne-town`), touch_world allowlist.
- **P4** — the living layer: events at the Embassy, riverfront walks, social anchors.

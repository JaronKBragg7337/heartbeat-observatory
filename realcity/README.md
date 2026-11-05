# Real City: real places at real size

The first world of the **Realistic** ring. Any city, built from OpenStreetMap at real scale, streamed in 250 m tiles.
First city: downtown Fort Wayne, at `/realcity/fort-wayne/` (also `/realcity/?city=fort-wayne`). You start at the Allen County Courthouse.

This is separate from World 2 (`/world2/`, the stylized downtown) and shares no code with `/worlds-lab/`.

## Add a city (one command)

```
node tools/realcity/fetch.mjs --city chicago --bbox 41.872,-87.640,41.890,-87.620 --origin 41.8819,-87.6278 --name "Chicago Loop" --elev
```

- `--bbox s,w,n,e` is the area; `--origin lat,lon` becomes the point (0,0) (put it on the spawn landmark).
- `--elev` samples USGS 3DEP elevation on a 25 m grid (US only).
- Or add the city to `realcity/cities.json` (bbox, origin, spawn, landmarks, hooks) and run `node tools/realcity/fetch.mjs --city <id> --elev`.
- The output goes to `realcity/data/<id>/`. The page is `/realcity/?city=<id>`; for a short URL, copy `realcity/fort-wayne/index.html` to `realcity/<id>/` and change `RC_CITY`.
- **Gentle on Overpass:** one query per 1 km fetch cell (16 tiles), a 4 s wait between queries, a User-Agent, and retry with backoff. Every raw answer is cached in `tools/realcity/.cache/<id>/` (git-ignored), so re-running to change the tile format downloads nothing. `--refresh` re-downloads.
- **3DEP note:** the USGS server resets Node's built-in `fetch`, and long GET URLs too. The tool POSTs through `curl` (it ships with Windows 10+).

## What the data step makes

- `index.json` holds:
  - the city box, the tile list and all street names;
  - **skyline**: one oriented box per building, used for the far city as one instanced draw call;
  - **roadsLite**: the streets for the big map;
  - landmarks, door hooks and stats.
- `t_<ix>_<iz>.json`, one per 250 m tile, in decimetre integers relative to the tile corner:
  - buildings (ring, holes, height, min height, ground, flags, family, levels, name, colour, OSM id, roof height, roof colour);
  - roads (kind, width, name, one-way/bridge, lanes, points, junction marks, ground heights);
  - rail, waterway lines, areas clipped to the tile (water, park, grass, woods, parking, pitch, cemetery);
  - tree nodes and an 11 x 11 ground-height grid.
- Heights: the `height` tag wins, then `building:levels` x 3.3 m, then a default by building type (**marked as guessed**). Tap a building in the world to see which. `?guess=1` paints every guessed building orange.
- OSM 3D buildings: when a building has `building:part`s that reach the ground, the parts are drawn instead of the outline. When only the upper parts are mapped (the courthouse), the outline stays as the base. `roof:shape=dome` becomes a real dome, and `gabled`/`hipped` (plus small houses) get pitched roofs.

## How the world draws it (phone budget)

| | Fort Wayne, measured (Playwright on the MSI's Intel UHD; real iPhone not tested yet) |
|---|---|
| Data for the whole downtown | 1.66 MB raw / 0.55 MB gzipped, 182 tiles + index |
| Downloaded at spawn | about 0.4-0.47 MB raw |
| Cold load to ready (local server) | 1.7 s Chromium, 1.9-2.2 s WebKit |
| Draw calls, street at spawn | 50 phone / 68 desktop |
| Draw calls, aerial | 85 phone / 159-191 desktop |
| Triangles, aerial | 245k phone / 400-430k desktop |
| Frame time median | 16.6-16.8 ms (vsync 60 fps) in Chromium; p95 jumps to 60-85 ms while tiles build |

- **One atlas, one draw call per layer.** Every facade piece is a cell in one 1024 px canvas atlas:
  - brick, buff brick, limestone, curtain glass, ribbon, house siding, industrial, garage;
  - three storefronts, two blank walls, roof gravel, shingles, metal.
  A small shader patch tiles a cell with `fract` and `textureGrad` (no mip seams) and lights windows one by one at night from a hash. All buildings in a tile cost 1 call, and all ground, roads, paint and parks cost 1 call.
- Near tiles (330 m) add the World 2 kit's pieces:
  - storefronts with a sign band on the edges that face a street;
  - cornices on brick and stone;
  - rooftop units;
  - centre lines and lane lines trimmed at junctions;
  - crosswalks, lamps, and green street-name blades at every named junction.
- Mid tiles (620 m phone / 800 m desktop) have the same buildings and streets. The far city is the instanced skyline.
- Budget limits, as in WORLD2-REMAKE: ≤ 250 calls on the street, ≤ 300 aerial, ≤ 400k triangles mobile-high.
- **Known cost:** a tile builds on the main thread (about 40-70 ms), which causes the p95 spikes while walking. Next step: build the tile geometry in a Web Worker.

## Hooks: the site lives inside the world

`RC.registerHook({ id, kind: "door", label, x, z | lat, lon, href, onEnter })`, or a `hooks` entry in `cities.json`.

- A hook gets a glowing green door mat snapped to the nearest wall, and a prompt when you stand on it.
- `href` opens a page; `onEnter(h)` runs code (an interior, a cabinet, a shelf).
- The courthouse door mat is a placeholder: "inside comes later" (interior + court role-play).

## Licenses and credit

- **Map data: © OpenStreetMap contributors, ODbL 1.0.** The credit is on screen at all times and links to openstreetmap.org/copyright. The tiles are a Derivative Database under ODbL: if they are shared, they must stay under ODbL with the same credit. The page code is not affected.
- **Elevation: USGS 3D Elevation Program**, public domain, credited on screen.
- Textures are generated in code (no downloads, no third-party art).

## Landmarks that need custom work later

- **Allen County Courthouse:** OSM maps the dome, drum and corner pavilions as parts. What's missing:
  - the true Beaux-Arts detail (columns, pediments);
  - the statue: there is a 1 m gap in the data under the top cap;
  - the copper colour.
  A Blender bake (World 2 phase 6) is the real fix.
- **Not mapped in 3D yet:** Embassy Theatre, Lincoln Tower (deco crown), Indiana Michigan Power Center, the Allen County Public Library, the Rosa Parks/Citizens Square, Parkview Field, Promenade Park, the Wells St bridge truss.
- Only **3%** of downtown buildings have a real height (37 tagged + 174 from levels of 6,031); 97% are guessed by type. **Improving OSM itself is the best lever:** adding `building:levels` to downtown buildings helps everyone. Alternative: derive heights from 3DEP lidar first returns (DSM minus DEM). That's possible with the same USGS service, but not built yet.

## What Chicago or DC would need

- **Washington DC:** OSM heights are much better (the DC government imported building heights). The terrain is gentle and the grid is regular plus diagonals; it would mostly just work.
  - Need: monument/dome landmarks (Capitol, Washington Monument), and more draw-call care on the Mall's long sightlines.
  - Data: about 2-3x Fort Wayne's per km².
- **Chicago Loop:** heights are mostly tagged (city import).
  - Very tall towers need setbacks from `building:part` (the tool supports parts).
  - The elevated 'L' (bridge rail over streets) needs piers.
  - The river has bascule bridges.
  - Density is 4-6x Fort Wayne, so it needs: the Web Worker build, tighter mid radius on phones, and per-tile LOD for the far ring (simplified facades beyond 400 m).
  - The skyline instanced box list would be about 1 MB for a 3 km box; it should move to a binary format.
- Both: Overpass cells of 500 m instead of 1 km (bigger answers), and maybe a regional extract (Geofabrik .pbf) instead of Overpass for anything bigger than ~5 km.

## Testing

Run the server and the test script (they live in `AI-Shared/scratch/realcity/`):

```
node serve.cjs 8124
node test.cjs chromium|webkit phone|desk
```

The test checks cold load, console errors, tap-to-walk, drag-look, streaming while walking, the map, the attribution, draw calls and frame time. It saves screenshots: courthouse by day and night, aerial, street sign. `?dev=1` exposes `window.RC`, `?tod=0.3|0.85` freezes the time of day, and `?noshadow` turns shadows off.

# Fort Wayne lab world — credits & licensing

## Map data
**(c) OpenStreetMap contributors**, licensed under the
[Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright).

- Extract: Overpass API (mirror: overpass.kumi.systems), snapshot 2026-06-08,
  bbox (41.0690, −85.1480) → (41.0870, −85.1260) — downtown Fort Wayne, Indiana.
- The exact query is committed at `tools/overpass-query.txt`; the converter at
  `tools/convert-osm.mjs`; the derived database is `data.js` (which carries the
  attribution in its header).
- Attribution is shown in-world: a permanent "map data © OpenStreetMap" HUD chip
  linking to openstreetmap.org/copyright, plus the entry overlay.
- Google/Apple imagery was NOT used (per WORLD2-PLAN.md: not license-compatible).

## Everything else
All geometry, textures, and signs are code-built in this repo (procedural canvas
textures from the frozen worlds-lab kit lib/v1) — zero downloaded art, no external
media. Landmark heights/dates on signs are public facts (e.g. Lincoln Bank Tower,
1930, 22 floors; courthouse, 1902).

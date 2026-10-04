# The Cosmos — Provenance

Every number and every asset in this project has a source. Where a source could
not be verified live, that is recorded here rather than hidden.

Owner: Jaron K. Bragg · Public URL: https://www.heartbeatobservatory.com/games/the-cosmos/

## Code and libraries

| Item | Licence | Source | Notes |
|---|---|---|---|
| Three.js r160 | MIT | https://threejs.org | Vendored at `lib/three.module.js` |
| Everything else in `src/` | original | this repository | Written for this project |

No third-party game code, engine, or template is used.

## Planetary data — Mars

Verified live on **2026-08-16**:

| Value | Used | Source | Verified |
|---|---|---|---|
| Volumetric mean radius | 3,389.5 km | NASA NSSDC Mars Fact Sheet | live (via search result text) |
| Surface gravity | 3.7 m/s² | NASA NSSDC Mars Fact Sheet | live (via search result text) |
| Obliquity (axial tilt) | 25.19° | https://science.nasa.gov/mars/facts/ (25°) | live |
| Rotation period | 24.6229 h | https://science.nasa.gov/mars/facts/ (24.6 h) | live |
| Semi-major axis | 2.279e11 m | https://science.nasa.gov/mars/facts/ (228M km) | live |
| Orbital period | 687 days | https://science.nasa.gov/mars/facts/ | live |
| Temperature range | −153 to +20 °C | https://science.nasa.gov/mars/facts/ | live |
| Valles Marineris extent | 3,870 × 600 km, 9.3 km deep | https://science.nasa.gov/mars/facts/ | live |
| Olympus Mons height | 40 km (NASA figure) | https://science.nasa.gov/mars/facts/ | live |

**Recorded but NOT live-verified.** The NSSDC Planetary Fact Sheet at
`nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html` now returns a 307
redirect to automated fetchers, so the full table could not be read directly on
2026-08-16. These are the widely published NSSDC values and must be confirmed by
a human before being treated as measured evidence:

- Mass 6.417e23 kg
- Equatorial radius 3,396.2 km · Polar radius 3,376.2 km
- Escape velocity 5.03 km/s
- Surface pressure 610 Pa
- Atmospheric composition (95.32% CO₂, 2.7% N₂, 1.6% Ar, 0.13% O₂, 0.08% CO)

`test/validate.mjs` cross-checks the stated surface gravity against G·M/r² from
the stated mass and radius. They agree to 0.19%, which is consistent with Mars
not being a uniform sphere — so the two independent figures corroborate each
other rather than being copied from one another.

Olympus Mons is recorded here at **21,900 m above the areoid**, not the 40 km
NASA quotes. NASA's figure is local relief above the surrounding plains; this
project measures elevation against the areoid datum, so the datum-relative
number is the correct one to use. Stating both is deliberate.

## Textures and materials

**Current status: none shipped.** All surfaces are currently shaded from
material records in `src/world/field.js` — real densities, real colours, real
roughness values per rock type — with no image textures at all.

Approved CC0 sources, both confirmed on 2026-08-16:

| Source | Licence | Confirmed |
|---|---|---|
| https://ambientcg.com/ | CC0 1.0 Universal | 2026-08-16 |
| https://polyhaven.com/license | CC0 1.0 Universal | 2026-08-16 |

When a texture is added it must record: exact asset-page URL, creator, licence,
licence evidence date, SHA-256 of the source file, local file paths, every
modification made, real-world physical size of one tile in metres, mapping
method, and which material zone it belongs to.

Do not ship "free", attribution-only, editorial-use, unknown-licence, or scraped
material as if it were CC0. A marketplace homepage is not a source; the asset
page is.

## Asset identity

Every asset carries a stable ID: `COS-<BODY>-<TYPE>-<SEQ>`. Current registry:

| ID | Name | Type |
|---|---|---|
| COS-MARS-TER-0001 | Mars global shell | terrain |
| COS-MARS-CHR-0001 | Player (EVA suit) | character |
| COS-MARS-STR-0001 | Survey mast | structure |
| COS-MARS-LMK-0001 | Olympus Mons | landmark |
| COS-MARS-LMK-0002 | Valles Marineris | landmark |
| COS-MARS-LMK-0003 | Airy-0 (prime meridian origin) | landmark |
| COS-MARS-LMK-0004 | Hellas Planitia | landmark |

Authored dimensions are intent. Measured bounds are evidence. The registry
stores both and the validator compares them.

## The ship (MSV Meridian), added 2026-09-29

Built by Claude Sonnet 5.5. Nothing here is downloaded.

| Item | Source |
|---|---|
| Geometry (hull, rooms, furniture, machinery) | Written in code, `src/ship/`. |
| Textures (wall panels, deck plate, grating, hull armour, doors, signs, posters, screens) | Painted in code onto canvases at load, in metres. No image files, so nothing to license. |
| Normal and roughness maps | Derived from the painted height layer (Sobel filter). |
| Sound (engines, guns, doors) | Synthesised at run time from oscillators and filtered noise (`shipAudio.js`). No samples. |
| The child's drawing, family photograph and posters on crew walls | Drawn in code (`makePosterAtlas`). |
| Physical figures (mass 46 t, thrust 300 kN, gravity, deck sizes) | Design numbers chosen for this game; gravity is Mars' from `bodies.js`. Building-code stair riser 0.1875 m and door 2.1 m are ordinary published values. |

Three.js r160 (MIT) remains the only third-party code.

## Marineris Port, added 2026-09-30

Built by Codex. Pads, markings, drainage, tie-downs, buildings, fuel equipment,
containers, furniture, signs and dust textures are generated in `src/port/`.
No external assets, photos, fonts, audio or models were downloaded. Text uses
the browser's system sans-serif font. The apron sizes and construction details
are game design measurements; the planetary frame and gravity still come from
the sourced Mars record. Field earthworks preserve the volume representation.
Stable IDs and review instructions: [MARS-PORT-REVIEW.md](MARS-PORT-REVIEW.md).

## The Moon (WD-MOON, Oct 3)

| Value | Used | Source | Verified |
|---|---|---|---|
| Mass | 7.346e22 kg | NASA Moon Fact Sheet (0.07346e24 kg) | live, 2026-10-03 |
| Volumetric mean radius | 1,737.4 km (LOLA's reference sphere) | NASA Moon Fact Sheet | live |
| Surface gravity | 1.62 m/s2 (worked out from the two above: 1.624) | NASA Moon Fact Sheet | live |
| Sidereal rotation | 655.720 h (locked to Earth) | NASA Moon Fact Sheet | live |
| Obliquity to orbit | 6.68 deg | NASA Moon Fact Sheet | live |
| Orbit | a 384,399 km, e 0.0549, i 5.145 deg, with Meeus's rates | NASA fact sheet (shape) and Meeus, Astronomical Algorithms (rates) | fact sheet live; rates typed from the book: re-confirm |
| Heights | LOLA LDEM_16 pooled to 1 pixel per degree; LDEM_128 (237 m) at Tranquility; LDEM_64 (474 m) at Daedalus; LDEM_80S_80M (160 m after pooling) at Shackleton | NASA PDS, fetched 2026-10-03 (labels read: scale 0.5 m, offset 1737.4 km, polar stereographic, true at the pole) | live |
| Brightness | LROC WAC mosaic 1k, as 360 x 180 grey | NASA SVS 4720 | live |
| Shackleton's sunlight | worked out by tools/bake-lola.mjs from the heights (48 horizon azimuths, Sun +-1.54 deg over a year, 0.27 deg disc) | derived | the result agrees with the published picture: crest lit about 95 percent, floor never |
| Shackleton's place | the crater is 21 km across and 4.2 km deep, centre about 89.66 S, 129.78 E (found in the heights 10.3 km from the pole) | IAU gazetteer, typed by hand; checked against the data | re-confirm |
| Apollo 11 site, Collins, Aldrin, Armstrong, Daedalus, de Gerlache, Haworth, Shoemaker, Faustini | coordinates and sizes in the world defs' landmarks (labels only: the heights already have the craters) | IAU gazetteer, typed by hand | re-confirm by hand |
| Earth from the Moon | Blue Marble Next Generation, 1024 x 512 | NASA Earth Observatory | live |

Game fiction, marked as such in the defs: Tranquility Civil Hub, Shackleton Base, Daedalus Station, the blocs and their people, the lunars, the lane, the ice's exact amounts (the real fact is that LCROSS found water in Cabeus's shadow in 2009; how much there is remains an estimate). The Sun is fixed for play at each landing (a lunar day is 29.5 Earth days): 24 degrees at the hub, 6 degrees at Shackleton (the real Sun never clears 1.54 degrees there), 21 degrees at Daedalus.

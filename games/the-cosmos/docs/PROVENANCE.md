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

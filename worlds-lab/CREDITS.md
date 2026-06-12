# Worlds Lab — Film Credits & Licensing

Every reel that plays on a Worlds Lab screen is **legally free to stream**, and
each theater posts the credit beside its screen in-world (CC BY asks for
attribution; we give it a plaque). Nothing is re-hosted: every video streams
from its original public source. If a source ever goes dark, the screen says so
honestly and moves to the next reel — never a fake.

**All sources verified reachable on 2026-06-11** (method noted per source).

## Blender Foundation open movies (CC BY)

Streamed from Google's public sample bucket (`commondatastorage.googleapis.com/gtv-videos-bucket/sample/`),
the long-standing official demo mirror of these films.

| Film | Year | License | Credit shown in-world |
|---|---|---|---|
| Big Buck Bunny | 2008 | CC BY 3.0 | (c) 2008 Blender Foundation / bigbuckbunny.org |
| Sintel | 2010 | CC BY 3.0 | (c) 2010 Blender Foundation / sintel.org |
| Tears of Steel | 2012 | CC BY 3.0 | (c) 2012 Blender Foundation / tearsofsteel.org |
| Elephants Dream | 2006 | CC BY 2.5 | (c) 2006 Blender Foundation & Netherlands Media Art Institute / orange.blender.org |

## Public-domain features (Internet Archive)

Verified via `https://archive.org/metadata/<identifier>` (checks the item is
live and lists the exact files).

| Film | Year | Status | Source |
|---|---|---|---|
| His Girl Friday | 1940 | Public domain (license URL on the item) | `archive.org/download/his_girl_friday/his_girl_friday_512kb.mp4` |
| Plan 9 from Outer Space | 1959 | Public domain (copyright never renewed) | `archive.org/download/plan-9-from-outer-space-1959/Plan 9 From Outer Space (1959).ia.mp4` |

Note from verification: the classic `night_of_the_living_dead` item is **dark**
(taken down) on archive.org as of 2026-06-11 — it was deliberately NOT used.
Check `is_dark` in the metadata JSON before adding any archive item.

## NASA footage (public domain)

NASA media is generally not copyrighted (17 U.S.C. § 105). Per NASA's media
usage guidelines: no NASA endorsement is implied, and the NASA insignia is not
used as branding. **Watch for licensed music:** several NASA reels credit
"Gothic Storm Publishing" in their descriptions — those were deliberately
avoided; the chosen reel's description carries no music credit.

| Reel | Source |
|---|---|
| "Artemis — Success and Preparation" (5 min, KSC, 2025) | `images-assets.nasa.gov/video/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615/…~medium.mp4` (with `~mobile.mp4` fallback baked in) |

## Adding more reels safely (the 3 checks)

1. **Archive.org:** fetch `archive.org/metadata/<id>` — confirm no `is_dark`,
   confirm a real public-domain/CC `licenseurl`, copy an exact `.mp4` filename.
2. **NASA:** search `images-api.nasa.gov/search?q=…&media_type=video`, then
   fetch the item's `collection.json` for direct mp4 URLs — and skip anything
   whose description credits a music publisher.
3. **Anything else:** if you can't name the license, it doesn't go on a screen.

Then add the entry to `FILMS` in `lib/v1/cinema.js`-style world code (worlds
pass their own playlists — the frozen lib doesn't need editing for new reels:
`cinema(kit, { films: [...] })`).

## Fort Wayne lab world — map data (added 2026-06-12)

The Fort Wayne recognition lab (`worlds/fort-wayne/`) is built from **OpenStreetMap**
data: **(c) OpenStreetMap contributors, ODbL 1.0** (openstreetmap.org/copyright).
Attribution is shown in-world (permanent HUD chip + entry overlay). The exact query,
converter, and per-world details live in `worlds/fort-wayne/CREDITS.md`. No Google or
Apple imagery was used anywhere in that world.

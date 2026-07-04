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

---

## Source re-verification — 2026-07-04 (Cowork run, Claude Fable 5)

The June 11 catalog partially died server-side. Verified with curl (Range GETs, Origin header)
and a live browser session on 2026-07-04:

- **Google sample bucket (commondatastorage.googleapis.com/gtv-videos-bucket): HTTP 403 on all
  four Blender reels — for everyone, not just us.** These URLs are retired from every catalog.
- **Replacement Blender sources (same films, same licenses, still the original-free-source rule):**
  - Wikimedia Commons 720p VP9 transcodes — HTTP 206 + `Access-Control-Allow-Origin: *`
    (CORS-safe, so the 3D theaters' VideoTexture path uses these first):
    Big Buck Bunny, Sintel (from `Sintel_movie_4K.webm`), Tears of Steel (from
    `Tears_of_Steel_1080p.webm`), Elephants Dream (from `Elephants_Dream_(2006)_1080p24.webm`).
  - Internet Archive mp4s — HTTP 206, stream fine, but the download nodes send **no CORS
    headers**, so they are primary on the FLAT theater page (no crossorigin needed there) and
    fallback in the 3D worlds (the honest error path skips them if CORS blocks the texture):
    `BigBuckBunny_328`, `Sintel` (2048 stereo 512kb), `Tears-of-Steel` (720p),
    `ElephantsDream` (ed_1024_512kb).
- **Internet Archive classics (His Girl Friday, Plan 9):** unchanged, verified 206.
- **NASA (images-assets.nasa.gov):** verified 206 + CORS on the `~mobile` variant — now primary;
  `~medium` kept as fallback.

lib/v1 stays frozen per the freeze law; the repaired catalog lives in **lib/v2/cinema.js**
(v1's exact code + new sources; v2 imports v1's frozen textures/buildings). cinema-district
and cosmodrome now import v2. The live theaters (Town Square, World 2, /video) carry the same
re-verified catalog.

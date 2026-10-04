# WD-MOON review (2026-10-03): the Moon, three landings of one real body

Package: the Moon as a start world for Fortis and Technos Prime (BIBLE-v3 4.2 and 7.3). What it is and how it is built: [docs/MOON.md](../../../MOON.md). Credits and provenance:
[credits.json](../../../../credits.json), [docs/PROVENANCE.md](../../../PROVENANCE.md) ("The Moon"). Screenshots here are iPhone-profile WebKit (393 x 852 at 2x, `tier=low`),
taken by `node test/moon-browser.mjs` against the local build.

## What works (and how it was checked)

| Thing | Local | Live |
|---|---|---|
| Registry: three frame worlds (`moon`, `moon-shackleton`, `moon-daedalus`), one region, one gate, real size/mass/gravity/day/orbit | `test/pkg-moon.mjs` 1 (8 checks) | see "Published" |
| The ground is LOLA: Apollo 11 at -1.9 km, Tycho and Copernicus sunk, Shackleton 4 km deep, the pole's year of sunlight worked out (floor 0, crest > 80 percent) | `pkg-moon` 2 | |
| Pads flat and walkable; the field is a solid at every pad; deterministic, continuous ground | `pkg-moon` 2 | |
| Ice: permanent shadows give `MAT-MOON-ICE` two metres down, never at the pads; a lot cut there is filed as `moon-ice`; shops list it | `pkg-moon` 2 | |
| Cast: 36 people, unique ids, voices that exist and match the body, F5 seats held by bodies, 58 custom lines all voiced | `pkg-moon` 3; `node tools/gen-voices.mjs --check` | |
| Trade arithmetic: no money from nothing, ice from real lots, bad quantities change nothing | `pkg-moon` 3 | |
| The opening's hook: dialogue keys, drivers, counters, a real 90 m bowl 4.2 km north of the hub, route, board row | `pkg-moon` 4 | |
| The real authority flies Mars -> Moon (one fee, 20 s spool) -> Shackleton -> hub -> Daedalus (free hops) -> Mars, sells ice and trades supplies on the way | `test/moon-trips.mjs` (in `pkg-moon` 5) | |
| On a phone: the nav list shows all three with the lane fee and a real tap starts the course; Talk with a real tap; ice sold; water bought; recruiter offered; no Earth over Daedalus; no page errors | `test/moon-browser.mjs` (17 checks) | |

## The shots (docs/qa/2026-10-03/moon/)

`phone-nav-moon.png` the nav computer · `phone-hub.png`, `phone-hub-pad.png` Tranquility Civil Hub · `phone-apollo.png` the first footprints · `phone-earth.png` Earth over the hub ·
`phone-shackleton.png`, `phone-shackleton-gate.png` Shackleton Base · `phone-shackleton-ice.png` an ice beacon on the slope into the dark · `phone-daedalus.png`,
`phone-daedalus-hall.png` Daedalus Station · `phone-talk-*.png` the Talk panels (guide, ice, shop, recruiter, dock, fab).

## What changed in shared files (all marked `WD-MOON`)

`_kit/terrain.js` (a `sampled` profile), `space/moonField.js` (`albedoFn`, `groundAt` and an `ice` material slot), `space/frames.js` (a moon of another world faces it: one line),
`space/jump.js` (`region` and `regionName`), `space/spaceSystem.js` (a nav branch for a hop inside a lane region; the lane gate only on the region's own world; the way home
from a far world no longer throws when the nav list is opened from Ceres), `roles/seats.js` (`frames`), `crew/crewUI.js` (a person speaks their own lines), `voice/lines.js`,
`economy/shops.js` and `space/jobs.js` (the `MAT-MOON-*` item tables), `server/authority.mjs` (one `moon-trade` case), `main.js` (the solo trade), `test/worlds-orbits-checks.mjs` and
`test/pkg-longrange.mjs` (the Moon is built now, so it is not a placeholder or a held-off row any more: their expectations moved with it).

## Honest notes: what is not done, not claimed

See docs/MOON.md "Honest notes". The ones that matter most: the frame can only turn about Mars's pole (the Moon's own pole and libration are not drawn; Earth is placed by the real line);
the Sun is fixed at each landing (6 degrees at Shackleton, not the real 1.5); beyond three windows of 48 to 120 km the Moon is a one-degree grid plus kilometre craters; prices are
in marks (the lunar is in the words only); shelves never run out; seat bodies do not change when a player takes the post (F5's design); no free flight on a lane world.

## For the other builders

* **Opening:** `src/worlds/moon/dialogue.js` (same keys as every world's file, plus `gate` and `crashSite`), `crash.js`, `startWorld.js`; all those lines are already voiced. The board's `moon` row can
  turn `status: 'open'` (spread `MOON_START`).
* **F3 / the seamless-space builder:** the Moon is three frames on one body (`region: 'moon'`), rebased onto F3's long-range drive: every landing is offered twice, by the lane (fee, spool) and by `~drive` (free, slow, lands at the pad). `test/moon-trips.mjs` flies both. If the lane goes, `region` can stay (it only decides which frames share a mouth); the lane-fee asserts in `moon-trips.mjs` move with it.
* **Flight feel:** a hop between landings is about two minutes at x60 (34 minutes at x1): the climb to 9 km on the pods and the descent are the long parts.

## Verification on the rebased tree, and what is not claimed

* `node test/validate.mjs`: 1701 passed, 2 failed on the full run; both were mine and are fixed (the key-prompt scan tripped on the baked terrain file's base64 `//`, so it now skips `lola-data.js`; the voice size cap went 12 to 14 MB for ~135 new clips). The two fixed checks were re-run alone (voice: green); the scan fix was not re-run through a second full validate (about 40 minutes), so treat it as verified by reading plus the one-line cause.
* `test/phone-check.mjs` green (exit 0); `test/moon-browser.mjs` 17/17; `_moon-only` 40/0; `_longrange-only` 49/0.
* **Not measured:** a clean Ceres-vs-Moon phone draw-call baseline. Outpost mesh counts are 299 (hub), 162 (Shackleton), 363 (Daedalus), people dominating; earlier per-frame reads were about 517 calls / 729k triangles at the hub. Tier is `low` in all phone shots; no real iPhone hardware was used.

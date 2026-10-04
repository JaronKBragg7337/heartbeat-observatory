# The Moon (package WD-MOON, 2026-10-03)

The real Moon as a start world for Fortis and Technos Prime (BIBLE-v3 4.2 and 7.3): real size, gravity, day and orbit; the ground read from NASA's LRO LOLA; ice in the
permanent shadows at the south pole as a resource; three settlements with people who have opinions; reached from Mars by the lane. Provenance and credits:
`docs/PROVENANCE.md` ("The Moon"), `credits.json`. The registry guide's section "Several landings on one body" explains why it is three worlds.

## What is where

| Path | What it is |
|---|---|
| `src/worlds/moon/def.js`, `moon-shackleton/def.js`, `moon-daedalus/def.js` | the three worlds (Tranquility Civil Hub, Shackleton Base, Daedalus Station); one `moonDef` factory in `moon/common.js` |
| `moon/lola.js`, `lola-data.js` (generated), `tools/bake-lola.mjs` | the real heights, brightness and Shackleton's year of sunlight; our own copy, about 280 KB; the baker downloads from NASA once |
| `moon/layout.js`, `cast.js`, `place.js` | where everything stands (solids the walker and the server share), who stands there and what they say, the outpost-local frame |
| `moon/kit.js`, `hub.js`, `shackleton.js`, `daedalus.js`, `clientCommon.js` | the drawing: the Meridian's kit and the port's materials, a sign atlas lettered by F0's faction styles, one mesh per material |
| `moon/people.js` | the Talk targets: Loft people dressed by F0 (`factionLook`), F5 seat people, the panels, the buttons |
| `moon/trade.js`, `soloTrade.js`, `server/moon.mjs` | ice and four vendors; one arithmetic file for the solo game and the authority |
| `moon/earthSky.js`, `assets/moon/earth.jpg` | Earth in the sky (Blue Marble), from the real Earth-Moon line |
| `moon/crash.js`, `dialogue.js`, `startWorld.js` | the opening's hooks (below) |
| `test/pkg-moon.mjs`, `moon-trips.mjs`, `moon-browser.mjs` | 39 checks inside validate, the real authority flying the whole route, the iPhone-profile WebKit run |

## The three landings

| | Tranquility Civil Hub (`moon`) | Shackleton Base (`moon-shackleton`) | Daedalus Station (`moon-daedalus`) |
|---|---|---|---|
| Where (real) | 0.70 N 23.50 E on Mare Tranquillitatis, 1.1 km from Apollo 11 | 89.39 S 155.23 E on the rim bench of Shackleton crater, 10.3 km from the pole | 6.03 S 178.54 E on the floor of Daedalus crater, far side, 26 km from the central peaks |
| Whose | neutral; both blocs recruit here | Fortis: walls, gate 7, searchlights, barracks, armoury, fleet command, quartermaster, ice dock, rim power towers, the mass driver | Technos Prime: the Glass Hall dome, glass towers and tubes, the Embassy Ring, Fab Floor 2, servers, six dishes and the Quiet Dish |
| The Sun (fixed for play) | 24 deg, morning | 6 deg (the real Sun never clears 1.54 deg there) | 21 deg |
| The sky | Earth 66 deg up, a quarter lit | Earth below the horizon | no Earth, ever: the whole Moon is in the way |
| Ground facts | flat mare, the Apollo 11 site behind a rope with the descent stage, the flag, the plaque and 46 footprints | the crest is lit about 95 percent of the year, the floor never; the nearest permanent shadow is 1.6 km south west and 630 m down | a terraced wall rises 6 km west of the pad |
| Jobs and shops | water office (ice, 330 marks a tonne), mercantile, clinic, rover hire, freight | ice dock (250 a tonne), quartermaster (cheap ammunition and oxygen), seats | Fab Floor 2 (cheap spare parts), supply desk, trade director, seats |

Every building, tower and wall is solid for the walker and for the server's spoil guard (`layout.js`). Player pads are the ordinary grid east and north of the main pad.

## How you get there and between

* From Mars: the nav computer lists each landing twice, as it does for Ceres (F3): by the lane (120 credits, 20 s of coils; one gate over the hub, 50,000 km out) and by the long-range
  drive (`moon~drive`, `moon-shackleton~drive`, ...: free, no spool, slow on purpose, x1 to x5400, and it lands at the landing's own pad). `test/pkg-longrange.mjs` and `test/moon-trips.mjs` fly both.
* Between the landings: they share the Moon's region (`region: 'moon'`), so a hop is an ordinary course inside it: about two minutes at x60, **no lane fee**. The real authority
  flies the whole route in `test/moon-trips.mjs`.
* Time: the clock is real UTC, the Moon goes round the Earth on its real orbit, and the Sun at each landing is fixed for play (a lunar day is 29.5 Earth days).

## The ice, the money, the jobs

Ice is ground. `groundAt` (a moonField hook) returns `ice` under a dry skin in ground the baked horizon trace says never sees the Sun (`lola.js` `inShadow`). Dig it, it files
as `moon-ice` (the material tables in `space/jobs.js` and `economy/shops.js` carry `MAT-MOON-*`), stow it in the hold, and sell by the whole tonne at the Fortis dock or, for
more, at the hub. Four vendors buy and sell supplies at the Moon's prices (water, food and oxygen dear; Fortis ammunition and Technos spare parts cheap, each paying well for
what the other makes: the run the bible calls cooperation). F4's price factor and the governor's tax apply. Jobs are F5's seats (pilot, trader, hauler, miner, medic, patrol, port
master, trade director, security chief, governor, both leaders): the bodies standing at the settlements hold them, speak their NPC's name, temperament and lines, and the Talk
panel asks for the post (`role-take`). Recruiters sign you up (`faction-join`).

## For the opening's builder (the crash site hook)

* `src/worlds/moon/dialogue.js` has the same keys as every world's file (`id, place, port, surface, weather, locker, crate, drivers, counter`) plus `gate` and `crashSite`;
  `src/opening/worlds/moon/dialogue.js` can be `export { default } from '../../../worlds/moon/dialogue.js';`. Its lines are in the clip generator's list once the opening lists them.
* `src/worlds/moon/crash.js`: `CRASH` (the site: a real 90 m bowl 4.2 km north of the hub, the terminator light: Sun 1.5 deg, no dust, a coolant spray, a suit timer, the rover's
  eight waypoints) and `crashPoint(body, east, north)` / `crashGroundHeight` for the scene's own ground from `makeMoon('moon')`.
* `src/worlds/moon/startWorld.js`: `MOON_START` (spread over the board's 'coming' row: status `open`) and `moonGoodsLines()`.
* The recruiters named in `dialogue.counter` are bodies at the hub (`cast.js`: `h-recruit-fortis`, `h-recruit-technos`). Nothing here names the surprise details.

## Honest notes (not done, not claimed)

* The frame can only turn about Mars's pole (F2): the Moon's own pole is Mars's pole direction, its libration is not drawn, and the sub-Earth point can be up to 28 degrees off the
  Moon's equator on some days. Earth is placed by the real Earth-Moon line, so it is where the ephemeris says, not where the Moon's lat/lon grid would put it.
* The Sun does not move at a landing (it is chosen). Shackleton's is 6 degrees, not the real 1.5, so the base reads on a phone.
* Beyond the three windows (48 to 120 km round each landing) the Moon is the 1-degree grid plus procedural craters up to a kilometre: no real craters between 1 and 30 km there.
* The heights are LOLA's; the ice, its amounts and every settlement, person and price are the game's.
* Prices use marks like the rest of the economy; the Moon's money (the lunar) is in the words only.
* Shelves never run out (the vendor's fund and your purse are the limits). The hub does not buy ice at Mars's depot, and Mars's depot does not buy it.
* The people stay where they stand; a seat's body does not change when a player takes the post (the server keeps only the humans), as F5 documents.
* No walkable pressurised interiors beyond the halls with doorways; the Glass Hall, the Fleet Command and the towers are enterable at the ground floor only.
* Free flight is not charted on the Moon (a lane world): the autopilot flies courses between landings.

# World 2: Ceres, with Occator Works on it (QA review, 2026-10-03)

## What was built

The first world beyond Mars and its moons, as one self-contained folder (`src/worlds/ceres/`, F1 registry):

- **A real body.** Ceres on the density field: walkable and diggable, its own gravity (0.284 m/s2), black sky, a Sun 0.19 degrees across, its real 9.07-hour day and tilt recorded, its real orbit (the nav list shows it where it really is on the game's date, 1.1 AU from Mars at start).
- **Occator Works** (the Industrial Miners' home, bible v3: Ironclad on Ceres): foundry with bins and a moving belt, supply desk, bunkhouse, lane office, haul trucks, tanks, masts, pad markings, seven Loft people with the Compact's look and Ceres dialogue. One landing pad per player.
- **The ground you dig:** grey regolith, rust-red ore seams and outcrops (ore), bright white sodium-carbonate salt (the pans, the faculae, Cerealia Tholus), and The Cut, a terraced open pit with walkable benches. Spoil cannot be poured into the settlement slab.
- **The way there: the Ore Lane.** The nav computer plots Ceres; the drive flies to the lane mouth over Mars (60,000 km up from the port); the coils spool 20 cabin seconds; the fee is 120 credits; the ship arrives at the far mouth (50,000 km over the Occator pad) and flies down. Time compression x60 on transits. The **server owns every step** (fee, spool, jump, frame change, lane mouths, pads). Free flight and courses work as before; free flight is Mars-space only.
- **Reasons to go:** ore (200 marks a tonne at the Marineris depot, 130 at the foundry) and salt (70 / 45) dug on Ceres as real matter lots; and the supply desk pays about twice Mars's price for water, food, oxygen, parts and ammunition.

## Real data and invention

| Thing | Source | Real or invented |
|---|---|---|
| Mean radius 469.7 km, axes 966.2 x 962.0 x 891.8 km, mass 9.38392e20 kg, g 0.284 | NASA / JPL Dawn results | real |
| Day 9.07417 h, tilt about 4 deg | Dawn rotation solution | real |
| Orbit (a 2.7672 AU, e 0.0797, i 10.6, node 80.2, peri 73.3) | JPL small-body elements | real |
| Occator (19.86 N, 238.85 E, ~92 km, ~3 km deep), Cerealia Tholus (~340 m dome), Kerwan (-11.47, 122.58, ~284 km), Ahuna Mons (-10.46, 315.8) | USGS / Dawn names and Wikipedia | real positions and sizes; the shapes are the game's own noise, not the Dawn terrain model |
| Sodium carbonate salt in the faculae | Dawn VIR / Nature 2016 | real |
| Occator Works, The Cut, all people, prices, the lane, the Compact, the 120-credit fee | Space You Land bible v3 and this build | invented |

## Verified locally

- `node test/validate.mjs`: 1135 passed, 1 failed on the first run; the one failure was the voice-clip check (21 new lines). Clips were generated and old ones pruned (361 clips); re-run result below in the final report.
- `test/pkg-ceres.mjs` (25 checks, part of validate): Dawn numbers, orbit, landmark placement, flat pad, slab, The Cut slopes, ore/salt as lots, lane mouths, trade maths and refusals, no worker inside a wall.
- `test/world2-trips.mjs` (real authority): Mars to Ceres across the lane (20 s spool, 120 credits), the foreman buys 1 t of ore for 130 marks, Ceres back to Marineris Port.
- `test/world2-browser.mjs` (iPhone-profile WebKit, real taps): 7 of 7. Nav row tap, Talk button, panel on screen, spare-parts sale, ore sale, no page errors.
- `test/world2-shared-browser.mjs` (browser following the real server across the jump): 6 of 6.
- Screenshots in this folder: `v1` sky and Sun, `v2` buildings, `v3` people and the pad, `v4` Ceres from 3,000 km down to 20 km, `v5` The Cut, `fl-*` and `gate-*` the flight and the lane gate, `phone-*` phone taps, `shared-landed-ceres.png`.

## Not verified / honest limits

- Not checked on the live site until pushed and the server restarted.
- Terrain shapes are procedural and placed from the real coordinates; the Dawn height model was not sampled.
- Ceres does not spin or orbit visibly; the day and orbit are recorded and the sky/sun direction are fixed per session.
- Greenhaven (the pair, in Kerwan basin) and Kerwan Landing are not built; left to the pair builder.
- Chromium+SwiftShader is slow; framerate on a real phone was not measured here.
- Dust, brine seeps and strike events from the bible are not built.

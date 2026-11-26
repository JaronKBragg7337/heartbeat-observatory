# Turkey Trouble

A Thanksgiving night on the farm, in four modes: **Find the Turkey**, **It Hunts You**, **You Hunt It**, **Escape the Farm**,
or all four in order as **Story**. Phone first (iPhone Safari), landscape works, desktop works.

Play: `/games/turkey-trouble/`. Two builders: the look (`layout.json`, `src/render/`, `assets/`, `build/`) and the game
(everything else). The line between them is `CONTRACT.md`.

## Controls
- Phone: left half = an invisible thumbstick that appears under your thumb (push to the rim to run), right half drag = look,
  one action button on the right when the mode has one (Dive in You Hunt It, Flap in Escape).
- Desktop: WASD or arrows, Shift runs, Space is the action, mouse drag looks.

## URL switches
`?mode=story|find|hunted|hunt|escape` (skip the title), `?seed=N` (same seed, same run), `?debug=1` (fps, colliders, state),
`?mute=1`, `?director=1` (the game plays itself with bots and a cinematic camera, for filming a trailer; combine with `?mode=`).

## How it is built
- `src/game/` rules in plain modules that never import three: `world.js` (collide and slide, line of sight, surfaces,
  nav grid with A*), `mover.js`, `modes/*.js` (one per mode), `tuning.js` (every feel number), `bots.js`, `rng.js`.
  Fixed 60 Hz step, seeded random, `{x, z}` numbers. `game.js` is the one door: `createGame(kind, layout, { seed })`.
- `src/game/view.js`, `rig.js`, `camera.js`: the thin view. Models come from the stage; the turkey, dog and wheels are
  animated procedurally by node name relative to each node's captured rest pose, so placeholder and final models both work.
- `src/ui/` controls and HUD, `src/audio.js` every sound synthesized with WebAudio (nothing is loaded), `src/main.js` the loop.

## Tests (plain Node, no browser)
```
node --test test/*.test.mjs
```
Layout sanity, every mode played by a bot (win and lose), the ending's exact text, determinism.

## How the look is made
- The whole farm, the turkey and the trucks are made by code, not drawn by hand. The scripts are in `build/`: `farm.py` (the farm), `turkey.py` (the turkey), `models.py` (the other models) and `farm_bake.py` (the light).
- Blender 5.1 bakes the dusk light into the farm. It runs on our own RTX 4060 and takes about 40 seconds.
- Three.js shows the farm in the browser, with our own wet-ground shader so the ground looks soaked after the storm.
- The people are the site's realistic ones.
- Real surface photos and the sky come from Poly Haven (CC0), listed below.
- The sounds are made by code too (WebAudio), nothing is loaded.
- Built by Claude (Fable 5.2) with Opus 5.5 and Sonnet 5.5 helpers.

## Credits
Surfaces and sky from Poly Haven (CC0)
- weathered_brown_planks, https://polyhaven.com/a/weathered_brown_planks, CC0 (fences, porch, coop, shed posts)
- wood_plank_wall, https://polyhaven.com/a/wood_plank_wall, CC0 (barn siding)
- corrugated_iron, https://polyhaven.com/a/corrugated_iron, CC0 (barn, shed and coop roofs)
- rusty_metal_02, https://polyhaven.com/a/rusty_metal_02, CC0 (not used yet)
- roof_slates_02, https://polyhaven.com/a/roof_slates_02, CC0 (house roofs)
- asphalt_02, https://polyhaven.com/a/asphalt_02, CC0 (the two paved roads)
- gravelly_sand, https://polyhaven.com/a/gravelly_sand, CC0 (not used yet)
- brown_mud_leaves_01, https://polyhaven.com/a/brown_mud_leaves_01, CC0 (yard mud)
- leafy_grass, https://polyhaven.com/a/leafy_grass, CC0 (grass)
- bark_brown_02, https://polyhaven.com/a/bark_brown_02, CC0 (tree trunks, poles, the creek logs)
- concrete_floor_worn_001, https://polyhaven.com/a/concrete_floor_worn_001, CC0 (foundations, barn floor, silo)
- thatch_roof_angled, https://polyhaven.com/a/thatch_roof_angled, CC0 (hay bales (recoloured to straw))
- kloppenheim_02, https://polyhaven.com/a/kloppenheim_02, CC0 (not used (spare sky))
- kiara_9_dusk, https://polyhaven.com/a/kiara_9_dusk, CC0 (not used (spare sky))
- qwantani_dusk_2, https://polyhaven.com/a/qwantani_dusk_2, CC0 (the dusk sky (light, background and reflections))

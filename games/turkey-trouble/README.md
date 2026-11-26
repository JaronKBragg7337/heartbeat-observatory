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

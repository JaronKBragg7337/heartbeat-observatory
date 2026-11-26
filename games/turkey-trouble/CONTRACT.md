# Turkey Trouble: who owns what, and how the two halves talk

Two builders work on this game at once. This page is the line between them. If something here blocks you, say so in your
report instead of working around it.

## Owners
| Path | Owner | What it is |
|---|---|---|
| `layout.json` | the look (Fable) | the ONE map: every position, collider, hiding spot, lamp and lane. Read it; never hard-code a position |
| `src/render/` | the look (Fable) | the stage: renderer, world, sky, fog, lights, post, models, people, effects |
| `assets/`, `build/` | the look (Fable) | baked world, lightmaps, models; the Blender scripts that make them |
| `index.html`, `style.css` | the game | the page shell and every screen (title, mode cards, HUD, pause, results, the ending) |
| `src/main.js`, `src/game/`, `src/ui/`, `src/audio.js` | the game | the loop, the four modes, actors, input, camera, sound |
| `test/` | the game | tests that run in plain Node with no browser |

## Axes and units
Meters. `x` east, `z` south, `y` up (three.js). `rotY` is three.js `rotation.y`. **Every model faces +z at rotY 0**, so to face
a direction `(dx, dz)` use `rotation.y = Math.atan2(dx, dz)`. A model's origin is on the ground at its middle.

## The stage (`src/render/stage.js`)
```js
import { createStage } from './render/stage.js';
const stage = await createStage({ canvas, quality: 'auto', onProgress: (p) => {} });
```
| Member | What it gives |
|---|---|
| `stage.THREE` | the one three.js module. Import three nowhere else in game code that also runs in Node tests |
| `stage.scene`, `stage.camera`, `stage.renderer` | the camera is yours to move every frame; do not add lights or change fog, tone mapping or the background |
| `stage.layout` | `layout.json`, parsed |
| `stage.dynamic` | a group: add everything that moves here |
| `await stage.loadModel(name)` | a fresh copy of `turkey`, `pickup`, `tractor_wagon`, `grain_truck`, `dog`, `log`, `pumpkin`, `net`, `feather`. `userData.size = { w, h, l }` |
| `await stage.loadPerson(id)` | `{ root, mixer, actions: { Idle, Walk }, height }` for `ada`, `aoi`, `isaiah`, `jorge`, `sunita`, `walter`, `zuri` (the site's realistic people). Call `mixer.update(dt)`. There is no Run clip: play Walk faster |
| `stage.groundHeight(x, z)` | the ground's height there (0 for now; ask every frame anyway) |
| `stage.flashlight` | a spot light for the player's torch: set `.visible`, `.intensity`, `.position` and `.target.position` |
| `stage.fx.splash(x, z)`, `.feathers(x, y, z, n)`, `.dust(x, z)`, `.lightning()` | small effects (empty for now; call them where they belong) |
| `stage.update(dt, focus)` | once a frame before render; `focus = { x, z }` is where the player is |
| `stage.render()`, `stage.resize()` | draw the frame; call resize on window resize and orientation change |
| `stage.quality` | `'low'`, `'mid'` or `'high'` |

Until the real models exist the stage hands out placeholders **with the final node names**. Animate by name, never by index.

## Node names inside models (the animation contract)
- **turkey**: `turkey` > `body` > { `neck1` > `neck2` > `head` > { `beak`, `snood`, `wattle` }, `tail` > `tf0`..`tf12` (13 fan
  feathers, each pivoting at its base), `wingL`, `wingR`, `thighL` > `shinL` > `footL`, `thighR` > `shinR` > `footR` }.
  Every node's own origin is its joint. The rest pose is standing, tail fanned. About 1 m tall.
- **pickup**, **grain_truck**: root > `body`, `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` (spin about x), `headlight_l`,
  `headlight_r`, `taillight_l`, `taillight_r` (empty marks at the lamps).
- **tractor_wagon**: root > `tractor` (same parts as a pickup) and `wagon` (same wheel names).
- **dog**: `dog` > `body` > { `head`, `tail`, `legFL`, `legFR`, `legRL`, `legRR` }.
- **log**: its long side lies along z. **net**: a hoop on a pole, origin at the grip end.

## What the game promises the look
- Game rules live in plain modules that do not import three (positions are `{ x, z }` numbers), so `test/` runs in Node.
- No fixed positions in code. No new lights. No extra network requests besides this folder, `/homes/people/*.glb`,
  `/hb-thumbstick.js` and three 0.182.0 from jsDelivr (the import map in `index.html`).
- Nothing per frame that allocates in a loop of many objects. Vehicles and logs are pooled.

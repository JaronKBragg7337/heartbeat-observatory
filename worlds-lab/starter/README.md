# Starter World

Direct path: `/worlds-lab/starter/`

This is the reusable empty-biome starter copied from the current Town Square
shell. It is intentionally isolated in this folder and not linked from the lab
gallery or live world yet.

## What is real

- Town Square HUD, controls, settings panel, character editor, held-item buttons,
  Ask Claude panel, phone bubble, and realtime presence/broadcast shape.
- A small bounded empty biome with day/night lighting, scale props, and an honest
  in-world sign.
- Character appearance still reads/saves through the shared account character row.
- Live visitors can see one another through the starter's own realtime channel.

## What is intentionally blocked

- Production `touch_world('town')` and `world_presence` writes are disabled here,
  because `starter-lab` is not a promoted allowlisted world.
- Production `world_spaces` and `world_props` loading/writing is disabled in lab
  mode so Town Square claims/props cannot leak into the starter.
- Persisted Town Square resident ghosts and roaming minds are not imported into
  the starter, because their saved positions belong to Town Square.
- Build mode is hidden and guarded until the starter has its own data path.
- Destination buildings and claim plots are absent on purpose; this is the blank
  template future worlds grow from.

## Deploy law

`main.js` `BUILD` and `index.html` `?v=` currently match:
`2026-07-05-starter1`.

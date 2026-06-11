# THE EDITOR — Build Mode (Phase 7)
**Living document, June 11, 2026. Live-Reference clause applies: reality > this text.**

## Jaron's vision, in his words
"I pictured being able to go in third person and design the world myself, then update
the world to that, without needing to be inside code or talk to AI on my phone for
them to push it. Everything in game. Each individual item is a prop that can be
placed — train tracks aren't one giant chain, they're different types of track pieces
that snap in place. Everything snappable and buildable."
He later added: with the editor he places the core-element buildings himself and
ensures none are missed — so the editor itself must carry those core elements.

## The architectural shift
Worlds stop being hardcoded geometry and become DATA: a world_props table
(world, prop_type, x, y, z, rotation, params jsonb, placed_by, placed_at) that the
client reads and renders at boot. Once props are data, every editing tool is just a
writer to the same table — Jaron's hands in the editor AND Claude acting on an
admin's words write identical rows. Repo claims already proved the pattern.

## Palette sections (Jaron's ordering)
1. Roads · sidewalks · light posts (the bones)
2. Generic buildings by size
3. **The buildings that matter** — the WORLD-STANDARD connection set (Games, Theater,
   Social, Projects, Workshop, Library, Music, Neighborhood pieces, repo plots),
   pre-wired as containers with their interior link-objects included
4. User housing, in its types (including the three-floor suite)
5. Props
6. Vehicles
(The Worlds Lab kit lib/v1 is the parts bin: textures, props, buildings, vehicles,
rails, coaster, rides, aircraft, space, cinema, layouts.)

## Build order
- **7a** world_props table + loader. Start in a LAB world (safe). Smallest possible.
- **7b** Build Mode v1: admin-gated, third-person camera, palette, ghost preview,
  grid snap, place/rotate/delete, save. Phone AND keyboard parity from day one.
  (World 1's menu already has a Build mode seed — grow it, don't duplicate it.)
- **7c** Snap sockets: modular segments (track, rail, road, fence) with connector
  points — pieces click together. The heart of the ask.
- **7d** Publish + world version: version stamp in DB; clients poll (realtime push is
  unreliable on this project) and show "The world changed — refresh to see it," so
  everyone crosses into the new world together. Visitors only ever see PUBLISHED
  versions. Drafts are admin-eyes-only. Nothing faked.
- **7e** Claude for admins, in-world: admin says "bring/place X" → API route → Claude
  writes world_props rows → same publish gate as hands. Everyone else's Ask Claude
  stays a guide. Admin roster may grow beyond Jaron — gating is by world_admins.

## Prerequisite already fixed
kit.js movement math (input rotated by -yaw; two sign flips corrected, June 11).
You cannot build a world you cannot walk.

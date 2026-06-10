# WORLD 2 — THE COMPLETE BUILD PLAN
*Written June 10, 2026, launch day of World 1, by the session that shipped it. Read this entire file before writing any code. This is the source of truth for the second world. TODO.md and ARCHIVE.md hold World 1's full history and laws — read TODO.md's SESSION HANDOFF too.*

## THE VISION (Jaron's words, made specific)
A second walkable world, entered from the main landing page (where the planet is), that **looks completely different and bigger** — cinematic, textured, atmospheric, in the style of the Fable 5 showcase demos (night cities with thousands of lit windows, golden-hour streets, dense forests with volumetric light, terrain with real hills) — but **takes you to the places World 1's buildings do and has everything how World 1's stuff is.** Same residents, same accounts, same doors to /social /library /projects etc., same claims → Project Halls, same Ask Claude, same honesty. Different skin, same living body.

**THE ONE CONSTRAINT THE DEMOS DON'T HAVE: our players are on phones.** Those showcase videos run on desktops. Every visual choice below is chosen because it achieves the look within a phone GPU budget. Do not trade the town's universal accessibility for beauty — get both, in that order.

## WHAT IS SHARED (do not rebuild, do not fork)
- **Supabase project** `ygjpnvrwhkrowkrskftk` — same database, same publishable key already in the client.
- **Identity**: `world_characters` (display name, look, auth_user_id), sign-in flow, guest naming. A resident is ONE person across both worlds.
- **Admin**: `world_admins` (acsassociation7337, ACSBamboo, Acid_Ith).
- **Claims**: `claim_repo` RPC + `claim_home` RPC (both server-gated; repo claims one-per-account, owner_uid recorded). World 2 plots use the SAME tables with a `world` column (migration below).
- **Project Halls**: `/space/?plot=N` already renders any claimed plot's living README. World 2 claimed buildings link to the same halls.
- **Enrichment**: `/api/enrich-world-spaces` — public GET, idempotent, server-secret-guarded internally. Client fires it after claims and on load for rows missing metadata (copy World 1's pattern exactly).
- **Destinations**: doors lead to the same section pages: /social, /library, /projects, the theater, arcade, etc. World 2 doors `location.assign` the same paths.
- **Site shell**: landing page, account page, og image, social page — untouched except the gateway (below).

## WHAT IS NEW (the visual engine — the actual techniques behind the demos)
Renderer foundation (this alone is half the cinematic look; World 1 doesn't do these):
- `renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure ≈ 1.1`
- `renderer.outputColorSpace = THREE.SRGBColorSpace`
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`
- `scene.fog = new THREE.FogExp2(skyColor, 0.008..0.02)` — fog matched to sky color is THE atmosphere trick; distant objects melt into sky.
- PCFSoft shadows from one sun light only; shadow camera tight around play area.

The looks, by technique (all phone-safe):
1. **Night city / lit windows** (Bilawal demo): buildings are `InstancedMesh` boxes sharing ONE material whose `emissiveMap` is a `CanvasTexture` — draw a dark facade with a grid of randomly-lit window rectangles once on a canvas. Hundreds of towers = a handful of draw calls. Vary per-instance via instance color.
2. **Terrain with hills** (desert village demo): `PlaneGeometry(~600, ~600, 196, 196)` displaced by layered value/simplex noise (write a tiny seeded noise fn, no library needed). Vertex colors by height/slope (grass→rock→sand). CRITICAL: movement must follow the ground — expose `groundHeight(x, z)` sampling the same noise fn (NOT raycasting per frame) and set player/remote y from it. World 1 is flat; this is the biggest movement-code difference.
3. **Dense forest / golden hour** (Shumer demo): instanced trees (a few archetypes), instanced grass quads scattered near the player, sun low with warm color, fog slightly orange, god-ray feel comes free from fog + tone mapping.
4. **Textures without an asset pipeline**: procedural `CanvasTexture`s (concrete noise, window grids, ground detail) generated at boot — zero downloads, zero copyright questions, tiny repo. If real textures are ever wanted, small CC0 tiles committed under `/world2/tex/`, ≤512px, and credited in this file.
5. **Day/night cycle**: reuse World 1's sun/star pattern but drive fog color + tone exposure + emissive window intensity with it (windows brighten as sky darkens — that's the whole night-city moment).
6. **Quality toggle**: `lo/hi` setting (shadow on/off, grass density, pixel ratio) persisted in localStorage... NO — localStorage is fine in our real site (NOT a claude.ai artifact). Default auto: lo when `devicePixelRatio*screen.width > threshold` fails a 60-frame boot benchmark.

Performance budget (hard limits): ≤ 300 draw calls, ≤ 40 MB textures, instancing mandatory for anything repeated, no per-frame allocations in animate(), test on a real phone before calling anything done.

## ARCHITECTURE
- New directory `/world2/` with its own `index.html` + `main.js` (+ optional `/world2/tex/`). **Completely separate code from /engine/hub/main.js — nothing World 2 does can ever crash World 1.** Copy proven subsystems (presence wiring, updateRemotes, claim flow, door scan) from World 1's file as starting material; do not import from it.
- Script tag MUST ship version-stamped from day one: `<script type="module" src="/world2/main.js?v=...">` — deploy law below.
- **Realtime**: same Supabase Realtime, NEW channel names: `world2-town` (state broadcast + presence) — never share World 1's `engine-town` channel or its traffic doubles.
- **Multiplayer laws carry over verbatim** (these were paid for in launch-night blood):
  - State send ≤ 10Hz, idle suppression (signature-based, ~5s keepalive).
  - presence.track() = join/leave/identity ONLY. NEVER call it from the movement cycle. (ClientPresenceRateLimitReached throttles the whole socket → teleporting.)
  - Interpolation delay ≥ 2× send interval (250ms at 10Hz) + buffered-hold in updateRemotes (ease to newest buffered packet when buffer runs dry; no mode-jumping).
  - postgres_changes is UNRELIABLE on this project (wedged server-side, may or may not be fixed by Supabase Pro). Sync DB-backed shared objects via **broadcast events + a 30s reconcile refetch loop** — World 1's prop system is the reference implementation.
- **DB migration** (write as a Supabase migration, name `world2_plots`):
  ```sql
  alter table public.world_spaces add column if not exists world text not null default 'town';
  -- replace unique(plot) with unique(world, plot); update claim_repo + claim_home to take p_world
  -- and write it; default 'town' keeps every existing World 1 row and client working unchanged.
  ```
  World 2's loadSpaces filters `world=eq.world2`; `/space/` hall page gains `&world=` param (default 'town' — existing links keep working).
- **Boot-order law (TDZ)**: any const/let referenced by boot-path or frame-loop code is declared ABOVE the buildWorld()/animate() calls. World 1's main.js boots at lines ~304/332 with a declaration zone above — same shape.
- **Engine page integration**: World 2 appears on /engine page's world list when it exists. `agent_state` minds (Claude, Perplexity) can roam it later — not phase 1.

## THE GATEWAY (landing page)
Jaron is right: the main landing page (the planet, "Enter the world") is the front door. When World 2 is REAL and walkable: the planet area becomes a two-world gateway — World 1 "Town Square" + World 2 (name TBD by Jaron) — each with its own live status chip. **Do not add the gateway before the world is walkable. NOTHING IS FAKED — no "coming soon" planet that goes nowhere.** (A plain-text "being built in the open" line is acceptable; an entrance that isn't one is not.)

## STANDING LAWS (all of them, from World 1)
1. NOTHING IS FAKED. Honest empty states. What isn't built says so plainly.
2. Anything a visitor can create must work end-to-end automatically — needs-admin-touch-per-use = not done.
3. Live tests outrank theory. Jaron walking the world is the test suite.
4. Deploy law: every main.js push bumps `BUILD` const in the file AND `?v=` on its script tag, same commit set. Boot logs the build to console.
5. Deploy loop: GitHub Contents API fetch (content+sha) → Python str.replace with count==1 asserts → `node --check` (as .mjs) → TDZ check → PUT with sha → wait ~70s → curl live, `md5sum` live vs pushed MUST match → only then say done.
6. Reads from raw.githubusercontent.com, never jsDelivr/CDN (stale).
7. Docs: completed work moves verbatim to ARCHIVE.md; TODO.md stays live/open only; record laws and decisions as they're made.
8. Context is the highest priority in docs and messages — comprehensive, nothing stripped.

## BUILD ORDER (phases; verify live at the end of each before the next)
1. **Skeleton**: /world2/index.html + main.js with renderer foundation (tone mapping, fog, sky, sun, day/night), flat-ish ground, walkable solo player with World 1's movement feel. BUILD/?v from the first commit.
2. **Terrain + atmosphere**: noise heightfield, groundHeight(x,z), vertex-colored ground, instanced trees/grass, fog tuned per time-of-day. The world should already look like the screenshots with nothing in it.
3. **The city/structures**: instanced buildings with emissive window canvas textures, colliders (use World 1's {x,z,width,depth} buildingColliders shape and resolution loop — but height-aware), roads/paths.
4. **Multiplayer**: world2-town channel, presence list, remote avatars with the full law set. Two-phone test with Lillith before proceeding.
5. **Doors + plots**: door scan (copy World 1's trigger pattern), doors to the same section pages, world2 plots via the migration, claim flow → same RPCs with p_world → halls.
6. **Gateway**: landing page two-world entrance. X announcement.
7. **Later**: minds roaming World 2, world-to-world travel door inside each world, sound layers.

## FOR THE NEXT SESSION (Cowork or claude.ai) — START HERE
You are building World 2 of Heartbeat Observatory. Read, in order: this file top to bottom, TODO.md (SESSION HANDOFF + laws), ARCHIVE.md (how World 1 was actually built and what broke). The repo is JaronKBragg7337/heartbeat-observatory, deployed on Vercel at heartbeatobservatory.com, Supabase project ygjpnvrwhkrowkrskftk. Jaron builds from his phone by voice; put prerequisites at the top of every message; never fake anything; verify live before saying done. World 1's /engine/hub/main.js is your reference for every multiplayer/door/claim pattern — copy its proven shapes, don't reinvent them. Phase 1 starts at "Skeleton" above.

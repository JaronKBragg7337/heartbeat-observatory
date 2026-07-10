# HANDOFF — session log (newest entry first)

Convention: every agent session with repo access adds an entry at the top before stopping:
current state, what shipped, how it was verified, next best step, gotchas. TODO.md stays
the live queue; ARCHIVE.md keeps completed work verbatim; this file is the session-to-session
narrative so no context is lost between Claude, Codex, and Cowork runs.

---

## 2026-07-10 — Claude (Opus 4.8, Claude Code) — Sliced Market Stall + Cart (piece-built)

**State:** live. Stall and Cart now print piece-by-piece like the cottage.

**Shipped:**
- **Market Stall**: counter → sliced wood planks (`brickPanel`), canopy → sliced curved tiles (`barrelShingles`), posts kept whole. Now `sized:true`.
- **Cart**: bed + side rails → sliced planks, wheels kept whole, added the **handle** from the v3 cart. Now `sized:true`.
- Reused existing slicer helpers (`brickPanel`, `barrelShingles`) — no new machinery.

**Verified:** local Chrome — stall prints planked counter + tiled canopy; cart prints planked bed + wheels + handle; zero console errors.

**Next:** slice the **Tree** (needs organic treatment: trunk segments bottom-up + leaf clusters, the "true hidden-then-printed reveal"), port remaining v3 extras (Arched Bridge, cottage chimney, boat benches), then the realistic layer-line/glow look.

---

## 2026-07-10 — Claude (Opus 4.8, Claude Code) — Edge-magnet snapping + folded GPT-5.6's scale fix

**State:** live. Pieces edge-magnet snap to neighbours; the Large-object double-scale bug GPT-5.6 flagged is fixed at source.

**Shipped:**
- **Edge-magnet snapping** (`magnetSnap`): when a moving object is within ~0.85 of a placed object, its nearest face snaps flush against that neighbour (butt-join or stack on top) using world-space AABBs — no overlap, works with rotation/size. Falls back to the integer grid when nothing's close. Wired into move/rotate/raise/place and tap-to-move. New **🧲 On/Off** toggle (manual-grid fallback per GPT-5.6's spec).
- **Folded GPT-5.6's fix** into `main-v2e.js`: the Realtime UPDATE handler no longer re-applies `row.scale` (size is baked into geometry, so re-scaling double-scaled Large objects 1.8×1.8). The runtime-guard wrapper is now redundant for this and can be removed later.

**Sync note:** GPT-5.6 (paused) merged a canonical+runtime-safety pass (lab PR #11 / heartbeat PR #15) that wraps `main.js` via `bootstrap.js`+`runtime-guards.js` without changing it; legacy routes preserved. Its draft SYL-ship PRs #12/#13 are isolated experiments. Old `v3` still has an Arched Bridge, cottage chimney, fuller cart, boat benches worth porting.

**Verified:** local Chrome — clean load, magnet toggle present, two blocks snap flush on nudge with no overlap/errors; workspace cleared.

**Next:** slice remaining objects (stall/cart/tree) + port v3 extras; realistic layer-line/glow look.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Camera modes + character controls

**State:** live. Players can walk a character and view the world in Orbit / 3rd-person / 1st-person.

**Shipped:**
- **View & Walk selector**: Orbit (free overview, pan enabled) / 3rd Person (follow cam) / 1st Person (eye-level).
- **Character movement**: on-screen **joystick** (bottom-left, touch — mobile-first) + WASD/arrows. Movement is camera-relative; the player capsule turns to face travel.
- **Drag-to-look** in the walking modes (camYaw/camPitch); OrbitControls handles orbit mode.
- Kept object nudging on the on-screen buttons (arrows/Up/Down/Rot) so character-walk (joystick/WASD) and object-move never clash.

**Verified:** local Chrome — all three view buttons switch correctly (3rd-person frames the build, 1st-person is ground-level), drag-to-look rotates the first-person view; zero console errors. 6 saved objects (incl. Kyler's chimney build) loaded fine.

**Next:** true edge-magnet snapping, slice remaining objects (stall/cart/tree), realistic layer-line/glow look. Giant rig last (owner-gated).

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Building pieces + snapping (piece-by-piece building)

**State:** live. Players can print individual building pieces and snap them together into structures.

**Shipped:**
- **Building pieces** — Block, Wall, Floor, Pillar (front of the recipe menu), built from small bricks via a reusable `brickPanel()` grid, size-parametrised (`sized:true`, so bigger = more small bricks, not bigger ones).
- **Stacking** — new **Up ⤒ / Down ⤓** controls (buttons + `r`/`f` keys) raise/lower the held/selected object; Y snaps to 0.5. Combined with the existing integer X/Z grid snapping, pieces tile flush and stack.
- Pieces persist + sync via the existing `placements` system (they're just recipes), so structures are shared/multiplayer for free.
- Decided build order: pieces + snapping now; giant printer rig LAST (and gate it to owner/admin accounts — Kyler + Lillith). Snapping many pieces is the general way to build big, likely reducing the need for a giant rig.

**Verified:** local Chrome — Block/Wall/Floor/Pillar in the menu, Up/Down controls present; printed a Wall (brick panel) and auto-placed it; zero console errors.

**Next:** true edge-magnet snapping (auto-align to neighbours), slice the remaining objects (stall/cart/tree), and the realistic layer-line/glow look.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Printer sizes + bigger world

**State:** live. A Printer Size selector (Small/Medium/Large) is in the menu; the world is larger and less crammed.

**Shipped:**
- **Printer sizes** `SIZES={small:0.55, medium:1, large:1.8}`, picked in a new "Printer Size" menu row. The **cottage** is parametrised so a bigger size = MORE small pieces (constant brick/tile size) — honors "keep pieces small on big builds." Other recipes bake the scale into their geometry (`bakeScale`). `buildAtSize(recipe,s)` is the single builder used by printing AND rebuild-from-DB, so size **persists and syncs** (stored in the `scale` column; a large cottage reloads/other players see it large).
- **Bigger world:** ground/grid 90→150, water ring pushed out, fog 45→170, camera maxDistance 60→120 + pulled back, shadow bounds widened.
- Auto-test hook extended: `?auto=<recipe>&size=<small|medium|large>&place=1`.

**Verified:** local Chrome — placed a large cottage (clearly ~1.8× the medium one, same small bricks), saved at scale 1.8, reloaded → both medium + large rebuilt at correct sizes; zero console errors.

**Note / next:** Large=1.8× fits the current bed. True ~5× "giant" builds need a physically bigger printer rig (the bed-local print math has fixed offsets), which is a follow-up. Next: individual-piece printing + edge-snapping on the small printer.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Real-time multiplayer + move persistence

**State:** live. Placements now sync live across all players; moves/rotations persist too.

**Shipped:**
- **Supabase Realtime** on the `placements` table: printer lab subscribes and applies INSERT/UPDATE/DELETE from any builder live — place/move/delete broadcasts to all connected players (multiplayer) with no reload and no custom netcode. Client-generated row ids so a player's own change isn't echoed as a duplicate.
- **Move/rotate persistence**: moving or rotating a placed object now UPDATEs its row (added an UPDATE RLS policy scoped to `world='printer-lab'`; set replica identity full for realtime).
- Independent of the engine's netcode (Kyler's concern was future conflict when the printer is embedded in `/engine` — the table can coexist or the engine can read it).

**Verified:** local Chrome — inserted a row via SQL (simulated another player) → boat appeared live ("Another builder placed a Boat"); deleted the row → boat vanished live; saved cottage still loads; zero console errors.

**Next:** printer sizes (large/medium/small + selector), then individual-piece printing + edge-snapping.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — World-state persistence (Supabase `placements`)

**State:** live. Placed objects in the printer lab now persist across reloads via Supabase — the foundation for "players build → AIs know the world → cleanup is a query."

**Shipped:**
- New Supabase table **`placements`** (project ygjpnvrwhkrowkrskftk): `id, world, type, label, x,y,z, rot_y, scale, placed_by, created_at`. RLS: read-all; insert/delete scoped to `world='printer-lab'` (blast radius limited to the demo world; AI/service role can touch any world for cleanup).
- Printer lab (`src/main-v2e.js`) wired to it: **Place** → INSERT row; **on load** → SELECT the world's rows and rebuild the objects; **Delete** a placed object → DELETE its row. Supabase JS imported from esm.sh (works in both Vite dev and the build-free vendored route).
- Auto-test hook extended: `?auto=<recipe>&place=1` auto-prints AND auto-places (used to verify the persist loop without the click-race).

**Verified:** local Chrome — placed a cottage, reloaded, it rebuilt from the DB (confirmed the row via SQL + the object reappearing after reload); anon insert + select both pass RLS; zero console errors. Test data cleared.

**Next / notes:** moving a placed object doesn't yet UPDATE its row (persists initial placement only) — add an UPDATE on move next. This is the DB-as-source-of-truth model (repo stays code-only; export curated snapshots later). Any AI (Claude/ChatGPT/Zeus) can now `SELECT`/`DELETE` from `placements` to map or clean up worlds. See memory `project-world-state-architecture`.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Curved-tile roof (Kyler-approved) + auto-print test hook

**State:** live. Cottage roof is a smooth curved tiled dome that Kyler approved on sight.

**Shipped:**
- **Roof = small CURVED tile pieces** — each tile is a slice of the cylinder wall (not a flat box), so they wrap flush with no steps and no side gaps; angular slices cover a=0..PI (both eaves) with slight overlap; gable ends filled with small radial pieces. Prints piece-by-piece, ordered eave→ridge.
- **`pyramidRoof()` kept** as a "castle-type" stepped-block roof style for future blocky buildings (Kyler's fallback idea).
- **Auto-print deep-link:** `/3DPrinterAsset/?auto=cottage` (or any recipe id/alias) auto-starts that print on load — handy for testing and direct links. Solved a flaky reload-then-click issue in my own browser testing.

**Verified:** local Chrome via `?auto=cottage` — smooth dome, gable filled, sits flush on walls, zero console errors.

**Gotchas:** flat oversized tiles on a curve read as stepped/spiky with gaps — curved cylinder-slice tiles are the right primitive for curved roofs. For blocky buildings use `pyramidRoof` instead.

**Next:** slice market stall / cart / tree; then print-a-single-piece + edge-snapping.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Roof redone as all-small-pieces (killed the deck illusion)

**State:** live. Cottage roof no longer uses a solid deck.

**Shipped:** Kyler/Lillith flagged that the roof still "grew as one shape while the nozzle spun" (the solid half-cylinder deck did the old fade-illusion, then tiles came after). Removed the deck AND the big gable-cap discs. Roof is now **entirely small overlapping shingle tiles** that wrap the whole arc (heavy tangential overlap + running-bond stagger via the shared `fillCourse` brick helper → no see-through) + small radial pieces filling the gable ends. Lays course-by-course eave→ridge, in order like the bricks. Cottage ~277 pieces.

**Verified:** local Chrome, top-down zoom — roof fully covered, built piece-by-piece with no giant growing object; zero console errors.

**Next:** slice market stall / cart / tree; then the bigger phase — print each piece alone + edge-snapping assembly.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — Printer v2e shipped (sliced) + roof/order/speed fixes

**State:** live. /3DPrinterAsset/ now runs **v2e** (sliced, piece-by-piece printing). Cottage prints as ~227 small pieces: brick-course walls + a solid-deck shingle roof.

**Shipped:**
- **v2e engine** vendored live (from World-Printer-Lab `src/main-v2e.js`): a reusable **slicer** (`brickShell`, `barrelShingles`) cuts big primitives into many small pieces so prints read as real fabrication, not a fade illusion. Reveal reworked — no opacity fade; small pieces pop, large un-sliced pieces still build up bottom-up (no regression on boat/tree/etc).
- **Roof fix** (Lillith flagged floating/see-through tiles): roof is now a **solid half-cylinder deck** under overlapping shingle tiles + **solid gable end caps**; seated so eaves meet the walls. No see-through.
- **Print order:** within each height layer, pieces lay by angular sweep around the object centre (deliberate), not scattered.
- **Speed:** eased ~11s → ~13.5s so the build is easier to watch.
- Homepage "3D Printer" card added earlier (Supabase `surfaces` row `printer` + SLUGS entry).

**Verified:** local Chrome — cottage prints 227 pieces, solid roof, full print→pickup→place flow, zero console errors; live route serves v2e (title + slicer present).

**Next:** slice the other objects (market stall, cart, tree — tree needs true hidden-then-printed reveal). Bigger asks from Kyler: print each piece alone (not just whole object) + edge-snapping assembly; this is the foundation for piece-built, player-placeable world objects.

**Gotchas:**
- Live printer is a **vendored copy** — update `heartbeat-observatory/3DPrinterAsset/main.js` from the lab's `src/main-v2e.js` (drop the `import './style.css'` line) and ship; pushing to the lab repo alone does nothing live.
- There's a Slack channel **#threedprinter** (separate from #world-printer-lab) — Kyler/Lillith may post feedback there too.

---

## 2026-07-09 — Claude (Opus 4.8, Claude Code) — World Printer Lab live at /3DPrinterAsset/ + homepage tab

**State:** live. https://www.heartbeatobservatory.com/3DPrinterAsset/ serves World Printer Lab v2d, and a "3D Printer" card now sits in the homepage grid (after Games, before The Engine). Kyler can test from any phone over public HTTPS — no LAN/localhost/same-Wi-Fi.

**Shipped:**
- **New isolated static route `3DPrinterAsset/` — build-free.** Raw v2d source + vendored Three.js (`vendor/three.module.min.js` + `three.core.min.js` + `OrbitControls.js`) resolved via an import map in `index.html`. No Vite build, no Vercel build config — heartbeat serves it as plain static files. All paths relative, so the folder is path-portable and fully isolated (breaking it can't break the rest of the site). Sourced from the MIT World-Printer-Lab-For-3D-Worlds repo (v2d = `src/main-v2d.js`, with its `import './style.css'` line dropped in favor of a `<link>`).
- **Homepage tab.** Added `printer:"/3DPrinterAsset/"` to the SLUGS map in `index.html`, and inserted a `surfaces` row (key=`printer`, name=`3D Printer`, status=`live`, position=6; bumped `engine` to 7).

**Verified:** loaded the live route and the homepage card click-through in a real browser — full v2d scene renders, **zero console errors**; every asset returns 200 with the correct MIME type (JS as `application/javascript`, critical for the import map). surfaces order confirmed via SQL.

**Next:** ChatGPT/Grok keep iterating v2 in the World-Printer-Lab repo. When a change is ready for the live site, re-vendor the new `src/main-v2dX.js` into `3DPrinterAsset/main.js` here and open a PR (owner merges).

**Gotchas:**
- **The live printer is a VENDORED COPY.** Pushing to the World-Printer-Lab repo does NOT update the live site by itself — the copy in `heartbeat-observatory/3DPrinterAsset/main.js` must be updated too.
- New homepage grid cards need BOTH a `surfaces` row AND a `SLUGS` entry — without the slug the card href falls back to `#`. So insert the DB row only after the SLUGS change is deployed.
- If the lab is ever built with Vite instead, set `--base=/3DPrinterAsset/` in **PowerShell**, not Git Bash — Git Bash mangles the leading-slash base into `/Program Files/Git/3DPrinterAsset/`.

---

## 2026-07-09 — Claude (Fable 5, Cowork) — Site-wide form-language pass (visual-direction brief)

**State:** live. All three worlds moved off blockout geometry in one run.

**Shipped:**
- **Engine/Home world** (engine/hub/main.js): person avatars rebuilt shaped
  (capsule limbs, tapered torso, sphere joints, neck, hair cap — box limbs
  gone); every hub building now gets addArchitecture(): base plinth, corner
  pillars, per-floor glass window bands with mullions, parapet + setback roof
  cap (the floating oversized slab is gone), entry awning + lamps + facade
  sign panel so labels aren't doing the identity work. Collision footprints
  unchanged.
- **Fable mirror** synced to fable-survival@HEAD: shaped characters (shared
  humanoid rig: survivor/infected/trader), real car model (one extruded hull,
  wheel wells, lights) for wrecks AND remote cars, barn gable roof that meets
  at the ridge with gable ends + ridge beam, shed roof on posts for the
  abandoned house. Wrapper (hb-device-tier + quality chip) preserved.
- **SYL v0.4.0** staged on syl-test, screenshot-verified, promoted to
  games/syl: one-piece extruded ship hull + fin + canopy + tapered wings +
  engine pylons, shaped astronauts (player + remotes), F7 collider debug view,
  scene-validation tests (caught a real building overlap).

**Verified:** SYL 143/143 headless + live syl-test screenshots (ship rear
reads as a vehicle: rounded hull, fin, nacelles; outpost daylight shot reads
as a planned settlement). Fable vite build clean. Engine hub node --check.

**Next:** in-world placement editor (brief Phase 4) — asset browse/drag/move/
save; F8 tuner + F7 colliders are the first two pieces of that tool chain.

---

## 2026-07-08 — Claude (Fable 5, Cowork) — SYL v0.3.0 visual overhaul promoted + Fable mirror synced to v0.6.6 + /api inbox routes

**State:** live. `/games/syl/` serves SYL v0.3.0 (visual overhaul: procedural
textures, shaped structures, lighting/fog/shadows, grounding+collision for
settlements, F8 tuner). `/games/fable-survival/` serves Fable v0.6.6 (was a
stale 2026-07-05 bundle missing feedback-on-all-screens and the 🤖 dev-chat
inbox).

**Shipped here:**
- `games/syl/` + `games/syl-test/`: synced from SYL-Full-Game v0.3.0. The
  syl-test route was used as the STAGING lane: two verification rounds ran
  there (screenshots via Chrome) before promotion — that loop caught a
  black-wall palette problem, a too-low sun, and near-black damaged engines.
- `games/fable-survival/`: fresh vite build of fable-survival@c7a21f8 with the
  Heartbeat wrapper re-applied (hb-device-tier.js script, quality chip CSS/div/
  script) per fable's HEARTBEAT_SYNC_PROMPT.md.
- `api/feedback.js`, `api/aichat.js` (new): no-credit inbox routes so the
  HOSTED Fable can submit player feedback / dev-chat as GitHub issues on
  fable-survival (labeled player-feedback). They return 503 not-configured
  until `GITHUB_TOKEN` (fine-grained, fable-survival only, Issues R/W) is set
  in this repo's Vercel project — that env var is the one manual step left.

**Verified:** live 200s on /games/syl-test/src/render/lighting.js and
/games/fable-survival/assets/index-PQL0LRu8.js; Chrome screenshots of the
staged SYL build; fable page shows quality chip + new UI buttons.

**Gotchas:**
- A HIDDEN Chrome tab never runs requestAnimationFrame — a screenshot of a
  freshly opened background tab shows frame zero (camera at planet centre,
  all sky). Drive frames manually via console or focus the window before
  judging visuals.
- games/syl-test is the SYL staging lane. Stage → screenshot-verify → promote.

---

## 2026-07-05 — Kimi (Moonshot AI) — Synced SYL: settings, space props, transport fleet, interiors, back buttons

**State:** live verified at `/games/syl/` and `/games/fable-survival/` and
`jaronkbragg7337.github.io/President-Sim/`.

**Shipped:** synced `games/syl/` from canonical `SYL-Full-Game` commit `ad0c435`
(`Add settings screen, space props, transport fleet, ship interiors, and back
button`). The hosted bundle now includes:
- Settings screen (`src/ui/settings.js`): `O` key opens mouse/touch sensitivity,
  graphics, and sound toggles. Persisted in localStorage (`syl_settings_*`).
- Space props (`src/world/spaceProps.js`): 40-60 decorative asteroids/clusters/
  debris/satellites in a 500k–2M unit radius field. Visual-only, no collision.
- Transport fleet (`src/world/civilTransport.js`): 3 staggered transports on the
  same 7-stop route with oriented-box collision, door toggle (`T`), and interior
  view (`V`).
- Ship interiors (`src/ship/ship.js`): interior bounds, door state, window
  meshes. Interior view toggle while piloting. `traversal.js` has
  `MODE.INSIDE_SHIP` architecture for future full walk-around.
- Multiplayer transport sync: remote players see all 3 transports via fleet
  state broadcast.
- Back buttons (`← Games` → `/games/`) on SYL mobile, SYL desktop, and Fable
  Survival. President-Sim back button synced via GitHub MCP.

**Verified:** canonical SYL passed `npm test` 124/124 before sync. Syntax checks
passed for all new files. Live deploy poll returned 200 for
`/games/syl/src/ui/settings.js`, `/games/syl/src/world/spaceProps.js`, and
`/games/syl/src/world/civilTransport.js`. Live Chrome smoke at
`https://www.heartbeatobservatory.com/games/syl/` rendered canvas, showed HUD,
zero warnings/errors. Fable Survival back button verified at
`https://www.heartbeatobservatory.com/games/fable-survival/`.

**Next:** Jaron phone-tests settings (`O`), interior view (`V`), door (`T`),
transport boarding, and space prop visibility. If good, next useful chunk is
full WASD walk-around inside ships (traversal.js architecture is ready).

**Gotchas:**
- Interior view is MVP camera toggle, not full ship-local physics. Future full
  walk-around should use the existing `MODE.INSIDE_SHIP` / `PHASE.INSIDE` hooks.
- Space props are visual-only; adding collision would need spatial indexing.
- Transport fleet uses staggered starts; adding more ships requires distinct
  `phaseOffset` values.
- Sync to heartbeat-observatory hit a rebase conflict with `fable-survival`
  assets; resolved by `git reset --hard origin/main` and re-syncing only SYL
  files. Do not touch `fable-survival/` when syncing SYL changes.

---

## 2026-07-05 — Codex — Synced Fable build snapshot sync

**State:** live verified at `/games/fable-survival/`.

**Shipped:** synced `games/fable-survival/` from canonical `fable-survival`
commit `2170f48` (`Share build snapshots with late peers`). The hosted bundle
now includes Fable v0.6.5: online clients share a bounded `build-snapshot`
payload with late-joining peers so already-placed base pieces become visible
without waiting for the next placement. The Heartbeat wrapper still loads
`/hb-device-tier.js` and displays the quality chip.

**Verified:** canonical Fable passed syntax checks, `git diff --check`, a
module smoke for addressed snapshot send/apply/duplicate/wrong-target behavior,
clean temp build, and production-dist browser smoke before sync. Synced bundle
is `assets/index-BV92Sd35.js`. Local Heartbeat Chrome smoke on
`http://127.0.0.1:4174/games/fable-survival/` served `hb-device-tier.js` plus
`assets/index-BV92Sd35.js`, rendered one canvas, showed `data-hb-tier="desktop"`
and `desktop graphics`, entered the world, displayed the HUD, initialized the
Realtime chip, and logged zero warnings/errors.
Live deploy poll returned 200 for
`/games/fable-survival/assets/index-BV92Sd35.js` with `build-snapshot` and
`vehicleId`. Live Chrome smoke at
`https://www.heartbeatobservatory.com/games/fable-survival/` served
`hb-device-tier.js` plus `assets/index-BV92Sd35.js`, rendered one canvas, showed
`data-hb-tier="desktop"` / `data-hb-webgl="webgl2"` and `desktop graphics`,
entered the world, displayed the HUD, initialized the Realtime chip, and logged
zero warnings/errors.

**Next:** verify standalone Fable deployment, then continue SYL/Fable durable
persistence planning.

**Gotchas:** this is live online snapshot sync, not durable persistence. A
schema-backed object store still needs a namespaced table/RPC; Town Square's
current `world_props` path is not safe to reuse directly because it has no
game/world namespace in the client query.

---

## 2026-07-05 — Codex — Synced Fable remote vehicle visibility

**State:** live verified at `/games/fable-survival/`.

**Shipped:** synced `games/fable-survival/` from canonical `fable-survival`
commit `f5f0a98` (`Use Heartbeat device tier for hosted Fable`). The hosted
bundle now includes Fable v0.6.4: drivers broadcast vehicle
mode/id/position/yaw over the existing Heartbeat Realtime state channel, remote
peers render a moving car instead of a walking survivor while that peer is
driving, and the Heartbeat-hosted build uses `/hb-device-tier.js` for renderer
pixel ratio caps.

**Verified:** canonical Fable passed `node --check`, `git diff --check`, clean
temp `npm install && npm run build`, production-dist Chrome smoke, and a module
smoke confirming `mode: "vehicle"` payloads before sync. The synced Heartbeat
bundle was checked for `mode`, `vehicleId`, and remote vehicle mesh code. Local
Heartbeat Chrome smoke on `http://127.0.0.1:4174/games/fable-survival/` served
`assets/index-BF118Vgp.js`, rendered one canvas, entered the world, displayed
the HUD, initialized the Realtime chip, and logged zero warnings/errors. Final
resync serves `assets/index-Bx8fCYaW.js`, includes `HBDevice` renderer pixel
ratio code in the bundle, keeps the Heartbeat quality-chip shell hook, and
local Chrome showed `data-hb-tier="desktop"`, `data-hb-webgl="webgl2"`, and
`desktop graphics` on the start screen. Live deploy poll returned 200 for
`/games/fable-survival/assets/index-Bx8fCYaW.js` with `vehicleId` and
`rendererPixelRatio`. Live Chrome smoke at
`https://www.heartbeatobservatory.com/games/fable-survival/` served
`hb-device-tier.js` plus `assets/index-Bx8fCYaW.js`, rendered one canvas,
showed `data-hb-tier="desktop"` / `data-hb-webgl="webgl2"` and `desktop
graphics`, entered the world, displayed the HUD, initialized the Realtime chip,
and logged zero warnings/errors.

**Next:** implement durable shared bases/parked vehicles when ready for a
schema-backed pass.

**Gotchas:** this is live visibility only. Durable shared bases and parked
vehicles still need a schema-backed pass using the Town Square `world_props` +
broadcast + reconcile pattern.

---

## 2026-07-05 — Codex — Synced SYL planet detail layer

**State:** live verified at `/games/syl/`.

**Shipped:** synced the SYL static copy from canonical `SYL-Full-Game` commit
`43259e6` (`Add planet settlement detail layer`). The website copy now includes
`games/syl/src/world/worldDetails.js` plus the runtime imports in
`planet.js`, `desktopPlanet.js`, and the body-map surface-detail line in
`ui.js`.

**Verified:** canonical SYL passed `npm test` 105/105 before sync. Local SYL
public route on `http://127.0.0.1:8377/` rendered canvas, opened `M`, showed
`surface: 36 buildings, 104 wild details`, preserved the CIVIL TRANSPORT LINE,
and logged zero warnings/errors. Local Heartbeat route
`http://127.0.0.1:4174/games/syl/` passed the same public-route checks and
served `./src/main.js`. Live deploy poll first returned 404 for
`/games/syl/src/world/worldDetails.js`, then returned 200 with
`buildWorldDetailLayer`. Live Chrome smoke on
`https://www.heartbeatobservatory.com/games/syl/` rendered canvas, opened `M`,
showed `surface: 36 buildings, 104 wild details`, preserved the CIVIL TRANSPORT
LINE, and logged zero warnings/errors. Desktop browser automation timed out in
the canonical repo; static HTTP returned 200 for `/desktop.html`, so a normal
desktop visual pass remains a known follow-up.

**Next:** inspect Heartbeat engine realtime patterns for shared build/vehicle
persistence in SYL and Fable.

**Gotchas:** `worldDetails.js` is visual-only. Persistent placed objects,
player-owned ships/vehicles, and shared builds should use a realtime/persistent
object system, not this scenery layer.

---

## 2026-07-05 — Codex — Promoted SYL civil transport line

**State:** live verified at `/games/syl/` and `/games/syl/desktop.html`.

**Shipped:** synced `games/syl/` from `SYL-Full-Game` commit `9c8c29c`
(`Add civil transport line`). The static copy now includes `index.html`,
`desktop.html`, `lib/`, `src/`, and `assets/`, including the new
`src/world/civilTransport.js` passenger route system, seven transit-base stops,
desktop fidelity route files, and GLB assets.

**Verified:** canonical SYL repo passed `npm test` 102/102 before sync. Local
Heartbeat static smoke on `http://127.0.0.1:4174/games/syl/` and
`/games/syl/desktop.html`: both booted `window.game`, exposed
`civilTransport`, route count was 7, current stop was Earth, next stop was Moon,
canvas sized correctly, and the `M` map panel showed the CIVIL TRANSPORT LINE
with Tranquility Civil Hub. Live smoke on
`https://www.heartbeatobservatory.com/games/syl/` and `/games/syl/desktop.html`
passed the same checks; `src/world/civilTransport.js` and desktop GLB assets
return 200.

**Next:** Jaron phone-tests boarding from the Earth terminal. Next useful
systems work: timetable/ETA polish, landing aids, or fare/faction hooks.

---

## 2026-07-05 — Codex — Starter World direct lab route

**State:** live verified at `/worlds-lab/starter/`. The route is not linked
from the lab gallery or live town.

**Shipped:** added `worlds-lab/starter/` as a new-folder-only starter template
copied from the current Town Square shell. The starter has its own
`index.html`, `styles.css`, `main.js`, and `README.md`; BUILD/?v is
`2026-07-05-starter1`. The environment is intentionally empty: bounded ground,
paths, a small sign, benches/trees for scale, and no destination buildings,
claim plots, arena, or production containers.

**Verified:** `node --check worlds-lab/starter/main.js`; local static server
at `http://127.0.0.1:4173/worlds-lab/starter/`; live Vercel route, module, and
CSS returned 200; live Chrome/Playwright desktop and mobile smoke. Checks
passed: page 200, module path includes `?v=2026-07-05-starter1`, canvas sized
to viewport, overlay enters, status online, place chip says Starter Biome,
Build mode hidden, Ask Claude button appears, inline favicon prevents the
default `/favicon.ico` 404, and no requests fired to guarded production paths
`world_spaces`, `world_props`, `world_presence`, `touch_world`, or
`agent_state`. Mobile screenshot was checked after moving/shrinking the sign so
it no longer overlaps the fixed Ask Claude button.

**Next up:** Jaron phone-walks the direct path after deploy. If accepted, the
next useful starter step is giving it a real starter data path for build-mode
draft props rather than reusing Town Square tables.

**Gotchas:** the starter deliberately does not import persisted Town Square
resident ghosts or roaming minds; their saved positions belong to Town Square
and made the empty template visually noisy. Live visitors still share the
starter's own `starter-lab` channel. Lab mode also blocks production ledger and
prop/space writes, so this is not yet a promoted world with `touch_world`.

---

## 2026-07-04 — Codex — SYL nose-first ship thrust synced

**State:** public `/games/syl/` needs the follow-up for Jaron's report that
the ship still felt like it had no front: left/right changed travel direction
instead of turning the glass/front of the hull.

**Shipped:** synced the `ship.js` assisted-flight change from SYL. Assisted
ship piloting now yaws the hull/front first, then applies throttle/reverse/lift
through that front/up axis. Left/right input alone rotates the ship nose without
inventing sideways velocity.

**Verified:** SYL `npm test` 72/72 before sync; Heartbeat `ship.js` syntax
check after sync.

**Next up:** Jaron retests desktop and mobile: A/D or analog left/right should
turn the hull/front; W/stick up should push through the direction the glass is
pointing.

**Gotchas:** still arcade-assisted and phone-friendly, not full Newtonian 6DOF.

---

## 2026-07-04 — Codex — SYL chase camera steering lock synced

**State:** public `/games/syl/` needs the follow-up for Jaron's report that
desktop WASD and mobile analog still moved the camera while in ship mode.

**Shipped:** synced the `main.js` chase camera change from SYL. While ship
steering/throttle/lift/brake is active, the chase camera holds its current base
orientation instead of treating ship yaw as camera orbit. Explicit mouse/touch
look still orbits the camera, and the chase camera recenters behind the ship
after steering/look input stops.

**Verified:** SYL `npm test` 71/71 before sync; Heartbeat `main.js` syntax check
after sync.

**Next up:** Jaron should phone/desktop retest. A/D and analog left/right should
turn the ship under the view; camera orbit should require mouse/look drag or a
touch outside the analog/buttons.

**Gotchas:** chase camera still follows ship position, so flying moves the
camera through the world. The fix is specifically about steering not orbiting
the camera.

---

## 2026-07-04 — Codex — SYL touch joystick/camera split synced

**State:** public `/games/syl/` has the Fortis visual and the next mobile
mechanics hardening for Jaron's report that the analog stick still felt like it
was orbiting the camera.

**Shipped:** synced `engine.js` and `touch.js` so joystick/button touch events
stop at the control layer and cannot bubble into global touch-look. This keeps
vehicle-control touches steering the ship and reserves camera orbit for touches
outside the analog/buttons, matching the Unreal pilot-input rule.

**Verified:** SYL `npm test` 71/71 before sync; Heartbeat syntax/source smoke
after sync.

**Next up:** if phone testing still shows camera drift, add dev logging for
active touch ids and a visible camera-lock state while piloting.

**Gotchas:** this is a mobile event-routing hardening pass; it keeps the
existing dev-fly-style assisted ship movement.

---

## 2026-07-04 — Codex — Fortis gunship visual synced

**State:** public `/games/syl/` is ready to receive the mobile-safe Fortis
gunship visual from the SYL game repo.

**Shipped:** synced the code-built `Fortis_Gunship_CodeBuilt` hierarchy into
the public SYL bundle: deck, shells, wings, engines, cockpit glass, pilot seat,
console, ramp, pressure door, trim, landing gear, cargo bay, tanks, and module
damage tinting. This ports the shape language from
`SpaceYouLand/_authoring/make_walkable_gunship.py` without adding raw FBX/GLB
payloads to the mobile web build.

**Verified:** SYL `npm test` 71/71 before sync, including the Fortis visual
hierarchy test; Heartbeat syntax/source smoke after sync.

**Next up:** wire the ramp, hatch, pilot seat, and camera anchors as real
interactions so the visual stops being only a flyable exterior shell.

**Gotchas:** this is still primitive Three.js geometry, not mesh-perfect
collision or a full walkable interior. That is deliberate for phone safety.

---

## 2026-07-04 — Codex — SYL ship structure collision synced

**State:** public `/games/syl/` has the follow-up for Jaron's report that the
ship could fly through anything.

**Shipped:** synced ship hull collision against authored analytic structure
footprints. The ship now uses the same structure collision resolver as the
player, but with a larger hull radius, and dampens velocity when pushed out.

**Verified:** SYL `npm test` 70/70 before sync, including ship hull structure
collision.

**Next up:** port the Fortis walkable gunship visual/interior from the Unreal
authoring script as lightweight Three.js geometry.

**Gotchas:** collision is analytic footprint collision, not mesh-perfect. This
is the right mobile-safe step before richer ship geometry.

---

## 2026-07-04 — Codex — Assisted ship piloting default synced

**State:** public `/games/syl/` has the fix after Jaron reported desktop WASD
was also weird and dev fly mode was the correct feel.

**Shipped:** synced dev-fly-style assisted ship piloting as the default:
W/S or mobile stick up/down moves forward/reverse, A/D or stick left/right turns
ship heading, Space/LIFT climbs, and X/Ctrl/BRAKE slows. Mouse/touch look is
camera orbit only and camera recenters behind the ship when look input stops.

**Verified:** SYL `npm test` 69/69 before sync; syntax and browser source smoke
before push.

**Next up:** Jaron retests: desktop W forward, S reverse, A/D turn ship, mouse
camera only; phone FLY stick should not orbit camera.

**Gotchas:** old 6DOF/inertial ship flight is no longer the default feel.

---

## 2026-07-04 — Codex — SYL dev-fly mobile ship feel synced

**State:** public `/games/syl/` has the follow-up requested after Jaron said
dev fly mode feels perfect and the ship should behave like that with ship
buttons added.

**Shipped:** synced mobile ship control split: the FLY joystick touch id is
excluded from camera-look, ship steering no longer consumes touch-look deltas,
and outside touches only orbit the chase camera. When outside look is released,
camera recenters behind the ship. Mobile ship movement now uses direct assisted
hover/free-roam velocity: stick forward/reverse moves the ship, LIFT climbs,
BRAKE slows, and release steadies.

**Verified:** SYL `npm test` 68/68 before sync; run syntax/touch smoke before
push.

**Next up:** Jaron phone retest: stick-only flight should keep camera locked
behind; touching outside the FLY circle should free-look camera only.

**Gotchas:** mobile ship flight is now intentionally dev-fly-like. Desktop 6DOF
is still separate.

---

## 2026-07-04 — Codex — SYL mobile heading assist synced

**State:** public `/games/syl/` has the fix for Jaron's "ship feels like it is
on a line" phone report.

**Shipped:** synced touch-only mobile flight assist. In `games/syl/src/ship/ship.js`,
mobile piloting now yaws the real travel heading directly, keeps the hull level
to the current body's up vector, and applies main thrust along that heading.
`main.js` passes `controls.mobileAssist` only from touch mode. Desktop remains
the existing 6DOF/inertial flight path.

**Verified:** SYL `npm test` 67/67 before sync, including mobile-heading tests;
run syntax checks and touch smoke before push.

**Next up:** Jaron phone retest: hold stick up to build throttle, then move
stick left/right and confirm the path curves instead of only the camera moving.

**Gotchas:** this is intentionally assisted phone free-roam, not advanced
aircraft mode. Keep it mobile-first unless adding an explicit advanced toggle.

---

## 2026-07-04 — Codex — Calmer SYL mobile piloting synced

**State:** public `/games/syl/` has the follow-up phone-control fix after
Jaron's screenshots showed the first touch steering pass was still too wild.

**Shipped:** synced calmer mobile piloting: left stick is FLY
(throttle + yaw), the bottom button becomes LIFT while piloting, right-side
ship buttons are reduced to BRAKE + GEAR, touch-look is less sensitive while
piloting, and throttling up on touch applies takeoff lift to prevent hard-impact
scrape loops.

**Verified:** SYL `npm test` 65/65 before sync; node syntax checks and browser
touch smoke before push.

**Next up:** Jaron should retest on phone. If the feel is accepted, port the
Fortis walkable gunship from `SpaceYouLand/_authoring/make_walkable_gunship.py`
as simplified Three.js geometry rather than raw FBX for mobile.

**Gotchas:** the Unreal gunship script is the richer ship Jaron asked about:
interior, cockpit, ramp, pressure door, glass, engines, gear. Web/mobile should
get a lightweight code-built version first.

---

## 2026-07-04 — Codex — SYL touch ship steering synced to Heartbeat

**State:** public `/games/syl/` now has the same touch ship steering fix as
`SYL-Full-Game` main.

**Shipped:** synced `games/syl/src` from SYL after adding piloting-mode analog
stick steering: left stick steers ship pitch/yaw, THR buttons control throttle,
and touch virtual-key sources are separated so steering cannot cancel throttle
buttons. This came from checking `SpaceYouLand` and carrying over the seated
pilot control separation in a mobile-safe web form.

**Verified:** SYL `npm test` 65/65 before syncing; node syntax checks on edited
Heartbeat game files after syncing.

**Next up:** Jaron's actual phone/tablet feel test on
`https://www.heartbeatobservatory.com/games/syl/?dev=1`, then prefab placement
and persistent building/ship-room editing.

**Gotchas:** desktop browser mobile viewport is not a true touch API test here;
real touch feel still needs device confirmation.

---

## 2026-07-04 — Codex — SYL dev editor first slice synced to Heartbeat

**State:** public `/games/syl/` had the promoted Kimi/multiplayer/yaw work.

**Shipped:** synced SYL's first opt-in dev editor to Heartbeat. Open
`/games/syl/?dev=1` to reveal the DEV button. Current tools: ready a mobile-safe
test ship, give supply kit, fill fuel, move ship to player, player to ship, save
now, and fly-person mode. This is deliberately code-built and phone-safe; no
Blender/GLB asset payload was added.

**Verified:** run SYL tests and browser smoke before push.

**Next up:** prefab placement + snap-compatible building/ship parts, then
walk-in ship interiors/hatches/seats.

**Gotchas:** `?dev=1` persists in localStorage on that browser. It is a playtest
convenience, not a security boundary.

---

## 2026-07-04 — Codex — Theater rear controls + SYL promoted to public main

**State:** working locally after Claude's theater promotion. `SYL-Full-Game`
had the approved work on `test/kimi-expansion-pack`; Heartbeat `/games/syl-test/`
had the same test-lane copy while `/games/syl/` was still the conservative build.

**Shipped:** moved Town Square and World 2 theater START/NEXT controls from the
screen/front floor to the rear aisle so the pads and station labels no longer
cover the movie view. Promoted SYL test content into public `/games/syl/`:
Kimi expansion registries/crafting, Heartbeat Realtime visibility, and the
A/D yaw + touch-turn flight fix. Kept `/games/syl/` on stable save key
`syl_save`; left `/games/syl-test/` path-scoped for future preview saves.

**Verified:** run node checks, SYL tests, and browser smoke before final push.

**Next up:** phone feel-test public `/games/syl/` and walk into the Town Square
theater to confirm the screen stays clear from the viewing seats.

**Gotchas:** the in-world arcade still links only to public SYL and Fable
Survival; `/games/syl-test/` remains direct-URL only unless a future admin/test
door is added back.

---

## 2026-07-04 — Whole-site audit + THE THEATER promoted (Cowork, Claude Fable 5)

**State when I arrived:** site live and healthy. Working video playback existed ONLY in the
worlds-lab Marquee Row proof (lib/v1/cinema.js); all three live theaters said "first screening
coming soon". Hub BUILD const said 2026-06-10d while its ?v= said 2026-07-04 (Codex's July 3
commits bumped ?v without BUILD — boot log was lying). worlds-lab (8 finished solo worlds) was
reachable but linked from nowhere. bubble.js missing on /pam and /space despite the README's
"rides along on every page".

**Shipped this session:**
1. `/video` — flat Theater page now plays real film: full legal catalog (Blender CC BY ×4,
   Internet Archive PD ×2, NASA PD ×1 w/ fallback), reel picker, credits during playback,
   honest error states, muted-first phone handling.
2. Town Square theater interior — full Marquee Row port: START/NEXT glowing pads, 16:9
   VideoTexture screen + masking, house lights (bright idle → dim show → restored on leave),
   NOW SHOWING + credit plaque boards, video pauses on exit. BUILD 2026-07-04-theater1
   (also heals the BUILD/?v drift). Stations gained an additive `fn` action type.
3. World 2 theater interior — same port. BUILD 2026-07-04-w2k.
4. Landing page — "The back lot" card linking /worlds-lab/ (honest Preview pill, says solo).
5. bubble.js added to /pam and /space.
6. Docs: TODO theater item updated (shipped text moved verbatim to ARCHIVE.md), this file created.

**SECOND PUSH same session — catalog repair (the important find):** live browser testing
revealed the June 11 catalog partially DIED server-side: the Google sample bucket
(commondatastorage.googleapis.com) now returns **403 for everyone** — all four Blender reels
were dead in every theater, including the lab proof. Re-verified every source with curl +
browser fetch and repaired the catalog everywhere: Blender films now come from **Wikimedia
Commons 720p transcodes (CORS-verified — required for VideoTexture)** with Internet Archive
mp4 fallbacks; the flat /video page uses the mp4s as primary (universal codec; its crossorigin
attribute is removed since a plain page needs no CORS and archive.org sends none); NASA's
~mobile variant (CORS-verified) is primary with ~medium fallback. worlds-lab got **lib/v2/cinema.js**
(v1 stays frozen per the freeze law — v2 is v1's code + the repaired catalog, importing v1's
frozen textures/buildings); cinema-district and cosmodrome now import v2 (BUILD 2026-07-04-films2).
Paper trail in worlds-lab/CREDITS.md. Final builds: hub theater2, world2 w2l.

**Verified:** node --check on both edited main.js files; anchored count==1 python edits per
METHOD.md; BUILD+?v bumped same commit (deploy law); live URL + md5 verification after push —
ALL lanes byte-exact vs pushed; live-browser boot checks: hub logs BUILD 2026-07-04-theater2,
World 2 logs 2026-07-04-w2l (its theater block runs AT BOOT — clean console = the ported code
executed end-to-end), Marquee Row logs 2026-07-04-films2 on the v2 import — zero console errors
anywhere; landing + /video render correctly with the back-lot card and reel picker;
TDZ law respected (new module lets sit with the other interior lets, far above
the boot calls).

**Honest limits / what is NOT done:**
- Theater playback is PER-VISITOR. Two people in one hall each run their own projector.
  Next step (designed, not built): "cine" broadcast event on the world state channel +
  late-join reconcile so a hall watches together. Then seat assignment (TODO SOON).
- worlds-lab worlds are still SOLO previews — the landing card says so. Real promotion of
  any lab world = the WORLD-STANDARD checklist (shell port, gate page, own channel,
  touch_world allowlist). Cinema-district's PATTERN is now promoted; the world itself stays lab.
- Fossil naming ("The Engine" vs "Town Square" in the landing sections list) is a Supabase
  `surfaces` row, deliberately untouched — final name is Jaron's call (TODO NOW item 7).

**Verification honesty note:** actual video FRAMES could not be confirmed from this machine —
the automated Chrome profile used for testing does not deliver media-element streams at all
(proved environmental: even known-good hosts and the OLD page stall at readyState 0 while raw
fetch of the same URL returns 206 bytes in ~400ms). Everything up to the pixels is verified
(sources reachable + CORS-checked via curl, UI states, credits, error paths, boot logs).
Jaron's phone walk is the true frame test — per the house law, live tests outrank theory.

**Gotchas for the next agent:**
- The three recent Codex commits put SYL-test behind an admin gate in the arcade, then the
  Fable Survival cabinet REPLACED that admin SYL TEST cabinet (2245a4a). /games/syl-test/
  is still live-but-unlisted by URL; there is currently no in-world door to it.
- engine/hub/main.js stations: `fn` acts run callbacks; world2 acts: `{ type: "fn", fn }`.
- Keep ONE <video> per room (media-surfaces law). Do not add per-surface videos.
- Deploy law: bump BUILD const AND ?v= in the same commit, every main.js push, both worlds.

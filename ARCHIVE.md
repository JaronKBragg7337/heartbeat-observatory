# Heartbeat Observatory — ARCHIVE (completed work, preserved verbatim)

Nothing is deleted in this project — it is relocated. When an item in `TODO.md` is verified done, its full text moves here with a date, so the live TODO stays a clean read for any fresh session while every detail of what was built (and why) stays on the record forever. Full document history also lives in git.

Convention: newest sections at the top. Text is moved verbatim from TODO.md — not rewritten.

---

## Archived June 9, 2026 (launch-eve sprint)

### NOW gate items completed (June 9)

1. **World-forward home page (Tier 1) — DONE (verified live June 9, late):** globe hero + "Enter the world" + plain-language intro were already live; **og:image + Twitter card shipped tonight** — `og.jpg` is a straight crop of a real world screenshot (dawn plaza, real residents, Claude · Architect visible), nothing staged. Verified: live homepage serves the tags, `/og.jpg` returns 200 byte-identical. Shared links (the X post) now preview the actual town. Original spec kept: landing leads with the walkable world, floating globe hero doubling as "Enter the world," plain-language intro, section cards below as secondary doors, SEO/OpenGraph meta.
2. **In-world first-run onboarding overlay — DONE (verified in code June 9):** the entry overlay covers what-this-is + Move/Look/Jump/Duck/Throw/Hold/Enter-a-building for desktop AND touch (device-adaptive blocks), and the layer-2 nudges (first ghost / first empty plot) fire once and are remembered locally. The entry overlay appears each visit by design — it doubles as the Enter gate. Original spec kept: what this is + move/look/jump + interact + throw, zero API cost, works for everyone, dismissible.
3. **Claude as the in-world guide — DONE (live):** Claude walks the town labeled Claude · Architect; approaching opens the Ask panel served by `/api/ask` (key server-side); `agent_state.claude.connected = true`; `ask_log` shows real conversations. Original spec kept: named as Claude, front-and-center; a walkable character you approach and talk to; scoped to the world + friendly all-ages knowledge via a character brief (a frame, not a word-for-word script); served from a backend function (key stays server-side); cost guards = small model + short answers + per-person rate limit + sign-in gate + cached common answers.
4. **Public-click rough edges** (don't embarrass a first-time visitor):
   - ~~hide the Build button from non-admin signed-in users~~ DONE — button renders only for admins
   - ~~bug: remote movement jitter moving spot-to-spot~~ FIXED — snapshot interpolation
   - ~~bug: held item vanishes when that player throws a snowball~~ FIXED — root cause was holding never being applied in `applyPeerState` (sync was incidental, not state-driven) plus a wipe path in `reconcileCharacter`; both corrected
5. **Repo storefront (README) — DONE (June 9, late):** README now opens with the one-line hook, the real town screenshot (`og.jpg`), the live link, and "why it's different" (humans + real AIs sharing one place, honesty principle, built live in the open); dev detail follows below the pitch.

---

### DONE — recent world sprint

## DONE — recent world sprint
- **Arena sprint (June 9):** PvP paintball arena (south doorway, paintgun gear-swap), shooting gallery (6 splat/score/respawn targets), shared multiplayer (targets sync via `thit`, mutual named tags via `tag`, TAGS · TARGETS chip), paint-true effects (colored pops, fading ground splats, tinted hit flash, shooter-colored target splats on all clients), iOS keyboard auto-zoom fix, welcome overlay now mentions the arena, held-item sync root-cause fix, solid geometry (town perimeter walls, arena walls, and cover blocks gained real collision for both movement and projectiles — fixed walking/shooting through walls and escaping the map; arena zone is now the true rectangle, not a half-plane), live ranked PvP scoreboard (TAGS desc / OUTS asc, scores ride state broadcasts so late joiners see current standings; splats in the arena count as OUTS; chip now TAGS · OUTS · TARGETS), remote-movement snapshot interpolation, arena venue pass (court markings, glowing wall stripe, corner floodlight posts, night floodlight, PAINTBALL ARENA doorway sign), night sky (420-star field + moon riding opposite the sun, both day/night-cycle driven), stone fountain centerpiece in the town square (two-tier, glowing water, flagstone ring, solid), shared day/night reality (cycle phase now derives from wall-clock time, not per-client page-load — all players see the same sun/stars/moon at the same moment; found in two-profile testing), THE NEIGHBORHOOD residential district (north lane, six new claimable home plots, streetlights, hedgerow, district sign), Theater building moved off the road and opened (walk-in interior at /video, surface live), social engagement layer (likes/reposts/follows/share live).
- In-world Build Mode + live ghost preview; code-built prop catalog; live prop realtime.
- Day/night cycle. Carryable held items (synced, shown in front of the avatar, first-person viewmodel). Snowball throw — the reusable projectile/hit/sync core, screen-flash on hit.
- Homes face the plaza + remove-my-home. Admin build permissions (allowlist of the 3 accounts, override-removal, 60-prop cap per person).

---

### Done in the world (cleared)

## Done in the world (cleared)
- [x] Buildings back: a **Workshop**, two **Apartment buildings**, and a **Video** door (→ /video), each with a visible door.
- [x] **Connected minds roam** — Perplexity walks the town, labeled with its job.
- [x] **People become ghosts on leave** — away residents keep roaming, and returning updates the same account-keyed character instead of duplicating.
- [x] **Full-screen** on phone and computer (with an iPhone-specific fallback); arrow keys no longer scroll the page underneath.
- [x] **Claimable spaces** — walk to a plot, paste a GitHub link, and it becomes a building everyone sees (saved in `world_spaces`).
- [x] **Account-keyed residents** — the world loads `world_characters`, keys people by `auth_user_id`, and shows each account live when present or as a roaming ghost when away.
- [x] **Saved character customization** — signed-in residents can choose a color and pattern that persists in `world_characters.appearance`.
- [x] **Guest mode** — visitors without accounts can enter live through realtime presence, but disappear when they leave and do not become permanent ghosts.
- [x] **Floating message bubble** on every page; it becomes a phone inside the world and uses the same real `messages` system as account messaging.
- [x] **Third-person start preview** — the entry screen watches the real town from an orbiting overview before Enter switches to first-person control.
- [x] **Town polish pass** — apartment doors work, world typing no longer steals spaces from text fields, benches face the square, and ground/path materials have subtle texture.
- [x] **Retired Unity build removed** — the ~18 MB Unity WebGL build under `engine/world/` was deleted from the repo and the dead Unity bridge stripped from the Engine page; `/engine/world/*` still 307-redirects to `/engine` as a safety net for old links. The Three.js hub is the only world.
- [x] **GitHub space enrichment schedule** — GitHub Actions pings `/api/enrich-world-spaces` hourly, with a daily Vercel fallback cron; the server function reads public repo metadata and writes display-safe details through a secret-checked Supabase RPC.
- [x] **Claimed-space building styles** — claimed buildings now vary from real GitHub link/project metadata and can update when enrichment arrives.
- [x] **Public Projects polish** — Projects is now a living, visitor-facing directory: a tightened flagship card showing the real stack (World / Data / Deploy / **Domain → Cloudflare**, the one owned, paid piece) plus a live **Community projects** list reading real claimed spaces from `world_spaces`, with an honest empty state until plots are claimed.
- [x] **Onboarding controls** — the world's welcome overlay now shows device-adaptive movement guidance (WASD + mouse on desktop, move-pad + drag on phone, via a `(pointer: coarse)` media query) on top of the existing doors/ghosts/guests/claiming intro.
- [x] **News refresh lowered** — `/api/news` (Perplexity) now refreshes at most ~4×/day (6-hour edge cache) instead of every 15 min, to cut credit spend.

---

### Other minds & social layer — completed

- [x] **Minds to follow — LIVE:** the panel lists real connected minds from agent_state with working Follow buttons (mind-kind follows).
- [x] **Likes / follows / reposts / shares — LIVE (June 9):** post_likes, post_reposts, follows tables with RLS (read public, write as yourself); Like/Repost toggle with counts; Follow chips on posts (user-kind) and minds (mind-kind); the Following tab shows posts from people you follow; Share uses the native share sheet or copies a link. Replies remain honestly marked coming soon.

---

### Open follow-ups — completed (multiplayer build sprint)

- [x] **Admin allowlist (build permissions):** restrict `place_prop`/`remove_prop` to specific `auth_user_id`s (the core team's three accounts). Everyone else explores; only admins build. Need the third profile's id. Fixes "anyone signed in can build."
- [x] **Admin override removal:** let admins remove **any** prop (not just their own) so a flooded area can be cleared. Removal is currently owner-only by design.
- [x] **Per-user prop cap (spam guard):** cap props per owner (~60) in `place_prop` so one person cannot flood the world (a road got spammed with chairs in testing). Pairs with admin work.
- [x] **Bug — held item vanishes on throw — FIXED:** root cause was structural, not the throw — `applyPeerState` never applied `holding` from state broadcasts (items only updated on remote creation / incidental re-renders), and `reconcileCharacter` could wipe an item by falling back to a DB row with no holding field. Holding now applies on every state message; reconcile only updates from live peer data.
- [x] **Bug — remote movement glitches spot-to-spot — FIXED:** remote players now render via snapshot interpolation (120ms buffer between their two latest state packets) instead of snap-and-chase lerp; smooth regardless of packet timing, old lerp kept as fallback for DB-driven moves.
- [x] **Café counter — SHIPPED (June 9):** the blocker was collider cleanup, now solved properly — renderProp tags every collider a prop creates with the prop id and removePropById strips them on removal. No more invisible walls. place_prop server whitelist extended to cafe + fence.

---

### Done in the world — build sprint (cleared)

## Done in the world — build sprint (cleared)
- [x] **In-world Build Mode** with live ghost placement preview; props persist in `world_props` and sync live to all clients.
- [x] **Prop catalog** (table/chair/streetlight/planter/tree/bench) walk-and-place.
- [x] **Day/night cycle** — arcing sun, sky/fog/light shift, lamps at night.
- [x] **Carryable held items** (coffee/ball/balloon) — first-person viewmodel + synced to others (`holding` on the state broadcast); touch buttons + H key.
- [x] **Snowball throw** — synced arcing projectile, lands+pops, screen-flash when hit; Throw button + F key. Reusable projectile/hit/sync core for future arcade games.
- [x] **Homes face the plaza** + **remove-my-home** (release) in Settings.
- [x] **world_props added to the Supabase realtime publication** so placements/removals broadcast live.

---

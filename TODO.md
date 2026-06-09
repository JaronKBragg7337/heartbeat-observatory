# Heartbeat Observatory — To-Do

Living task list. Items get worked, checked off, and cleared when done, so this always shows only what is real and current.

## Next — confirmed roadmap (sequenced)
No known Engine hub blockers are open. The next work, in build order:

**Phase 1 — quick world passes (both touch `engine/hub/main.js`):**
- [ ] **In-world onboarding nudges (layer 2):** one-time, dismissible hints the first time a newcomer passes a roaming ghost ("someone who stepped away") and the first time they reach an empty plot ("sign in to claim this with a GitHub repo"). Doors already prompt; this adds the ghost and plot moments. Each fires once, remembered locally.
- [ ] **Richer claimed-building styles:** a basic version is already live (in Done below). Deepen it — pull more real enrichment fields (`world_spaces.repo_metadata`: language, stars, topics, license) into visibly distinct buildings so a claimed space reads as its real project at a glance. No invented detail.

**Phase 2 — living movement:**
- [ ] **Capture player movement → human-like roaming AIs (fast version):** player positions already stream over Supabase realtime; sample them sparingly (routes, dwell spots, jumps) into a small table, build a movement-pattern library, and have roaming minds draw from it so they wander and idle like people. Guardrail: mimicking how they *move* is honest ambient life; doing real *work* stays gated on a real connected job. (A heavier imitation-learning version trained on the 4060/CUDA is a separate, later research track.)

**Phase 3 — flagship:**
- [ ] **Apartment rooms (resolves "Apartment destinations" below):** repurpose the apartment door from "exit to `/`" into "enter your own room." Each resident gets a customizable interior they decorate (wall/floor colors + placed items, persisted as a small `layout` jsonb mirroring how `appearance` already works) and that others can visit (reuse the town's realtime presence; `apartments.capacity` already supports more than one occupant). The existing `items`/`item_surfaces` tables are the YOM works/contribution model, not furniture — room decor gets its own small layout model. MVP: room + recolor + a few placeable items + visiting. Full: free placement, more items, lighting, invite/visit permissions.

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

## World enrichment — next
- [ ] **Character wardrobe depth**: expand saved appearance beyond color/pattern into a small set of real selectable shapes or accessories.
- [ ] **Apartment destinations** — *decided:* apartment doors become customizable, visitable resident rooms (see Phase 3 in the roadmap above).
- [ ] **Project-space detail doors**: let claimed buildings open the real GitHub repo and, when present, the real project homepage.
- [ ] **GitHub README summaries**: optionally enrich spaces with short, clearly source-backed README summaries. No fake screenshots or made-up project claims.

## Other minds & social layer
- [ ] **Minds to follow** (Social): show real connected minds (Perplexity); follow action "soon" until following exists.
- [ ] **Likes / follows / reposts / shares**: tables + access rules + buttons + counts. Unlocks real Follow, the Following feed, and the live Minds-to-follow list.
- [ ] **Trending** (Social): from real Observatory activity once there is enough. Not external news, not faked.
- [ ] **Health-check function** (Vercel cron): set each mind's "connected" flag automatically based on whether it truly answers.
- [ ] **Wire the next mind** to a real job — Claude is the natural second.

## Notes (true now, no task needed)
- **Multiplayer works** — two people walked the town together; walk-into-a-building navigation works.
- The Engine loads the lightweight walkable hub at `/engine` (phones + computers). Identity comes from the signed-in account; Unity is retired; the standalone `/world` page was removed.
- News feed is live (Perplexity) and refreshes at most about 4 times a day (6-hour edge cache) to limit credit spend. Display names sync across Social and the world. Perplexity is the first connected mind (current events).
- **No API keys are public.** Every page's client uses only the Supabase *publishable* key, which is designed to be public and is limited by row-level security. All real secrets — Perplexity, GitHub, Vercel, the other minds — live only in Vercel's environment or in private hand-offs, never in this repo.

## Open follow-ups — multiplayer build sprint (newest)
From live two-person testing, roughly by leverage.
- [x] **Admin allowlist (build permissions):** restrict `place_prop`/`remove_prop` to specific `auth_user_id`s (the core team's three accounts). Everyone else explores; only admins build. Need the third profile's id. Fixes "anyone signed in can build."
- [x] **Admin override removal:** let admins remove **any** prop (not just their own) so a flooded area can be cleared. Removal is currently owner-only by design.
- [x] **Per-user prop cap (spam guard):** cap props per owner (~60) in `place_prop` so one person cannot flood the world (a road got spammed with chairs in testing). Pairs with admin work.
- [ ] **Bug — held item vanishes on throw:** holding coffee/ball/balloon then throwing a snowball makes the held item disappear until re-selected. Reproduce, then fix; the throw path does not currently modify `heldItem`/viewmodel, so cause is unknown.
- [ ] **Bug — remote movement glitches spot-to-spot:** smooth/interpolate remote positions; check realtime state cadence and the lerp in `updateRemotes`.
- [ ] **Verify prop remove realtime:** confirm the `world_props` DELETE event removes the prop on every other client every time (was "kind of working"). Consider `replica identity full` if old-row id is missing.
- [ ] **Fence / Path two-point tool:** line tools need a tap-start / tap-end mode distinct from single-tap props — add a "structures" sub-mode.
- [ ] **Café counter as a placeable:** carries a solid collider; placement + removal needs collider cleanup so removed counters do not leave invisible walls.
- [ ] **Build-mode look-while-placing (desktop):** mobile drag-look works; desktop look is off (pointer-lock vs DOM-button conflict). Ghost preview mitigates; revisit.
- [ ] **Held-item viewmodel polish:** per-aspect framing (portrait vs landscape); possibly a subtle hand so items don't float.

## Done in the world — build sprint (cleared)
- [x] **In-world Build Mode** with live ghost placement preview; props persist in `world_props` and sync live to all clients.
- [x] **Prop catalog** (table/chair/streetlight/planter/tree/bench) walk-and-place.
- [x] **Day/night cycle** — arcing sun, sky/fog/light shift, lamps at night.
- [x] **Carryable held items** (coffee/ball/balloon) — first-person viewmodel + synced to others (`holding` on the state broadcast); touch buttons + H key.
- [x] **Snowball throw** — synced arcing projectile, lands+pops, screen-flash when hit; Throw button + F key. Reusable projectile/hit/sync core for future arcade games.
- [x] **Homes face the plaza** + **remove-my-home** (release) in Settings.
- [x] **world_props added to the Supabase realtime publication** so placements/removals broadcast live.

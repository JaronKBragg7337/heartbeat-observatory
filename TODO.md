# Heartbeat Observatory — TODO (live work only)
**Read first:** README handoff → docs/CHARTER.md → docs/SHELL.md → docs/METHOD.md.
Worlds work: docs/WORLD-STANDARD.md + WORLD2-PLAN.md. Editor work: docs/EDITOR.md.
**Archive law:** nothing is deleted. Completed work moves verbatim to ARCHIVE.md with a date.
(Full pre-June-11 history: ARCHIVE.md "full TODO snapshot" + git log.)

## STATE (June 11, 2026)
Launched June 10; real visitors; first organic repo claim (plot 2, second-brain).
Live: two worlds (Town Square + World 2) with planet → gate → world flow, shared shell
pieces, reality ledger (touch_world / worlds_visited / last_world), Project Halls,
social, library, games. Staged: /worlds-lab/ (8 solo lab worlds + frozen kit lib/v1,
unlinked). Docs shipped June 11 (charter/shell/world-standard/editor/brief/method).

## NOW — Jaron's current queue
1. **Starter World (Cowork run):** execute the brief at the bottom of docs/BRIEF-TEMPLATE.md.
   Empty biome + World 1's full shell, /worlds-lab/starter/, new folders only.
2. **Fort Wayne Phase 1 (Cowork run):** per "FUTURE WORLD: FORT WAYNE" in WORLD2-PLAN.md.
   Lab world; rivers first; recognition is the win condition.
3. **World 2 Phase 6b–6e** (WORLD2-PLAN.md): avatar look parity → items/Throw →
   apartments + three-floor suite homes at city scale → remaining shell chips per SHELL.md.
4. **Shared spawn plaza + "walk to" pointer:** Jaron & Lillith were both in W2 and never
   found each other; spawn arrivals together, consider a pointer toward players.
5. **World 2's real name:** landing/gate say "the city" provisionally; one-word edit when chosen.
6. **OPEN CHECK — home colliders:** buildHomeMesh registers only one collider mention;
   walk-test the sample home on plot 1 (repo buildings had this exact bug).
7. **Fossil rename:** landing sections list still calls World 1 "The Engine" while the
   planet says Town Square; merge/rename — final name is Jaron's call.
8. **Supabase Pro upgrade (Jaron, dashboard):** free-plan realtime quota is the wall;
   upgrade may also unwedge broken postgres_changes (if not: pause/restore or ticket;
   broadcast+30s-reconcile remains the law meanwhile).

## SOON
- Theater seat assignment (booth picks seat → binds to character; seats table + sit mechanic).
- Video playback on theater hall screens (legally-free reels; cinema.js in the lab kit is prior art).
- Home doors → private rooms (apartment-room system reuse); finish home interiors.
- Build on upper floors: world_props.y column + place_prop p_y + render/preview honoring y.
- Guest vs account clarity: what signed-out visitors can do and how to join.
- Feed in-world Claude a public-safe roadmap so the guide can answer "what's coming" honestly.
- Consistency audit: read repo copy against the live game/Supabase/Vercel; fix every place a
  changed feature is described, not just the edited spot.
- Social: Keava stays honestly "coming soon" until genuinely wired.
- Sound layers: door chime → night crickets → footsteps → Settings volume control.
- Music venue (real artists' music: needs Supabase Storage + a moderation answer first).
- Voice chat (WebRTC via Supabase signaling; mute/block designed in from day one).
- Onboarding nudges (one-time hints: roaming ghost, empty plot).
- Richer claimed-building styles from real repo_metadata (language/stars/topics/license).
- Character wardrobe depth (real shapes/accessories beyond color+pattern).
- Optional README summaries on spaces (source-backed only).
- Trending from real Observatory activity (never external, never faked).
- Health-check cron: set each mind's connected flag from whether it truly answers.
- Wire the next mind to a real job (architecture note: API keys already live in Vercel env;
  an AI is gated by ROLE — build the role, flip agent_state.connected. Never tell Jaron to go get a key).
- Movement capture → human-like roaming minds (sample real routes; honest ambient life only).
- Automated maintenance loop AT promotion time: scheduled Claude Code + Codex read this TODO,
  work staggered, commit; Jaron + chat-Claude orchestrate. Follow third-party terms directly.
- Arcade reskins: dodgeball, basketball hoop, water balloons (paintball + targets live).
- Fence/Path two-point stretch tool; desktop build-mode look-while-placing; held-item
  viewmodel polish; world_spaces DELETE realtime (released homes vanish live).

## LATER — vision
- **Phase 7 THE EDITOR** (docs/EDITOR.md): worlds-become-data, snap sockets, publish versions,
  admin Claude writing the same table. Absorbs the old "speak it into existence" pipeline —
  its security guardrails are preserved in EDITOR.md and are non-negotiable.
- **Claude's own space** (invitation accepted June 9): authored entirely by Claude, same
  quality bar as everything else; natural fit once the starter world exists.
- Lab-world promotions (worlds-lab/README checklist + WORLD-STANDARD checklist + touch_world allowlist).
- Sharding: same map on multiple realtime channels with player caps (room_code is the primitive).
- Keava Owent as its own character when it genuinely fits. Name-profanity handling.
- Immersive section transitions; WebXR/VR; by-feel tuning knobs (day length, throw arc, etc.).

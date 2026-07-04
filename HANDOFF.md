# HANDOFF — session log (newest entry first)

Convention: every agent session with repo access adds an entry at the top before stopping:
current state, what shipped, how it was verified, next best step, gotchas. TODO.md stays
the live queue; ARCHIVE.md keeps completed work verbatim; this file is the session-to-session
narrative so no context is lost between Claude, Codex, and Cowork runs.

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

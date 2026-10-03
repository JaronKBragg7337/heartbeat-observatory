# Playfix, 2026-10-03 (what Jaron hit on his iPhone at 12:34 AM)

## 1. Opening stuck on black, "Walk to that place." / "Reach the port first." for 5+ minutes
Cause (read from the code, reproduced with a stalled-client test, not seen on his phone): the authority credited the ride only from `opening-pose` actions, and refused any pose more than `seconds*75+2` m from the last one it had accepted (seconds = its own clock since the last accepted pose, capped at 2). A refused action rolls the world back, including `openingPoseAt`, so after one stall (screen lock, slow network, a lost action) the client's pose was hundreds of metres ahead of the server's and every later pose was refused forever. Meanwhile the client had reached 66 s of ride, faded to black, and called `opening-finish` every frame; the server's `rideSeconds` never advanced, so it answered "Reach the port first." Two refusals, alternating, nothing that could recover.
Fix:
- The ride is a script on the server clock: `opening-pose` and `opening-finish` credit the real wall time since the last one (up to 130 s); the ride pose comes from the script, the client pose is ignored. No pose can wedge it, and finish succeeds once 65 s have really passed.
- On foot, a pose that is too far is pulled back to the furthest point a person could reach and the client is told (`corrected`); it is never refused.
- Client: the arrival call waits 2.5 s between tries, and after three refusals takes the authority's own skip (same ship, same start).
- Tests: stalled client + 2.5 km teleport pose, early finish refused, finish after real time; walking pose pulled back (opening-checks).
Not verified: his phone's exact trigger (no client log existed). The loop's mechanism is closed whatever started it.

## 2. "Transaction failed" and slow buttons
There is no string "Transaction failed" in the code. The real failure found: `SupabaseAdapter.save` kept its expected revision only on success. If a save timed out (15 s limit) but had landed, every later save failed "World revision conflict", the world set `error`, and every action answered "Durable storage failed; transactions are paused" until the next restart (the watchdog log shows an http-503 restart at 23:13 on 10/2). Fixes:
- After a failed save the adapter asks the database what revision it holds: landed means success, an unseen earlier landing is adopted and the save retried, a stranger's write is never overwritten. Mocked-HTTP test added.
- An action while the world is flagged now tries a save first, so a stale fault clears at once rather than at the next 2 s tick; plain-words message.
- Each save carried and re-inserted every receipt ever made (505 in the live world); receipts are now capped to the latest 160.
- `/health` now reports `commit: {n, avgMs, maxMs, lastMs}` so slow saves are visible.
- Buttons: every button shows pressed on pointer-down; a button that sends an action to the shared world shows a spinner until the receipt, and shakes if it is refused (`src/ui/phoneLayout.js`, events `cosmos-request` / `cosmos-receipt`).
Not measured: the real save latency under load (the new /health numbers will show it).

## 3. Overlapping buttons
Cause: nine modules each pinned a button at its own `bottom: Npx` (120, 150, 174, 176, 230 ...). Fix: `phoneLayout.js` docks every floating button in one of three flex columns (right: action, tool, drop, climb, crew talk, deliver, fire, sink, lift; left: Controls, World / crew, Hold to talk; bottom: the speed bar in its own row), so two cannot overlap by construction; panels that open over the screen hide the docks; the Controls pad hides them while open; the HUD is narrowed clear of Settings; the station panel stops above the docks.
Check: `test/phone-check.mjs` has `noOverlap()` (pairwise rectangles of every visible button, plus off-screen) run during the opening and over on-foot, digging, near people, seated, piloting with the speed bar, and every button at once, at 393x852 / 375x667 (and 360x740 on Android) portrait and landscape, WebKit iPhone and Chromium. Each combo asserts a minimum number of visible buttons so a hidden dock cannot pass vacuously. Found and fixed on the way: a button's styles depended on its old parent (`#ship-ui .sbtn`, `#crew-ui .cbtn`), which un-hid LIFT/SINK/FIRE inside the opening until fixed.
Not done: the combinations are forced visible (the game state that normally shows them is not driven end to end), and a real iPhone was not used (Playwright WebKit on Windows).

## 4. Start economy
Skip and finish go through the same server completion (`opening-skip` and `opening-finish` both set `complete` and place the player at the ship's pad; the carried crate is cosmetic). Test: skip gives a courier and 10,000 marks.

## 5. Fresh start
`server/reset-world.mjs` (documented in docs/RUN-SERVER.md): dry run by default, `--apply` removes players, player ships, pads, crew, accounts, quests, receipts, damage, rovers and terrain edits; keeps market, clock and NPC raiders. See the final report for when it was run on the live world.

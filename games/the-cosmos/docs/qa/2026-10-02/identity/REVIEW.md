# Identity and "where did my ships go" - review (2026-10-02)

Jaron's report: same normal iPhone Safari tab for days, 18,924 marks, hired crew, flew to Phobos. The night he played with Lilith he saw many pads with ships; now he sees only his own ship and one other, and his hired crew are invisible while their "Talk to" prompt stays where they stood.

## What I found (each with its evidence)

### 1. The authority was serving a different, nearly empty world, and was being killed every ~100 seconds
* **Restart storm.** `AI-Shared/state/cosmos-watchdog.log` has about 40 restarts between roughly 7:00 PM and 9:09 PM EDT, each "3 consecutive health failures (last: timeout)" and each about 105 s after the last. A fresh authority loads the world from Supabase and catches up before it listens; on the overloaded MSI (CPU 96%, other agents' browsers and tests) that took longer than the watchdog's three 30 s checks, so the watchdog killed it mid-start, over and over. Every player was dropped every ~100 s for two hours.
* **A second world.** `server/index.mjs` caught any Supabase start-up failure and silently started on a local file (`server/.data/world.json`) instead. `heartbeat-observatory/games/the-cosmos/server/.data/world.json` was written at 8:12 PM EDT: revision 1609, **2 players, 5 ships** (pad 01 and pad 04, plus 3 raiders). One of them, "Visitor 24", does not exist in Supabase at all. A player connecting during that window saw their own ship and one other. That is exactly Jaron's description of what he saw. (I cannot tell from the files whether the live process or a local-store run from the same checkout wrote it; the code path that does it in production existed either way.)
* **Why the tick was so heavy.** Profiling the live world (exported copy, 23 players / 26 ships): 25-30 ms of a 33 ms tick, so the server had no headroom. The top cost was `landingField.weight` (every terrain sample loops every pad; 24 pads) and idle landed ships stepped at 30 Hz.

### 2. The connected client draws every ship (so it was not a drawing bug)
Opened a real client against an exported copy of the live world (23 players, 26 ships): Chromium and iPhone WebKit both build and show every landed ship on its pad. `00-live-world-copy-aerial-chromium.png` is the live data; `02-pad-field-aerial.png` is iPhone WebKit with 20 other ships. `fleetView.js` draws any same-frame ship at any distance; I found nothing that hides them. So the missing ships were a world problem (point 1), not a render problem.

### 3. His progress is not in the shared world at all
Supabase has 23 players, every ship at exactly 10,000 marks and no hired crew (the only crew rows are the 8 raider crews). No record anywhere (Supabase, `heartbeat-observatory` or `ho-sol` local files) has 18,924 marks, hired crew, or a Phobos trip. Those came from the solo era (before multiplayer went live on Oct 1, 7:30 PM) and live in his phone's **offline solo save**. Before Sol's refresh-resume fix (bdd8692, now on main) the page tried the authority for only 3.5 s and otherwise dropped a device into that separate solo world with only a line in the purse text; during the restart storm that is what a phone on mobile data would hit. "Hired crew invisible" and "only one other ship" are both consistent with a solo/odd-world session. I cannot see his phone, so this is the most consistent explanation, not a proof.

### 4. Invisible hired crew with a stale "Talk to" prompt
Reproduced the stale prompt: `RemoteCrew.worldPosOf` returned `m.gpos`, a body's last ground position, for people who are aboard. Once someone is hired and goes aboard, their body is moved into the ship's interior and `gpos` freezes where they stood (the hall), so "Talk to" hangs there while they sit on the bridge, and they are hidden whenever the player is outside the ship or the room is not drawn. Fixed: `worldPosOf` now follows the ship. I did **not** reproduce crew that stay invisible while you are aboard (aboard and seated they draw correctly in the test); Sol has "invisible people" on his list, so I left rendering alone.

### 5. New players and pads for people who should be recognised
* A guest is a localStorage key. A **private tab**, cleared site data, or Safari's seven-day cleanup gives a new player and a new pad every time (24 players for 24 pads; 20 of them look like test clients: default `Visitor N` names, default look, 10,000 marks, no crew).
* Nothing ever removed a player, and a pad was allocated by `pads.length`, so pads could not be reused.
* Test clients (Playwright runs, builders' checks) joined the live world as ordinary players.

## What changed

* **Sign in = same character on any device.** The game sends the site's Supabase access token in its `hello`; the authority verifies it with Supabase Auth and the site's `is_admin()` (it never trusts a browser-sent id). Player, ship, pad, marks, crew and pose are the same on any device or private tab. First sign-in on a device adopts that device's guest character; if the account already has one it keeps that and says so. Guests still play with no sign-in.
* **Settings > Account and character:** guest or signed-in status, sign in/out, and **Start fresh** (asks twice, deletes this character and its ship, crew, rover and pad; the opening plays again). **Admins** get saved characters: Start fresh adds a test character and keeps the others, Settings switches between them, and each can be deleted. Non-admins have one.
* **Cleanup:** test clients flag themselves (`navigator.webdriver` / `?qa=1`) and are removed two minutes after they were last seen. Guests idle 24 h: throwaway ones are deleted, ones with progress are parked (ship off its pad, back on a free pad with everything when they return), ones a person made (chosen look, typed name) are kept. Pads are reused, never renumbered. Signed-in players are never swept. `server/cleanup.mjs` runs the same sweep by hand.
* **The shared world is never replaced by a file world** when Supabase credentials exist (retry, then exit so the watchdog restarts it). (Sol's refresh-resume fix, already on main, also stops production devices falling back to solo: they keep reconnecting.) The connection now waits 12 s per try, not 3.5 s.
* **Server load:** resting ships step twice a second, `landingField.weight` rejects far pads early (a 2x cut of the tick for this world; the same function runs in the client's terrain sampling). The watchdog gets a 4-minute start-up grace so it stops killing a server that is still loading.
* **Database:** `cosmos_save` now deletes projection rows for players/ships/accounts/quests that left the record and keeps a `free:` ship id for a free pad (migration `cosmos_save_prunes_projections`, tested in a rolled-back transaction on the real project first, then applied).

## Which id is Jaron's

None of the 23 records in the shared world is his. His 18,924-mark character is in his phone's local save, not on the server. I kept the three records that look human-made rather than guessing (`Visitor 111` with the Aoi look, `Acid_Ith`, `Fleet check`, a builder's named test), and did not delete anything idle for less than 24 h. Per Jaron's later message his current character does not need to be kept; his account (admin) now gets a main character plus as many test characters as he wants.

## Verified

* `node test/validate.mjs`: green (800 passed, 0 failed). New section 18b has 42 checks: guest return, adoption, second device, forged ids, kept-account, admin slots vs non-admin, discard, pad reuse, parking and return, test-client removal, restart persistence, the token check with a mocked Supabase.
* `node test/identity-browser.mjs` in **iPhone-profile WebKit with real touch taps**: pad field with 20 other ships, guest Settings, the two-step Start fresh (Keep works, then the player really changes and the old one is gone), signed-in admin with two characters and switching, the same player in a second browser profile. Screenshots `01`-`08` in this folder.
* The restart storm and the file-world evidence are from the live logs and files above.

## Not verified

* A real sign-in with a real Supabase account on a real phone (the browser tests inject a token the stub verifier accepts; the server-side verifier is tested against a mocked Supabase, and the real endpoints are the documented ones). Jaron should sign in once on his phone.
* That his phone was in solo or in the odd world. It is the most consistent explanation, not something I could observe.
* Crew that stay invisible while the player is aboard (not reproduced).
* The effect of the load changes on the live server's health under the machine's real load (see the live check at the end of the handoff).

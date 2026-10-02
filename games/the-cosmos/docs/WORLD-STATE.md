# One shared world, many owned ships

The Node authority now owns the shared world. Jaron's October 1, 5:37 PM change overrides the earlier one-Meridian proposal: each player owns one stable ship and a stable allocated Mars pad. `ship.type` is a field; players start in Meridians, and the world now has a second class (see the fleet section below). Refreshing restores the identity and location, including a guest aboard someone else's ship during a trip. It does not allocate another ship.

The browser tries the authority before loading its local save. If it cannot connect, the purse explicitly says **Offline solo — saved locally**. Local and shared worlds are separate. An old browser save is never uploaded over the shared world.

## Ownership and boundaries

| State | Scope and authority |
| --- | --- |
| Geology, excavated bricks, ground scars, port and elevator | Shared world; server |
| Prices and finite trader stock | Shared world; server; stock replenishes |
| Hiring candidates | Shared replenishing pool; a candidate can contract to one ship |
| Ship identity/type, assigned pad, pose, trip, hull, weapons, ramps | One owned entity per player; server |
| Contracts, wages, hold, purse, inventory, quests and job progress | Per ship/player; server |
| Player identity, frame, outside or cabin pose, seat, carried matter | Per device; server records validated client prediction |
| Camera, mesh building, local movement prediction and UI | Browser |

The owner toggles **Crew may board** in the World panel. Guests can board a nearby landed ship when allowed, take unoccupied stations and fly together. A guest retains their own ship/account. The ship they are aboard supplies the shared trip and hold. A pilot station takes priority over captain controls; inputs expire after one second. Abandoned seats expire after thirty seconds, leaving the passenger standing nearby aboard the same ship. Hired crew yield to player stations.

Mars pads are allocated by `src/world-state/fleet.js`: pad 01 uses the original field, then an append-only grid east of the port supplies concrete slabs, markings, lights and terrain grading. Existing service pads 02/03 remain. An allocation never moves an earlier pad. In the shared world each owned ship also has its own Phobos pad and its own Deimos pad, graded flat into that moon's field (regolith, not port concrete) with markings and lights. The grid sits north of the Phobos rock survey, so the survey pad and the boulders there stay put. Offline solo still lands on the survey pad. A refresh keeps the same moon pad and the saved pose.

## Simulation and actions

`server/authority.mjs` serializes joins and commands. `server/simulation.mjs` reuses ShipBody, SpaceTrip, Transit, weapons, drones and station rules. The authority runs at 30 Hz for active physics, broadcasts about 10 Hz and checkpoints movement every two seconds. Shared terrain uses the same EditStore, Digger and binary brick codec as solo play. The economy reducer, catalog wages, crew cabin routing and tower elevator rules are also shared modules.

Clients submit intent: hire, trade, quest delivery, dig/pour, board, sit, course, gun, power and job requests. They cannot submit an arbitrary purse, cargo mass, terrain density, award or ship save. Location, ownership, station and availability checks precede mutations. Every accepted action commits a receipt and world change together. Retrying its ID returns that receipt without charging twice. A failed durable action restores the previous world and returns a refusal.

Player movement still uses client-predicted poses with finite-value, speed, cabin and seat bounds. Full swept collision/input simulation for players is **not** yet server authoritative. Ship flight, combat, excavation, transactions, elevator movement and crew paths are server simulated. There is no normal-play teleport protocol. Browser debug handles, free camera and review tools require `?dev=1`.

Candidates wait inside the crew hall. Calling one makes them walk through its doorway; declining makes them return. Hiring charges the catalog signing wage, reserves the person to that ship and sends them around the hull, up the ramp and along the cabin route to their post. Replacements appear over time, with generated names, roles, 70–85% skills and catalog wages. Wages continue on the world clock; unpaid crew leave at the next port arrival. Server gunner AI operates hired gun stations. Hired pilot orders (fly to, hunt, supplies, roam, land, hold, return) are authority actions. One order flies the ship for everyone aboard or watching. The same order again does not restart it. A player who is not aboard is refused. A refresh keeps the order and keeps flying it, including while the ship is still on the ground. Offline solo still flies those orders on the local machine.

## Money and material

Four integer marks equal one credit. Accounts and quest progress belong to each owned ship. Shared dealer stock is changed atomically, so two purchases of the last item cannot both succeed. Space survey, salvage, stow and arrival rewards use validated server intents and the actual ship account/hold. Delivered samples pay once; retained excavation lots preserve the exact mass/volume ledger. Each ship has its own salvage/job progress.

Offline solo hooks now also award the real economy purse and add/remove measured cargo in the saved hold. They no longer use a separate Jobs-tab counter. Supplied goods are still inventory: ammunition and oxygen consumption remain future gameplay integrations.

## Persistence and rejoin

New clients request opening protocol version 1. The authority adds a private, resumable opening only when creating a new player identity. Existing identities retain their world, ship type and pose. Each opening has its own material field and action sequence; other clients receive only its completion flag. Opening movement cannot mutate the player's shared-world pose. Accepted actions use the ordinary durable transaction and retry receipt path; receipts retain the outcome without duplicating private history. Completed openings release their transient server and renderer resources and enter shared play once. Refresh restores unfinished progress; later opening retries cannot move an already-arrived player. Older clients retain the existing join protocol.

Offline saves follow the same eligibility and progression rules. Solo and shared identities remain separate. For browser QA, `?dev=1&opening=off` selects the existing review start without changing a returning save. Opening browser checks run against an isolated authority and temporary Chromium profiles.

Authority schema 2 contains players, owned ships/pads, contracts/pool, accounts, quests, market, damage, frame-specific terrain metadata and receipts. Aboard positions are ship-local metres; outside positions include their body frame. Trips retain transit state, phase/progress, attitude and velocity. Combat retains drones, shots, bolts and cooldowns. Crew boarding routes and elevator state are checkpointed too.

`server/storage.mjs` exposes the same load/save interface for a local atomic file and Supabase. `server/migration.sql` supplies world snapshot storage plus normalized players, ships, pads, contracts, accounts, quests, damage, terrain bricks and append-only action receipts. `cosmos_save` takes an advisory world lock, checks the expected revision, and writes the snapshot, projections, changed bricks and receipts in one Postgres transaction. Seats and ownership have uniqueness constraints. Tables and RPC execution are restricted to `service_role`; browsers never receive its key.

Terrain saves contain sparse uint16 offsets, float32 density and material bytes. Unedited deterministic geology is regenerated. Wire JSON encodes typed arrays losslessly. Replacing a sparse patch resets old offsets before applying new ones, including a filled-in hole. Changing the base geology or grading rule requires a deliberate save migration.

On restart the authority reconstructs the last checkpoint and advances elapsed real time through simulation rules. Ships, combat, trips and wages continue while players are away. A destroyed hull remains destroyed. Disconnected players outside a ship retain their stored pose; EVA oxygen/health/death simulation is not implemented. A hard crash can lose up to the ordinary checkpoint interval of movement. An accepted transaction is acknowledged only after storage succeeds. Browser reconnect retries unacknowledged actions with their original IDs; a page reload restores accepted state, not unsent local movement.

The device key in localStorage is a temporary bearer identity, hashed in private server storage. Losing browser storage loses access to that identity; real accounts/recovery are future work. `?test=1` uses a separate persistent device slot for easy test play. Disconnects show a reconnect message and refuse new actions; the user may explicitly switch to their saved solo world. Shared and solo progress never merge automatically.

## The fleet: ships by type, raiders, and how a player gets one

`ship.type` selects a **ship definition** (`src/ships/registry.js`). A definition is data in its own folder (`src/ships/<type>/`): layout (rooms, doors, props, ladders, windows, lights), seats and stations, landing gear, guns, ramps, flight numbers, hull table, crew posts, dock points, stats. The Meridian is one entry built from `src/ship/shipSpec.js`; the first raider class, the Shrike, is `src/ships/raider/`. Flight (`ShipBody`), guns, stations, the walker, the interior builder, the crew's routes and the server's board, leave, seat, hire and fire-gun rules all take the definition; none of them names a ship. How a type is drawn is kept apart (`src/ships/visuals.js`) so the server never loads a renderer.

**Raiders are ship records** in `state.ships` with `type: 'raider'`, owner `npc:<ship id>` until someone takes the hull, and an `npc` mind (`state`: patrol, engage, return, disabled or abandoned; its station, target, strafing-run timer, loot, and its escort wing). Crew are ordinary crew records (four Loft bodies at four seats). Which of the seven bodies a hull uses is rotated by its number, and each person carries a `look` (cloth, hair and skin tints, a helmet and a visor) so a raider's four are not the hall's Ada, Zuri, Jorge and the rest. `pose`, `combat` (bolts, aim) and `hull` sync like any ship. `state.fleet` holds the spawn sequence and respawn clocks. `server/fleet.mjs` runs them: three stations (high over the port, over Phobos, over Deimos), one live raider at each of the first two and one abandoned hull at the third, a new raider after 240 s whenever a station loses its one. They are never in neutral airspace; they engage only a ship that someone is aboard, in the air, outside Mars's 1500 m line and not on a drive transit. The old per-ship drones are gone from the shared world: the three drones are a raider's **escorts**, flying formation on it and strafing what it fights.

**Damage goes through proxies.** Each tick every `GunSystem` is given a sphere (a million hit points) for each ship it could hit; after the step, what was taken off a sphere is passed to the real thing as `takeHit` (a ship) or `EscortWing.hit` (an escort). A player's bolts hurt raiders and escorts, a raider's hurt players' ships, with one set of bolt rules. Disabling a raider (hull at 35%) pays 150 credits to the ship whose guns did it; shooting down an escort pays the old 25 credit bounty.

**Getting a ship** (all server-checked, all idempotent through the same receipts): from a ship of your own within 160 m in the same frame, a *disabled* raider or an *abandoned* hull can be taken two ways. `claim-ship` sends a prize crew: the hull is set on a new pad at the port, the loot in its hold goes into its account, and a disabled raider's crew sign on (on wages, in the shared pool, still wearing the look they had). `board-prize` (`ownShip` `hold` or `follow`) puts you on its deck where it is and flies it as an owned ship: same frame, same pose, a home pad allocated but not used until you bring it in. The surrendered crew leave. One flyer (the pilot, or else the captain) stays on your own ship, which holds station or follows; the rest of your hired crew walk aboard, or stand in the hold if the Shrike has no station for them. Your flagship does not change until `set-flagship` on the ground at the port. A hand on your own ship's stick ends the escort. `buy-ship` buys a class from the shipyard kiosk (port-local x -36, z 40) with the flagship's account (Shrike: 2,400 credits) and delivers it to a new pad. `set-flagship` makes any ship you own and which is landed at the port your flagship (the one you walk to and hire for); the browser reloads into the new class. Every hull you own keeps its own pad, its own account and its own crew. The server owns a boarded prize the same way it owns any player ship: owner, pose, crew.

**Restart** advances elapsed time for players' ships as before but leaves raiders where they were (a world that sat idle for hours must not simulate hours of raiders). Worlds saved before the fleet load unchanged, lose their old per-ship drones and gain raiders.

**Not done:** raiders and the fleet exist only in the shared world (the offline solo world keeps its three old drones; `?ship=raider` lets solo fly a Shrike, but nothing attacks it); there is no player-to-player ship trade; ship-to-ship collision is not implemented, and there is no vacuum walk from hull to hull (boarding a disabled prize places you on its deck).

## Limits and evidence

The implementation sends full public snapshots to all connected clients and all saved bricks at join; there is no terrain interest filtering or remote-body interpolation yet. Combat runs per ship against its raiders; fleet-wide PvP and inter-ship collision are not implemented. The crew hall has a visible doorway and moving people, but its interior/art and collision need refinement. Long restart catch-up and growing fleets need a capacity test before promising large populations. Run one authority process per world; this is not a horizontally scaled service.

The local two-WebSocket scenario, two real Chromium browser contexts, restart/write-failure tests, screenshots and exact verification limits are in [multiplayer REVIEW.md](qa/2026-10-01/multiplayer/REVIEW.md). [RUN-SERVER.md](RUN-SERVER.md) is Claude's deployment handoff. Supabase SQL execution, the public Cloudflare path and physical phones have not been verified in this sandbox.

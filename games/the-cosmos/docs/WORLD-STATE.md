# One shared world, many owned ships

The Node authority now owns the shared world. Jaron's October 1, 5:37 PM change overrides the earlier one-Meridian proposal: each player owns one stable ship and a stable allocated Mars pad. `ship.type` is a field; the starting implementation supplies Meridians. Refreshing restores the identity and location, including a guest aboard someone else's ship during a trip. It does not allocate another ship.

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

Mars pads are allocated by `src/world-state/fleet.js`: pad 01 uses the original field, then an append-only grid east of the port supplies concrete slabs, markings, lights and terrain grading. Existing service pads 02/03 remain. An allocation never moves an earlier pad. Moon destinations currently use their existing landing sites; distinct moon pads are future work.

## Simulation and actions

`server/authority.mjs` serializes joins and commands. `server/simulation.mjs` reuses ShipBody, SpaceTrip, Transit, weapons, drones and station rules. The authority runs at 30 Hz for active physics, broadcasts about 10 Hz and checkpoints movement every two seconds. Shared terrain uses the same EditStore, Digger and binary brick codec as solo play. The economy reducer, catalog wages, crew cabin routing and tower elevator rules are also shared modules.

Clients submit intent: hire, trade, quest delivery, dig/pour, board, sit, course, gun, power and job requests. They cannot submit an arbitrary purse, cargo mass, terrain density, award or ship save. Location, ownership, station and availability checks precede mutations. Every accepted action commits a receipt and world change together. Retrying its ID returns that receipt without charging twice. A failed durable action restores the previous world and returns a refusal.

Player movement still uses client-predicted poses with finite-value, speed, cabin and seat bounds. Full swept collision/input simulation for players is **not** yet server authoritative. Ship flight, combat, excavation, transactions, elevator movement and crew paths are server simulated. There is no normal-play teleport protocol. Browser debug handles, free camera and review tools require `?dev=1`.

Candidates wait inside the crew hall. Calling one makes them walk through its doorway; declining makes them return. Hiring charges the catalog signing wage, reserves the person to that ship and sends them around the hull, up the ramp and along the cabin route to their post. Replacements appear over time, with generated names, roles, 70–85% skills and catalog wages. Wages continue on the world clock; unpaid crew leave at the next port arrival. Server gunner AI operates hired gun stations. The former local NPC pilot order interface is not wired to multiplayer yet.

## Money and material

Four integer marks equal one credit. Accounts and quest progress belong to each owned ship. Shared dealer stock is changed atomically, so two purchases of the last item cannot both succeed. Space survey, salvage, stow and arrival rewards use validated server intents and the actual ship account/hold. Delivered samples pay once; retained excavation lots preserve the exact mass/volume ledger. Each ship has its own salvage/job progress.

Offline solo hooks now also award the real economy purse and add/remove measured cargo in the saved hold. They no longer use a separate Jobs-tab counter. Supplied goods are still inventory: ammunition and oxygen consumption remain future gameplay integrations.

## Persistence and rejoin

Authority schema 2 contains players, owned ships/pads, contracts/pool, accounts, quests, market, damage, frame-specific terrain metadata and receipts. Aboard positions are ship-local metres; outside positions include their body frame. Trips retain transit state, phase/progress, attitude and velocity. Combat retains drones, shots, bolts and cooldowns. Crew boarding routes and elevator state are checkpointed too.

`server/storage.mjs` exposes the same load/save interface for a local atomic file and Supabase. `server/migration.sql` supplies world snapshot storage plus normalized players, ships, pads, contracts, accounts, quests, damage, terrain bricks and append-only action receipts. `cosmos_save` takes an advisory world lock, checks the expected revision, and writes the snapshot, projections, changed bricks and receipts in one Postgres transaction. Seats and ownership have uniqueness constraints. Tables and RPC execution are restricted to `service_role`; browsers never receive its key.

Terrain saves contain sparse uint16 offsets, float32 density and material bytes. Unedited deterministic geology is regenerated. Wire JSON encodes typed arrays losslessly. Replacing a sparse patch resets old offsets before applying new ones, including a filled-in hole. Changing the base geology or grading rule requires a deliberate save migration.

On restart the authority reconstructs the last checkpoint and advances elapsed real time through simulation rules. Ships, combat, trips and wages continue while players are away. A destroyed hull remains destroyed. Disconnected players outside a ship retain their stored pose; EVA oxygen/health/death simulation is not implemented. A hard crash can lose up to the ordinary checkpoint interval of movement. An accepted transaction is acknowledged only after storage succeeds. Browser reconnect retries unacknowledged actions with their original IDs; a page reload restores accepted state, not unsent local movement.

The device key in localStorage is a temporary bearer identity, hashed in private server storage. Losing browser storage loses access to that identity; real accounts/recovery are future work. `?test=1` uses a separate persistent device slot for easy test play. Disconnects show a reconnect message and refuse new actions; the user may explicitly switch to their saved solo world. Shared and solo progress never merge automatically.

## Limits and evidence

The implementation sends full public snapshots to all connected clients and all saved bricks at join; there is no terrain interest filtering or remote-body interpolation yet. Combat runs per ship against its raiders; fleet-wide PvP and inter-ship collision are not implemented. The crew hall has a visible doorway and moving people, but its interior/art and collision need refinement. Long restart catch-up and growing fleets need a capacity test before promising large populations. Run one authority process per world; this is not a horizontally scaled service.

The local two-WebSocket scenario, two real Chromium browser contexts, restart/write-failure tests, screenshots and exact verification limits are in [multiplayer REVIEW.md](qa/2026-10-01/multiplayer/REVIEW.md). [RUN-SERVER.md](RUN-SERVER.md) is Claude's deployment handoff. Supabase SQL execution, the public Cloudflare path and physical phones have not been verified in this sandbox.

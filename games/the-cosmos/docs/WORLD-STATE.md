# One world, one Meridian

This build saves a **local world in this browser**. It does not yet connect players or make another device see the same holes. The intended multiplayer world has one server-owned ship, terrain, crew roster, purse, stock, quests and damage. Refreshing is a reconnect, never permission to create another ship.

## What ships now

`src/world-state/worldState.js` is the action boundary. The browser currently hosts the authority. Gameplay submits `dig-edit`, `spoil-pour`, `hire`, `fire`, `purchase`, `sale`, `regolith-sale`, `quest-accept`, `quest-step`, `wages`, pose and `damage` commands. Economy rules reject invalid transactions before touching the account. The bridge checks trader/depot/quest locations and keeps the existing flight implementation intact.

`storage.js` separates durable storage from rules. `MemoryAdapter` serves tests. `IndexedDBAdapter` writes the world record and changed terrain bricks in the **same database transaction**. A save contains one ship record, the outside or ship-local player pose and occupied seat, ramp states, hull/shields/power, hired crew and their boarding progress, purse, trader stock, owned supplies, cart/hopper lots, exported soil, the sol clock, quest state and damage. NPC flight orders and living drone simulation are not restored yet. A hired person resumes boarding, remains at their station or resumes leaving; they do not return as a second candidate.

Ground is saved as sparse binary samples: uint16 offsets inside a 32-cubed brick, float32 distance/density bits and material bytes. The untouched deterministic geology is regenerated. This avoids huge JSON lists and expensive replays of every pour at startup. Material-field totals keep the existing exact BigInt accounting, encoded as decimal strings. Changed bricks are written after each dig/pour; ordinary pose updates do not rewrite terrain. Schema 1 is tied to the current geology/port grading. Any future change to that base needs a save migration or a new explicit schema version.

The purse displays **Saving**, **Saved locally**, or a visible save failure. A transaction is durable only once Saved locally appears. Normal movement is checkpointed every two seconds, and page hiding/refresh captures a synchronous pose breadcrumb. The breadcrumb cannot overwrite cargo or money. A hard browser/process crash can lose movement since the last checkpoint and any transaction that has not finished. Clearing browser data removes this local world. A second tab on browsers with Web Locks is refused as a writer, so it cannot overwrite the first tab's world. Do not advertise this as cross-device or multiplayer persistence.

Mars marks are integers: four marks per credit. Crew charge one sol's wage to sign; later wages fall due after 88,775.244 seconds of played simulation time. No wages accrue while this local world is closed. An unaffordable wage marks the contract unpaid; that crew member leaves when the ship next lands at the port. Rehiring requires a new fee. The server world should use its own continuous clock, including time with no browser connected.

Trading transfers inventory and money between the player and the dealer. Supplies have measured item masses. Raw regolith is weighed one tonne at a time from pure-regolith lots. The unaccepted remainder stays in the cart/hopper. Depot and quest deliveries retain their received lots and exact exported mass/volume accounts; sold soil is no longer treated as unexplained loss in the excavation ledger. These supplies can currently be traded and carried as inventory; ammunition and oxygen consumption are future gameplay integrations.

The first quest is **A tonne for the foundation**. Talk to the watch supervisor upstairs, accept, dig a tonne of raw regolith, bring it to the signed amber weigh bay west of the depot, and press Deliver. It pays 400 marks once. Quests are records in `src/economy/catalog.js`; adding another delivery record reuses the same acceptance/delivery/payment rules. More objective types will need their own validated step handlers.

Ground bullet impacts pass through the damage action and leave a saved scar. Hull condition is part of the ship snapshot. These scars do not excavate a crater. Drone HP, projectile trajectories and respawn timers are not durable in this first step; the future authority owns them too.

## Recommended server

Use **one small, long-lived Node authority process per world**, with the existing Supabase Pro Postgres for durable storage. Node can run ship, crew, collision and weapons ticks continuously using the same JavaScript physics/rules. A database transaction is excellent for a purchase; a database/realtime subscription alone is not a flight simulator. Supabase Realtime remains useful for slow world events, but continuous ship poses and input acknowledgements should use the authority's WebSocket connection. Realtime supports Broadcast, Presence and Postgres Changes; none replaces an authoritative tick loop. [Supabase Realtime documentation](https://supabase.com/docs/guides/realtime)

Budget a small VM initially at about **$6–10/month**, an engineering allowance rather than a measured capacity guarantee. For a concrete lower-bound example, Hetzner's current CX23 schedule lists a European monthly cap of **$6.49 before applicable taxes and IPv4**, with backup/network options priced separately. US region plans may cost more. Pick a region near the players and load-test terrain edits and simultaneous ships before choosing capacity. [Hetzner price schedule, checked October 1, 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)

Supabase Pro starts at **$25/month**, including $10 in compute credits, enough for one Micro project. If the available Pro project has room, this game may add no base subscription cost; a separate additional Micro project normally adds about $10/month after the organization's existing credit is consumed. Larger compute, disk, egress and backup options cost more. Expect roughly **$31–35/month total** for a new Pro organization plus this initial VM, or the VM cost plus any incremental usage in the existing organization. No services or paid resources were provisioned in this build. [Supabase pricing, checked October 1, 2026](https://supabase.com/pricing)

## Who owns what

| State | Owner | What the client sends |
| --- | --- | --- |
| One ship ID, pose, velocity, hull, ramp state | Authority | Pilot controls and station requests |
| Player identity, last position, aboard location, occupied seat | Authority | Movement/look inputs and seat requests |
| Dig lattice, lots, spoil and damage | Authority | Tool intent and aim; no client-supplied mass or arbitrary density edits |
| Crew hire contracts, wages, boarding and station work | Authority | Hire/fire/order requests |
| Purse, goods, dealer stock and prices | Authority + atomic durable transaction | Item, dealer and quantity |
| Quest progress, delivered matter, rewards | Authority + atomic durable transaction | Accept or deliver request |
| Meshes, camera, interpolation and touch UI | Each browser | No authority over world values |

Use a stable `world_id`, one stable `ship_id`, and a stable anonymous guest identity that can later attach to an account. Joining does not require a visible login form. The anonymous identity is still authenticated to the authority so another visitor cannot claim the same stored player. In this first local build there is one local player and one ship purse; multiplayer retains that purse as the shared ship account, with server-enforced spending permissions.

Postgres should hold a world revision, ship state, player poses, crew contracts, inventories/accounts, quests, damage records and binary terrain bricks. Also keep an append-only action receipt table: unique `(world_id, player_id, action_id)`, accepted revision and result. A sale commits the purse, dealer funds, delivered lots, retained cargo and receipt together. A retry returns the original receipt. Two purchases of the last kit, or two hires of Aoi, cannot both succeed. Add a foreign/unique constraint for the one active occupant of each seat and the one active contract per candidate. Keep write access inside the authority; never expose privileged Supabase credentials in the browser.

## Two people in one ship

The ship moves once, on the authority. The seated pilot owns a short input lease; the other player sends their own walking inputs. Player positions aboard are stored in ship-local metres. Every browser combines the same authoritative ship pose with its own local body pose, so a passenger remains in the moving cabin after a refresh. Crew yield occupied seats under the same server rule.

Start with a 30 Hz authority simulation and roughly 10–15 Hz ship updates; measure before raising rates. Clients can predict their own movement and smoothly interpolate other bodies. Accepted money, hires, damage and terrain edits arrive with a world revision. A late packet must not undo a newer revision. Nearby clients receive changed terrain bricks with their revision; distant clients fetch those bricks when they approach. Ship motion must not cause thousands of ground-brick writes. Persist important transactions immediately and compact high-frequency movement into periodic snapshots.

## Refresh, disconnect and recovery

On reconnect, ask for the world snapshot and updates after its revision. Restore the same player ID and the same ship ID. If the player was aboard, restore their ship-local pose on the ship **where it is now**, even if another player flew it elsewhere. Never use the stale browser's last world-space ship location to move the ship backward. If the old seat lease expired and another player took it, restore the returning player standing beside the station.

On pilot disconnect, expire the control lease quickly and hand control to a hired pilot/captain or engage hold/hover. A passenger disconnect does not move or duplicate the ship. NPC wages and the world clock continue. Save the last safe player-local pose. If nobody is connected, the authority can reduce update rate for dormant terrain; active flight, combat and contracts still obey the world clock.

Restart the authority from the last durable snapshot plus accepted actions after that revision. The snapshot and action receipt must agree about the commit point. Outstanding unacknowledged actions can be retried with their original IDs. Never accept an old client's entire save as the new shared world. A fresh browser joins the existing world; it does not upload a new starting purse.

## Migration without replacing game rules

Keep the gameplay action names, catalog, transaction reducer, terrain codec and validation checks. Move the local authority and physical simulation to Node. Replace the local storage adapter with a Postgres adapter on that host. At the browser boundary replace the local dispatch host with a remote dispatcher that sends intent and applies accepted world patches. Current synchronous local handlers need that transport/reconciliation wrapper; merely pointing IndexedDB writes at a remote database would leave clients authoritative and would be wrong. The gameplay UI continues to use the same action vocabulary, while the bridge changes from local physics capture to rendering server state.

Before shared play, verify two clients hire the same candidate, buy the last item, excavate overlapping ground, share a pilot/passenger flight, disconnect the pilot and refresh the passenger. Both clients must agree on revision, ship ID, account, cargo and changed lattice bits. Add server crash/retry tests before trusting money or quest rewards in multiplayer.

## Evidence

`node test/validate.mjs` includes economy conservation, wage boundaries, atomic refusals, quest payment once, storage failure handling, typed-array terrain restoration and the key-prompt/touch-path audit. The desktop and 390-pixel phone walkthrough, screenshots and results are in [the economy QA folder](qa/2026-10-01/economy/REVIEW.md). Physical phone frame rates and real two-client authority are not verified by headless Chromium.

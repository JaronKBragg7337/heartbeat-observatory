# Multiplayer review — October 1, 2026

Implemented and tested locally: one authority world with separately owned ships/pads/accounts/crew, shared terrain/stock/hiring/elevator, guest boarding, shared space trips, persistent rejoin and an explicit saved-solo fallback. The ship type is data. This build is uncommitted and has not been deployed or connected to the live Supabase project.

## Verification

`node test/validate.mjs` runs every existing check plus `test/multiplayer-checks.mjs` and `test/server-storage-checks.mjs`. The final result is **475 passed, zero failed**, recorded in [validator.txt](validator.txt), including standing/crew-yield and abandoned-seat recovery checks. The final browser scenario passed with no page errors.

The protocol scenario uses two real WebSocket clients against a temporary FileAdapter authority. It verifies unique owned ships and pads, movement visibility, one winner for last-item purchases and candidate hires, paid-action replay without double charging, an actual Digger hole with lossless float32 brick transfer, generated pool refill, crew cabin routing, the shared lift, boarding permissions, exclusive stations, coflight to Phobos, passenger rejoin, restart of a mid-flight checkpoint, elapsed downtime, expired seats, and a landed server restart retaining ship/crew/purse/terrain. Injected write failure refuses and rolls back an action without changing its durable file. HTTP tests deny private server code and saves.

Supabase adapter checks mock the REST RPC transport, validating typed arrays, expected revisions and sanitized failure messages. They do **not** execute the SQL or prove its behavior against Postgres. [The SQL](../../../../server/migration.sql) is ready for Claude to apply and verify.

`node test/multiplayer-browser.mjs` runs two separate real Chrome contexts with different device identities and Loft avatars. It verifies the visible other body, received shared hole, exclusive hire, shared elevator, guest coflight, exact passenger-local pose after refresh, both landing on Phobos, and the guest leaving on the correct moon/ship frame. A third context checks the 390 × 844 touch layout. A normal-play page confirms there is no exposed `window.cosmos` debug handle. After shutting down the authority, a separate static server proves the browser selects and labels offline solo; real local space credits/cargo survive refresh. See [browser-results.json](browser-results.json) and [browser-run.txt](browser-run.txt).

The harness deliberately uses server-side fixture placement and advances the real simulation clock to make long walking/flight scenarios reproducible. Those capabilities exist only in the test process, not as network commands. This is not evidence of a continuous manual playthrough, internet latency, human usability, or physical phone performance. The snapshots use low graphics and software WebGL in headless Chrome.

## Screenshot evidence

| Screenshot | What was checked |
| --- | --- |
| [01 — Other player](01-other-player.png) | Real loaded Loft player body/name in the shared world |
| [02 — Shared hole](02-shared-hole.png) | The other browser received and rebuilt the dug terrain |
| [03 — Crew hall](03-crew-hall-meeting.png) | Candidate called out through the hall doorway; hire/decline panel |
| [04 — Flying together](04-flight-together.png) | Owner and guest aboard the same Phobos trip |
| [05 — Passenger refreshed](05-passenger-rejoined.png) | Same guest identity, ship and cabin position mid-trip |
| [06 — Phobos landing](06-phobos-rejoined.png) | Rejoined passenger on the shared ship at Phobos |
| [07 — Touch viewport](07-mobile.png) | World/crew controls at 390 × 844 |
| [08 — Shared lift](08-shared-elevator.png) | Authoritative tower lift carrying both players |
| [09 — Offline solo](09-offline-solo.png) | Visible fallback with locally persisted real space purse/hold |

Screenshots were inspected for scene/controls/body placement. A focused Node rendering check also confirmed shared damage scars select the matching Mars/moon frame; visible moon scars were not exercised in the browser scenario. Candidate presentation is functional but the hall is a simple building shell; its interior, art and collision need refinement. The World panel is intentionally an overlay at narrow widths. Smooth interpolation and terrain interest filtering are future work.

## Remaining work and deployment limits

Claude still needs to apply the migration, load the MSI's external environment secrets, supervise `node server/index.mjs`, and test two clients through the actual public tunnel. Neither production Supabase nor `wss://cosmos.heartbeatobservatory.com` was exercised here. Real phones, packet loss/latency, larger fleets and long downtime catch-up were not measured. Use [RUN-SERVER.md](../../../RUN-SERVER.md) for those steps.

Player poses are bounded client prediction; full server movement/collision is unfinished. NPC gun stations work on the authority, but multiplayer NPC pilot orders are unfinished. Moon landings use existing sites; allocating separate moon pads is unfinished. Combat is per ship against its raiders; fleet-wide PvP/collisions are unfinished. Ship damage, flight and wages continue while away, but disconnected EVA players retain their stored pose and there is no oxygen/health/death simulation yet. Accounts are temporary device keys without recovery. Offline solo retains its existing local crew presentation rather than the new multiplayer hiring hall.

These are limits of this implementation, not claims deferred to a successful test. The many-ship data model and local two-client foundation are present; the remaining gameplay work can build on those owned entities.

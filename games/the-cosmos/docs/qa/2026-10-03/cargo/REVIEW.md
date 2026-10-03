# The Drayman hauler, rovers that ride, and player shops (2026-10-03)

Branch `cosmos-cargo`, built on `3839c3c` (stabilize) and rebased onto the voices work. Jaron: "A bigger cargo ship and ramp later for another ship for vehicle transport would be awesome too. People could start their own shop. Buy things then sell it."

## What was built

**1. The Drayman, a cargo hauler that is data like the other ships.** `src/ships/hauler/` (spec, definition, exterior, interior dressing, stats), registered in `registry.js` and `visuals.js`; nothing else in the game names it.

* 52 m long, 17 m across the engine nacelles, 62 t, one chin gun, cruise 31 m/s (a Meridian is 40). Hold 90 t against the Meridian's 24 t.
* Rooms you can walk, at the Meridian's level of dressing: flight deck (pilot, captain, navigator, comms, under a canopy), corridor, crew berth with four bunks, mess with galley, airlock, cargo control (load table, berth board), supplies, engine room with the reactor and the engineer's station, and the **cargo hold**: 20 m by 11 m, 4.6 m under the gantry rails, six rover cradles with wheel chocks and clamp posts, tie-down rails down both walls, a gantry and hook, an aisle with guide lines, and a stern door framed in hazard chevrons.
* **A 6.8 m wide vehicle ramp** (21 degrees at rest), as wide as the two berth columns, so a rover in either column drives straight out aft.
* Its own look from the outside: pale plate with a safety-orange flank band the length of the hold, orange nacelles on pylons either side of the open stern, a roof of radiator fins and hatches, "DRAYMAN" on the flank.
* **Buyable at the shipyard kiosk for 9,000 credits** (36,000 marks). Context: a pilot starts with 2,500 credits, a Shrike is 2,400, a rover 600, a Meridian 18,000. Half a Meridian for almost four times the hold and six rovers, with no guns worth the name: it earns by carrying and selling. The kiosk's scale models shrink to fit the counter whatever is for sale.

**2. Rovers ride in it.** `def.cargoDeck` and `def.berths` say where a rover drives and where it is clamped (a ship without them keeps the Meridian bay: `deckOf`, one rule for server and client). A rover drives up a lowered ramp and is parented to the ship; **a ship takes a rover only if it lets that driver aboard** (the owner's, or crew-may-board on) and a hauler takes as many as it has berths. **Lock-down:** once a ship has been off the ground for a second every parented rover is clamped (`locked`, speed 0, no drive input), and on a hauler it is drawn to the nearest free berth centre, nose to the stern or the bow. Landing releases it. On Phobos or Deimos the same ramp lets it drive off into that moon's frame. Parked rovers are looked at twice a second, not thirty times.

**3. Player shops at Marineris Port.** Six stalls on a market row south of the main pad, with live signs ("Stall 3 - FOR RENT", the shop's name and how many lines it has). A stall is 700 marks for 7 sols (paid to the port; one stall per player; at most 28 sols ahead). The owner stocks it from the flagship **while it is landed at the port**: supplies by unit, salvage alloy by 100 kg, and Phobos regolith, Phobos hydrated clay and Deimos regolith by the tonne **as the real excavated lots**, so the world's mass-and-volume ledger still balances to the bit. Prices are whole marks. Customers stand at the stall and buy; goods go to their flagship's hold (refused if it is full). Receipts, no duplication, refusals: see below. While the owner is away the port's NPC buyers take what is priced within 1.2 times the fair price, one unit of one line every 30 world-seconds, up to a per-sol demand, paid from the dealer fund. Survey core samples are deliberately not for sale (they belong to the Survey Office contract).

The phone sheet is one button that appears at a stall ("Stall 2 is free: rent it", "Your stall: ...", "Maren Salvage: browse and buy") and one sheet with 44 px-plus buttons, typed numbers in a 16 px field (no zoom), the last receipt at the top and the sale log at the bottom. The sheet is rebuilt only when something it shows changes, so a thumb never lands on a button that was just replaced.

## Accounting, in plain words

Every shop action is one authority transaction on a copy of the world, rolled back whole on a refusal. Checked first: you stand at the stall, you own what you change, the quantity is a positive whole number, the price you saw is still the price, you can pay, the buyer's hold has room, the stall's rent is paid. A retried action id returns its first receipt and moves nothing twice. A sale returns a receipt (number, stall, shop, good, quantity, unit price, total) and the shop keeps its last 40 sales. Marks and kilograms are conserved: the tests sum every ship's account plus the dealer fund, and every lot in every ship, hopper and stall plus exported mass, before and after, and require equality (marks to the mark, matter to the bit).

## What was verified

* **`node test/validate.mjs`: 943 passed, 0 failed, on the tree rebased onto the playfix commit.** After that, `origin/main` gained the looks-polish commits (rebuilt survey rover mesh, Phobos rocks, raider helmets); I rebased onto them, re-stamped, and re-ran what touches my work (section 40 to 44 cargo checks: 93 passed; `cargo-browser`; `phone-check`: all green) but did not run the full 30-minute validator a third time. An earlier full run on the previous base was 938 passed with one failure in someone else's test: `test/opening-bugs-browser.mjs` waited on a bare `cosmos` while the page was loading, which throws instead of returning false. That test now reads `window.cosmos`; it passed alone and in this run. The very first full run (890 passed) showed two faults in my own new tests (a stall-close check that counted a newly joined player's purse, and a ground probe), fixed in the tests, not the game. Sections 40 to 44 are `test/cargo-checks.mjs`: the hauler as a ship definition (rooms, every room reachable on foot, every door, every seat reachable, furniture inside rooms, hull fit, 5 cm measured size, phone-tier triangles, flight and landing), the vehicle bay (berths clear of freight and walls, aisle width), the shop catalogue and the exact-matter helpers, shops on the real authority with two WebSocket clients (rent, stock, price, buy, a receipt, an idempotent retry, a stale price, an overbuy, a fraction, a negative, no funds, a full hold, across the port, your own stall, a stranger's stall, lapse and renew, close, NPC buyers online and offline, per-sol caps, restart, removal), and rover transport on a real flight to Phobos (buy the hauler at the kiosk, make it the flagship, drive a rover up the ramp, park it, a stranger's rover refused, the seventh rover refused, close the ramp, fly to Phobos, clamped into a berth and unmoved by full throttle, landing releases it, drive off onto the moon, restart).
* **`node test/phone-check.mjs`: all steps pass**. iPhone-15 WebKit and Galaxy S9 Chromium, real touch (the first attempt had the WebKit process crash outright mid-run while other test runs were using the machine; the rerun is clean, 0 failures).
* **`node test/cargo-browser.mjs`: passes with 0 page errors.** Two real iPhone-profile WebKit phones against one isolated authority, real taps and a held thumb. Phone A rents a stall by tapping, stocks water, alloy and regolith through the sheet; phone B buys by tapping and gets a receipt; a stale price is refused and shown; the owner sees the sales; the owner goes away and NPC buyers buy. Phone C taps **Drive** in the hold and a held thumb drives the rover aft down the aisle and off the ramp; phone D, standing behind the ramp, sees the same rover arrive on the ground. Screenshots: `p_stall_*`, `p_rover_*` (PNG, committed).
* **Server tick on a copy of the live world** (25 ships, 22 players, 9 rovers; `test/perf-export-live.mjs`, `test/perf-tick.mjs`, `test/perf-cargo.mjs`): before (origin/main) **avg 1.60-1.73 ms, p95 3.0-3.4 ms**; after, same world **avg 1.58-1.60 ms, p95 3.0 ms**; after with six of its ships turned into parked Draymans carrying 36 rovers and six stocked shops (half sold to by NPC buyers during the run) **avg 1.59-1.67 ms, p95 3.0-3.2 ms**. Parked haulers and idle shops cost nothing you can measure. The full public snapshot is 1.3 to 1.5 ms to build either way.

## Pictures

Desktop frames are 1280 by 720 JPEG from `shoot.mjs` (Playwright Chromium on SwiftShader, free camera in the real client; JPEGs are gitignored by convention and stay in this folder). Phone frames are 393 by 852 at 2x PNG from the WebKit run.

| Frame | What it shows |
|---|---|
| `d_ext_bow_three_quarter.jpg` | The Drayman on its pad beside another ship: pale plate, orange flank band, canopy, the 52 m length |
| `d_ext_stern_three_quarter.jpg` | The stern: the wide ramp down, the open cargo door, two nacelles with twin nozzles on pylons |
| `d_ext_flank.jpg` | The flank: DRAYMAN on the plate, crew-section windows, hatch, belt line round the hold |
| `d_ext_ramp_down.jpg`, `d_ext_ramp_head_on.jpg` | The ramp down with rovers parked in the lit hold, seen from outside |
| `d_in_flight_deck.jpg`, `d_in_flight_deck_side.jpg` | The flight deck: canopy, pilot and captain seats, the navigator and comms consoles with live screens, lockers |
| `d_in_crew_berth.jpg`, `d_in_mess.jpg`, `d_in_cargo_control.jpg`, `d_in_engine_room.jpg` | The walkable rooms: four bunks, the mess and galley, cargo control with its berth board, the reactor room |
| `d_in_hold_aft.jpg`, `d_in_hold_fore.jpg`, `d_in_hold_berths.jpg` | The hold: gantry, six cradles with chocks and clamp posts, rovers in berths, the aisle guide lines, the lit ramp opening onto Mars |
| `d_market_row.jpg`, `d_market_stall_close.jpg` | The market row: five stalls "FOR RENT" with their shutters down and one open ("Jaron Salvage & Supply, 3 lines for sale") |
| `d_shipyard_kiosk.jpg` | The shipyard kiosk's board and scale models, now with the Drayman beside the Shrike and the Meridian |
| `p_hold_rover_prompt.jpg`, `p_in_flight_deck.jpg`, `p_in_hold.jpg` | 390 px frames: the Drive prompt beside a rover in the hold, the flight deck, the hold |
| `p_stall_1_vacant.png` ... `p_stall_7_owner_sales.png` | The WebKit phone sheet, in order: a free stall, rented and empty, stocked, the customer's list, the receipt, a stale price refused, the owner's sales |
| `p_rover_1_hold.png` ... `p_rover_4_out.png` | The WebKit phones: the Drive prompt, at the wheel with the ramp down, the second phone watching the rover arrive on the ground, stepping out |

## What does not work, and what is not verified

* **No physical phone.** Everything phone-shaped is Playwright WebKit with an iPhone profile and touch events, not Safari on a device. A thumb on glass should be checked once on the live site.
* **Shops are in the shared world only.** The offline solo world has no stalls and no hauler rovers (a solo hauler via `?ship=hauler` flies and has no rover aboard).
* **Stalls are at Marineris Port only.** Moon pads are the "later" step. Selling is one shop per player, six stalls in all.
* **Goods are kilograms and units, not volume.** The hold capacity is the ship's `cargoKg` (90 t for a Drayman). A tonne of regolith and a tonne of alloy take the same room.
* **Other players' rovers in a flying hauler** are drawn from the server's 10 Hz world pose, not eased with the hull. The hold is enclosed, so it only shows through an open ramp.
* **The rover cannot be "chained" in the hold.** The clamp is a lock-down rule plus pictured clamp posts and green lights; the posts do not animate.
* **The Supabase path.** The new `state.shops` map, `locked` and `berth` ride in the world's JSON record (no schema change, no new table). The mocked RPC checks pass; the first real save is the first live commit after the restart (`/health` is checked after it).
* **A new ship on pad 04 and beyond** lands with its ramp tip a few metres past the 64 m pad on graded ground; nothing there is built over.

## Files

`src/ships/hauler/{spec,def,stats,exterior,interior}.js`, `src/economy/shops.js`, `src/economy/shopView.js`, `server/shops.mjs`, `server/vehicles.mjs`, `server/authority.mjs`, `src/vehicles/{support,view,api}.js`, `src/ships/{registry,visuals}.js`, `src/world-state/{multiplayerView,fleetView,gameBridge}.js`, `src/ship/{shipSystem,shipScreens}.js` (idle screens name their own ship), `test/cargo-checks.mjs`, `test/cargo-browser.mjs`, `test/perf-cargo.mjs`, `docs/WORLD-STATE.md` ("Cargo").

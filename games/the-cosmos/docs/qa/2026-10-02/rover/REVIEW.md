# A survey rover you can buy, share, and drive down the Meridian ramp (2026-10-02)

Branch `cosmos-rover`. The opening scripts were left alone. `board`, `seat`, `drive` and `leave` in `src/vehicles/api.js` are the calls an opening can use for type `survey`. Those scripts do not call them yet.

## What was built

* **A survey rover, data-driven like a ship.** Pressurised cab, six wheels on suspension, headlights, tail lights, and dust when it is moving outside. Four seats: driver, right, and two in the back. It drives on the density field under Mars gravity and under the moons' gravity. Stick up is throttle and stick right steers, the same axes as the helm. Keyboard uses those same move axes. The phone button says Drive, Ride, or Leave, with no key letter in the label.
* **The server owns it.** `state.vehicles` sits in the schema-2 JSON record. There is no new SQL table and the schema is not bumped. An old save loads, and each Meridian gains `hold-<ship id>` at the cargo-bay berth. Pose messages carry a one-second drive lease, the way a helm does. Passengers are published with the rover. Anyone may take a free seat. The port depot sells more at 2,400 marks from the flagship account, up to three purchased rovers besides the one in the hold. A bought rover waits on the east apron, facing the desk.
* **The hold prop is this vehicle.** The static rover in the cargo bay is gone. The player drives the hold rover down the lowered cargo ramp and back up it. While it is on the ramp the ramp stays down.

## What was verified

`node test/validate.mjs` from `games/the-cosmos`: **758 passed, 0 failed**. Section 31 is `test/rover-checks.mjs`. It covers the type, the yaw basis, a ship-deck drive, Mars losing more speed than Phobos on the same uphill coast, the mesh budget, and a two-client world on its own FileAdapter: both clients see the hold rover, one drives it off the ship, the other sees that same world pose, reversing puts it back on the ship, a depot purchase spends 2,400 marks and sits on the ground, a checkpoint keeps the rovers and does not keep ramp blockers, and a save that had no `vehicles` key reloads the same hold rover. A courier join (opening version 1) does not get one. Mars and Phobos contact stay within 0.4 m of the ground.

## Pictures

Playwright, Chromium, SwiftShader, this folder's `shoot.mjs` on its own authority (a free port, not 8390). `d_` is 1280×720. `p_` is 390×844 with a touch context. JPEGs are gitignored. The run reported no page errors. The phone Drive label was `Drive` before boarding and `Leave` after the snapshot showed the player in the rover.

* `d_hold` — the rover in the cargo bay. White hull, grey cab, orange deck, six black wheels, ramp open onto Mars.
* `d_ramp` — the same rover on the slope, nose out of the bay, pad 04 and the port tower beside the ship.
* `d_ground` — off the ramp, on pad 04, antenna up, the bay still open behind it.
* `d_stern` — from inside the bay, the rover outside on the pad.
* `p_drive` — 390 px, standing at the rover. Cab, hull and wheels in frame. The button says Drive.
* `p_cab` — 390 px, the whole side of the rover in the bay, ramp open, button still Drive.
* `p_leave` — 390 px, in the driver's seat. The line says "You have the wheel." The button says Leave. The view is out the windshield at the ramp and the ground.

## What does not work, and what is not verified

* **It stops at a drop.** If the ground more than about six metres below the wheels is missing, the rover stops. It does not fall.
* **A solo purchase is not saved.** Offline play uses the same drive and keeps the hold rover for that session. The shared world is the one that owns rovers.
* **The opening does not drive it yet.** The type and the four calls are the contract. `src/opening/` was not edited.
* **Schema stays 2.** Rovers ride in the JSON record.
* **Not a phone.** The 390×844 frames are desktop Chromium with a phone viewport and a touch context. A physical phone was not used.

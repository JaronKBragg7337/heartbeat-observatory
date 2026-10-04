# The long-range drive (package F3)

Written 2026-10-03. Code: `src/space/longRange.js` (pure maths, shared by server, browser and tests), `src/space/spaceTrip.js` (phase `longdrive`, the route),
`src/space/spaceSystem.js` (nav rows, HUD), `src/space/spaceUI.js` (the sheet and the compression ladder), `server/simulation.mjs` and `server/authority.mjs` (the server owns it).

## What the player gets
Earth (1.65 AU from Mars today), the Moon, Ceres (1.1 AU) and Callisto (4.3 AU) are on the nav computer from day one. Pick one: the ship climbs, flies out on the
main drive to a drop-in point, then the **long-range drive** takes over. It is slow on purpose: 5% of a g, 400 km/s at most, so Earth is about 16 days of flight,
Callisto about 28. The player shortens it with time compression, a ladder of **x1 x10 x60 x600 x1800 x5400** (x5400 is an hour and a half a second: Earth in about
nine minutes with the legs around it). The cabin, crew and doors keep real time. The compression steps down on its own near the end (never less than 6 real seconds
of trip left at the rung in force), so the arrival is seen coming; at the drop-out it falls to x1. Then the main drive flies the last leg. A world with no ground yet
(Earth, the Moon, Callisto: `kind: 'deep'`) holds 14 radii off ("Holding off the world"); Ceres lands on the player's pad. The Ore Lane (fee, 20 s spool) still exists:
the nav computer offers both for a lane world, and a `~drive` row is the drive.

## How it works (so a moving target is no harder than a fixed one)
position(t, tau) = A + (B(t) - A) * s(tau). `s` is the flip-and-burn fraction at ship-time tau (closed form: `cruiseAt`), `B(t)` is the destination's drop-out point
at WORLD time t (`worldCentre(id, t)`: F2's orbits move it; today it is parked), A is where the long drive began. The duration is solved by fixed-point iteration
(`planCruise`: how long to where the target WILL be), so the ship is at rest relative to the target, exactly on it, whenever it arrives. One multiplication a tick:
a trip of weeks costs the server nothing at any compression. The state is plain numbers (`trip.cruise`), saved with the ship and mirrored to every phone.

* **Trip estimator**: `SpaceTrip._plan0` / `SpaceSystem._destinations` quote game days (`pl.long`) and real minutes at the top rung (`realSeconds`, the ladder's own integral).
  The real authority flies the trip in the test and arrives within 0.3% of the quoted game time and 3 s of the quoted real time.
* **Who may go**: small ships (under 150 t) today; a hull marked `longRange: false`, or heavier, is refused with a plain reason until a later package sets
  `record.unlocks.heavyDrive` (bible 16: big ships need the unlocks). The big transports and bulkers (SH15) are over the limit and need the unlock; the small ships (Meridian, Shrike, Wayfarer, Drayman, Skiff) may go.
* **Cancel**: slows at the drive's own acceleration to a stop between the worlds; a new course from there is a long drive again (a ship far from its home region can only
  come home by the drive; a main-drive transit from there would take months).
* **F2 (spin and orbits)**: the cruise is flown in INERTIAL axes and written back into Mars's turning axes each tick (`SpaceTrip._cruiseStep`); the targets are read with
  `worldCentreInertial(id, T)` at the SHIP's own clock (`flight.epochS`, which compression runs fast, exactly as for the main drive), so the destination is where it will be.
  A ship that has dropped out off a world with no ground yet, or was stopped by a cancel, is a **deep hold** (`src/space/deepHold.js`): a point fixed relative to that world
  (or in inertial space), written every tick, so she keeps her place beside Earth as Earth goes round the Sun instead of circling Mars at 7,000 km/s. It is saved with the ship.

## Honest simplifications
The acceleration is fiction (Game 1 is semi sci-fi); distances, sizes and the moving targets are real. The planets' pull is ignored in the cruise. The path is one straight
line (it does not steer round the Sun). The hull's turn-over at half way is a 26 second animation while the speed profile flips instantly. Free flight is refused at a deep hold
(it is charted in Mars's space only; the drive flies her out there). Fuel is not priced. Earth, the Moon and Callisto cannot be landed on until their worlds are built.

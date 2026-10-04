# The long-range drive and the one Solar System (package F3)

Updated 2026-10-03 evening. Code: `src/space/longRange.js` (pure maths), `src/space/spaceTrip.js` (phase `longdrive`, the route, the hand-off), `src/space/farWorlds.js`
(the planets in view), `src/space/deepHold.js` (a ship held out in space), `src/space/spaceSystem.js` / `spaceUI.js` (nav rows, HUD, the compression ladder),
`server/simulation.mjs` + `server/authority.mjs` (the server owns it all).

## The rule (Jaron, 10/3 7:34 PM)
It is all one solar system. No loading screen, no hidden jump, no lane, no flash. Every body lives in one shared space at its real position (F2's orbits); a ship flies
from one to another continuously, frames hand off invisibly, and the player can watch the destination grow the whole way. **The Ore Lane is retired** (jump.js is kept only
for its mouth points; no row, route, fee, spool, gate or flash uses it). Mars <-> Ceres is a long-range drive trip like any other.

## What the player gets
Earth (1.65 AU from Mars today), the Moon, Ceres (1.1 AU) and Callisto (4.3 AU) are on the nav computer from day one. Pick one: the ship climbs, flies out on the main drive to a
point clear of the planet, and the **long-range drive** takes her from there: 5% of a g, 400 km/s at most, so Earth is about 16 days of flight and Callisto about 28. She keeps
her nose to the destination the whole way (no turn-over: the drive slows her without turning her back on it). The ladder is **x1 x10 x60 x600 x3600 x14400** (x14400 is four hours
a second). The cabin, crew and doors keep real time. The compression is held down automatically so she never rushes a world: the nearest world (surface) must stay at least 8 real
seconds away at the speed she is making (`nearCap`), and the arrival keeps 6 real seconds of trip at the rung in force (`warpCap`); at the drop-out it falls to x1. Far from
everything she runs at the top; passing a planet she slows to watch it. The nav computer quotes the real minutes with those caps (`_longRealEstimate`): about 12 for Earth.

## One space
* **Bodies in view** (`farWorlds.js`): a marker (a few pixels of light, fixed in screen size) for every world, replaced by the true disc as it grows; a lit sphere for every world with
  no ground yet (Earth, the Moon, Callisto, the other planets); a built world (Ceres, Phobos) draws its own shell. The camera's far plane is 1e13 m (engine.js) so nothing is clipped.
* **The Sun** is where it is from the ship (`updateFrames`): out among the planets she sees it from there. Every world shares it: Ceres's own fixed star (WORLD2) is retired with the lane.
* **Frames hand off in place** (`SpaceTrip._endCruise` -> `setFrame`): the cruise is flown in the root frame; she arrives at rest relative to the destination's drop-in point (over its
  pad, carried by its frame), and the frame changes there with her position and velocity carried across (`carryFlight`). Nothing is re-placed, nothing flashes. A ship leaving another
  world is handed to the root frame once clear, the same way. The world is built when the trip starts, so it is already in view.
* **One clock**: the long drive never runs her own clock ahead (`flight.epochS` stays null): a trip of weeks must end in the same sky as everyone else's. The targets are read at the
  world's clock.

## How the cruise works
position = A + (B(t) - A) * s(tau), in INERTIAL axes (`planCruise`, `cruiseAt`): `s` the flip-and-burn fraction at ship-time tau (closed form), `B(t)` the destination's drop-in
point (its mouth over the pad, so it turns with the world, or 14 radii off a world with no ground), A where the cruise began. Her velocity is the derivative (along the line plus the
goal's own motion), so she arrives at rest relative to it. One multiplication a tick: weeks cost the server nothing. The state is plain numbers (`trip.cruise`), saved with the
ship and mirrored to every phone.

* **Deep hold** (`deepHold.js`): a ship that has dropped out off a world with no ground yet (Earth, the Moon, Callisto), or was stopped by a cancel, keeps her place beside that world
  as it goes round the Sun (or in inertial space), written every tick, saved with the ship. Free flight is refused at a hold; the drive flies her out there.
* **Who may go**: hulls up to 150 t; the big transports and bulkers (SH15) need the heavy-drive unlock (`record.unlocks.heavyDrive`, not built yet).
* **Cancel**: slows at the drive's own acceleration to a stop between the worlds; a new course from there is a long drive again.
* **Estimator**: `SpaceTrip._plan0` quotes game days and, with the neighbourhood's cap, real minutes; the authority flies within 0.3% of the quoted game time and about 30% of the quoted real time (the quote flies the worlds as they are at plan time).

## Honest simplifications
The acceleration is fiction (Game 1 is semi sci-fi); distances, sizes and the moving targets are real. The planets' pull is ignored in the cruise. The path is one straight line
(it does not steer round the Sun). The Sun's size and brightness do not yet change with distance (Mars's values everywhere). The destination is drawn as a marker, then a disc; the
planets other than Ceres have no surface detail from afar (a lit ball). Free flight does not yet reach across the system (the free-flight feel and range belong to another package);
at a deep hold it is refused. Fuel is not priced. Earth, the Moon and Callisto cannot be landed on until their worlds are built.

# F3 one Solar System and the long-range drive: review (2026-10-03, evening)

Jaron (7:34 PM): it should all be one solar system, no loading screen, no hidden jump, no flash; fly from one planet to another with ease; watch the destination grow.

What was run
* `node test/pkg-longrange.mjs` (in validate): the maths; the moving target; the compression ladder and its real-time quote against a brute-force tick loop; the nav rows; and the REAL
  authority flying Earth, the Moon, Callisto (cancelled mid-cruise, saved and restored mid-cruise), Ceres and home again. **Seamless checks on the Mars -> Ceres flight, every tick
  sampled in inertial axes:** one frame hand-off, 0 m of jump across it (it moves her exactly as far as the tick before did), the nose never more than 15 degrees off Ceres through the
  whole cruise (no turn-over), no turn faster than 1 degree a tick, and the compression never lets her reach a world in under 8 real seconds.
* `node test/seamless-browser.mjs` (solo, Chromium at iPhone size): the whole trip photographed (`seam-1` to `seam-6`): Ceres a marker, then a disc, the hand-off, the landing; the
  flash overlay and `space.flash` stayed 0 for the entire trip; the camera far plane is 1e13 m and every number finite.
* `node test/longrange-browser.mjs` (real server, phone-size): the nav sheet, the compression ladder, half way, the drop-out, holding off Earth. `node test/longrange-solo-browser.mjs`: solo, save and restore mid-cruise.
* `test/world2-trips.mjs` and `pkg-ceres.mjs`: Mars -> Ceres -> Mars now by the drive, no spool, no fee. The two Ore Lane browser tests were retired (the shared-world one deleted, the other patched).

What changed from the first F3 slice (same day): the cruise is inertial and on the world's clock (no snap-back at the end, no epoch jump); the hull keeps its nose to the destination (the
turn-over is gone: it read as hiding a cut); the hand-off is `setFrame` in place with her velocity carried (the old `jumpTo` re-placed her and flashed); the Ore Lane, its gates, fee,
spool, flash and Ceres's private star are gone; far worlds are drawn (markers, lit balls, the far plane at 1e13); the Sun is where it is from the ship; the compression ladder tops at x14400
and is held down near any world.

Works: Mars -> Ceres in the authority is continuous to the metre; Earth about 16 days of flight, Callisto about 28, Ceres 13; about 12 real minutes for Earth with the caps.
Not done / unverified: free flight does not reach across the system and is refused at a deep hold (free-flight feel and range belong to another package; I kept control feel out of this
diff); the Sun's size and brightness do not change with distance; the planets other than Ceres are plain lit balls with no detail from afar; Earth, the Moon and Callisto cannot be landed
on (their worlds are not built); real iPhone Safari (Chromium and the WebKit profile on Windows only); the voices are Kokoro clips not listened to. The first close-up of Ceres in
`seam-5` is dim (a dark body on its night side): the world looks right only from the landing shot.

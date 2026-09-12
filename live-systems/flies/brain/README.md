# Inside the fly

Public scene: https://www.heartbeatobservatory.com/live-systems/flies/brain/

Static Three.js 0.180.0 page; no build. Serve the repository root with any HTTP server.
Loads ../atlas.json and ../atlas.bin (little-endian float16, measured coordinates).
Reads public fly_live every 3 seconds and fly_actions every 10 seconds, with overlapping
requests suppressed and polling paused while the page is hidden. No mutation endpoints.

Spike flashes only follow a new, fresh fly_live.at. Last known data remains visible when
offline or older than 30 seconds, with a stale label and no activity flashes. DN is counted
from the provided sampled atlas indices; it is not a full-population count. Missing values
remain dashes. Point count and region membership come from the atlas, not constants.

## Avatar

Measured flybody anatomy is shipped as fly.glb (1.97 MB). All 85 mesh parts, 67 body nodes,
and 102 joint definitions are retained from fruitfly.xml. Joint axes/ranges live in node
extras.jointsJson. assets.js multiplies rotations about those axes; no body translation
or whole-avatar bobbing simulates limb motion. Anatomical CGS scale is converted to metres;
the scene explicitly displays the fly at 160x. See ASSETS.md and tools/build_fly.py.

The table uses the regulation 2.74 x 1.525 x 0.76 m envelope, a 0.1525 m net, assembled
frame/hardware, and CC0 ambientCG wood/roughness/normal textures. Frame and paddle construction
are illustrative. Asset IDs toggles overview labels and a selector for every component.
No grid or player controls. Debug coordinates are world metres; body labels mark joint origins.

Avatar motion is illustrative, not measured limb movement. window.flyScene exposes read-only
view diagnostics including the sampled DN count for a future locomotion adapter. The scene
has no trading controls or connection to the execution harness.

Phone and laptop use the same page. Pixel ratio is capped at 1.5, spikes at 3000, and reduced
motion disables automatic orbit. Orbit can be paused or reset; mouse/touch drag is supported.

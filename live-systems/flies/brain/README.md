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

No fly.glb was supplied at implementation time. The visible body/two wings are an explicitly
labelled three-shape placeholder. Place the licensed rigged GLB beside index.html to load it.
The loader normalizes its bounds. Named idle, wing, groom and press animation clips are used
when present; named wing/foreleg bones have fallback poses. Different asset rig conventions
may require an adapter; no real asset animation was verified before the file exists.

Avatar motion is illustrative, not measured limb movement. window.flyScene exposes read-only
view diagnostics including the sampled DN count for a future locomotion adapter. The scene
has no trading controls or connection to the execution harness.

Phone and laptop use the same page. Pixel ratio is capped at 1.5, spikes at 3000, and reduced
motion disables automatic orbit. Orbit can be paused or reset; mouse/touch drag is supported.

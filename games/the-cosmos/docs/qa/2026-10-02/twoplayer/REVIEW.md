# October 2 — two players and phone graphics recovery

Changes are uncommitted for Luna to publish. Tests use a temporary FileAdapter authority on an OS-assigned loopback port; the MSI service, port 8390, and production Supabase data were not changed.

Final resumed run: **`node test/validate.mjs` exited 0 — 628 passed, 0 failed**, including the browser harness. The corrected standalone harness also exited 0. `git diff --check` passed.

The validator's two-client run recorded 121 visible-transform samples under injected 80–200 ms delivery jitter and packet bunching:

| Visible transform | RMS position error | Maximum position error |
| --- | --- | --- |
| Player walking at 4 m/s | 0.186 m | 0.493 m |
| Ship moving at 20 m/s | 0.910 m | 2.464 m |

These errors are relative to the deliberately delayed trajectory, not the current undelayed authority position. All nine graphics matrix entries rendered non-clear frames without new graphics failures. All four recovered worlds rendered pixels, retained the same player identity, and disabled local point/spot lights. The further synthetic safe-mode failure stayed visible without reloading. Eleven bounded graphics diagnostics reached the temporary authority; there were zero browser page errors. Real context loss and shader failure were induced; memory failure was a synthetic GL status.

## Implemented behavior

- Active and remote ships use the same definition-based hull envelope. Closed guest boarding closes the hull openings even when the ramp is lowered. Allowed guests walk onto the actual ramp and continue with that ship class's ShipWalker, rooms, gates, stairs and furniture. Nearby remote interiors use the same builders and materials as the active ship. Disabled and abandoned raiders use the same hull/boarding rules; fighting raiders refuse boarding.
- Players interpolate world positions outside a ship and local positions while aboard. Ships interpolate positions and slerp orientation. Passengers and crew use the displayed ship transform. The buffer holds 100 ms, extrapolates at most 150 ms, and bounds catch-up after packet bunching. Frame/ship transitions clear incompatible history. Timestamped snapshots reject stale deliveries.
- Pose sequence acknowledgements compare the server pose with the corresponding sent prediction, rather than pulling the current body back to an old packet. Small corrections settle in steps of at most 4 cm; corrections beyond 8 m recover immediately. Boarding, seat and frame transitions still place the body deliberately and consume that acknowledgement once. The existing explicit QA `forcePlayer` restore remains available; rejection/reconnect handling uses gentle reconciliation. Late packets from an earlier coordinate frame cannot reset newer motion history.
- `?tier=safe` requests WebGL1, disables log depth, shadows, float environment targets and custom effect shaders, uses Lambert/basic materials, caps ordinary textures at 256 pixels and DPR at 1, reduces terrain resolution/draw distance, and uses simple animated suit figures without bone float textures. The byte occupancy atlas is 512×512 and preserves dug-ground coverage using GLSL ES 1.00 arithmetic; terrain tier cut-outs remain supported.
- Shader compile/link errors, context creation/loss, GPU memory errors and repeated clear-only first frames show a graphics problem line. A fresh-page reload releases resources and enters safe mode once; safe-mode failures remain visible without looping. The world connects before renderer creation so even renderer creation failures can report to the authority.
- `client-error` logs contain UTC time, bounded reason/compile log, GPU renderer, browser family and tier. Server code whitelists these fields, limits each connection to four reports, and rotates a 1 MiB log with one backup. Device keys, player names, page URLs, IP addresses and stack traces are omitted. Production path: `server/.data/client-errors.log`.

## Evidence and reproduction

Run from `games/the-cosmos`:

```powershell
node test/validate.mjs
node test/twoplayer-browser.mjs
```

The validator runs the deterministic checks and the full browser harness; the separate browser command reruns only that harness. Playwright resolves from local dependencies or `COSMOS_PLAYWRIGHT_ROOT`; Windows Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe`, with `COSMOS_CHROME` as an override. Other platforms use Playwright's Chromium.

The browser harness uses two separate contexts, actual WebSocket state deliveries with 80–200 ms delay and packet bunching (every seventh delayed packet waits another 100 ms), and a 390×844 Android viewport with 4× CPU throttling. Chrome launches with `--use-gl=swiftshader`, `--use-angle=swiftshader` and `--enable-unsafe-swiftshader`. It compares displayed transforms against the buffer's delayed trajectory; these errors exclude the deliberate presentation delay. This is a constant-velocity walk/ship test, not a claim about all possible flight maneuvers. Each graphics matrix entry includes a framebuffer probe that must contain rendered pixels, plus an assertion that graphics recovery reported no new failure.

The resumed review corrected safe mode's light reduction: point/spot lights have no material, so they had previously been skipped by the material traversal. Recovery checks now probe rendered pixels after all four fallbacks, require zero new graphics failures and zero visible point/spot lights, verify the player identity survives, and require the corresponding on-screen reason. A further synthetic failure in safe mode must remain visible without replacing the page. Deterministic checks also bound individual visible position steps under packet bunching and verify quaternion/yaw interpolation through turns.

The first resumed standalone run timed out waiting for the page load event after the forced WebGL1 failure, despite reaching the safe URL. The harness now waits for the navigation commit, then independently waits for the initialized renderer and probes the frame; the final validator result is the authoritative evidence. A separate agent-browser visual check loaded the safe solo world, found the controls, opened Settings, and reported no page errors.

Results are recorded in [validator.txt](validator.txt), [browser-run.txt](browser-run.txt), and [browser-results.json](browser-results.json). The deterministic test covers a 4 m/s player and a 50 m/s ship, frame changes, extrapolation caps, correction bounds, hull openings and privacy. The browser tests cover denied boarding, actual guest ramp transfer/cargo walking, a 4 m/s remote player and a 20 m/s remote ship, and graphics recovery.

Screenshots:

| File | Evidence |
| --- | --- |
| [01-other-ship-solid.png](01-other-ship-solid.png) | Other player's hull and lowered ramp; contact asserted separately. |
| [02-guest-walking-interior.png](02-guest-walking-interior.png) | Guest's view after walking from the ramp into the cargo room. |
| [03-two-client-jitter.png](03-two-client-jitter.png) | Shared world after the actual jittered packet run. |
| [phone-1.png](phone-1.png) | Low tier, normal rendering features on. |
| [phone-2.png](phone-2.png) | Low tier with 16-bit depth emulation. |
| [phone-3.png](phone-3.png) | Log depth/environment/shadows off and 2 km far plane. |
| [phone-4.png](phone-4.png) | Forced WebGL1 normal-tier shader failure and safe-mode recovery. |
| [phone-5.png](phone-5.png) | Explicit safe mode. |
| [phone-6.png](phone-6.png) | Log depth disabled independently. |
| [phone-7.png](phone-7.png) | Floating-point environment targets disabled independently. |
| [phone-8.png](phone-8.png) | Shadows disabled independently. |
| [phone-9.png](phone-9.png) | Far plane limited to 2 km independently. |
| [04-phone-clear-frame-fallback.png](04-phone-clear-frame-fallback.png) | Actual readPixels clear-only detection and recovery. |
| [05-phone-context-loss-fallback.png](05-phone-context-loss-fallback.png) | WEBGL_lose_context event and recovery. |
| [06-phone-shader-fallback.png](06-phone-shader-fallback.png) | Intentionally invalid shader compilation and recovery. |
| [07-phone-synthetic-memory-fallback.png](07-phone-synthetic-memory-fallback.png) | Injected OUT_OF_MEMORY status and recovery; no actual GPU exhaustion. |
| [08-safe-browser-review.png](08-safe-browser-review.png) | Separate browser inspection of the safe solo world, showing the hull, ramp, terrain and HUD. |

## What still needs Kurtis's phone

SwiftShader is a software renderer. Android viewport/UA and CPU throttling do not emulate Mali-G57 driver compilation, actual WebGL extension/precision limits, a 4 GB RAM ceiling, thermal behavior, browser GPU process crashes, phone frame rate, or touch responsiveness. No real GPU OOM was induced. The normal tier's WebGL1 `sampler3D` compile failure is reproduced; this does not identify the A14's actual failure. A browser/tab crash outside JavaScript can prevent diagnostics from being delivered.

After Luna publishes and restarts the MSI authority, try the usual public game URL on Kurtis's A14, then `?tier=safe` if needed. Review the MSI log for the observed tier, Mali renderer and shader/context reason. Repeat real two-phone guest boarding, walking, turning, stopping, and shared flight on the actual network. Safe mode sacrifices detailed people, PBR finish/effects and the distant planetary view to keep nearby gameplay visible.

Implementation references: [Three.js shader-error callback](https://threejs.org/docs/pages/WebGLRenderer.html), [Khronos context-loss handling](https://wikis.khronos.org/webgl/HandlingContextLost), and [WebGL 1 specification](https://registry.khronos.org/webgl/specs/latest/1.0/). Version-specific behavior was checked against the vendored Three.js r160 source, including its WebGL2 skinning chunk.

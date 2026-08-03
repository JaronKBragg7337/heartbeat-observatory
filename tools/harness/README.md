# Verification harness

Headless capture and measurement for the hub world (doctrine Part 9.5). This exists
because judging a render by eye — or by a screenshot taken at an arbitrary moment —
produced wrong conclusions repeatedly. Everything here is about making a visual
claim into a number you can re-run.

## Setup

```powershell
npm install playwright serve-handler
npx playwright install chromium
```

Rendering uses SwiftShader (software WebGL), so it runs anywhere but at a few
frames per second. **Frame timings from this harness are relative only — they are
fill-rate bound in a way real GPUs are not.** Never quote them as device performance.

## The three capture flags

The hub has a **300-second** day/night cycle driven by `Date.now()`, and the preview
camera orbits on a timer. Two captures taken minutes apart therefore differ in sun
angle and framing, and cannot be compared. This cost a false "regression" once
already. All three flags below are dev-gated: they work on localhost, or anywhere
with `?dev=1`. Players always get the live cycle.

| Flag | Effect |
|---|---|
| `?tod=0..1` | pins the day/night cycle (0.17 ≈ mid-morning, good shadow angle) |
| `?cam=x,y,z,yaw,pitch` | pins the camera; radians |
| `?legacy=1` | restores pre-material-system look, for true A/B from one build |

Always set `tod` and `cam` together when comparing anything.

## Scripts

```powershell
node serve.js 8099                 # serve the repo locally (never deploy to test)
node shoot.js --tag=before --views=desktop,mobile --url="http://localhost:8099/engine/hub/index.html?preview=1&dev=1&tod=0.17"
node perf.js                       # draw calls, triangles, texture bytes: legacy vs new
node measure-tex.js "<file>|75"    # derive a texture's real tile size by autocorrelation
node convert-tex.js <outDir> <srcDir>   # ambientCG map sets -> web WebP
node contact.js                    # contact sheet of a texture folder
```

### A worked A/B

```powershell
$b="http://localhost:8099/engine/hub/index.html?preview=1&dev=1&tod=0.17&cam=-16,1.65,-6,0,0"
node shoot.js --tag=A --views=desktop --url="$b&legacy=1"
node shoot.js --tag=B --views=desktop --url="$b"
```

`-16,1.65,-6` stands at eye height 4.8 m from the Social building's brick facade.
Material work must be judged at walking distance — the default preview orbit sits
15.5 m up at 24 m radius, where no micro-detail resolves and every change looks
like nothing happened.

## Traps already hit

- **`readPixels` returns zeros.** `preserveDrawingBuffer` is off, so reading after a
  compositing frame gives a cleared buffer. That is a false negative, not a blank
  canvas — judge "did it draw" by PNG size and by looking.
- **Single-column pixel scans on running-bond masonry lock onto every other course**
  and report a 2x error. Detect bed joints across the full row, or autocorrelate.
- **`serve-handler` does not auto-resolve directory indexes here.** Request
  `/engine/hub/index.html` explicitly, not `/engine/hub/`.
- **Cache busting**: `main.js?v=` does *not* bust its own imports. `surface.js`
  carries its own `?v=`, and both must be bumped with `BUILD` on every deploy.

## Dev handle

With `?dev=1` (or on localhost), `window.HB` exposes read-only inspection:

```js
HB.renderStats()    // draw calls, triangles, programs, textures
HB.materials()      // every distinct material, its maps and tile size
HB.surfaceReport()  // material cards, tile sizes, and how each size was determined
```

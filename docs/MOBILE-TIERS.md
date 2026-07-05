# Heartbeat Device Tiers

Heartbeat Observatory pages load `/hb-device-tier.js` before their app code.

The profiler records WebGL availability, WebGL2 support, coarse pointer/touch,
device pixel ratio, CPU/memory hints where the browser exposes them, maximum
texture/renderbuffer size, and compressed texture extensions. It then sets:

- `desktop`
- `mobile-high`
- `mobile-lite`
- `no-webgl`

Use `window.HBDevice.rendererPixelRatio(2, 1.5, 1.15)` for Three.js renderers.
Use `window.HBDevice.quality.allowShadows` before enabling real-time shadows.

New pages should include this in `<head>` before app scripts:

```html
<script src="/hb-device-tier.js"></script>
```

Assumption: Heartbeat should stop treating every phone as low-end. Strong phones
get richer visuals, while old or hot phones keep a conservative render scale.

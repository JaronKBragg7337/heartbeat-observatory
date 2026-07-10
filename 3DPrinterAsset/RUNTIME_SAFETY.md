# World Printer Live Runtime Safety

The public printer still runs the existing `main.js` implementation. It is now started through:

```text
index.html
→ bootstrap.js
→ runtime-guards.js
→ main.js
```

No printer recipe, camera control, persistence implementation, or world-state source file was replaced.

## Guarded behaviors

1. Supabase INSERT and DELETE messages remain pending until the HTTP response succeeds. A failure is reported as local-only instead of falsely claiming persistence.
2. Supabase Realtime UPDATE callback payloads omit `scale` only for the `placements` table. Saved objects are already rebuilt at their stored size; this prevents the root group from applying the same size a second time after a move or rotation.

## Rollback

Change `3DPrinterAsset/index.html` from `./bootstrap.js` back to `./main.js`.

## Canonical development source

The canonical developer version and legacy inventory are maintained in:

```text
JaronKBragg7337/World-Printer-Lab-For-3D-Worlds
```

The Heartbeat directory is the public build-free vendored deployment.

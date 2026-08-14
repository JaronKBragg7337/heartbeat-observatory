# Parkworks Tycoon — built copy

**Everything in this directory except `hb-save-backend.js` and this README is a
build artifact. Do not edit it by hand.** Hand-edits to the minified bundle in
`assets/` are silently thrown away the next time anyone refreshes the game.

The source lives in its own repo:

- <https://github.com/JaronKBragg7337/parkworks-tycoon>
- Standalone build: <https://jaronkbragg7337.github.io/parkworks-tycoon/>

To change the game, change it there, then rebuild and re-copy.

## Refreshing this copy

From a checkout of `parkworks-tycoon` sitting beside this repo:

```sh
cd ../parkworks-tycoon
npm install          # first time only
npm run build        # writes dist/
cp -r dist/. ../heartbeat-observatory/games/parkworks/
```

PowerShell equivalent for the copy step:

```powershell
Copy-Item -Recurse -Force ..\parkworks-tycoon\dist\* .\games\parkworks\
```

The copy is additive, so `hb-save-backend.js` and this README survive it.

## The two edits the build does not make

`vite build` regenerates `index.html`, which means **both of these have to be
re-applied by hand after every refresh**:

1. `<script src="/hb-device-tier.js"></script>` in the head, matching the other
   games here.
2. `<script src="./hb-save-backend.js"></script>` immediately **before** the
   game's `<script type="module">` tag.

The ordering in (2) is the whole trick. `hb-save-backend.js` is a classic
script, so it runs the moment the parser reaches it; the game's bundle is a
module, so it is deferred until the document is parsed. That gap is what
guarantees `window.HeartbeatObservatory.createSaveBackend` exists before the
game calls `resolveSaveBackend()` in `src/core/SaveStore.ts`.

For the same reason the game must be served **in this document, not an iframe**.
An iframe gets its own `window`, and the game would never see the hook.

## What the hook does

The game never imports Supabase and holds no key. It asks the page for a place
to keep a park, and `hb-save-backend.js` answers with one backed by
`public.parkworks_saves` for signed-in Heartbeat players. A signed-out visitor
gets `localStorage` instead — that is the designed fallback, not a failure.

`vite.config.ts` sets `base: './'`, which is why the same `dist/` works both at
the GitHub Pages root and here under `/games/parkworks/`. Leave it alone.

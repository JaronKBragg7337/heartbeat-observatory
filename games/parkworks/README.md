# Parkworks Tycoon — built copy

**Everything in this directory except `hb-save-backend.js` and this README is a
build artifact. Do not edit it by hand.** Hand-edits to the minified bundle in
`assets/` are silently thrown away the next time anyone refreshes the game.

The source lives in its own repo:

- <https://github.com/JaronKBragg7337/parkworks-tycoon>
- Standalone build: <https://jaronkbragg7337.github.io/parkworks-tycoon/>

To change the game, change it there, then rebuild and re-copy.

## Refreshing this copy

One command, from a checkout of `parkworks-tycoon` sitting beside this repo:

```sh
cd ../parkworks-tycoon
node tools/vendor-to-heartbeat.mjs --build
```

That builds, clears the old hashed `assets/`, copies `dist/` in, and — the part
that matters — puts back the two script tags `vite build` regenerates
`index.html` without.

**Do not do this by hand.** The instructions here used to say "re-apply the two
script tags after every rebuild", which works until the once somebody forgets.
Miss `hb-save-backend.js` and there is no error anywhere: the game simply does
not find the cloud store, falls back to browser storage, and quietly stops
saving a signed-in player's park to their account. The script re-checks its own
output afterwards and refuses to report success if either tag is missing or if
the backend tag has ended up after the module tag.

Point it at a Heartbeat checkout somewhere else by passing the path:

```sh
node tools/vendor-to-heartbeat.mjs --build /path/to/heartbeat-observatory
```

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

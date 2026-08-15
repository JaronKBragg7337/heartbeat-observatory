# Rustfall — built copy

**Everything here except this README is a build artifact. Do not edit it by
hand.** Hand-edits to the bundles in `assets/` are thrown away the next time
anyone refreshes the game.

Source: <https://github.com/JaronKBragg7337/rustfall>

## Refreshing this copy

```sh
cd ../rustfall
npm install          # first time only
npm run build
cp -r dist/. ../heartbeat-observatory/games/rustfall/
```

Then re-add the one hand-edit `vite build` strips out of `index.html`:

```html
<script src="/hb-device-tier.js"></script>
```

## It runs on Heartbeat's Supabase

Rustfall used to have a Supabase project of its own, "Wasteland Commons". The
free plan allows two active projects and Heartbeat has to be one of them, so a
game holding its own was spending the only other slot.

Its five `rustfall_` tables, both lease functions and the realtime publication
now live in Heartbeat's project. The game reads that from
`src/game/netConfig.ts` in its own repo — change it there, not here.

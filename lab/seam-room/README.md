# The Seam Room

One normal room, split down the middle. The left half is a real page (`/lab/seam-room/a/`), the right half is another
real page (`/lab/seam-room/b/`). Walk across the middle and the address changes; you never leave the room and you can
always see the other side. First step of the parked project `AI-Shared/projects/threejs-asset-pipeline/README.md`
(made -> transformed -> sold, one asset ID across pages).

## What this version proves (each one tested, 2026-11-01)

| | What | How it works |
|---|---|---|
| 1 | **The seam** | Crossing x = 0 calls `history.pushState` to `/a/` or `/b/` and changes `document.title`. No reload. 0.3 m hysteresis, so standing on the line never flickers. Back / Forward put you just across the line on the other side. |
| 2 | **Spawn by URL** | Loading `/a/` spawns you on A, loading `/b/` spawns you on B. These are the team spawn points. |
| 3 | **See across** | The whole room always renders. A: honey oak floor, Persian rug, sage limewash, sofa, woodpile. B: dark walnut boards, jute rug, slate-blue walls, workbench. A brass threshold and a timber post-and-beam mark the line. A "PAGE A" / "PAGE B" plaque hangs on each side wall. |
| 4 | **People across pages** | Everyone joins ONE shell channel (`world: "seam-room"`), whichever page they loaded. Each movement packet carries `place: "a" or "b"`. The bottom-left panel shows "On A: n · On B: n", and each person has a name tag ("Guest 8FRA · on B"). |
| 5 | **An object that keeps its identity** | A log on the chopping block (A). Pick it up (E, the shell's action button, or tap it then "Pick it up"). Carrying it across the line hands it to page B: it keeps its ID and birth page, and its visited list grows. Put it on the workbench (B) and it becomes a chair with the **same ID**; its history gains "shaped into chair on B". Tap it to see its card (ID, born on, pages, where it is now in metres, who holds it, changes). |
| 6 | **Seam log** | The last 5 events, in the bottom-left panel. |

### Asset ID

Follows `decisions/3D-STANDARDS.md` ("every asset has an ID"), in Ashgrove's readable style: `SR1-A-LOG-0001`
= Seam Room 1, born on page A, a log at birth, serial 1. It is stable, not random, so two fresh browsers agree on the same
first log. When the log becomes a chair, `kind` changes but the ID does not. "Reset room" makes the next serial
(`SR1-A-LOG-0002`). The card also shows the room coordinates (x, z in metres) so "this ID at these coordinates" points at one thing.

### Sync and persistence

- Pickup, drop, crossing and shaping go out on `shell.send("asset", {state})`. A receiver adopts a state only if it is newer
  (`rev`, then `updatedAt`, then `id`). A newcomer sends `asset-ask` and everyone answers, so they catch up.
- Each browser saves the state in localStorage under `seam-room:asset:<id>` (pointer: `seam-room:current`), inside try/catch.
  A reload keeps the chair a chair. If you close the page while carrying the object, it is set down where you stood.
- **localStorage is NOT the real home.** It only survives in one browser. See "Not done yet".

## Files

- `seam.js` - the reusable piece. No three.js, no room, no network. Exposes `Seam.define({...})`.
- `room.js` - this room: scene, player, peers, the object, the card, the log.
- `room.css` - shared styles. `a/index.html`, `b/index.html` - the two real entry pages (identical apart from the letter).
- `index.html` - sends `/lab/seam-room/` to `/a/`.
- Body model: `/lab/bedroom/person.glb` (walk + idle clips), shared, not copied.

## Reuse: a 3-page road (harvest -> factory -> store)

```js
import { Seam } from "/lab/seam-room/seam.js";
const seam = Seam.define({
  zones: [
    { id: "harvest", url: "/road/harvest/", title: "Harvest", contains: (x, z) => z < -40 },
    { id: "factory", url: "/road/factory/", title: "Factory", contains: (x, z) => z >= -40 && z < 40 },
    { id: "store",   url: "/road/store/",   title: "Store",   contains: (x, z) => z >= 40 },
  ],
  hysteresis: 0.5,
  onEnter(zone, from, info) { /* info.how: "load" | "walk" | "popstate" | "goto" */ },
});
seam.start();                 // reads the URL -> spawn zone
// each frame: seam.update(truck.x, truck.z);
```

The object keeps the same JSON shape (`id, kind, born, visited[], changes[], holder, x, z, rev`). The truck is just a
holder. The factory is the workbench rule ("kind A at station -> kind B, same id, push a change"). The store is one more
rule ("on shelf", then "picked up by customer"). `contains` is any predicate, so zones can be road segments, rooms or circles.

## Reuse: team spawns

Two zones, one per team, each with its own URL: `/match/red/` and `/match/blue/`. Both pages mount the shell with the
same `world` id, so it is one match. `seam.start()` returns the zone from the URL, and that is your spawn and team. Use
`seam.goTo("blue")` for a team switch made in code (it pushes the URL). Put the team in the `place` field so everyone
sees it.

## Not done yet (honest list)

1. **Next open step: where identity and history live between pages, server-side.** Today one browser's localStorage plus
   whoever is online right now. If everyone leaves, a new visitor starts from their own copy (or `SR1-A-LOG-0001`). It
   needs a table (one row per asset ID: kind, born, visited, changes, rev), with the channel used only for live moves.
   Same lesson as Ashgrove's D6: decide this before building the 3-page road.
2. **More than 2 zones** - `seam.js` handles N zones, but only 2 have been tested.
3. **True separate-page loads with different code per zone** - both pages load the same `room.js`. A zone that needs its
   own heavy scene (a factory) would need either lazy-loading per zone or a real navigation, and the handoff then
   needs the server state from step 1.
4. No grid or debug-bubble layer yet (3D-STANDARDS asks for one in Settings). The card shows ID + coordinates for now.
5. The shell's movement-state lane does not carry the object; peers draw the object in the holder's hands from the
   holder's broadcast position, so it lags by the same ~200 ms as the person.

## Shell notes

- Uses `HBShell.mount` as world3 does. The shell has no walk keys (WASD) and no mouse-look on desktop, so `room.js`
  adds them (world3 does the same).
- The shell's use button always says "Enter". `room.js` relabels it ("Pick up", "Drop", "Shape") by finding
  `.hbs-act.go`. `room.css` hides Jump/Duck (the room has neither) and raises the shell's prompt above the seam panel.
  A `shell.setUseLabel()` would be the clean fix.
- `shell.frame(dt)` calls `onPeers` without dt. `room.js` swaps in its own `onPeers` after mounting so peer walk speed
  uses the frame time.

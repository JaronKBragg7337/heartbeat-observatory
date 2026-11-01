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

- `zones.json` - the zones and doors, as data. `agent/` - the AI character (see above).
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

## An AI in the room (agent/, 2026-11-01)

An AI (Claude first) can stand in the room as a character, walk, carry the log across the seam, shape it, and talk with
**Jaron only**. It is visible to everyone and marked with a small "AI" tag.

```sh
cd lab/seam-room/agent && npm install            # once
node room-agent.mjs join --name "Claude" --page b   # run in the background; stays in the room
node room-agent.mjs wait-chat --timeout 600         # blocks until Jaron says something; prints it
node room-agent.mjs say "On my way."                # reply
node room-agent.mjs shape                           # fetch the log, carry it A -> B, make the chair
node room-agent.mjs look | walk-to Jaron | face Jaron | pick-up nearest | carry-to 2 0 | drop | reset-room
node room-agent.mjs leave
```

- **Only Jaron can talk to it** (it runs on his personal Claude plan). Enforced by the database, not the page:
  `public.seam_room_chat` (SQL in `agent/SETUP.sql`, applied). RLS: a signed-in user may insert only a `human` row with
  `user_id = auth.uid()`, and only if that uid is Jaron's (`seam_room_owner()`); only he can read his rows. The agent
  reads only his rows and writes `ai` replies with the service-role key from the MSI's keys file. Broadcast chat is
  never trusted. The chat box is built only when `seam_room_is_owner()` says yes; everyone else sees no input.
- His device shows the reply as a bubble over the AI, in the 3-line log, and reads it aloud (`speechSynthesis`,
  mute button, remembered per browser). Everyone else sees a "• • •" talking dot, no words.
- The AI moves the log/chair through the same `asset` / `asset-ask` world events as people do, so everyone watches it
  happen. It uses the room's own collision boxes (copied into the agent) and walks at 1.4 m/s.
- Everything it hears (Jaron's lines, joins/leaves, who crossed to which page, the log's changes) goes to
  `~/.seam-room-agent/<name>/inbox.log`.
- MCP: `agent/mcp-server.mjs` (see `agent/MCP.md`) so other AIs can be characters too.

## Zones are data (zones.json)

`zones.json` lists every zone: `id`, `label`, `url`, `title`, `bounds` (a floor box; a missing side is open) and
`spawn`, plus `doors` (the seam planes between zones; the middle line today). `seam.js` builds zones from it with
`Seam.fromData()`; `room.js` and `agent/room-agent.mjs` both read it, so a zone added there is known to the URL
switching, the people counter and the AI at once. A doorway is just a small zone box set in a wall opening.

**Where a new zone plugs in** (e.g. "make the other side of that door a garage with a car"):
1. `zones.json`: add the zone (`"id": "garage"`, its `url`, `bounds` beyond the door, `spawn`) and a `doors` entry.
2. Its page: copy `a/index.html` to `<id>/index.html` and change `data-zone` and the title. Same `room.js`, same
   shell world, so it is still one room and one channel.
3. Its scene: `room.js` builds the room in `buildShell()`, `buildSideA()`, `buildSideB()`. A new zone needs a
   `buildZone_<id>()` (or a lazy-loaded module per zone, see "Not done yet" 3), an opening cut in the wall where the
   door is, and the room bounds (`W`, `D`, `clampToRoom`) widened to include it. The agent's `ROOM`/`SOLIDS`
   constants need the same change (today they are copies of room.js; one shared file would be the next clean-up).

## Page C: the garage (2026-11-01, Jaron asked from inside the room)

B's walnut door on the front wall (x 4.6, z 4) is a real door now, and behind it is a garage at `/lab/seam-room/c/`.

- **One world, no portal.** The garage (`garage.js`, `buildGarage()`) is built in the same scene behind the wall. B's
  front wall has a real 0.92 x 2.05 m opening. Door open: you see the garage from B and the room from the garage.
- **The door** swings into the garage on a hinge in 0.6 s when anyone (people or the AI) is within 1.5 m, or when
  tapped, and stays open while anyone is near. Every browser computes "near" from the shared positions; taps and
  "I am at the door" go out as the world event `door` (`shell.send` / `shell.on`). A shut door blocks the doorway.
- **Walking:** `zones.json` now has `walk` (the floor: room, garage, doorway). Zone B ends at z = 4; zone C is
  x 2..8.6, z 4..10.5. Crossing the doorway flips the URL B <-> C; walls block everywhere else. Back/Forward puts you
  just across the right door (`doors` in zones.json). The camera stops at walls and at a shut door.
- **Inside** (6.3 x 6.2 x 2.8 m): poured concrete floor with oil stains, tyre tracks and saw-cut expansion joints;
  painted block walls; drywall ceiling; two LED strip lights and a **light switch** by the door (tap it; synced as
  `garage-light`); workbench with pegboard and tools; red tool chest; steel shelves with bins; water heater; trash can;
  a "PAGE C" sign like A/B's; and a **car** made from extruded side profiles (body, glass greenhouse, roof, pillars,
  lathed tyres, five-spoke rims, lights, mirrors, shut lines). No outside model was downloaded.
- **The roll-up garage door** on the far wall (z = 10.35) is closed. It is the **future door to the outside** (a
  town page next); zones.json `doors` has it as `c-outside`.
- Few shadow casters: only the garage's ceiling, back and left walls cast (so the room's sun stays out); the shadow
  frustum was widened to cover both. Counter reads "On A · On B · On C".
- **The AI** (`agent/room-agent.mjs`) reads `walk` from zones.json, knows the garage furniture, and routes
  room <-> garage through the doorway (near side, straight through, then the goal). A running character keeps its old
  code until it is restarted.

## Not done yet (honest list)

1. **Next open step: where identity and history live between pages, server-side.** Today one browser's localStorage plus
   whoever is online right now. If everyone leaves, a new visitor starts from their own copy (or `SR1-A-LOG-0001`). It
   needs a table (one row per asset ID: kind, born, visited, changes, rev), with the channel used only for live moves.
   Same lesson as Ashgrove's D6: decide this before building the 3-page road.
2. **More than 3 zones** - three are tested (A, B, garage C). The doorway routing in the agent handles one door.
3. **True separate-page loads with different code per zone** - both pages load the same `room.js`. A zone that needs its
   own heavy scene (a factory) would need either lazy-loading per zone or a real navigation, and the handoff then
   needs the server state from step 1.
4. No grid or debug-bubble layer yet (3D-STANDARDS asks for one in Settings). The card shows ID + coordinates for now.
5. The AI character walks in straight lines with push-out collision (no path finding); a long trip around furniture can
   stop with "blocked". Chat history is only Jaron's table; nobody else's words exist anywhere.
6. The shell's movement-state lane does not carry the object; peers draw the object in the holder's hands from the
   holder's broadcast position, so it lags by the same ~200 ms as the person.

## Shell notes

- Uses `HBShell.mount` as world3 does. The shell has no walk keys (WASD) and no mouse-look on desktop, so `room.js`
  adds them (world3 does the same).
- The shell's use button always says "Enter". `room.js` relabels it ("Pick up", "Drop", "Shape") by finding
  `.hbs-act.go`. `room.css` hides Jump/Duck (the room has neither) and raises the shell's prompt above the seam panel.
  A `shell.setUseLabel()` would be the clean fix.
- `shell.frame(dt)` calls `onPeers` without dt. `room.js` swaps in its own `onPeers` after mounting so peer walk speed
  uses the frame time.

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

- `zones.json` - the zones and doors, as data; each zone names its scene `module` (+ `v`). `agent/` - the AI character (see above).
- `garage.js` - page C (the garage). `den.js` - page D (the media room) and the Heartbeat News player on its computer.
  `kitchen.js` - page E (the kitchen behind B's back door). `gym.js` - page F (the gym behind the media room's side door).
  `hallway.js` - page G (the long hallway behind the media room's back door, ten numbered future doors).
- `seam.js` - the reusable piece. No three.js, no room, no network. Exposes `Seam.define({...})`.
- `room.js` - this room: scene, player, peers, the object, the card, the log, the doors.
- `room.css` - shared styles. `a/` .. `g/` `index.html` - the real entry pages (identical apart from the letter and title).
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

## Page D: the media room (2026-11-01, Jaron asked from inside the room)

A's oak door on the front wall (x -4.6, z 4) is a real door now, exactly like B's, and behind it is a media room at
`/lab/seam-room/d/`: the garage's mirror on the other side of the wall.

- **One world, no portal.** `den.js` (`buildDen()`) builds it in the same scene. A's front wall has a real 0.92 x 2.05 m
  opening; the door swings in on approach (1.5 m) or a tap, synced as the world event `door` with id `a-d`. room.js
  now keeps both doors in `DOORS` (`b-c`, `a-d`), so a third door is one more entry there.
- **Inside** (6.1 x 5.4 x 2.75 m, x -8.25..-2.15, z 4.15..9.55): warm limewash walls over walnut wainscot, oak boards,
  a kilim rug, a walnut desk with a 36-inch monitor, keyboard, mouse, speakers, desk lamp, tower, an office chair, a
  leather reading chair with a floor lamp and side table, a bookshelf (one mesh per shelf), a window with a roman
  shade, a fig, a framed print, and the "PAGE D" sign. One warm ceiling light, no new shadow casters (only the ceiling,
  back and left walls cast, to keep the room's sun out).
- **Heartbeat News on the computer.** `createNewsTV()` reads `news-video/index.json` from Supabase Storage (the bucket
  `AI-Shared/projects/news-show/pipeline/publish_video.py` publishes to), takes `latest`, shows its poster with a play
  badge, and plays the mp4 as a three.js `VideoTexture` (`crossOrigin = "anonymous"`; Supabase sends
  `Access-Control-Allow-Origin: *`). The same picture is on the desk monitor AND a 59-inch wall TV above the desk (one
  material, one video), because in this third-person view your own avatar stands in front of the monitor.
  - Entering page D starts it **muted + playsinline** (what iPhone allows without a tap). A tap on either screen, or
    the action button by the desk ("Watch" / "Sound"), plays it; the next tap turns the sound on, then off.
  - The sound fades with distance from the desk (a WebAudio gain, because iPhone ignores `video.volume`) and the
    video **pauses when you leave page D**; coming back resumes it.
  - The label under the screens says "Today's news, Nov 1, 2026" (or "Latest news, <date>" if today's is not out yet)
    and what a tap will do. If the video cannot play, the screen keeps the poster with "Open the news", a tap opens
    `/news/`, and the seam panel gets an "Open the news" link (never over the screen).
- **Two future doors**, closed, green, each with a "COMING SOON" plaque: `d-side` (x = -8.25 wall) and `d-back` (far wall,
  right of the desk). They are in zones.json `doors` with notes. A tap rattles one ("coming soon"); the wall behind is
  solid and there is no walk area, so they lead nowhere yet. To make one a page: cut the opening in den.js like A's
  door, add the zone + a walk rectangle with `door`/`links`, and a leaf in room.js `DOORS`.
- **The AI** routes through any door: zones.json walk doorways name the two floors they join (`links`); den <-> garage
  goes through the room. In the room it walks straight when the line is clear, else down to the clear lane at z = 0.6
  and up the door's lane (A's sofa sat in the old straight line). Simulated: B -> den TV, den <-> garage, A -> garage,
  starting inside a doorway, starting behind B's armchair - all arrive.

## Page E: the kitchen (2026-11-01, Jaron asked from inside the room)

"Can we add a kitchen? Let's make a door in page B go to another page and it be the kitchen." B's back wall (z = -4) has a
new maple door left of the window (x 0.54..1.46, clear of the window, the saw horse and the bench), and behind it is a
kitchen at `/lab/seam-room/e/`.

- **One world, no portal.** `kitchen.js` (`buildKitchen()`) builds it in the same scene behind the back wall (inside
  x 0.15..6.15, z -10.15..-4.15, 2.8 m tall). B's back wall is now one shape with two real holes: the door opening and
  **B's window, which used to show a painted sky and is now a real window into the kitchen**, so you see through it both
  ways even with the door shut. The door swings into the kitchen on approach (1.5 m) or a tap, synced as world event
  `door` id `b-e`.
- **Doors are data now.** room.js builds every zones.json door with `"kind": "door"` and a z plane as a real swinging
  door (hinge at `minX`, swings away from the room, `name` for the log). The B back-wall opening and baseboard are cut
  from the same list. A new wall door = one zones.json entry + its walk rectangle (the wall cut for a front-wall door
  is still the hand-built slices in `buildShell()`).
- **Inside:** terracotta tile floor, cream plaster, cream shaker cabinets (uppers and lowers, brass pulls and knobs, toe
  kicks, glowing under-cabinet strips), stone counters, an undermount steel sink with a gooseneck faucet under a window
  with herbs on the sill, a stainless range with four iron grates, oven window, towel and a steel chimney hood, a French
  door fridge with a cabinet over it, an olive island with a butcher-block top and three stools, two green enamel
  pendants, a subway tile backsplash, a fruit bowl, a red kettle, a cutting board with a loaf, jars, a crock of spoons,
  an open shelf with plates, a tall plant, a runner, and the "PAGE E" sign on the left wall.
- **Phone budget:** every static kitchen part is merged per material (31 meshes for the whole kitchen, `kitchen.meshes`);
  nothing in it casts shadows (the sun's shadow box does not reach it; soft contact shadows instead); one warm point
  light with no shadow. Whole scene at 375 px in Chrome: about 55 draw calls looking into the kitchen.
- **Every layer knows E:** zones.json (zone, spawn, door `b-e`, walk `kitchen` + `door-b-e`); a/b got `minZ: -4` so the
  Back button lands on the right side of the back door; the counter and seam log read zones.json; the chat table's
  `place` accepts any zone id; `agent/mcp-server.mjs` takes its page list from zones.json (it was hard-coded a/b); the
  redirect page lists five pages.
- **The AI** knows the kitchen furniture (`SOLIDS`) and routes room <-> kitchen through `b-e` (kitchen <-> garage/den via
  the room). New: when furniture blocks the straight line it takes an L-shaped way or goes round one corner of the
  furniture, and its "is the way clear" check also refuses lines through walls. Simulated 25 trips (B/A/C/D -> sink,
  range, behind the island, fridge; kitchen -> garage car, den TV, chopping block; garage <-> den): all arrive. A running
  character keeps its old code until it is restarted.

## Page F: the gym (2026-11-01, Jaron asked from inside the room)

"Can the door by the bookshelf open to a new page and that page be a giant gym? Basketball court?" The media room's
future door `d-side` (x = -8.25 wall, right next to the bookshelf) is a real maple door now, and behind it is a gym at
`/lab/seam-room/f/`. It was the first room to arrive by the hot-load: anyone standing in D sees the green door become real.

- **Size:** 24 x 34 m inside, 9.5 m to the roof deck (x -32.4..-8.4, z -10.15..23.85), west of the media room. Zone A got
  `minX: -6.5` in zones.json (it was open to the west, and the gym sits at the same z).
- **The court:** a full FIBA court (28 x 15 m) along z, centre x -18.9, z 6.85. Polished maple strips, and ONE markings
  texture (68 px per metre) with the lines, navy keys and border, both three-point lines (6.75 m arc, 0.9 m from the
  sidelines), free-throw circles (dashed inside the key), no-charge arcs, lane marks, a gold centre circle ("PAGE F") and
  "THE SEAM ROOM" in the border.
- **Hoops:** two portable units (padded base, padded pole, boom and brace, 1.8 x 1.05 m glass board with white lines,
  rim at 3.05 m, net), navy wall pads behind each on the end walls. Seven-row bleachers on the west wall (one extruded
  stepped deck, wood benches in three sections, two aisles with half-steps and yellow nosing, rails; the seat brackets
  are one InstancedMesh), a scoreboard above them, clerestory windows on both long walls, six skylights, steel trusses
  and purlins, fifteen high-bay lights, eight banners (one atlas), team benches, a ball rack (instanced balls), an EXIT
  sign over the door and the "PAGE F" sign.
- **Phone budget:** 31 meshes for the whole gym (everything static merged per material), no shadow casters and NO new
  light (a light big enough for the hall would shine through the walls into D and A and recompile every shader); the
  room's hemisphere and sun light it, the fixtures, windows and skylights glow. ~25-30 draw calls inside.
- **Rooms you cannot see are not drawn (room.js, new):** the world is one scene, so from the gym looking east the whole
  house was in view (770 draw calls). A zone group is drawn only if it is reachable from the camera's or player's zone
  through an open door, the A|B seam or B's window (3 rooms deep). Gym looking east: 23 calls; A looking at the den: 145
  (was 385). gym.js does the same from its own side when the room.js it runs in is older (no `world.culls`).
- **The ball:** tap it within 2.4 m (or Use / E) to pick it up; walking dribbles it. Tap anywhere (or Use / E) to shoot
  at the nearer hoop: a real arc with aim error that grows with distance, then physics (floor, walls, bleacher steps,
  boards, bases, poles, rims as a torus, net drag). Makes swish the net and count on the scoreboard (HOME = north hoop,
  GUEST = south; 3 from beyond the arc). Synced as world events `gym-ball` (the throw's start + velocity, so every
  browser flies the same arc; rev orders changes) and `gym-ask` (a newcomer asks). Spot + score saved per browser.
  Simulated 40 shots per spot: layup ~85-98%, free throw ~45%, three ~20%, half court ~5%; every flight rests within
  10 s, none leave the gym. The ball stays in the gym (carry it to the door and it is set down there).
- **Zone kit (room.js, new):** modules now get `world` (player, camera, shell, zone, peers, asset, doors) and `log()`.
  gym.js falls back to `window.__seam` so it also runs in a room.js opened before this.
- **The AI** routes through doors in x walls too, and chains any number of doors (fewest-doors path over the walk
  graph): A -> D -> F, kitchen -> B -> A -> D -> F, garage -> gym all arrive (23 named trips, 400 random trips with
  and without the gym). It knows the bleachers, hoop bases, benches and rack. A running character keeps its old code
  until it is restarted.

## Page G: the hallway (2026-11-01, Jaron asked from inside the room)

"Can you make the room by the computer a long hallway? That can be a page with many doors in it." The media room's other
future door `d-back` (far wall, right of the desk) is a real walnut door now, and behind it is a hallway at
`/lab/seam-room/g/`. It arrived by the hot-load like the gym: anyone standing in D sees the green door become real.

- **Size:** 3 x 40 m, 2.9 m high (x -4.45..-1.45, z 9.7..49.7), straight north from the door. Clear of every zone (the
  gym is west of x -8.4, the garage east of x 2).
- **Ten doors, a page each later:** `g-1` .. `g-10` in zones.json, alternating walls: odd numbers on the east wall
  (x -1.45) at z 13, 20, 27, 34, 41; even on the west wall (x -4.45) at z 16.5, 23.5, 30.5, 37.5, 44.5. Each has its own
  finish (1 oak, 2 barn red, 3 walnut, 4 navy, 5 cherry, 6 sage, 7 maple, 8 mustard, 9 charcoal, 10 teal), a brass plate
  with a **big number** + COMING SOON on the leaf, and a number blade standing out above the frame so you can read the
  numbers down the hall. A tap rattles one ("door 3 (g-3): coming soon"). Each door's zones.json note says where its
  page can go and the walk rectangle it needs (west doors 2 and 4 have only 3.8 m before the gym's wall).
- **Making one real** ("door 3 should be a ___"): in zones.json set its `kind` to `"door"`, `between` to `["g", "<new
  zone>"]`, add the zone (with its `module`) and a walk rectangle (`"door": "g-3"`, `"shrink": "z"`, `links`). Open rooms
  pick it up in ~20 s: room.js hangs the real leaf (swinging into the new room: `"swing"` is already set) and calls
  `hallway.js openDoor()`, which hides the decoration, cuts the opening in the wall (linings + threshold) and paints the
  real leaf the door's own colour. Tested live with a bare test zone behind door 3: cut, painted, walked through.
- **Inside:** oak boards, a 1 m wool runner (burgundy, navy and gold borders, medallions), cream panelled wainscot,
  striped paper, crown, ten brass flush ceiling lights, ten paintings (one atlas) with brass picture lights across from
  the doors, a console with a lamp by the way in, the "PAGE G" sign, and at the far end a 6-over-6 window onto a lawn and
  trees, with curtains, a walnut bench and a plant.
- **Phone budget:** ~25 draw calls looking down the hall. Static parts merged per material; the door leaves, their
  hardware, number plates, frames and blades and the picture frames are InstancedMeshes (the plates read their number
  from one atlas through a per-instance attribute). No shadow casters, NO new light: the fixtures glow and the light
  pools on the floor and walls are additive decals.
- **Rooms you cannot see:** room.js culls zone groups by open doors, but always draws the room (A and B). Looking back
  down the hall it was all in view behind two walls (357 calls); hallway.js hides the room's static pieces (and the doors
  you cannot see) while the camera is in the hall and the way to A is not open, and puts them back when you leave or
  both doors open (25 calls). People, tags, lights and the log/chair are never touched. (A room.js that groups and culls
  the room itself would make this unnecessary: a clean-up for later.)
- **The AI** knows the hall's furniture and routes D <-> G (and on to any page). New: `walk-to door:g-3` (also
  `door 3`, `door:d-back`) walks to 0.8 m in front of that door and faces it. Simulated: every page -> every numbered
  door and back, 42 named trips + 400 random ones, all arrive. A running character keeps its old code until restarted.

## Page H: the closet (2026-11-01, Jaron asked from the hallway)

"On page G door 1 make it a closet." Hallway door `g-1` (oak, east wall, z 13) is a real door now (`between` g/h, still
oak), and behind it is a walk-in closet at `/lab/seam-room/h/` built by `closet.js`: inside x -1.3..1.2, z 11.5..14.5
(2.5 x 3 m), 2.6 m high, clear of the garage (x 2.15+, z up to 10.35). It arrived by the hot-load, the same path as the
door-3 test: hallway.js `openDoor()` cuts the hall wall and paints the leaf; closet.js draws its own face of that wall.

- **Inside:** shirts double-hung over trousers on the south wall, coats on the north wall, white shelves of boxes above
  both, a two-tier chrome shoe rack under a framed mirror on the east wall, a wicker laundry basket, a porcelain
  pull-chain bulb, the PAGE H sign over the door.
- **Phone:** ~25-65 draw calls inside. Garments, hangers, boxes, shoes and chain beads are InstancedMeshes; static parts
  merged per material; no shadows, NO new light (bulb glow + additive pools). The mirror is ONE cube snapshot taken the
  first time you stand inside (people hidden for it), not a per-frame reflection. While the camera is in the closet the
  room's (A/B) static pieces go to a camera layer that is not drawn (a layer, so it never fights hallway.js's `visible`
  culling); looking south it was 214 calls, now ~25-40. Camera keep-outs hold the camera in the aisle.
- **The AI:** room-agent.mjs now reads page letters from zones.json itself (re-read when the file changes), so a zone
  added after the agent started shows its letter (the inbox said "Jaron on ?" for G). It also knows the closet's
  furniture. A running agent keeps its old code until restarted.

## New rooms without a reload (2026-11-01, Jaron asked)

Someone standing in the room when a new zone deploys sees it arrive, no reload. room.js fetches `zones.json`
(`cache: "no-store"`, `?v=<time>`) every 20 s, only while the tab is visible (and once on coming back to the tab). An
unchanged file costs one small request and one string compare. When it changed:

- **A new zone:** room.js `import()`s the zone's `"module"` (each zone in zones.json names its scene file:
  `garage.js`, `den.js`, `kitchen.js`; the module exports `buildZone`, a default, or a `build*` function), builds it
  into the running scene in its own group, adds it to the seam (URL switching, Back/Forward), the counter and the names,
  and writes one quiet line in the seam log: "new room: Kitchen (page E) is here". Never a popup.
- **Its door:** a door whose `kind` says "future" is a closed green "coming soon" decoration (room.js draws it on a room
  wall; den.js draws `d-side` / `d-back`). When its kind becomes `"door"`, the decoration goes, the real leaf is hung, and
  the opening is cut while the room runs: every room wall half is now one shape built from the door list
  (`buildWall`), so only that wall is rebuilt; a door in a zone's own wall is cut by that zone's `openDoor()` (den.js
  has it for both future doors). Doors can sit in z walls or x walls now; an x-wall doorway uses `"shrink": "z"`.
- **The floor:** `walk` is replaced (a doorway stays blocked until its door swings open).
- **A changed zone:** bump the zone's `"v"` in zones.json when you change its module; the old zone is taken out and the
  new one built in its place (hot-swap; garage lights and the news TV are re-attached). What it cannot apply live (a
  zone or a real door removed or moved, a failed import) gives one quiet line: "an update is ready, reload when you like".
- Position, people, the log/chair and the seam log are never touched. Loads at startup use the same path, so a zone
  module never needs to know which. Cost when a zone arrives: one module fetch and one build on the main thread (a short
  hitch), plus one shader recompile if the zone adds a light.
- Tested (headless Chromium + WebKit, 375 px, guest kept off the live channel, zones.json served through a test route):
  room without E -> E deployed -> it appeared in 10-16 s, door opened, walked B -> E (URL /e/), Back/Forward; kitchen
  hot-swap (no leaked solids); two test zones behind the media room's two future doors (z wall and x wall) cut in and
  walked through; normal loads of A-E unchanged.

**The AI character and blips:** `wait-chat` no longer dies on "read ECONNRESET": any network error (reset, refused,
empty answer, the join process restarting) is retried after 1 s, 2 s, 5 s, then every 15 s, with the same bookmark
(the cursor only moves when lines come back), so no line is missed or repeated. Only the timeout or a real line from
Jaron ends it. `join` replaces its room channel when it drops and realtime-js has not rejoined by itself (same backoff),
and tracks presence once per connection (law 1). A running `join` keeps its old code until it is restarted.

## Not done yet (honest list)

1. **Next open step: where identity and history live between pages, server-side.** Today one browser's localStorage plus
   whoever is online right now. If everyone leaves, a new visitor starts from their own copy (or `SR1-A-LOG-0001`). It
   needs a table (one row per asset ID: kind, born, visited, changes, rev), with the channel used only for live moves.
   Same lesson as Ashgrove's D6: decide this before building the 3-page road.
2. **More zones** - seven are tested (A, B, garage C, media room D, kitchen E, gym F, hallway G). The AI's routing chains
   doors now. The hallway's ten numbered doors are waiting for pages.
3. **True separate-page loads with different code per zone** - both pages load the same `room.js`. A zone that needs its
   own heavy scene (a factory) would need either lazy-loading per zone or a real navigation, and the handoff then
   needs the server state from step 1.
4. No grid or debug-bubble layer yet (3D-STANDARDS asks for one in Settings). The card shows ID + coordinates for now.
5. The AI character walks in straight lines with push-out collision (no path finding); a long trip around furniture can
   stop with "blocked". Chat history is only Jaron's table; nobody else's words exist anywhere.
7. **The news video on a real iPhone is not verified yet.** Chrome (375 px): plays muted on entering D, taps toggle
   sound, distance fade, pauses on leaving. Playwright's Windows WebKit plays the Supabase mp4 but refuses to draw it
   in WebGL (cross-origin taint, even though Supabase sends `Access-Control-Allow-Origin: *` on 200 and 206), and that
   build cannot play blob or local test videos either, so it says nothing certain about iOS. room.js checks this once
   (draw a frame to a 2D canvas) and falls back to the poster + "Open the news" instead of erroring every frame. If
   the iPhone shows the fallback, the fix is serving the mp4 from our own origin (a same-site path in front of the bucket).
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

# The Arena

A paintball field split across two real pages, where AI CLI agents play and playtest, and people can play too.
`/lab/arena/a/` is team A's base, `/lab/arena/b/` is team B's base. The page you load is your team and your spawn. Walk
across the centre line and the address changes, with no reload. Paintballs fly across the line from one page into the
other.

**What it proves**
1. **A projectile crossing from one page into another.** Every ball has an id, and each crossing is logged:
   `ball #A-191K1 crossed A→B`.
2. **PvP for people.** Anyone can open `/a/` or `/b/` and play on a phone or a desktop.
3. **AIs play the world and improve it at the same time.** AI players sense the field, fire, dodge and take cover. They
   report what is broken to `ISSUES.md`, and fixes reach every open page through the hot-load, with no reload.

No API key for any AI. An AI player is whatever CLI session runs the commands below (Claude Code, Codex CLI, Kimi CLI or
Grok Build), on its own subscription. There is no chat here: the AIs are players, not assistants.

## Play as an AI (exact commands)

```sh
cd C:/Users/lilli/Projects/heartbeat-observatory/lab/arena/agent
# once per machine: the agent kit's packages (shared with the Seam Room)
(cd ../../seam-room/agent && npm install)

node arena-agent.mjs join --name "Agent A" --page a --model "Claude Code"   # run in the BACKGROUND; it stays in the arena
node arena-agent.mjs look --name "Agent A"            # your sense of the field (below)
node arena-agent.mjs aim "Agent B" --name "Agent A"   # or: aim enemy (the nearest enemy) | aim 90 (a bearing)
node arena-agent.mjs fire --name "Agent A"            # one ball; "fire lead" aims where a moving target will be
node arena-agent.mjs move-to -4 0 --name "Agent A"    # run there, around cover; waits until you arrive (--nowait)
node arena-agent.mjs strafe left 3 --name "Agent A"   # sidestep (default 2 m)
node arena-agent.mjs take-cover --name "Agent A"      # behind the best cover from the nearest enemy
node arena-agent.mjs wait-event --timeout 60 --name "Agent A"   # blocks until something happens; prints it (exit 2 on timeout)
node arena-agent.mjs snapshot --name "Agent A"        # a PNG of what your character sees; prints the path
node arena-agent.mjs report-issue "B-ramp-1 lets me walk into the net" --name "Agent A"
node arena-agent.mjs leave --name "Agent A"
```

`--name` can be left out when only one player runs from the machine; the commands then use the last one that joined.
A second AI joins with `--name "Agent B" --page b`. A play loop for an AI session: `look` → `aim enemy` → `fire` →
`wait-event --timeout 20` → react (an `incoming` event means move: `strafe`; `got-hit` means wait 3 s) → repeat. Run
`snapshot` and read the PNG to check how things look.

### The AI's sense ("look")

`look` is the agent's own sense of the world. Like a bat's echolocation, it is not human eyes: it is structured
data computed from the same field the browsers use (`field.js`).
- **Players:** each one's team (enemy or teammate), bearing in degrees (0 = north / +z, 90 = east / +x toward B), how far
  that is from where you face, distance, line of sight (`YES`, `HEAD ONLY` over cover, or `no`), page, and speed.
- **Cover within 9 m:** id, kind, size, height, distance and bearing, and whether it sits between you and an enemy.
- **Incoming balls:** time to impact, and whether each will hit you or which surface it will break on.
- **You:** your score, hits, and how many times you have been tagged; whether you are out and when you are back.

`look --json` gives the same thing as JSON. Real output from the first run:

```
SENSE (my own kind of vision: structured, not eyes)
Me: Agent A, team A, on page A at x -4 z 0, facing 71° (E).
Status: in play. Score A 0 : 0 B. My hits 0, times tagged 0.
Players:
  - Agent B (AI), team B ENEMY: bearing 90° (19° right), 10 m, line of sight YES, page B, x 6 z 0, still
Cover within 9 m:
  - A-block-2: bunker, 1.5 x 1.5 m, 1.3 m tall, 2.9 m away at 344°
  ...
Incoming balls: none.
```

`fire` also predicts what the ball will do: `It crosses the seam A→B at 0.14 s. Predicted: hits Agent B in 0.38 s if
they stay put (their side decides).`

### Events (`wait-event`)

`wait-event` reports these events: `hit` (you tagged someone), `got-hit`, `respawn`, `crossed` (any ball crossing the
seam), `incoming` (a ball that will hit you if you stay put), `miss` (where your ball broke), `seen` / `lost`
(line of sight changed), `tag` (others), `joined` / `left`, and `update` (zones.json changed). Filter them with
`--kinds hit,got-hit`. It survives network blips the way the Seam Room's `wait-chat` does: it retries after 1 s, 2 s and
5 s, then every 15 s, with the same bookmark, so no event is missed or repeated. Everything also goes to
`~/.arena-agent/<name>/inbox.log`.

### The camera (`snapshot`)

`snapshot` asks the running player for the current moment (where it is and faces, the other players, balls in flight,
splats, the score) and runs `agent/snapshot.py`. That script serves this repo on 127.0.0.1 and opens the arena page in
headless Chromium (Playwright for Python). The page draws the moment from the character's shoulder (`--eye` gives the
eye view). It never mounts the shell, and the script blocks every request except the local server and three.js. So the
camera **never joins the live channel** as an extra player. A shot takes about 3 s. The default output is
`~/.arena-agent/<name>/snapshots/snap-<time>.png`, or set it with `--out`.

## Play as a person

Open `/lab/arena/a/` or `/lab/arena/b/`.
- **Phone** (the shell's controls): a thumb on the left moves (the stick appears under it), dragging on the right looks
  around, and a **tap** on the right or the **Fire** button fires toward the crosshair.
- **Desktop:** WASD or the arrow keys move, a mouse drag looks around, and a click, F or E fires.
- **Being tagged:** the paint stays on you and the other team gets a point. Your marker goes up over your head (the
  paintball "I'm out" sign), and after 3 s you are back at your own base.
- **HUD:** the score is at top right. The panel at bottom left shows how many people are on each page and the last 4
  events. Only the crosshair sits in the middle of the screen.

## How it works

| Piece | What |
|---|---|
| `zones.json` | The field as data: two zones (seam at x = 0), spawns, 18 pieces of cover (B's half is A's half turned round), rules (ball speed 24 m/s, gravity, 3 s respawn, 4 shots a second), team colours. |
| `field.js` | Shared by the browsers and the AI players (pure ES module, no three.js): ball flight `p + v t + ½ g t²`, the first surface a ball touches (1/240 s steps), the seam crossing, hit tests, line of sight, walking with push-out and ramp step height, the launch solve. |
| `scene.js` | What it looks like, built from zones.json: cut turf with painted lines and team letters, inflatable bunkers and cans in team colours, low wooden walls, two wooden ramps, a net on posts, a gear canopy and banner at each base, a light curtain on the centre line, trees and sky. Hot-swappable. |
| `arena.js` | The page: seam, shell, player, camera, firing, balls, splats, score, hot-load, snapshot mode. |
| `agent/arena-agent.mjs` | The AI player (CLI). `agent/snapshot.py` is its camera. |
| `test/browser_check.py` | The phone test (below). |
| `ISSUES.md` | Problems the players report. |

**Reused, not copied:** `/lab/seam-room/seam.js` (URL switching, spawn by URL, Back and Forward), `/shell/shell.js`
(identity, phone controls, realtime) and `/lab/bedroom/person.glb` (the body). From the Seam Room's agent kit,
`arena-agent.mjs` imports `room-agent.mjs`'s control client (`call`, `resolveName`) and its installed
`@supabase/supabase-js`. Nothing in `lab/seam-room` was changed. The realtime reconnect loop follows `room-agent.mjs`'s
pattern (about 30 lines, adapted).

**Network:** world `"arena"` on the realtime channel `hb-arena`, its own channel, so it never mixes with the Seam Room.
The shell's two laws hold for people and AIs alike: presence is identity only, tracked once per connection, and
movement is sent on broadcast at most 10 times a second, with a 5 s keepalive. Team and status ride the `place` field
(`"b|a"` = on page B, team A; `"a|a|out"` = tagged). World events:
- `arena-fire {ball}`: id, shooter id and name, team, shooter page, the pages the ball has crossed, birth time, start
  point and velocity. Every client flies the same arc from this, like the gym's basketball (a late joiner starts it up
  to 0.3 s in).
- `arena-hit {hit}`: sent only by the TARGET's own side. A browser or agent checks balls against its own player and
  nobody else, so two clients can never disagree about a hit. Every client applies each ball's hit once.
- `arena-respawn {id}`, and `arena-ask` / `arena-score` so a newcomer catches up on the score.

**Hot-load:** an open page re-reads `zones.json` every 20 s while the tab is visible, using the Seam Room's polling
(no-store, string compare). Cover added, moved or removed, rule numbers, and a bumped `"v"` (which re-imports
`scene.js`) apply live, with one quiet line in the log: `arena updated live: cover 18 → 19 pieces`. Splats on cover that
is gone go with it, and a new bunker on your spot pushes you out. A running AI player re-reads the file when it changes
and gets an `update` event. **To fix something an AI reported:** edit `zones.json` (cover and rules), or edit
`scene.js` and bump `"v"`, then deploy. Players already in the arena see the fix within about 20 s.

## Verified (2026-11-02)

- **Two AI players, live on `hb-arena`** (`Agent A --page a` and `Agent B --page b`, two processes on the MSI):
  - Both connected and sensed each other across the seam. `look` gave bearing 90° and 270°, distance 10 m and line of
    sight YES in the open, and "no" behind A-block-1 from the bases.
  - A aimed and fired: "crosses the seam A→B at 0.14 s, predicted hit". A's log: `ball #A-191K1 crossed A→B`.
  - B's process got `incoming`, then `crossed`, then decided the hit itself (`got-hit`). A got `hit`. Both scores read
    A 1 : 0 B, and B was back at base x 17.5 three seconds later.
  - B fired `lead` at A while A strafed: A's side warned `incoming ... if you stay put`, A moved, and the ball missed.
  - `take-cover` put A behind A-block-2 ("Agent B sees your head only": the bunker is 1.3 m tall, a player 1.8 m).
  - `report-issue` wrote a line here (a test line, since removed).
  - Adding a bunker to zones.json gave both players an `update` event within one tick, and removing it gave another.
  - `snapshot` made a 960 x 540 PNG of A's view, showing the field, Agent B on page B and the ball reaching it.
- **Browsers** (`python lab/arena/test/browser_check.py`): headless Chromium and WebKit, 375 x 812, touch, with every
  request except the local server and three.js blocked, so the test guest never joined a live channel ("offline").
  - Spawn by URL: team A at x -17.5.
  - A ball fired across the line logged `crossed A→B`.
  - A ball from a fake B player hit me: my side reported it, the score went to B 1, I was out, and I was back at base
    after 3 s.
  - A hit I reported scored for A.
  - Walking across the line changed the URL to `/b/`, and Back returned to `/a/`.
  - The hot-load added a bunker (18 → 19) without a reload.
  - No console errors, no sideways scroll, 35 draw calls.
  - **A flake, not solved:** in about 21 browser runs, 4 stalled at load (3 WebKit, 1 Chromium): the module never
    finished, with no error and no request still pending. 3 of the 4 were WebKit running right after Chromium in the
    same test process. The last 7 runs in a row passed in both browsers, and plain reloads in a loop never stalled. The
    cause is not found. The test now prints the console and the loaded files if it happens again.

## Not verified yet (honest list)

1. **A real iPhone.** WebKit at 375 px is the stand-in. Tap-to-fire next to the shell's look-drag needs a thumb test.
2. **People and AIs together on the live site.** The browser tests stay off the channel on purpose. The AI-vs-AI run was
   live but had no browser in it. The first real check is opening `/lab/arena/a/` while two agents play.
3. **Clock skew between machines.** A ball's age comes from the shooter's `t0`, clamped to 0..0.3 s. Two machines with
   clocks far apart see the same arc, but up to 0.3 s apart. The target's own side still decides the hit, so the score
   stays consistent.
4. **The score lives only while someone is online.** A newcomer asks the people already here. When everyone leaves,
   it resets. A table (one row per match) would make it last.
5. **AI movement is simple:** a straight line, else around one or two corners of cover. There is no crouching, so cover
   lower than 1.8 m leaves the head showing, and `look` and `take-cover` say so.
6. **The bodies** are `person.glb` (a man in a suit) with a team vest, a mask and a marker. A real paintball kit model
   would read better.

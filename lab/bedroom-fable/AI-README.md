# Bedroom lab v2 (Fable) - how an AI reads this scene

One doorway, three ways in. Everything the page shows comes from the same record, so what you read here is what a
viewer sees. Written by Claude Fable 5.1 for the 2026-10-26 engine bake-off.

## 1. The file: `history.json`
A snapshot of one recorded session (the same shape the live page keeps in memory). Top level:

```
scene        "bedroom-fable"
version      2
t0_iso       when the session started (UTC)
t_now        seconds since the page loaded when the snapshot was taken
units        position = metres, y up, floor at y=0, door wall at x=-1.45; time = seconds since page load
provenance_key   what seen / rebuilt / made / unseen mean (below)
objects      { id -> object }   every thing in the room that can be tapped
events       [ event, ... ]     everything that happened, in order
tracks       { "PERSON-001": [[t, x, z, speed_mps, yaw_rad], ...] }   the man's path, sampled every 0.2 s
```

### Objects (`objects`)
Each has `id`, `label`, `kind` (surface | door | room | person | camera) and `provenance`:

| provenance | meaning |
|---|---|
| `seen` | what the camera saw. Two filmed frames of the Grok video, depth-filled. Solid. |
| `rebuilt` | built from evidence in the footage (depth, skeleton tracking, walk timing). Approximate. |
| `made` | constructed by our tools, never filmed: the far-right, near and door-back walls, the floor fill, the ceiling, the room beyond door 2, and the person himself. |
| `unseen` | never seen, kept faded and locked: the three doors. |

IDs: `ROOM-SEEN-01/02`, `FLOOR-MADE`, `CEIL-MADE`, `WALL-RIGHT-MADE`, `WALL-NEAR-MADE`, `WALL-FAR-MADE`,
`WALL-DOORS-BACK-MADE`, `DOOR-001..003`, `BEYOND-002`, `PERSON-001`, `CAMERA`.
Doors carry `state` (locked | unlocked). `BEYOND-002.state` is hidden until door 2 is unlocked.

### Events (`events`)
Every event: `id` (E-0001...), `t` (seconds), `type`, `object` (who it happened to), plus fields per type:

| type | fields | meaning |
|---|---|---|
| `scene_start` | objects, seen_triangles_dropped | page loaded; how many torn triangles the tear-fix removed |
| `walk_start` / `stop` | position, heading_deg, target | the man set off / stopped to turn |
| `footstep` | foot (L/R), position [x,0,z], speed_mps, yaw | one planted foot; drawn as a tappable footprint |
| `door_tap` | result, position | someone tapped a door ("Locked - not seen yet" or "unlocking") |
| `door_unlock` | target=BEYOND-002, note | door 2 opened; the room beyond is MADE |
| `arrived` | position, target | the man reached the made room (game demo) |
| `quest_done` | door, seconds, steps | the game moment finished |
| `tap` / `foot_tap` | panel / target | a viewer opened an object's history |
| `view_mode` / `view_follow` / `sound_on` | mode / on | viewer settings (recorded, because they change what was seen) |
| `replay_start` / `replay_end` | to_t | the timeline was dragged back to a past moment |
| `demo_start` / `demo_end` | demo, seconds | one of the use demos ran (game, movie, music, show) |
| `beat_from_steps` | bpm, steps_used | the music demo derived a tempo from footstep timing |
| `narration` | line, text | the show demo spoke a line built from this same record |

Honesty rule in the data: nothing in `events` is interpolated. Between two track samples the page draws a straight
line; if you need a position at an unsampled time, say it is interpolated.

## 2. Live, in the page: `window.HB`
Open the page, then (console, Playwright, or any bridge that can evaluate JS):

```js
HB.history()                 // the whole record, same shape as history.json
HB.trace_object('PERSON-001')  // { object, events: [...only his...], track }
HB.events_between(10, 20)    // every event with 10 <= t <= 20
HB.describe()                // one plain-English paragraph of the session so far
```
Those are the same three verbs hb-render's MCP server uses (`trace_object`, `events_between`), so a tool built for one
works on the other. Adding an MCP wrapper is one file: call the page headless, evaluate the function, return the JSON.

## 3. Questions an AI can answer from this file alone
- "Where was he at 12 s?" -> nearest `tracks.PERSON-001` samples around t=12 (say: interpolated).
- "How fast does he walk?" -> `speed_mps` on footsteps, or distance/time from the track.
- "What did the viewer do?" -> `door_tap`, `tap`, `view_mode`, `replay_start` events.
- "What in this room is real?" -> `objects[*].provenance`: nothing here is a real place; `seen` means seen in an
  AI-made video, and the person is `made` (AI-generated, not real).
- "Why is there a room behind door 2?" -> the `door_unlock` event's `note`.

## 4. Limits (so you don't over-claim)
- The room's scale comes from an assumed 0.9 m doorway width; the ceiling height (2.5 m) is a guess from the 2.03 m doors.
- The rig is 17 joints; the walk is a measured cycle from one Grok clip, not motion capture of a real person.
- `tracks` keep the last ~10 minutes (3000 samples); `events` keep the last ~4000.
- The page never phones home: the record lives in the viewer's browser until something exports it.

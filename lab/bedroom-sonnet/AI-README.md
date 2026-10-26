# AI-README: Bedroom v2 (sonnet) - read a scene and its event history

Made by Claude Sonnet 5.5 for the Heartbeat Observatory engine bake-off (2026-10-26). This page is a closed 3D bedroom with one
AI-generated man in it. Everything that happens in it is written to ONE event history. Any AI can read it through one plain door.

## The doorway (pick one)
1. **File:** `history.json` in this folder. A real recorded run: 66 s, ~214 events, 188 entities, the man's track at 10 Hz.
   Same events as `history.jsonl` (hb-render format `hb-history/1`: one `{"k":"ev",...}` per line + one `{"k":"s"}` track line), so the
   hb-render tools (`trace_object`, `events_between`) can read it.
2. **Live, in the page:** `window.HB` (open `index.html`, then use the console or an automation tool):
   - `HB.entities()` - every id with kind, label, basis
   - `HB.story("P-0001")` - the touch-it-and-see view: plain-language summary + every event that touches the id + ids it caused
   - `HB.eventsBetween(t0, t1, {e:"planted", id:"D-0002"})` - what happened in a time window (filters optional)
   - `HB.where(t)` - where the man was at time t (x, z, yaw, which floor)
   - `HB.snapshot()` / `HB.jsonl()` - the whole live history, same shape as `history.json`
   - `HB.unlockMiddleDoor()` - do what a tap does (logged as an event caused by `C-0001`, "you")
   In the UI: tap anything, then "{ } JSON" in the sheet shows `HB.story(id)` for that object.
3. **MCP:** `C:\Users\lilli\Projects\hb-vision\bake\sonnet\mcp\server.mjs` (stdio, no dependencies). Tools: `scene_info`,
   `trace_object(id)`, `events_between(t0,t1,e?,id?)`, `where_was_he(t)`. It reads `history.json`.
   Client config: `{"command":"node","args":["C:/Users/lilli/Projects/hb-vision/bake/sonnet/mcp/server.mjs"]}`.
4. **Shot list:** `shots.json` - the camera plan the Film mode uses, written from the history (an AI can write a different one).

## Ids
`P-` person, `F-` footstep, `S-` sound, `D-` door, `O-` seen object (bed, window wall, seen floor), `M-` made thing (shell, nightstands,
bed skirt, the room behind the middle door), `C-` the viewer, `E-` an event (`eid`).

## Event fields
`{eid, t (s), id (who/what it is about), e (verb), target, p [x,y,z] metres, v [vx,vy,vz], parent (what caused it), children (ids it caused),
basis, place, snd, note}`. Coordinates: x toward the headboard wall, z toward the unseen +z wall, y up. The door wall is x = -1.36.
Verbs: `seen built planted sounded walked_past tried_door paused tapped unlocked opened entered left answered`.
Chain example: `C-0001 tapped D-0002` -> `D-0002 unlocked` (+ chime) -> `D-0002 opened` (creak) -> `M-0005 built` (the made room)
-> `P-0001 entered M-0005` -> footsteps `F-####` with `place: "made-room"`.

## The honesty rule (read before you quote anything)
`basis` is **seen** (the camera saw it), **rebuilt** (rebuilt from evidence: his walk cycle is tracked from a video) or **made**
(built by our tools, never seen). Footsteps on the part of the floor the camera passed over are `rebuilt`; footsteps anywhere else
(`place` = `made-floor` or `made-room`) are `made`. The man's body is AI-generated (not a real person); his route is scripted by us.
The unseen wall, ceiling, nightstands, headboard, bed skirt and the whole room behind the middle door are `made`, and the page shows
them in teal under "Made". Never describe a `made` thing as something that was seen.

## Time and replay
`sim.t` is seconds since load. The page view is a pure function of (history, time): scrub the timeline strip and the man, doors,
footprints and sounds replay from the recorded events. Game, Film, Music and Show modes read only this history.

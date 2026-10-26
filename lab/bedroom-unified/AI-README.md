# AI-README: Bedroom v3 (sonnet, patched) - read a scene and its event history

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
3. **MCP:** `C:\Users\lilli\Projects\hb-vision\bake\sonnet\mcp\server3.mjs` (stdio, no dependencies). Tools: `scene_info`,
   `trace_object(id)`, `events_between(t0,t1,e?,id?)`, `where_was_he(t)`. It reads `history.json`.
   Client config: `{"command":"node","args":["C:/Users/lilli/Projects/hb-vision/bake/sonnet/mcp/server-unified.mjs"]}`.
4. **Shot list:** `shots.json` - the camera plan the Film mode uses, written from the history (an AI can write a different one).

## Ids
`P-` person, `F-` footstep, `S-` sound, `D-` door, `O-` seen object (bed, window wall, seen floor), `M-` made thing (shell, nightstands,
bed skirt, the room behind the middle door), `C-` the viewer, `E-` an event (`eid`).

## Event fields
`{eid, t (s), id (who/what it is about), e (verb), target, p [x,y,z] metres, v [vx,vy,vz], parent (what caused it), children (ids it caused),
basis, place, snd, note}`. Coordinates: x toward the headboard wall, z toward the unseen +z wall, y up. The door wall is x = -1.36.
Verbs: `seen patched built planted sounded walked_past tried_door paused tapped unlocked opened entered left answered`.
Chain example: `C-0001 tapped D-0002` -> `D-0002 unlocked` (+ chime) -> `D-0002 opened` (creak) -> `M-0005 built` (the made room)
-> `P-0001 entered M-0005` -> footsteps `F-####` with `place: "patched-room"`.

## The honesty rule (v3: four labels)
`basis` is **seen** (the camera saw it), **rebuilt** (rebuilt from evidence: his walk cycle is tracked from a video),
**patched** (made from pieces the camera did see, placed where it did not) or **made** (invented, no pixels from the footage).

**Patched things carry their source.** Entities `Q-0001..Q-0013` and the study `M-0005` have `source.pieces[]`: each piece has the
texture name, the **source frame** (`v1/f0040.jpg`, from `hb-vision/out/rooms/grok-bedroom/frames/`), the **pixel rectangle**
`[x0,y0,x1,y1]` it was cut from, and the method (Efros-Freeman image quilting for plaster/floor/ceiling/trim/wood/fabric/linen, GrabCut
cut-out for the real lamp, a straight crop for the window view). `patches/sources.json` is the whole table; `HB.story("Q-0008")`
returns it with the entity. In the page, tap a patched surface and the sheet shows the frame with the rectangle drawn on it.
- `Q-0001` plaster walls, `Q-0002` the unseen +z wall, `Q-0003` floor outside the filmed strip, `Q-0004` ceiling (wall plaster placed overhead),
  `Q-0005` baseboards, `Q-0006/7` nightstands, `Q-0008/9` the real lamp (right one mirrored), `Q-0010` bed end + pillows, `Q-0011` headboard,
  `Q-0012` door frame + leaf, `Q-0013` window on the unseen wall, `M-0005` the study behind the middle door (surfaces patched).
- Still **made**: `M-0004` bed skirt, `M-0006` study furniture (desk, computer, chair, shelf, rug), `M-0007` ceiling light.

Footsteps: the contact is a scripted action, so `basis: "made"` always; `floor_basis` says what is under it (`seen` or `patched`) and `place` says where (`seen-floor`, `patched-floor`, `patched-room`). The man is AI-generated (not a real person); his body is rebuilt from a tracked walk, his route is scripted by us. The toggle is Seen / Patched / Made / All; **Seen hides everything invented** (the person, footsteps, path, door overlays and every patched or made piece).

## Time and replay
`sim.t` is seconds since load. The page view is a pure function of (history, time): scrub the timeline strip and the man, doors,
footprints and sounds replay from the recorded events. Game, Film, Music and Show modes read only this history.

## Unified base additions (read these too)
- Default view is the **evidence view** (most of the original photo); `HB_CONFIG.camera` holds both presets.
- Steps: `basis: "made"` (the contact is scripted) plus `floor_basis: "seen" | "patched"` (what the floor under it is).
- `HB.selfTest()` (replay appends nothing, unique ids, patched entities name frame + rect, parents resolve), `HB.grounding()` (sole height + planted-foot slide), `HB.why(id)` (cause chain), `HB.download()`.
- MCP: `C:\Users\lilli\Projects\hb-vision\bake\sonnet\mcp\server-unified.mjs` adds `causal_chain(id)` and `patch_source(id)`.
- Seams for the next passes are listed in `HANDOFF.md`.

## Fix pass (Sol review): what changed in the data
- **Causal edges go by event id.** `cause` = the `eid` of the event that caused this one. `parent` = the actor or tool that did it (`P-0001`, `C-0001`, `tool:...`) and is never a cause. `origin` = `viewer-input | script | tool`. `HB.why(id)` / MCP `causal_chain` follow `cause` only; a chain ends at a root marker (`viewer-input`, `actor`, `tool`). An unrelated earlier tap can never appear in another action's chain; a code-requested unlock gets its own `triggered` event (`T-0001`).
- **Ids are per piece.** `D-0002` is only the filmed doorway; the replacement slab and trim are `Q-0012`, the invented knob is `M-0008`; the viewer `C-0001` is `basis: made` (input, not footage).
- **Sound ids are reserved** before listeners run: each step's `children[0]` is its own contact sound (`snd.k = step`, `cause` = the step). Music layers are appended as further children, each with `cause` = the step.
- **Velocity is measured** (`v` = displacement per fixed step), track is exported at `track_hz: 10`.
- Study sources: `M-0005` lists `plaster`, `floor`, `plaster_ceiling`, `picture` (v1/f0050 [360,120,540,235]) and `trim` (v1/f0040 [228,20,258,215]).
- Checks: `HB.selfTest()` now has 16 checks (see HANDOFF.md); `HB.pickRay(...)`, `HB.layerState()` for tests.

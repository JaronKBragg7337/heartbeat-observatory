# Bedroom Sol — AI doorway

By GPT-6.1 Sol · Heartbeat Observatory · 2026-10-26.

## Read the scene

Serve this folder with any static HTTP server. The page has no accounts, backend, writes to external services or runtime CDN dependency. It is deliberately noindex and unlinked from the main site.

- `history.json` is a recorded, complete example session from the screen capture. It is a snapshot, not the current visitor's live history.
- In the page, **AI / JSON** opens the current session. **Download live JSON** exports all entities and events. The onscreen JSON preview deliberately abbreviates the arrays; the download does not.
- Browser console: `heartbeat.snapshot()` returns the complete current session.
- `heartbeat.traceObject('P-0001')` returns the walker and its linked events, including footprints.
- `heartbeat.eventsBetween(1, 4)` returns events in an inclusive time window, in scene seconds.
- `heartbeat.inspect('L-0001')` opens the lamp's Necklace panel. Every visible semantic object is pickable; meshes that form one furnishing share its ID.
- `heartbeat.replayAt(2, 'P-0001')` shows a wireframe marker at the latest recorded position at or before 2 seconds. The scrubber uses recorded samples, not an invented path through missing time. It is a location replay, not a replay of the original person's full pose.

No AI integration is privileged. Read JSON with any model or a normal parser. The optional read-only stdio MCP adapter is in `hb-vision/bake/sol/mcp_server.py`; it exposes `scene_info`, `trace_object`, `events_between` and `causal_chain` over this saved snapshot. It never controls the browser or reads another model's work.

## Schema: heartbeat.event-history/1.0

`entities[]` contains `{id, name, kind, provenance, position, velocity, parent, detail}`. IDs are stable within a scene/session; footprint IDs are assigned in order. Position is `[x,y,z]`, +Y is up. Distances are approximate metres using v1's 0.9 m doorway assumption; this is not a surveyed room.

`events[]` contains `{id, t, object, position, velocity, event, target, children, provenance}` plus optional fields:

- `cause` is the parent event ID. `children` holds caused event IDs; both directions agree.
- `rotation_y` is a made heading in radians.
- `sole_min_y` is the sampled deformed sole's floor clearance; it verifies grounding, not absence of foot sliding.
- `audible` records whether sound was enabled. Muted contacts still exist.
- `midi` records a score or wayfinding pitch.
- `note` explains the action and its provenance.

Examples of causal chains: `P-0001 foot_contact → FST-00001 contact → A-0001 footstep_sound`; `D-0002 tap → unlock_made → R-0002 constructed`. Shared IDs and t/position/velocity/event/target/children mirror hb-render's event vocabulary; source tracking in hb-vision/run.py uses richer frame/joint records and is not falsely claimed to be the same file schema.

Object prefixes: P = person, D = door, W = enclosing surface, F = floor, FST = individual foot contact, B = bed, T = table, L = lamp, N = window framing, A = audio, R = room/evidence, S = presentation base, E = event. The scene contains 20 semantic objects before footsteps. The complete current history stays in memory until reload; there is no silent truncation. Download to preserve it. Long sessions consume memory.

## Truth and source boundaries

This is a **constructed world** from Grok Imagine generated footage, not a real person's memory. The label “AI-generated person (not real)” remains attached to the character. The corner credit names the source and rebuilding tools.

- **seen** means a pixel exists in the generated source imagery; no rendered 3D surface is asserted to be directly seen or physically accurate.
- **rebuilt** means the reused depth/SfM geometry and Hunyuan3D-2mini synthetic person. Their geometry is approximate.
- **made** means the closed shell, repaired furnishings, route, new actions, footsteps, audio, care log and listening alcove. A rebuilt asset may participate in a made action; event provenance is distinct from asset provenance.
- **not seen** means all three original spaces beyond the thresholds. Opening door 02 makes a new design; it does not recover the original unknown room. Doors 01 and 03 remain locked.

The Seen / made lens colors rebuilt evidence blue and constructed parts amber. Default natural colors are labelled “Rebuilt + made.” The outside view is a labelled cutaway: two walls and the ceiling are hidden for inspection. **Step inside** restores all four walls and the ceiling. The made extension also has enclosing walls and a ceiling; its roof/front wall are hidden only in the cutaway. No real-video gap is filled by this page.

The room's torn lamps/nightstand and bed foot are clipped and covered with made geometry. The central source-textured duvet remains rebuilt. Do not describe the repair as recovered observation.

The walk uses the original GLB's gait animation and approximate rig, on a made path with timed turns. Sampled deformed sole vertices ground the character about 8 mm above the made floor. Contacts are simulated cadence events, not measurements of the underlying clip; residual skating and soft hands/face remain possible.

## Sound and demos

Sound stays off until a deliberate tap. Footstep/contact events produce synthesized footsteps; Sound guide adds pitched, spatial cues and foot-driven notes/light pulses. Care log records synthetic lamp checks. Design review unlocks a made alcove. USES.md lists the other possibilities.

## Reproduce / review

Processing and capture scripts live only in `C:/Users/lilli/Projects/hb-vision/bake/sol/`. `verify.mjs` runs touch and data-flow tests at 375 px; `--webkit` selects WebKit. `capture.mjs` captures deterministic frames from the actual page; `encode.py` makes the 1080×1920 H.264/AAC screen recording. Its audio is rendered from that exact event log, using the page's oscillator rules. Nothing is an AI-generated stand-in for the screen recording.

Three.js r160 and its matching GLTFLoader/BufferGeometryUtils are copied from the existing repository's r160 installation, including upstream MIT license comments. Version is pinned locally for offline reproducibility. Upstream equivalents:
`https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
`https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js`
`https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js`

Source GLBs and source-meta.json are copies of lab/bedroom v1. No shared source was edited. No commit, push or deployment was performed. Signed: GPT-6.1 Sol.

## Verification limits

The recorded QA at 375×812 passed in Chromium and Windows Playwright WebKit. This Windows WebKit build does not expose `AudioContext` or `webkitAudioContext`; the sound-unavailable fallback was checked there. Chromium Web Audio activation, score events, spatial cues and JSON export passed. Physical iPhone Safari and its audio output were not available for a device test. See the signed QA JSON in the Sol processing folder for exact results.

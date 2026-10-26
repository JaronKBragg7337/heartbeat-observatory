# Bedroom 02 AI doorway

Built and signed by **Kimi**.

This is a dependency-free JSON event history for the interactive bedroom. No MCP server or credentials are required.

## Read it

- Static seed: `GET /lab/bedroom-kimi/history.json`
- Live page: `/lab/bedroom-kimi/` (noindex and intentionally unlinked)
- In a browser console: `window.__debug.history.toJSON()` returns the current session, including footsteps, taps, sounds, unlocks, and position samples.
- The **Save history** button downloads that same live JSON as `bedroom-kimi-live-history.json`.

The static file is the initial scene, not a server-side event sink. A browser session records locally; export it to retain the live events.

```js
const history = await fetch('/lab/bedroom-kimi/history.json').then(r => r.json());
const door = history.objects.find(o => o.id === 'D2');
const firstEvents = history.events.filter(e => e.t <= 5);
```

## Format

`format` is `hb-history/1`. Time is seconds since this scene starts. Position is `[x,y,z]` in metres, Y up. Velocity is metres per second. Room scale is approximate because the source is generated footage, not a measured scan.

Each object has a stable `id`, human-readable `name`, `kind`, provenance `source`, and optional `parent` and `note`. Each event has:

- `id`: unique event ID, or a stable footstep/sound ID where appropriate.
- `t`: event time in seconds.
- `object`: object this event describes.
- `event`: verb such as `foot_contact`, `door_tapped`, `unlocked`, `sound_triggered`, or `score_note`.
- `position`, `velocity`: numeric XYZ arrays.
- `target`: what was affected, when applicable.
- `parent`: cause or owning object, when applicable.
- `children`: caused IDs, when applicable.
- `source`: `rebuilt`, `made`, or `not_seen`.

Traces contain `{id, rate, samples}`; each sample is `{t, position, velocity}`. Live capture keeps a rolling buffer of at most 1,200 person samples at up to 4 Hz. Film replay uses a separate short transform buffer and never manufactures in-between evidence.

## AI queries

To trace an object, select events where `object`, `id`, `target`, or `parent` equals its ID; join traces by `id`. For a time window, use `start <= t <= end`. Sort by `t`. Follow `parent` backward for causes and `children` forward for effects. Example: a footstep's parent is `P-0001`, its target is `FLOOR-0001`, and its child is the triggered sound ID.

## Honesty contract

- `rebuilt`: derived from Grok-generated source footage or images; not original camera pixels.
- `made`: constructed geometry, motion, interaction, or sound; never claimed as observed.
- `not_seen`: unknown; doors remain faded and locked rather than receiving invented content.
- Door `D2` opens only an explicitly `made` annex. It does not claim to reveal the real unseen room.
- `P-0001` is an AI-generated synthetic person, not a real person.

The page's same rules apply to games, replay, and music demos. Unknown must remain unknown.

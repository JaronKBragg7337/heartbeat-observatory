# The Hedge - traps and events

Any AI or person can add a trap by adding one entry to `traps.json` in this folder. No code change needed.
The game loads the file on start; if the file is broken JSON the game falls back to Jaron's loop only, so check it parses.

## Entry shape

```json
{
  "id": "unique-id-with-dashes",
  "by": "Who made it (Jaron, Claude, Grok, Codex, ...)",
  "cell": [x, y],
  "type": "sign",
  "params": {},
  "lines": ["Text shown on screen when it fires."],
  "kind": "scary"
}
```

- `id` - unique. Also seeds where an `"auto"` trap lands, so changing it moves the trap.
- `by` - shown under the line as "trap by ..." so players see who built it.
- `cell` - `[x, y]` maze cell, 0..34 each. `[0, 0]` is the start corner (north-west), the exit is past `[34, 34]` on the east side.
  Or `"auto"`: the game picks a cell 18-90% of the way along the paths from the start, not on another trap, not under an arch.
- `kind` - `"scary"`, `"funny"` or `"both"`. Colours the line (red / orange / lilac).
- `lines` - text. Most types show `lines[0]`; see the table for types that use more.

The maze is 35 x 35 cells, corridors 4 m wide, hedges 5.4 m tall, same layout every time (fixed seed).
Open the game with `?dev=1` to get buttons that teleport you next to every trap.

## Types

| type | what happens | params | lines |
|---|---|---|---|
| `loop` | **Jaron's.** A long straight corridor with solid sides. Walking down it, the player is moved back a few cells without noticing (same view, same speed, thicker mist, a pumpkin to recognise), `loops` times in a row, then let through. Only one loop trap is used. | `length` (cells, 8-15, default 9), `axis` (`"x"` east-west or `"y"` north-south), `loops` (default 3). `cell` = the corridor's first cell, or `"auto"` = middle of the maze. | `lines[0..loops-1]` one per loop, `lines[loops]` when it lets you through |
| `fake_exit` | A glowing exit gate at the back of a dead end. Walk up to it: it flickers out, a laugh, the line. | none. `"auto"` picks a dead end. | `lines[0]` |
| `whisper` | A whisper from somewhere in the hedge (positional sound) + the line. Re-arms after 60 s. | none | `lines[0]` |
| `jumpscare` | A shadow face flashes on screen with a sting (spooky, not gory), then the line. Once. | none | `lines[0]` |
| `darkness` | Fog closes in and the lanterns die for a while. | `seconds` (default 8), `fog` (how far you can see, metres, default 7) | `lines[0]` when it starts, `lines[1]` when the light returns |
| `sign` | A wooden sign leaning on a hedge in that cell. | `text` - what is painted on the sign (`\n` for new lines, keep it to 3-4 short lines). Without `text`, `lines[0]` goes on the sign. | the toast shown when you walk up: `lines[0]` if `text` is set, else `lines[1]` |
| `reverse` | Controls flip (forward is back, left is right). | `seconds` (default 6) | `lines[0]` |
| `decoy_eye` | The Eye snaps onto you, turns orange, sting... then blinks and goes back to searching. No shadows. Once. | none | `lines[0]` after the blink |
| `shortcut` | A hidden gap: the hedge between this cell and its neighbour that is furthest away by path becomes a thin leaf curtain you can walk through. | none | `lines[0]` when you pass through |

## Rules of thumb

- Keep lines short (one breath). Jokes welcome, nothing gory - kids play this.
- Do not put two traps in the same cell; the second one is skipped for `"auto"` but not for fixed cells.
- A new trap type needs code in `game.js` (`updateTraps`); ask in the handoff instead of inventing a type the game ignores.

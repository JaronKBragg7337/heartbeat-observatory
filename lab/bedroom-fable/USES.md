# What a shared event history is good for (Fable, bake-off 2026-10-26)

The stack: a place (seen frames + made fill, each surface marked), things in it with IDs, and one timeline of events
(`history.json`). Every use below is the same record read a different way. The four with a star are built as demos in
the page (Demos button); the rest are one line each on how this stack does it.

## Built in the page (Demos)
- **Game moment (The faded door)** * - the honesty rule becomes the mechanic: unknown = locked. Tap the one door the
  story allows, the man walks through into a room marked MADE, the quest logs `quest_done` with seconds + steps.
  Two doors stay locked until new footage arrives. (The game and the memory product share one rule.)
- **Movie shot** * - the record IS the footage. Three cuts (over-the-shoulder, floor level, crane) replayed from
  what he already did, letterboxed, title card. Re-shoot any moment from any angle without a reshoot.
- **Music video** * - his footstep intervals set a tempo (`beat_from_steps`), cuts and light pulses land on the
  beat, footprints flash. Studio's timeline and this timeline are the same shape: a hit is an event.
- **Show scene** * - the room narrates its own history as captions (and voice when sound is on), documentary
  style, every sentence generated from events: first walk, a named step, the unlock. A show is a narrated query.

## Also in the page
- **Necklace view** - tap the man, a footprint, a door, a wall: it tells what it is (provenance) and what happened
  to it. Tap a footprint and it names its event ID, foot, time and speed.
- **Replay / scrub** - drag the timeline in the History panel: the man goes back to where he was, footprints after
  that moment vanish. Rewind as a feature.
- **AI doorway** - `HB.trace_object`, `HB.events_between`, `HB.describe()`, `history.json`, `AI-README.md`.

## More uses (how this stack does each)
- **Memories (the product)** - upload a video; seen parts solid, rebuilt parts marked, the never-seen left faded;
  more videos of the same place turn more of it solid. The made fill here is what the engine does for constructed
  worlds; for real footage it stays off and the fade stays.
- **Movies / shows (full pipeline)** - block a scene once with tracked actors, then re-frame, re-time and re-cut
  from the record; continuity errors become queries (`events_between` across cuts).
- **Games** - every NPC and prop keeps a history; "why is the vase broken?" is a trace, not a script. Saves and
  replays are the record itself. Faded = unexplored.
- **Music videos / Studio** - any recorded motion (a dancer, a drop of water, a walk) scores itself; swap the kit,
  keep the timing. Sound events and motion events sit on one timeline.
- **Roofing / job sites (Jaron's trade)** - a phone walk-around of a roof becomes a measured place with a timeline:
  where the damage was first seen, what was fixed when, by whom. Seen vs rebuilt keeps estimates honest.
- **Insurance / incident reconstruction** - trajectories, contacts and timing from footage, with every rebuilt
  segment marked so a claim never rests on an invented gap.
- **Sports and dance coaching** - skeleton events (foot contact, turn, hidden joint) with speeds; compare two
  attempts by trace; the fade shows exactly which joints the camera could not see.
- **Temporal-fidelity score for AI video** - the tracker measures where generated footage breaks physics (foot slide,
  room drift) from the same event log; a number instead of "looks fake".
- **Training data for Sapling** - cause-and-effect sequences in plain JSON ("tapped door -> unlocked -> walked in")
  that a small model can learn from without ever seeing pixels.
- **Education / science demos** - run an experiment once, let students scrub it, tap any object, ask it what
  happened to it.
- **Real estate / rentals** - a walk-through video becomes a place with honest unseen zones instead of a stitched
  360 that pretends.
- **Theatre blocking** - rehearse once, replay from the director's seat, the wings, above; the record is the prompt
  book.
- **Accessibility** - `HB.describe()` and the narrated show: a blind viewer hears the scene's history in plain words.
- **Archaeology / museums (The Necklace literally)** - every artifact with a path: found where, moved when, by whom;
  touch it, see everything it has seen.
- **Kids' memories (with the family's say)** - a birthday video becomes a room they can stand in; faces and voices
  never invented; what the camera missed stays a soft blur, which is the truth.

## Honesty lines that hold across every use
seen = solid; rebuilt = marked approximate; made = marked made; never seen = faded or locked. Real footage never gets
made fill. AI-generated people are labelled. Nothing in the record is interpolated without saying so.

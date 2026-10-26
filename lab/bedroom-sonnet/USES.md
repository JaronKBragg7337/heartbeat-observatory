# Other uses of the same stack (Claude Sonnet 5.5, bake-off 2026-10-26)

One event history (ids, time, position, cause) + a scene that is a pure function of that history + honest seen/rebuilt/made marks.
Four uses are built and running inside `index.html` (tabs at the bottom). The rest say how this stack does them.

## Built (real, not mock-ups)
1. **Game - "Witness" (Game tab).** A detective game with no scripted answers: the man makes statements generated from the live
   history ("I took 14 steps in the last 20 seconds", "The middle door is still locked", "My last step was my left foot"); you
   say TRUE or LIE, scrub the timeline to check, and the game proves you right or wrong with the exact events and replays the
   moment. Scales to stealth games (who saw whom, when), mystery rooms, "spot the continuity error".
2. **Movie shot - "The Locked Door" (Film tab).** A seven-shot sequence (establish, track, feet, POV with the real gait bob, door,
   reveal from inside the made room, top) with letterbox, a slate carrying the live event id, grain, cut flashes and a title card.
   The camera is a function of the man's recorded pose, so the same take can be re-shot from any moment (scrub, and it films the
   replay). `shots.json` is the shot list an AI can rewrite. Real value: previs and coverage from a recorded world.
3. **Music video - "Heavy Steps" (Music tab).** His steps are the drum machine: left foot = kick + bass note (his position picks the
   note), right foot = clap, hats between, bells when he passes a door, riser + pad when you unlock, a brighter chord when he walks
   into the made room. He stops, the beat stops. Every note is an event (SOUND lane), so the song is also data: a Studio session
   you can edit. Lyrics advance with the step count; the camera kicks on every kick.
4. **TV show scene - "The Room Remembers" (Show tab).** A script written live from events (sluglines switch to INT. MADE ROOM when he
   enters it), captions, a "Take 2" button that replays the scene, and a **continuity supervisor** with five checks computed from
   the history (no teleporting, steps spaced, never leaves the room, door opened only after unlocked, made floor labelled made).
   Tap a script line to jump to that moment.

## Other uses (how the stack does them)
- **Step inside a family video (memories).** Camera + room from structure-from-motion, bodies from pose tracking; seen = solid,
  rebuilt = amber, never seen = faded like a memory (the three locked doors). More videos of the same room turn more of it solid.
- **Insurance / accident / CSI reconstruction.** Every object keeps path, speed and what it hit; `trace_object` answers "what did it touch".
- **Sports review.** Players are tracks; "every sprint over 7 m/s and who was within 2 m" is `events_between` plus a filter.
- **Education, "touch history".** Museum rooms, chemistry flasks, physics demos: tap a thing, see everything it has been through.
- **Audio description / accessibility.** The Show mode already writes plain-language action lines from events; read them aloud.
- **Open-world game memory.** NPCs and doors with real histories ("this door was unlocked by the player at 12:04"), so quests and
  AI narrators reason about what happened instead of inventing it.
- **Training data with ground truth.** Rendered scenes come with exact object ids, paths and causes: labels for tracking models.
- **Architecture walk-throughs.** Made rooms are clearly marked, so a client never mistakes the proposal for the survey.
- **Live visuals.** Any event stream (footsteps, doors, collisions) becomes notes and camera cuts.
- **Smart-home replay.** Door, motion and light events as a scrubbable 3D timeline of the house.

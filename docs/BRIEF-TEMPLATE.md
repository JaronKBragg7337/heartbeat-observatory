# BRIEFING AN AI — the template, and the next brief ready to paste
**Living document, June 11, 2026.**

## The three-line skeleton (works on Claude, Cowork, Codex, anyone)
- **GOAL:** what should exist when you're done. One or two sentences, concrete.
- **CARRY:** what must NOT change. For worlds this is now one sentence:
  "World 1's shell, verbatim — see docs/SHELL.md; gold master engine/hub/main.js."
- **FREE:** where you're allowed to be creative.
Add: where to work (folder), what's forbidden (live files), how we'll verify (the
acceptance test). Most pain lives in an unspoken gap between CARRY and FREE — speak both.

## READY TO PASTE — the Starter World brief (the next Cowork task)
GOAL: Build a reusable STARTER WORLD at /worlds-lab/starter/ — an empty biome
carrying World 1's complete shell. This becomes the template every future world is
born from: clone it, design the environment, done.

CARRY (the law — read docs/SHELL.md and docs/CHARTER.md first):
- Port the shell EXACTLY from engine/hub/main.js (World 1). Do not redesign or
  approximate: controls and movement feel, top chips, PHONE with real messages,
  Ask Claude tab, Settings (sensitivity/FOV/invert Y/roster), Character editor
  (saves to account, one body across worlds), action stack with contextual door
  bar, Leave action returning to a gate, fullscreen, menu. Final names on every
  label — nothing temporary-sounding.
- Presence laws: track() join/leave only; sends ≤10Hz + idle suppression;
  interp ≥2× send interval. Deploy law: BUILD const + ?v= bump, same commit.
- New folder only. Not one line of live code touched. Unlinked from the landing.
- Honest empty states: the world says plainly it is an empty starter biome.

FREE: terrain rendering approach, file organization inside the folder, and a tiny
sample environment toggle (flat / hills) to prove environment varies while shell
holds.

VERIFY: Jaron walks it on his phone and cannot tell the UI from Town Square except
that the world is empty. Then: every control pressed once, character edit saves,
phone opens, settings sliders work.

## Standing instructions for any AI working this repo
Read README handoff → docs/CHARTER.md → the doc nearest your task. TODO.md is live
truth. Report bugs and progress concretely. When reality disagrees with a document,
say so — updating the document is part of the job.

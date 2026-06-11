# THE KICKOFF MESSAGE (paste this to start ANY new AI conversation)
Fill in the TASK line and the two keys (keys live with Jaron, never in this file):

> I'm Jaron, owner of Heartbeat Observatory - a live 3D multiplayer web world.
> Live site: https://www.heartbeatobservatory.com
> GitHub: https://github.com/JaronKBragg7337/heartbeat-observatory (branch main, auto-deploys to Vercel)
> GitHub key: [paste] / Vercel key: [paste] - tool use only, never committed to any file.
>
> Before doing anything, read these from the repo, in order: README.md (handoff at top),
> docs/CHARTER.md, docs/SHELL.md, docs/METHOD.md, then whichever sits closest to the
> task: docs/WORLD-STANDARD.md, docs/EDITOR.md, WORLD2-PLAN.md, or docs/LOOK.md for
> anything visual/aesthetic. Then TODO.md. Tell me in one short paragraph what
> you understood before you start. If the docs disagree with the live site, tell me -
> reality wins.
>
> YOUR TASK: [Build Phase 1 of the Fort Wayne world per the FUTURE WORLD: FORT WAYNE section of WORLD2-PLAN.md — lab world, new folder, recognition is the win condition.]
>
> Rules that never bend: new folders only unless the task says otherwise - not one line
> of live code touched without being told. Nothing faked, honest empty states. Verify on
> the live site before calling it done, and report concretely: what changed, where, and
> how I can test it from my phone.

Why each part exists: keys first (nothing works without access); forced reading WITH a
comprehension check (the paragraph it reports back is the insurance - stop it if the
summary sounds wrong); one tight task; guardrails; and a testable report that closes
the loop.

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

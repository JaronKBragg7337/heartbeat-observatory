# HANDOFF — session log (newest entry first)

Convention: every agent session with repo access adds an entry at the top before stopping:
current state, what shipped, how it was verified, next best step, gotchas. TODO.md stays
the live queue; ARCHIVE.md keeps completed work verbatim; this file is the session-to-session
narrative so no context is lost between Claude, Codex, and Cowork runs.

---

## 2026-07-04 — Whole-site audit + THE THEATER promoted (Cowork, Claude Fable 5)

**State when I arrived:** site live and healthy. Working video playback existed ONLY in the
worlds-lab Marquee Row proof (lib/v1/cinema.js); all three live theaters said "first screening
coming soon". Hub BUILD const said 2026-06-10d while its ?v= said 2026-07-04 (Codex's July 3
commits bumped ?v without BUILD — boot log was lying). worlds-lab (8 finished solo worlds) was
reachable but linked from nowhere. bubble.js missing on /pam and /space despite the README's
"rides along on every page".

**Shipped this session:**
1. `/video` — flat Theater page now plays real film: full legal catalog (Blender CC BY ×4,
   Internet Archive PD ×2, NASA PD ×1 w/ fallback), reel picker, credits during playback,
   honest error states, muted-first phone handling.
2. Town Square theater interior — full Marquee Row port: START/NEXT glowing pads, 16:9
   VideoTexture screen + masking, house lights (bright idle → dim show → restored on leave),
   NOW SHOWING + credit plaque boards, video pauses on exit. BUILD 2026-07-04-theater1
   (also heals the BUILD/?v drift). Stations gained an additive `fn` action type.
3. World 2 theater interior — same port. BUILD 2026-07-04-w2k.
4. Landing page — "The back lot" card linking /worlds-lab/ (honest Preview pill, says solo).
5. bubble.js added to /pam and /space.
6. Docs: TODO theater item updated (shipped text moved verbatim to ARCHIVE.md), this file created.

**Verified:** node --check on both edited main.js files; anchored count==1 python edits per
METHOD.md; BUILD+?v bumped same commit (deploy law); live URL + md5 verification after push
(see below); TDZ law respected (new module lets sit with the other interior lets, far above
the boot calls).

**Honest limits / what is NOT done:**
- Theater playback is PER-VISITOR. Two people in one hall each run their own projector.
  Next step (designed, not built): "cine" broadcast event on the world state channel +
  late-join reconcile so a hall watches together. Then seat assignment (TODO SOON).
- worlds-lab worlds are still SOLO previews — the landing card says so. Real promotion of
  any lab world = the WORLD-STANDARD checklist (shell port, gate page, own channel,
  touch_world allowlist). Cinema-district's PATTERN is now promoted; the world itself stays lab.
- Fossil naming ("The Engine" vs "Town Square" in the landing sections list) is a Supabase
  `surfaces` row, deliberately untouched — final name is Jaron's call (TODO NOW item 7).

**Gotchas for the next agent:**
- The three recent Codex commits put SYL-test behind an admin gate in the arcade, then the
  Fable Survival cabinet REPLACED that admin SYL TEST cabinet (2245a4a). /games/syl-test/
  is still live-but-unlisted by URL; there is currently no in-world door to it.
- engine/hub/main.js stations: `fn` acts run callbacks; world2 acts: `{ type: "fn", fn }`.
- Keep ONE <video> per room (media-surfaces law). Do not add per-surface videos.
- Deploy law: bump BUILD const AND ?v= in the same commit, every main.js push, both worlds.

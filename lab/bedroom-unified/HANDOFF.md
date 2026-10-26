# HANDOFF: unified base (Claude Sonnet 5.5, 2026-10-26 ~2:20 AM wall-clock)

Base = Sonnet v3 (patched surfaces, `hb-history/1`, Witness / Film / Music / Show, study behind door 2) + the council's agreed picks
(`C:\Users\lilli\AI-Shared\projects\strategy\bakeoff-council\`: REVIEW-sonnet.md, PLAN.md). v2 (`lab/bedroom-sonnet/`) and v3
(`lab/bedroom-sonnet-v3/`) are untouched records. No git was run. Serve `lab/` with any static server and open `bedroom-unified/index.html`.

## What the base already does (verified: `HB.selfTest()` passes 6/6; 375 px Chromium + WebKit)
- Opens on **Kimi's evidence view** (`CONFIG.camera.inside`), toggle **Overview / Step inside** (Sol's idea) in Explore.
- Labels: **Seen / Patched / Made / All** toggle; every patched surface (`Q-0001..Q-0013`, study `M-0005`) shows source frame + pixel rectangle in the sheet.
- **Steps are `made`** (scripted contact) with `floor_basis: seen | patched` kept apart (Sol's fix). Replay appends nothing (selfTest proves it, answering Kimi's concern about Kimi's own build).
- `HB.grounding()`: measured sole height + planted-foot slide (1.4 / 1.3 cm per 7 cm of root travel). Grounding is not proof of no sliding; the number says how much.
- "Why?" button in the sheet = `hist.why(id)` (parent chain up to a root) -> also MCP `causal_chain`, `patch_source`.
- `Download` in the JSON box and `HB.download()` (Kimi's idea). `AI-README.md`, `history.json/jsonl`, `shots.json`, MCP `bake/sonnet/mcp/server-unified.mjs`.

## Seams (where each next pass plugs in; do not restructure around them)
| Seam | File / symbol | For |
|---|---|---|
| Seen picture rules | `app.js: makeSeenMaterial(old, CONFIG.seen)` + `CONFIG.seen = {veil, anchorFrame}` | **Fable** (anchor frame 1, frame 25 only in holes: the two GLB meshes are `v1_f0001jpg`, `v1_f0025jpg`; set per-mesh alpha/discard in the shader) and **Kimi** (veil opacities: walls .22 / floor .48 on the made/patched shell; the shell materials are `madeMat(..., kind)` in `buildShell()` / `buildStudy()`) |
| Opening camera | `CONFIG.camera.inside/overview` | Kimi (tune), keep inside as default |
| Modes | `modes.js: api.register(name, {label, enter(ctx,panel), update(dt), leave(), cameraOwned()})` adds a tab or **replaces a built-in** by name (`game film music show`) | **Fable**: narrated Show (`speechSynthesis`), replay-cut Film, tempo-from-steps Music; fold his tabs in so the bar stays 5 wide at 375 px |
| World labels | `ctx.labels.add(id, [x,y,z], 'D2 - NOT SEEN', 'seen')` (CSS `.wlabel`) | **Kimi**: per-door NOT SEEN pills (door ids D-0001..3, door wall x = -1.36, z = -2.52 / -0.97 / 0.67, y ~ 2.1) |
| "Why?" presentation | sheet button `#swhy` -> `hist.why(id)`; data is done, UI is a JSON box | **Kimi**: causal-trace card (step -> sound -> cause) |
| Study furniture | `buildStudy()` (`studyM` group, id `M-0006`, all made) | Sol: listening corner as a made addition; keep the desk + computer |
| History | `history.js` (`emit`, `why`, `story`, `toJSON`); event fields `eid t id e target p v parent children basis floor_basis place snd note` | add `cause` aliases only if needed (`parent` is the cause) |
| Video | `rec.cjs` pattern in `hb-vision/bake/sonnet/` (deterministic `__step`, offline audio via `__renderAudio`) or Fable's `rec.mjs` | Fable |

## Known soft spots (honest list)
- The made/patched shell sits behind the seen mesh, so the photo is already on top; Kimi's veil pass should lower shell opacity only where the photo is present, not everywhere.
- Real lamp is one GrabCut cut-out (frame `v1/f0040`, rect 296,172-410,378); the right lamp is the mirror. Nightstands/headboard use a tone-matched real red-wood swatch; they read stylised, not photographic.
- Ceiling = wall plaster placed overhead (never filmed). Floor outside the filmed strip = quilted real floor. Both are labelled `patched`.
- Dollhouse cut-away uses the camera position; at the top of the Overview the seen window above the headboard is still the stretched seen mesh (Fable's anchor-frame fix should address).
- Sound is a small synth (`audio.js`); the Sol "sound guide" (spatial pan wayfinding) is not ported.
- Five tabs fit at 375 px; a sixth will not. Fold, do not add.

## Rules held
`noindex`, "AI-generated person (not real)" tag, corner credit "Room + person made by Grok Imagine, rebuilt by Heartbeat Observatory tools", no GPU used, page ~4.9 MB.

## Fable pass (Claude Fable 5.1, 2:09-2:21 AM) - for Kimi, who goes next
Edits: `app.js` (seen picture only), `modes.js` (Game + Show). Nothing restructured; every seam above still holds. No git.
- **Seen picture, anchor-frame rule** (`CONFIG.seen = { anchorFrame: 'v1_f0001jpg', otherAlpha: 0.92 }`, `makeSeenMaterial(old, opts, meshName)`):
  frame 1 is THE picture: it writes depth and draws last (renderOrder 2). Frame 25 writes no depth, draws first (renderOrder 1), so
  frame 1 always paints over it and frame 25 survives only in frame 1's holes; its depth estimate never fights the anchor's any more
  (that fight was the "scattered" look). `uFrameA` dims the non-anchor slightly. Kimi: your veil goes in the same function/CONFIG.
- **Game = quest first, then Witness** (`quest()`, `questUpdate()`, `witness()` in modes.js): "The faded door" card until the middle
  door is unlocked; when the man's `entered` event lands it emits `quest_done` (parent = the entered event; seconds + steps in the
  note) and offers Witness. "Skip to Witness" exists. Once done, Game opens straight on Witness.
- **Show = voice** (`S.voice`, `speak()`, `narration()`): "Voice: off/on" speaks each new script line (speechSynthesis, iOS needs the
  tap, button is disabled where no synthesis exists). "Narrate the history" writes 5 lines from the record (steps, metres, one named
  step, the unlock or the locked doors), shows them as captions 6.5 s apart, speaks them, and emits `narrated`. Film and Music were
  already better than mine (7-shot list, step-driven kit): left as Sonnet built them.
- **Tested (375 px Chromium, CPU GL, `bake/fable/unified-test.mjs`): all pass, 0 console/page errors.** Seen/Patched/Made/All toggle,
  door-2 unlock (sheet opens with D-0002, Why? gives chain D-0002 <- C-0001 + JSON box), he enters the study (`entered` + `quest_done`
  5.9 s after the tap), patched tap on the left lamp shows frame + pixel rect, Film/Music/Show tabs, Voice button, Narrate caption,
  Overview/Step inside, `HB.selfTest()` 6/6, scrollWidth 375. WebKit 375 px renders (unified.png).
- **Video**: `hb-vision/out/bakeoff/unified.mp4` (30 s, 1080x1920, with the page's own offline-rendered sound) + `unified.png`.
  Recorder: `bake/fable/rec-unified.mjs` (page `?rec` + `__step`, CDP capture, GPU under gpu.lock, `--cpu` fallback; 900 frames in 39 s).
  Shot list: Seen -> Patched -> All, lamp tap with source, Game quest + door unlock, Why?, walk into the study, Film (TRACK/FEET), Music.
- Soft spots I saw and left: the dark doorway alcoves from frame 1 read as "boxes" on the left wall in Overview; the Why? JSON box
  is a raw box (your causal card goes there); `#rcap` captions in rec mode sit at top:124px, fine at 540x960.

## Kimi pass (Kimi K3.1 Pro, 2:20-2:55 AM)
Edits: `app.js`, `index.html`, this handoff. No git, no GPU, no connectors or settings changes.
- **Original photo first**: `CONFIG.seen.veil = {wall: .22, floor: .48}`. In All, the main room's wall/ceiling closure is 22% and
  floor closure 48%, drawn behind Fable's anchor picture; Patched inspection restores full opacity. Study opacity is unchanged.
  In Overview only, `uOverview` softly dissolves reconstructed depth behind the three doorway planes, removing the dark box-like
  alcove edges without discarding the photographed door faces.
- **Readable Why?**: `showWhy(id)` turns the existing `hist.why()` chain into a plain-words cause-to-effect card, including the
  resulting sound when one exists. Every step is a button that seeks and plays that moment. The separate `{ } JSON` button and
  download remain unchanged. Effects are chosen at/after the selected event, so an old door-pass sound cannot become the unlock effect.
- **Door labels**: short high-contrast `D1/D2/D3 · NOT SEEN` world labels, clamped inside the phone viewport. All three are readable
  together in Overview at 375 px; the label still tells the truth after D2 opens because its room was never filmed.
- **Tested at 375 x 812, CPU only**: Chromium 1234 with SwiftShader and WebKit 2359. Final pass: 25 checks in each engine, zero
  console/page errors; `HB.selfTest()` 6/6 before and after; no horizontal overflow; all four layer toggles; Overview/Step inside;
  real canvas tap to unlock D2; study entry; every Why? step replays; explicit JSON still opens; Film/Music/Show plus narration;
  return to Explore. Separate footstep check passed in both: footstep -> cause -> contact sound. Inline favicon removes the old 404.
  Screenshots were inspected in both engines, then removed. No video or heavy render was run.

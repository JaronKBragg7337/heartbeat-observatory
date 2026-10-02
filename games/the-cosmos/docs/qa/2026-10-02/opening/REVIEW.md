The opening — local implementation and QA, 2026-10-02. Changes remain uncommitted for Luna to publish. This review deliberately uses scene numbers. The PNGs contain the opening and are intended for builder review.

New saves enter the opening. Existing solo and shared saves retain their identity and progress. Unfinished saves resume their scene, pose and interactions. The first-play skip restriction, private multiplayer progression, one-time completion and later retries are covered by the rule checks. Connection loss pauses the opening and displays its reconnect state. The browser walkthrough uses normal keyboard/touch actions; controlled frame stepping supplies elapsed time without changing progression rules. The authority runs in an isolated memory adapter and the browser uses temporary profiles.

| Review | Evidence | Result |
|---|---|---|
| The opening, scene 1 | Desktop and phone; multiple desktop angles | Actor assets load before playback; seated poses fit their surroundings; normal look input and the filming toggle work. |
| The opening, scene 2 | Desktop and phone; two desktop angles | Keyboard and canvas touch movement reach the contextual action. |
| The opening, scene 3 | Desktop and phone; three desktop angles | Normal interactions change the actual material field; refresh restores the field and pose. |
| The opening, scene 4 | Desktop and phone | Actor placement, rotated collision and contextual touch actions are exercised. |
| The opening, scene 5 | Desktop and phone | The camera clears the surrounding geometry and the transition enters shared play. |
| The opening, scene 6 | Desktop and phone; seven additional room views | All seven rooms are traversed with the real collider, with zero route snaps. |

The final browser walkthrough passed with no page errors or failed game-asset requests. Its second client retained separate progress throughout, paused visibly on socket loss and reconnected with the same identity. The phone viewport is 390 × 844 with touch input and 4× Chrome CPU throttling; rendering uses desktop SwiftShader. Scene 3 measured 73 draw calls and 154,164 triangles. Safe mode resumed the same unfinished save and rendered with 12 calls and no graphics failures. These are emulation measurements, not physical-device FPS results. Safe mode uses the existing reduced-fidelity graphics fallback.

Run `node test/validate.mjs` from `games/the-cosmos/`. It includes the opening's rule checks and Chromium walkthrough. The final full run passed **707 checks, with 0 failures**, recorded in [validation.txt](validation.txt); detailed browser results are in [browser-results.json](browser-results.json) and [browser-log.txt](browser-log.txt). `git diff --check` also passed.

For filming, use a separate browser profile and enable the existing dev layer. Wait for `cosmos.opening.ready`, then call `cosmos.opening.syncFilm(true)`. This hides the interface through shared arrival. `cosmos.opening.syncFilm(false)` restores it. Click the canvas to enable browser audio. `?dev=1&opening=off` is for the existing review start; it does not reset a returning player's save.

Codex inspected the local screenshots. Claude's independent picture review remains pending before publication, as required by the project decisions. Physical phones, the public deployment, production storage and traffic capacity were not tested in this run. The audio is procedural sound with on-screen dialogue; recorded voice performances are not included. This is an implementation and verification handoff, not a completed trailer.

Luna: publish the game changes and this QA evidence after review. Keep the local brief files out of the publication. No commits, pull requests or deployments were created in this run.

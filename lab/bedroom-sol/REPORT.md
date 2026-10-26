# Sol bakeoff report

By GPT-6.1 Sol · 26 October 2026 · approximately 30 minutes.

Built Bedroom v2 with a four-wall/ceiling/floor shell, explicit cutaway and interior views, made repairs over v1 tears, a grounded synthetic walker, three faded doors and one made-room unlock. Added touch-to-history, recorded-position scrubbing, tap-enabled event sound, live JSON export, AI-README and four read-only MCP tools.

Verified: 6.18 MB page folder; 375 px Chromium and WebKit visual/touch checks; 15 interaction/data checks including the appropriate WebKit sound fallback; 7 MCP checks. The 24-second capture contains 305 events, 57 object IDs and 37 foot contacts. Sole checks measured approximately 7–8 mm above the reference floor. This is grounding verification, not a claim of zero foot sliding.

USES.md lists 70 uses. Three working extra-use demos: synthetic lamp care log, sound-based wayfinding/score, and a clearly made interior-design alcove.

Weak: approximate scale, rig and photo geometry; some residual duvet seams and possible foot sliding; history persists only for the current page session unless downloaded. Physical iPhone audio was not tested. Windows Playwright WebKit lacks AudioContext, so its unavailable-audio fallback was checked; Chromium Web Audio works.

Deliverables:
- `C:/Users/lilli/Projects/heartbeat-observatory/lab/bedroom-sol/index.html`
- `C:/Users/lilli/Projects/heartbeat-observatory/lab/bedroom-sol/history.json`
- `C:/Users/lilli/Projects/heartbeat-observatory/lab/bedroom-sol/AI-README.md`
- `C:/Users/lilli/Projects/heartbeat-observatory/lab/bedroom-sol/USES.md`
- Scripts, QA evidence and capture frames: `C:/Users/lilli/Projects/hb-vision/bake/sol/`
- `C:/Users/lilli/Projects/hb-vision/out/bakeoff/sol.mp4` — 24 s, 1080×1920, 30 fps, H.264/AAC, 2.81 MB; faststart verified; all 720 frames decoded.
- `C:/Users/lilli/Projects/hb-vision/out/bakeoff/sol.png` — actual phone-layout screenshot, 1080×1920, 0.38 MB.

CPU SwiftShader capture; no neural/GPU generation. Brief Windows WebKit checks honored the shared GPU mutex and released it. No commits, pushes or deployment. No shared source scripts or other models' folders were edited. Signed: GPT-6.1 Sol.

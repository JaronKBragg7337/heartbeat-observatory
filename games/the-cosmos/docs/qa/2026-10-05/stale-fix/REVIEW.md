# Stale-content fix (2026-10-05)

Source: AI-Shared/projects/syl/STALE-AUDIT-2026-10-04.md. Rule: DECISIONS 10/3 7:34 PM, one seamless Solar System.

## Changed
- No lanes / Ore Lane / jump drive in anything the player sees: Course list tag, trip phase names, trip speech lines, nav-computer "out of range" message, HUD spool line, Ceres Lane Office (now "Flight office": sign, NPC, Q&A about flying to Mars on the long drive, no toll), Ceres/Moon blurbs and comments, placeholder worlds (Fortis, Greenhaven, Mercury, Venus, Jupiter, Saturn, Uranus, Neptune): "A world of this Solar System, not open yet".
- Dead fee check in SpaceSystem.engage and the "lane fee" Course-list branches removed (no route has a jump leg since F3).
- Solo board text: honest and short. Solo cannot START on Ceres because the landing frame/pose comes from the shared-world authority (main.js onFinish), so the board says "A solo game starts at Mars and flies here on the long-range drive." Ceres is still reachable solo by flying. Gap: a true solo Ceres start needs local arrival-frame support.
- Voices: lines.json regenerated (gen-voices --prune); all Ore Lane / lane fee / jump drive voice entries gone, new generic lines voiced.
- Stay on Mars: guide line now says walk out, ride the lift up the control tower, ask the watch supervisor for a paid job (that job, "A tonne for the foundation", exists). Status-card NEXT text says "Your ship is on its pad" for stayers (was "Lifeboat ready") and tells the player to ride the lift.
- Tower elevator: audit text had no elevator-disabled item and nothing disables it (port.elevatorAction is live; the opening runs in its own scene). So no dead button to explain; the hint now just mentions the lift.

## Left, and why
- Phobos voice/course lines: generic "Course set for X" templates, valid later; the opening never selects Phobos. Phobos jobs kept as later Mars content.
- Old freighter art (src/opening/art.js, freighterInterior.js, freighterHull.js): not removed; not proven unreferenced in this pass.
- Dead jump code (jump.js, laneGate.js, spool phase branches in spaceTrip.js, server/simulation.mjs fee check): still imported by live files (isLaneWorld in freeflight/crew, JUMP.mouthM in trip). Only text changed. No server file touched, so no server restart.
- freeflight.js "Free flight is only charted in Mars's space" (audit: unsure): untouched; gap, free flight is off in Ceres/Moon/deep space.
- Gap: no world-local starter job for Ceres; "Ceres has no job board yet" text stays.

## Validation
- test/phone-check.mjs: all PASS, no FAIL.
- test/validate.mjs: see bottom.
- validate.mjs (partial at push time, ~1300 lines, run still going): 1 FAIL 'Deimos is farther and takes longer (50 min)' in test/space-checks.mjs:277, pure transit physics on orbit phase (Deimos 50 min vs Phobos 58); transit.js untouched, so not caused by this change (unverified against baseline).

## Final results
- validate.mjs complete: 1863 passed, 1 failed (the Deimos timing check above; pre-existing physics test, not touched by this change; not verified against baseline).
- AI playtester (live, 15 min, iphone): 12 problems total, 0 blockers, 2 serious (stuck walking to Shift runner; stuck walking to Lookout at the glass). Also: a Dig tap in the opening made no cut. Report: AI-Shared/state/playtest/2026-10-05_01-40/REPORT.md. Vision calls failed with fetch errors 3 times.

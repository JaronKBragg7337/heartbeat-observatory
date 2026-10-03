# F5 roles and NPC stand-ins + F4 balance and home strength (published together)

Verified locally: `node test/validate.mjs` 1428 passed, 1 failed. The one failure (Deimos trip estimate, space-checks) fails identically on main before this work. `test/phone-check.mjs` 27 pass, 0 fail. `node test/roles-browser.mjs` (real taps, iPhone WebKit profile, real authority): Mars shows the neutral message and no seats; on Ceres join a faction, hear the governor (voiced), take the pilot post, work a shift (balance 40 -> 38.4, marks paid, rep earned), stand down; no sideways scroll. Screenshots 01-06 here. 96 new checks in `test/pkg-roles.mjs`.
Voices: 117 new clips generated (478 total, 8.4 MB; the clip size cap in voice-checks was raised from 8 to 12 MB).
Not verified: live URL after deploy (see timeline), other worlds in play (only Mars and Ceres are reachable), real audio heard by a human.
Changed existing behavior: Ceres desk and foundry pay now follow the world price factor and tax (an outsider at the start gets about 113 instead of 130 marks per tonne of ore); world2-trips test updated to a range.
Honest gaps: see "Not done" in docs/ROLES-AND-BALANCE.md (unlocks, docking policy and home upkeep are computed and shown but no shipyard or port on the other worlds enforces them yet; Heat and faction-switch labels are F7).

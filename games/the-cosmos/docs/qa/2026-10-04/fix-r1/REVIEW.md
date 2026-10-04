# The Cosmos fix round 1 - review (Jaron's iPhone playtest, 10/4)

Built by Codex Sol (jobs 1-7), finished by Claude Sonnet 5.5 (rebase onto Grok's looks commit, the two new items, WebKit evidence).
Screenshots: `*-webkit.png` are iPhone WebKit (393x852 @2x, iPhone UA, touch). `*-chromium.png` are Sol's earlier Chromium captures, kept as extra evidence.
`eyes-sheet-*.jpg` are contact sheets of every room. Capture script: `test/fix-r1-browser.mjs`; checks: `test/pkg-fix-r1.mjs` (runs inside `node test/validate.mjs`).

| # | Job | What changed | Evidence | Check |
|---|-----|--------------|----------|-------|
| 1 | Real door names | Labels are assigned once at the source (`assignDoorLabels` in `src/ships/layoutKit.js`) from the room the door leads to; an unknown label throws instead of showing MEDBAY. Hellas Dawn has one MEDBAY. | `room-*-webkit.png` | every ship: distinct atlas cells; one MEDBAY |
| 2 | Nothing covers a door | `src/ship/clearance.js` reserves each door's clear volume before decorative pipes, rails, glass and notices are generated; props moved off doors. | all `room-*`, `port-*` | fails if any prop, fitting or collision box overlaps a door opening, all ships and all port rooms |
| 3 | Hellas Dawn gangway and hull | The side gangway is a visible ramp you walk down; the cargo bay stays shut in the opening; the hull is solid seen from outside. | `opening-0-visible-ramp`, `opening-1-solid-liner` | ramp visible while inside; closed hatch and hull ray hits |
| 4 | Crash-site dig soil | The first dig takes the soil of the world you are on (Ceres regolith on Ceres). | `ceres-opening-first-dig-*` | Mars and Ceres material check |
| 5 | Rover ride under ground | Ride height follows the rendered surface (`rideSurfaceHeight` / `rideSupportHeight`). | `opening-6-ride-0..60` | every wheel footprint over the whole ride stays above the surface |
| 6 | Night settlement | Real night kept; lit windows, pad lights, path lights pad to buildings, glow on building fronts. | `port-night-*`, `ceres-night-*` | sun below horizon on Mars and Ceres; settlement lights on at night |
| 7 | Hints | Lit path ship to arrivals hall, big lit ARRIVALS sign, crew line on stepping off (generated MP3), edge arrow only on a planet and only after 60 s away, hidden when close; same for Pad 01 and the lifeboat pad. | `opening-1-*`, `port-delayed-lifeboat-arrow` | arrow hidden before 60 s, shown at 60 s, hidden close / aboard / goal change |
| a | Departures board in front of a door (Ares promenade) | Boards moved to the side walls clear of every door (also the gate board). | `room-transport-promenade-webkit.png` | covered by the door-clearance check |
| b | Skiff flight deck: tan slab over the cabin door | The hull roof rose through the flight deck (hull stations -3.4 to -2.8 climbed from the sill to the cabin roof inside the cockpit). The roof now stays at the sill until the deck's aft wall (z -2.5), and the near-vertical riser below the deck ceiling is left to that wall (`riser` option in `src/ships/_liner/hullShell.js`). | `skiff-flight-deck-looking-back-webkit.png` (door and wall visible), `skiff-outside-nose-webkit.png` | rays from the pilot aisle to the aft door never hit the hull |

Final runs: `validate-final.txt` (1846 passed, 0 failed), `phone-check-final.txt` (all PASS).

## NOT verified
- Real iPhone hardware. WebKit here is Playwright's Windows WebKit build: it has no WebAudio, so the step-off voice clip is decoded in Chromium and only size-checked in WebKit; nobody has heard it on a phone.
- The Skiff nose seen from outside was checked in one view only (`skiff-outside-nose-webkit.png`); the removed riser strip sits behind the canopy glass.
- Live site (cosmos.heartbeatobservatory.com) after publish: see the final report.
- Night lighting was judged on frames at low tier; high-tier look and frame cost on a real phone are untested.

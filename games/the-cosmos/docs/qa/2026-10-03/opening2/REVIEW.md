# Opening 2 review (Oct 3)

Package: the new opening (BIBLE-v3 10.1, DECISIONS 10/3 10:46 AM) plus Jaron's 7:34 PM rule: **one seamless Solar System, no cuts**.
Branch `cosmos-opening2`. Screens in this folder.

## The flow, as built

1. **Wake aboard the Ares** (the transport, `Hellas Dawn`) inbound to Mars. Seven people with voices and jokes, the convoy (six real ships, names readable) beside the lounge windows, Mars in the glass.
2. **The entry and a normal landing** on **Apron A**, a new big-transport apron and walkway at Marineris Port (`portSpec.js`; the 120 m Ares fits no pad). Gangway down, you walk off.
3. **Walk the port** (lit way markers) to the new **arrivals hall** and read the **world board**: every start world and its two sides, a picture, plain lines, live numbers from the registries, F0's style sheet, the economy tables and the shared world's own counts.
4. **Board the Kestrel** at Pad 01 (gate agent, then up the gangway: you walk aboard, nothing is cut).
5. **The flight and the crash**, cause by season (storm, meteor, pirates, failed part, bad weather).
6. **The wreck**: crew locker, dig out the crate, the driver (one of the world's two sides) and the ride (the old opening's wreck art, rover ride, touch fixes, refresh resume all kept).
7. **Arrive** at the chosen world's port with the 2,500 credit settlement and the **drained lifeboat** on your pad. Two parts, one from each side (power cell, fuel coupler, 300 marks each); fit both and she lifts.

## One continuous flight (the 7:34 PM rule)

`src/opening/flightPath.js`. The Ares and the Kestrel each fly ONE path in the port's own frame; the world is drawn at its true place in that same frame all the way.

- **One Mars**: the game's global shell, a 60 km tier of real ground, the graded port ground, handed over per pixel (`installTierDiscard`). **One sky** that thins from the port's dusk to stars with height. The Sun, the convoy and the crash effects ride with the ship.
- **Ares**: orbit with Mars off the starboard windows, the entry heat and shaking (the air meeting the hull, no frame swap under it), the final approach, touchdown. Before this change a plasma-covered switch hid a jump from space to the port frame.
- **Kestrel on Mars**: lift-off over the apron (the Ares is there under you), up to the edge of space, the planet curving away, down onto the desert 2.6 km east. Before this change a white flash hid a "pop" from ground to sky.
- **Kestrel to another world (Ceres)**: the same climb, then a **time-compressed cruise** with an on-screen label ("Cruise to another world, time compressed"): Mars shrinks behind to port, Ceres appears ahead as a point, grows, and comes round under the ship. Time compression is shown; a cut is not.
- The **only** hard transition left is the **crash blackout**, which is in the story.
- Proof: `test/opening-checks.mjs` samples every path at 30 frames a second and fails on any jump or sudden speed change (the Ares, the Kestrel on Mars, the Kestrel to the far world, and the far world's approach). Filmstrips: `flight-liner-continuous.jpg`, `flight-kestrel-mars-hop-window.jpg`, `flight-kestrel-to-ceres-window.jpg`.

## Choices to know about

- **Open start worlds today: Mars and Ceres.** The Moon, Earth and Callisto are on the board as COMING and cannot be picked (nothing is faked, nothing is rerouted without saying). Phobos and Deimos are listed as places you reach later, not as starts.
- **Mars also offers "stay"**: walk out of the port (the bible's way), beside the Kestrel flight to the Marineris desert.
- **Solo (no shared world) has Mars only**, and the board says why.
- **Skip intro gives the same start** as staying on Mars (tested: same ship, same purse, same place).
- Server-owned and multiplayer-safe: each opening is private, the same season gives every player the same crash, a restart keeps finished openings and resets old-shape ones.

## Checks

- `node test/opening-checks.mjs` (inside `test/validate.mjs`): 64 headless checks, including the flow through the authority to Ceres (lifeboat landed beside the player, purchase, fit, can lift) and the new flight-path checks.
- `node test/opening-browser.mjs`: desktop Chromium, iPhone WebKit, all five causes on Mars and Ceres, two players. Result file: `browser-results.json` (`passed: true`).
- `node test/phone-check.mjs`: iPhone 15 WebKit and Galaxy S9 Chromium, every opening step by real touch taps with a thumb held. Green.
- `node test/validate.mjs`: see the report that came with the commit.
- Voices: 77 new Kokoro clips for every line (`tools/gen-voices.mjs`), manifest regenerated.

## Bugs found and fixed on the way

- The Kestrel cabin was not drawn after boarding in the real flow (rooms never updated); a check now fails if it happens again.
- A touch emulator that reports a release at the wrong spot made one button ignore its tap (`src/ui/activation.js`: the click after a release that did not run is no longer suppressed).
- The world board's tab row scrolled sideways on a phone; it now wraps.
- Dust fog from the bad-weather crash no longer greys the sky at the edge of space.

## What is NOT verified

- **No real iPhone or Android.** Everything touch-related ran on Playwright WebKit (Windows) and Chromium emulation. Web Audio does not exist in that WebKit build, so voice playback was verified through an audio element and on Chromium only.
- Not live: this package was tested against local servers; the live check is part of publishing.
- Frame rate on a real phone is unmeasured (software rendering here). The Mars shell, the 60 km tier and Ceres add draw cost during the flights; the low tier uses coarser meshes.

## Polish still open

- The Kestrel cabin ceiling is dark in the storm blackout (lamps go out by design; the ceiling itself could be lighter).
- Ceres's globe reads warm tan from the Sun's colour; it could be greyer.
- A transient terrain tear at the Ceres arrival, and a blue streak in the Ceres ride sky, seen once each.
- The far-world cruise shows the world ahead only through the starboard windows; a port-side window shot of Mars shrinking away would sell the compression more.

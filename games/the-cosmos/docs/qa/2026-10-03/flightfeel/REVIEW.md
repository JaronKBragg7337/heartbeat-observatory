# FLIGHTFEEL: flying the ship yourself (10/3)

Jaron, 7:34 PM: "I tried to fly myself again, and it was the hardest thing to do in the world... there's limits to how fast I can go up and down...
I didn't really feel like how it should feel when flying. People are gonna want NPCs to fly for them, but people also want to fly themselves."

## What was wrong (read in the code, not guessed)

| What he felt | What the code did |
|---|---|
| "limits to how fast I can go up and down" | `SHIP_PHYS.climbSpeed = 12` m/s climb cap and a sink flare tuned to that; 2.8 m/s2 of spare lift on Mars |
| "hardest thing in the world" / not like flying | tank steering (stick up/down = thrust, sideways = turn at 0.75 rad/s), cruise capped at 40 m/s, a 6 s wait for the ramp to fold before the first push did anything, nose never aimed, nothing to read the speed by |
| landing | the sink flare was good, but on rough ground (everything beyond the port: 3 to 17 m of relief under the hull) she could hang for ever, 2 to 6 m up, "airborne" with the legs in the air and the hull held up by the landing constraint |
| no feel of speed | cockpit camera from the chair, fixed 72 degree field of view, nothing passing the windscreen |

## What it does now

`src/ship/flightAssist.js` (new, pure maths, the browser and the authority run the same file), the hand modes in `src/ship/shipFlight.js`,
`src/ship/speedFx.js` (new), the stick wiring in `src/ship/shipSystem.js`, the phone controls in `src/ship/shipUI.js`, the lease in `server/authority.mjs`.

* **ASSIST (default): point and go.** The stick says where you want to be going; the flight computer gets her there and kills the drift when you let go.
  Speed, climb and agility **scale with height**: 50 m/s with the legs on the ground, 450 m/s at 1 km, 1.8 km/s at the top of the air, 6 km/s in space. Climb 24 m/s at the ground, 300 m/s at 1 km.
  Reaching a height's top speed takes a few seconds at every height; slowing down is quicker than speeding up. The nose is steered (stick sideways, a drag on the right half, the mouse), banks into turns, climbs along the aim, and eases back to the horizon; near the ground it is held near level.
* **Take-off by pushing**: a push forward or up on the pad hops her off at 14 m/s and she keeps a hover-car's height; the ramp folds in 2.7 s instead of 6.
* **Terrain following**: ground rising ahead of a moving ship is climbed over before she reaches it.
* **Boost**: x2.2 speed, x1.8 acceleration; a charge that drains in 5.5 s and refills in 9 s, off at empty until a third is back (no flicker). The button fills with the charge.
* **Landing assist**: hold DOWN low, or tap **LAND**, and she sets herself down soft from any height (1.2 m/s touchdown from 25 m or 3 km; the old stick: 2 m/s from 20 m, minutes from 1.5 km).
  Slows for the lowest thing under her (feet and hull, so a slope's nose or wing tip), pulls toward a pad within 150 m, slides to flat ground when there is any, settles by herself when slow and low with nothing asked, and a hand landing always **ends landed** on rough ground (the hang is gone, by hand).
* **NEWTON** (the expert chip, `M`): the stick is thrust at the engines' real rated numbers (5.7 m/s2 forward, half that reversed), she keeps whatever speed you give her, nothing brakes or lands her. The hover trim still carries her weight (nobody should hold UP to stay alive on a phone).
* The power split still decides whether she flies: below ~19% engines the assist gets no overboost and she cannot lift, by hand either. A hull's rated lift still means something: the assist runs the pods and jets in overboost (LIFT_GAIN 3.2, DRIVE_GAIN 3.6) and says so.
* **Autopilots are untouched.** Controls with no `mode` (a course, a crew pilot, an escort) fly the old law bit for bit (test: top 40 m/s, 12.0 m/s climb). Free flight above the air (the FREE FLIGHT bar) is the other, orbital Newtonian system and is unchanged.
* **Phone**: the invisible left-half stick (up = go, sideways = turn), a drag on the right half steers the nose, UP / DOWN / BOOST buttons, chips ASSIST/NEWTON, CHASE/COCKPIT, LAND, a strip with speed, height and vertical speed (km/s above 1 km/s). In landscape the chips sit in a row at the top.
* **Desktop**: W/S go, mouse or A/D steer, Space up, C/Ctrl down, Shift boost, arrows slide, L land, R hold the nose, V view, M mode.
* **Camera**: chase view by default (behind and above, trails back with speed, swings out in turns, never under the ground); the field of view widens up to 16 degrees (+6 boosting); streaks of dust (star-dust in space) pass the camera, longer and brighter with speed (one draw call). Cockpit view is one tap away.

## The server stays the authority

A client sends **intent only**: pitch and strafe -1..1, boost, land and level 0 or 1, and a mode name (`assist` | `newtonian`); fwd, lift, yaw as before. The authority clamps every one, turns junk and NaN to zero,
and treats an unknown mode as the old three levers. There is no field that can name a position or a speed (test: a packet with `pos` and `speed: 1e9` and `mode: 'warp-drive'` reduces to `fwd,lift,yaw`).
It runs the same file the browser does. A pilot whose connection drops while she is fast does not leave her coasting on the old 5.6 m/s2 brake: the flight assist brings her to a hover (510 m/s to under 20 m/s in 10 s). `boostCharge`, `boosting`, `aimPitch` ride in the ship's pose.
No teleports: the largest step in one tick at 221 m/s was 7.4 m (a tick is 1/30 s).

## Before and after

First-timer bot (reacts a third of a second late, coarse proportional thumb, eases off near the goal; the same policy flies every style on the same ground).
From the Meridian's pad: take off, fly 2 km out, land; fly 2 km back, land on the pad. Three bearings. `test/flightfeel-bot.mjs`, `bot-results.json`.

| style | to 20 m up | 2 km out | down at the goal | landed out / on the pad | out and back |
|---|---|---|---|---|---|
| **old stick** (what Jaron flew) | 3.6 s | 58.8 s | 77 s, 88 s, **never in 420 s** (hung on rough ground) | 2/3, 3/3 | 163 s, 163 s, **504 s** |
| **assist** (stays low, no boost) | 1.8 s | 30.6 s | 38.3 s | 3/3, 3/3 | **74 s** |
| **assist, climb to 160 m and boost** | 1.8 s | 11.2 s | 26.3 s | 3/3, 3/3 | **54 s** |
| newtonian (an expert's bot, real physics) | 3.6 s | 42 s | 64 s | 3/3, 3/3 | 127 s, **33% hull lost** to hard landings |

The same bot flying the **real phone UI** (iPhone WebKit, held thumb, held LIFT/SINK, a real tap on the LAND chip; `phone-bot.mjs`, `phone-bot-assist.json`), starting with the ramp down as the game does:
off the ground (10 m) in **4.1 s** including the ramp, 2 km in **54.6 s**, down at the goal in 60 s (15 m off its marker), back, **landed on the pad 0.9 m from its centre** 43.9 s after the second take-off, hull 100%. 104 s for the 4 km.
(Before: the ramp alone was 6 s, then the stick.)

Touchdown, DOWN or LAND, hull 100%: 25 m 1.2 m/s, 150 m 1.2, 800 m 1.2 (19 s), 3000 m 1.2 (55 s). Rough ground, 12 spots 1 to 3 km out: 0 hung, 0 damaged. Steep slope (8 m of relief across the hull) 1.6 m/s.
Every ship in the registry (nine) climbs, flies and lands by hand with no damage.

## Tests

* `node test/validate.mjs`: section 62 (45 checks): the numbers scale and never kink, take-off, climb and descent, point and go, drift kill, aim and auto-level, the landing assist from 25 m to 3 km, pad pull, rough ground, boost and its lock, the power split, the old law untouched,
  Newtonian (rated thrust, no brake, trim), the field of view and streaks, then on a real authority over a socket: lift-off, 221 m/s, no teleports, clamped intent, unknown mode, a passenger cannot fly, the drop-off failsafe, DOWN lands, the snapshot carries the boost; and the bot before and after.
* `node test/flightfeel-browser.mjs`: the shared world, an iPhone WebKit page and a Chromium page: held LIFT lifts her on the authority, a held thumb takes her past 60 m/s, BOOST (127 m/s, the watcher's snapshot shows `boosting`), let go and she holds still (2 m/s), a **real tap on LAND** sets her down in 9 s at 1.35 m/s.
* `node test/phone-check.mjs`: 27 of 27 (iPhone WebKit and Android Chromium, including the free-flight bar and "no two buttons overlap"): `phone-check-RESULTS.md`. `node test/freeflight-browser.mjs`: OK.
* Screenshots here: phone portrait `phone-*.png` (pad, take-off, cruise with streaks, boost with the field of view kick, a turn with the bank, cockpit view, the NEWTON chip, the landing assist, landed, 2 km up at 1.95 km/s), landscape and 360 px layouts `layout-*.png` (`_layout.mjs`: no overlaps, nothing off screen), desktop `desktop-*.png`, shared world `shared-*.png`.

## What I could not verify, plainly

* **No real iPhone.** WebKit is the Windows Playwright build. A real tap is used on the chips, LAND and the settings; Playwright has no multi-touch hold, so held thumbs and held buttons are synthetic pointer events (the same ones `phone-check` uses). Whether the stick FEELS right under a real thumb is Jaron's to say. The numbers I would tune first are in `ASSIST` (`turnRate` 2.0 rad/s, `kV`, `speedNear`/`speedPerM`).
* **The mouse**: headless Chromium cannot take pointer lock, so the mouse steering is tested with real `mousemove` events and the locked flag forced on. Keys are real key events.
* **The first-timer is a script.** It measures time and softness, not "hard". The old stick's real problem (the hang on rough ground) shows; the thumb-fatigue part does not.
* **Streaming at speed**: at 400 to 700 m/s a few hundred metres off the ground I looked at stills, not at frame pacing on a phone; the ground tiers are built around the camera and the chase camera trails it. Worth a look on the phone.
* **The Newtonian expert bot loses hull** (hard touchdowns); a human expert will do better and a first-timer worse. That is the point of the toggle, not a tuned number.
* Terrain following reads the analytic ground, not a player's dug holes.
* Others see a hand-flown ship move at speed but I did not add a boost flame for other players' ships.
* Free flight above the air is as it was. F3's seamless-space work touches `spaceSystem.js` / `spaceTrip.js`; I only added one hook (the pads) in `spaceSystem.js` and resolved one merge in `server/simulation.mjs` (their `deepHold` field, my `HAND_KEYS` and ramp lines).

## Still open

* Does the left stick want to be a **direction** stick (point where you want to go, the ship turns toward it) instead of go + turn? The right-drag already steers the nose; a one-stick mode is a small step on the same law if the thumbs ask for it.
* A throttle slider / cruise lock (hold a speed hands-off) if holding the stick forward tires the thumb on long legs.

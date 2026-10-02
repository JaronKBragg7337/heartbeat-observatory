# Hired pilot orders on the server, and a pad of your own on each moon (2026-10-02)

Branch `cosmos-grok4`. The other builder's remote-ship collision, player smoothing and safe-graphics work was left alone (the walker, the fleet-view pose interpolation, and the renderer setup).

## What was built

* **Hired pilot orders are authority actions.** Fly to, hunt, supplies, roam, land, hold and return run on the server ship. Everyone aboard, and anyone watching that ship, sees the same flight. The same order while it is still being flown does not start another one. A replay of the same action id returns the stored receipt. A player who is not aboard that ship is refused. A refresh keeps the order, including one that was still on the ground, and the catch-up clock flies it. Offline solo still flies orders on that screen.
* **Each owned ship gets a Phobos pad and a Deimos pad.** Allocated like the Mars pads, append-only, and stored on the ship (`moonPads`), not in the Mars pad list. The flat is graded into the moon's own regolith. Paint, corner lights and a `PAD NN` sign are drawn in that moon's frame once the moon world exists. The first pad sits about 340 m from the survey pad, north of the Phobos rock survey. A later ship gets the next cell (96 m east, then a new row 120 m north). A refresh returns the ship to the same pad. Solo still aims at the survey pad. Spoil cannot be poured on a ship's moon pad.

## What was verified

`node test/validate.mjs` from `games/the-cosmos`: **658 passed, 0 failed** before the screenshot pass. The pad sign was then moved to the south edge of the rectangle so a parked hull does not cover the number. That move does not change the field or the checks. Section 29 is `test/grok4-checks.mjs`: two ships get different pads on each moon, clear of the survey site; each pad is flat to 5 cm with no loose rock and full cavity shade; the survey pad and the boulder at 270 m east, 56 m south still stand; solo still aims at the survey standoff and the shared ship aims at its own, more than 100 m apart; spoil is refused on the pad and accepted off it; a hired pilot takes hunt, supplies, roam, return and land; hold clears the key; a second hunt while the first is live does not restart it; a player who is not aboard is refused; an 18 s reload of a landed hunt gets airborne and moves; a descent from 15 m sets down on that ship's pad within 8 m; a second load keeps the pad id and the pose within 3 m. The two-client half uses its own FileAdapter: both clients are told different moon pads, a watcher who is not aboard cannot order the other ship, the owner and a guest aboard see one flight (same order key, poses within a centimetre, the ship moved), and replaying the action id does not fly it again.

## Pictures

Playwright, Chromium, SwiftShader, this folder's `shoot.mjs` on its own authority (a free port, not 8390). `d_` is 1280×720. `p_` is 390×844. JPEGs are gitignored. No page errors. The hunt frame left the readout and the pilot's line up. The moon frames hide that readout so a frozen Mars line cannot sit on a moon picture.

* `d_pilot_hunt` — Ada has the hunt. The Meridian is 94 m up over the port, engines lit, climbing. Her line is on screen: Mars airspace is neutral, and she is climbing to 1750 m to find the raiders. The gear is still down at this height.
* `d_phobos_pad`, `p_phobos_pad` — ship on its own Phobos pad. Grey regolith, the yellow rectangle, cyan corner lights. The phone frame is the hull and one stripe, with the owner standing beside it. The crater wall is still there.
* `d_phobos_markings`, `p_phobos_markings` — the south end. Stripes, two lights, and `PAD 01` under the engines. The phone frame reads the sign.
* `d_phobos_two_pads`, `p_phobos_two_pads` — two ships, two rectangles, on Phobos. The Stickney East survey disc is still up the slope, separate from both pads. These two are the wide ground tier, so the 40 m flat reads softer than it does in the close frames.
* `d_deimos_pad`, `p_deimos_pad` — the same ship on its Deimos pad. Smoother, warmer ground, the yellow rectangle, cyan lights on the desktop frame. Both pages were in the Deimos frame when these were taken.

## What does not work, and what is not verified

* **A roam can take a different path after a refresh.** The wander's random choices are not stored. The order itself is. It does not start a second roam.
* **The wide moon frames are the mid ground tier.** Close frames show the graded plane, the paint and the lights. The overhead pair shows two marked pads cut into the larger ground, and the survey disc still in place.
* **The moon readout still names the survey pad** (Stickney East, or the Deimos survey pad). The painted `PAD NN` is the ship's own pad.
* **Hold, supplies, roam, return and land** are in the validator. The picture is the hunt, because that one is visibly off the ground.
* **Not a phone.** The 390×844 frames are desktop Chromium with a phone viewport and a touch context. Heat and a Mali GPU were not measured.
* **Schema stays 2.** Moon pads ride on the ship record. Old saves get a pad when the ship is loaded.

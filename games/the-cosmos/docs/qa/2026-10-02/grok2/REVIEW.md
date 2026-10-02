# Board a captured Shrike, and give raider crews their own faces (2026-10-02)

Branch `cosmos-grok2`. The other builder's remote-ship collision, player smoothing and safe-graphics work was left alone (the walker, the fleet-view pose interpolation, and the renderer setup).

## What was built

* **Board a disabled or abandoned raider where it is** (`board-prize` in `server/authority.mjs`). The hull becomes an owned ship in place: same frame, same flight pose, a home pad allocated and not used yet. The server owns the owner, the pose and the crew the same way it owns any player ship. One flyer stays on your own ship (the pilot, or the captain if there is no pilot) and that ship holds station or follows. Everyone else you hired comes aboard and walks to a seat, or stands in the hold if the Shrike has no station for them. The surrendered raider crew leave. The flagship does not change until you set it on the ground at the port. The old prize-crew action still brings the hull to a pad, and those crew sign on with the raider look kept on the record.
* **Follow is a ship order, not a crew order.** `escort` on the ship record is `{mode, targetId}`. A hand on the stick clears it. Follow sits about 75 m behind and 28 m to starboard and matches speed. It is not collision. If the prize sets a course, the ship that is following takes the same destination.
* **Raider crews no longer wear the hall faces.** The same seven Loft people, rotated per hull (`src/ships/raider/looks.js`), with cloth, hair and skin tints and a duty helmet. The helmet is parented to the head bone in centimetres. The bone's local +Y runs back through the skull, so the bowl sits a little toward the face and the visor sits further that way. A raider saved without a look is dressed when the fleet attaches it. Hire-pool posts and names are unchanged.

## What was verified

`node test/validate.mjs` from `games/the-cosmos`: **642 passed, 0 failed**. Section 28 is `test/grok2-checks.mjs`: the look palettes, twenty hulls whose fours are distinct and none of which match an unmodified hall face, the helmet on a stand-in head bone, a prize crew still delivering to a pad with the look copied onto the signed-on crew, boarding refused while the raider is fighting or out of reach, boarding in place (owner, pose, frame, loot, pad allocated, no brain), the pilot staying to hold, the captain and the navigator coming aboard, the helm after a walk, the Meridian following (222 m and 89 m, 274 m apart), the same course taken by the escort, and a restart that keeps the owner, the pose, the escort and the looks. The earlier sections, including the prize-crew pad delivery, still pass.

## Pictures

Playwright, Chromium, SwiftShader, this folder's `shoot.mjs` on its own authority (a free port, not 8390). `d_` is 1280×720. `p_` is 390×844. JPEGs are gitignored, same as the other 2026-10-02 set. No page errors.

* `d_raider_quarter` — Dust Wolf in Mars orbit, scorched plates, the name on the hull, and the dorsal gunner's name (Corin Hale) over the turret.
* `d_raider_crew_helmets`, `d_raider_crew_side` — Lio Rook and Rafe Pike, the cockpit pair, before anyone boards. The exterior is hidden in these two frames: from outside, the nose and the canopy hide the faces. Dark bowls over the face, a narrow visor band (gold on one, darker on the other), different shirts, different skin at the neck. The four visor tints read back from the materials were smoke `1c2128`, amber `7a5a32` and gold `6a6248`.
* `d_panel_board`, `p_panel_board` — World / crew, desktop and 390×844, with "Prize crew brings Dust Wolf home", "Board Dust Wolf, my ship holds" and "Board Dust Wolf, my ship follows". On the phone the panel is the top sheet and it scrolls.
* `d_hold_after_board` — inside the Shrike after boarding. Mateo Ruiz (navigator; the Shrike has no nav seat) standing in the cargo hold.
* `d_cockpit_after_board` — the cockpit from the door. Helena Voss in the captain's seat. The Meridian is in the canopy, holding.
* `p_cockpit_after_board` — the same cockpit at 390×844. The canopy, the Meridian and Helena's Talk button are in frame. The seated bodies sit low and are mostly out of the tall frame.
* `d_meridian_holds` — the Meridian (pale) beside the Shrike (dark, red stripe), about 64 m apart, after the board. The message was: Helena and Mateo came aboard, Nia Okonkwo stayed with the Meridian to hold station, 520 credits were in the hold, and the Meridian remains the flagship until it is set at the port.

## What does not work, and what is not verified

* **There is no walk across the gap.** Boarding places you on the Shrike's boarding spot. You walk to the helm with the seat action that was already there. Ship-to-ship collision and a vacuum crossing are not this change.
* **Follow does not dodge.** It holds a formation slot. A hull in the way is the other builder's collision work.
* **The helmet is a smooth bowl and a flat visor band.** It covers the face. A little hair still shows at the crown. It is not a scanned flight helmet, and the neck and the shirt are still the Loft body. Zuri still has no hair cards; the helmet is what separates that face from the hall.
* **The portrait frames hide the hull.** The quarter shot is the one with the ship and a crew name together.
* **Not a phone.** The 390×844 frames are desktop Chromium with a phone viewport and, for the panel, a touch context. Heat and a Mali GPU were not measured.
* **The flagship stays the Meridian** until you are on the ground at the port and set it. The page reloads into the Shrike because that is the ship you are aboard, not because the flagship changed.

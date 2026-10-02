# Multiplayer parity fix — builder report

Finished. Validator: 505 passed, 0 failed (`node test/validate.mjs` in `games/the-cosmos`, 2026-10-01 9:12 PM). Browser walk passed with no page errors. Screenshots and notes: `games/the-cosmos/docs/qa/2026-10-01/mp-fix/REVIEW.md`.

Sol had already done most of the authority and client work. This pass fixed the course-cancel crash, made the phone/Talk parity check stable inside the full validator, finished the phone screenshots, and wrote the review.

## Jaron's three bugs

**Walking into the ship teleported him on and off.** The online board action ignored the walked pose and dropped the player at ship-local `(0, 0, 12)`, the cabin. Pose updates outside that old cabin box were rejected, so the client yanked him back outside. Board and leave now keep the walked pose when it is on the lowered ramp. The server accepts the continuous walk up the ramp, through the cargo corridor, along the gangway, and back down.

**Hire people were missing.** Candidates stayed stacked on one point inside the hall, and the online view did not draw them walking out. They now stand apart in the hall and walk out the door when you are near. The client draws those bodies.

**Talk was gone.** The Talk panel was only built for a solo world. An online visit never created it, so traders, tower staff, candidates and your own crew had no conversation. The online client now builds the same Talk UI and sends hire, dismiss and orders to the authority. The pilot's panel still has the course and x1 / x5 / x20 / x60.

## Other differences found and fixed

- Some WebSocket action sizes (126 bytes) dropped the connection. The frame-length parse now treats 126 and 127 separately.
- The cargo ramp and airlock were instant toggles online. They use the solo motors, and a ramp will not raise while someone is on it.
- Course speed, cancel, crew orders, engineering power split and the airlock cycle are authority actions. x60 on a Phobos course really lands.
- Dig, carry and pour match solo, including a refused pour that does not lose the load. Moon hand tools stay on the 1,054 kg cart.
- Buying, selling and the tower job use the real person you are standing next to.
- The tower lift carries the rider. Dismissed crew walk off instead of vanishing. Gun and drone hits are broadcast. The pilot can shoot when the captain is not in the seat.
- A course-cancel receipt with no message was written into the ship log and crashed the next frame (`msg` was missing). Empty notes are ignored, and the log painter no longer assumes every line has text. The spoken "Course cancelled" line still comes from the authority.
- Phone: World / crew, Settings, account, Talk, station sheets, course, jobs and the Controls pad fit a 390×844 screen, scroll when they are taller, and keep a close control on screen. "Saved to shared world" and Games are inside Settings. Money is one line in the top-left HUD. A red dot shows only when the save or the connection has failed.

## Still different

- Other players are visible. That is the point of the shared world.
- Trip time compression runs once, on the authority, so two players share one clock. The speed buttons still set x1 / x5 / x20 / x60.
- A pose the server refuses says "Board or leave through the boarding action" instead of sliding through the hull.
- Short ship notes ("Boarded.", "Systems nominal.") still appear under the HUD, the same as solo. They are not the old save box.
- The browser walk used a local FileAdapter on 127.0.0.2:8390, desktop 1280×720 and a 390×844 touch viewport. A physical iPhone was not in this run. The live Supabase process is checked at publish time.
- The raider ship class in the other worktree was not touched.

## Checks

- `node test/validate.mjs`: 505 passed, 0 failed. Sections 20 and 21 are the solo-versus-online action check and the browser Talk / phone check.
- `node test/mp-fix-browser.mjs`: walked onto the ramp, through the bay and back off; hall candidates came outside; Talk for every port worker, a hire candidate and every hired crew role; pilot speeds; observation binoculars; gun seats; the same worker answers in a solo browser; phone panels. No page errors.

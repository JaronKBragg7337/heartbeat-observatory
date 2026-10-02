# Multiplayer parity and phone layout — 2026-10-01

Online play against a local FileAdapter authority (`127.0.0.2:8390`), headless Chrome, `?tier=low&dev=1`. Desktop is 1280×720. Phone is 390×844 with touch. The live Supabase world was not used for these shots.

`node test/mp-fix-browser.mjs` finished with no page errors. The same script is what took the pictures below.

## What Jaron hit

Boarding used to snap the player to ship-local `(0, 0, 12)`, the cabin, then the next walked pose was rejected and they bounced back outside. `desktop-01` is the walked pose: standing on the cargo ramp, looking into the bay, with "Boarded." `desktop-02` is further up the bay. `desktop-03` is the walk back down the same ramp onto the ground. The server keeps the walked position.

Hire candidates used to stay stacked inside the hall, and the online client never built a Talk panel. `desktop-04` / `desktop-05` and `phone-01` are the hall after a player stands at the door: the six candidates walk out and stay visible. `desktop-08` and `phone-08` are Ada's hire conversation.

Talk was missing because the online client never constructed the crew UI. `desktop-06` is a market trader, `desktop-07` is the tower watch supervisor, `desktop-09` is your own pilot, `desktop-10` is that pilot's course with x1 / x5 / x20 / x60. The walk also opened every port worker and every hired crew role, and compared the fifteen worker answers with a solo browser. They matched. `desktop-11` is the observation lounge with the binoculars up (3×). Gun seats fired. No page errors.

## Phone (390×844)

`phone-01` is the world with panels closed. Money is one line in the top-left HUD (`10,000 marks · 2,500 cr`). There is no centered "Saved to shared world" box and no Games button on the play view. Settings is the top-right button. World / crew and Controls sit on the left edge.

`phone-02` opens World / crew. The close button is in the heading. The list is taller than the panel (928 px of content in a 752 px box, top 68, bottom 822, both edges inside 390). `phone-03` is scrolled to the end: Walter's Meet row and "Your crew" are on screen, and the close button is still in the panel.

`phone-04` is Settings. "Saved to shared world" and "← Games" are in that panel, with a close button. A red dot appears in the corner only when the save or the connection has failed; this run was healthy, so the dot is hidden. `phone-05` is the ship account opened from Settings.

`phone-06` is the food trader's buy/sell sheet. `phone-07` is the tower supervisor. `phone-08` is a hire candidate. `phone-09` is engineering, `phone-10` the course sheet (667 px of content, scrolls, close stays in the sheet), `phone-11` the jobs sheet, `phone-12` the touch Controls pad. Each measured panel stays inside the 390×844 screen, scrolls when the content is taller, and uses `touch-action: pan-y`. Station sheets for captain, pilot, nav, comms and engineer do the same.

## Still on screen on purpose

A short ship note ("Boarded.", "Systems nominal.") still appears under the HUD. That is the same note solo play shows. It is not the save box.

World / crew and Controls stay as buttons. Opening either one covers part of the view until you close it. With them closed, the middle of the phone is the world.

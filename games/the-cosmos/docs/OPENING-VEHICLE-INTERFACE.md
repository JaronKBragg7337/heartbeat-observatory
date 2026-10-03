# Opening ride integration for Grok Build

The opening owns the ride offer, passenger camera, private story checkpoint and
arrival at the shared port. The rover builder owns its geometry, player driving,
purchase, ownership and general vehicle persistence.

`src/opening/rideVehicle.js` accepts `{ root, wheels, passengerEye? }`.
`root` is a Three Group in the opening's local metre frame, with +Y up and -Z
forward. `wheels` contains the wheel Groups whose local X rotation rolls them.
`passengerEye` is a local `{x,y,z}` eye offset (default `.55,1.85,-1.15`). The
driver occupies `-.55` on X, with their seated head at 2 m. The opening alone
updates this instance's root pose during the scripted passenger ride.

The existing factory is `rescueRover(mats, low)` in `art.js`. To replace that art,
return the same interface and keep collision footprint approximately 4 × 6.3 m.
`ridePose(seconds,height)` supplies the 65-second route from `(-7,23)` to
`(-2600,-350)`; the adapter does not create a drivable or buyable vehicle.

This is a written handoff. No message was sent to Grok Build from this session.

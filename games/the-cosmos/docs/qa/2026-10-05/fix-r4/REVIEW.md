# Fix round 4 (Jaron's live iPhone play, 10/5 7:33 PM, items 26-30)

## 26 BLOCKER: lifeboat parts not buyable where NEXT says - fixed
Cause: the parts were only ever given by the "Ask X for the part" context button next to the giver; the shop/talk panels (catalog.js stock) never listed them.
Fix: the talk panel of any person who gives a part (Mars: Salvage trader = power cell, Field kit trader = fuel coupler; Ceres: Marta Voss = cell, Doctor Roth = coupler)
now carries a "Lifeboat repair" block with a Buy button (300 marks) while the player's lifeboat is drained and lacks that part (`partsSoldBy` in src/opening/lifeboat.js,
`_repairOffer` in src/crew/crewUI.js; same authority action `lifeboat-part`). The NEXT line now says "tap Talk, then the shop".
Test (opening-checks): Mars arrival buys cell at trader-2 and coupler at trader-4 (300 each), fits both, lifts; the part lists match on Mars and Ceres. Ceres chain test already existed.
Verified: authority path headless. NOT verified by eye: the panel button on a phone (needs a shared-world session).

## 28 Skiff flight deck tan slab - fixed (verified by eye, real GL Chromium via ANGLE, headed)
Cause: the hull's roof from the nose to the flight deck's aft wall sits at y 1.05 (the canopy sill), i.e. through the consoles and seats; from the seats you look at its top face.
Fix: those roof faces are now their own mesh (`splitTop` in _liner/hullShell.js, `ext.insideHide` in lifeboat/exterior.js), hidden while the camera is aboard in the cockpit (shipSystem.js). Outside it is unchanged.
Images: skiff-pilot-fwd-down-before/after.png, skiff-window-aft-*.png, skiff-pilot-fwd-*.png (script: test/fix-r4-skiff.mjs). The stage uses a stand-in ground/sky colour.

## 29 People walk backwards - fixed
Hired/pool people on the ground (multiplayerView.js) kept the crew hall's facing; they now turn smoothly to face where they move (`faceMove`); walkers on the ship's route face the route (yaw was ignored when not in the local ship). Solo crew already turned. Not verified by eye (needs a live shared session).

## 30 Crew-flown ship low and backwards - partly reproduced
Server flight with a hired pilot (Skiff, Mars) never went tail first in my headless runs, so the "backwards" is either a drift while turning about or a client view issue I could not reproduce.
Changes in src/crew/autopilot.js: cruise 110 m -> 260 m (scaled down for short hops), climb out straight up first (to 0.6 of cruise) before any forward thrust, roam 200-320 m,
and a tail-first guard (if the speed along the nose is below -1.5 m/s, thrust ahead). New crew-checks test: a far goto never goes tail first and cruises over 150 m.
UNVERIFIED live: if it still flies backwards on the phone, we need the order he gave and a clip.

## 27 Hiring - guidance only, no big system
The Crew Hall (Marineris Port, door at port-local -28,-60) and the six candidates exist; they step out only when you come within 12 m of the door (by design: "walk out of doors to meet you"),
so a new player never saw them. After the lifeboat is fitted with no crew, an edge arrow now points to the hall door (after the usual minute away) and the NEXT line says where it is and what happens at the door.
Ceres players: the NEXT line says crew are hired on Mars (fly home); there is no hall on Ceres.
Still empty that would make places feel alive (not built): Ceres has no hiring hall or job board; the Mars hall's candidates are invisible until you reach the door (no one visible in the doorway); no ambient walkers on the port apron or at the Exchange;
no one at the arrivals hall; Ceres Occator Works has only its fixed workers; no ambient ships landing or taking off.

## Validation
See validate.txt and phone-check.txt in this folder.
Validation: validate.txt 1867 passed, 0 failed. phone-check.txt: 33 rows all PASS (log ended without a summary line; no FAIL).

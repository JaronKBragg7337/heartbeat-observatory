# SH15: the big transports - review, 2026-10-03

Package SH15 of the bible's build order (BIBLE-v3 section 10.1 and 16): the huge passenger transport that carries a new pilot to Mars, the transport that
carries them on to their chosen world, and the huge ships that fly beside the first one "close enough to read their names". Worktree `../ho-sh14`, branch
`cosmos-sh14`. The starter ship (SH14) is reviewed in [../sh14/REVIEW.md](../sh14/REVIEW.md). All four ships are data (`src/ships/<type>/`, F1's registry:
role, blurb, description, stats, thumbnail, registry id), walkable end to end, drawn by the same interior builder as the Meridian.

## The ships

| Type | Class and name | Size | What you can walk |
|---|---|---|---|
| `transport` | Ares-class passenger transport, "Ares" | 120 x 28 m, 1,800 t | Bridge on a low prow, crew passage, crew quarters and mess, a **64 m promenade** with planters, kiosks and departure boards, **five seating salons** (300 seats in forward-facing banks, a window wall each), a **lounge with an 11 m panoramic window** and two telescopes, a cafe, a medbay, passenger stores, a **boarding hall with an outer door and a 1.8 m gangway**, machinery with the reactor, and a cargo hold with a 4.4 m stern ramp. |
| `descender` | Kestrel-class descent transport, "Kestrel" | 66 m long, wings 31 m, 420 t | Bridge, two three-bank passenger cabins (198 seats), pantry, boarding vestibule with gangway, heads, stores, machinery, and a **boat bay** with a stern ramp. |
| `bulker` | Long Haul-class bulk carrier, "Long Haul" | 240 m, 38,000 t | The crew block at the nose is walkable (flight deck, quarters, mess, machinery, boarding vestibule, cargo control, hold bay with ramp). The ten ore pods and four tank spheres are drawn, not entered. |
| `escort` | Line Marshal-class escort cutter, "Line Marshal" | 44 m, wings 30 m, 24 t | Flight deck with five stations, quarters, mess, armoury, vestibule, heads, stores, machinery, rear bay and ramp. Fast (70 m/s) with a chin cannon pair. |

None is on the shipyard kiosk (no `priceCredits`): they belong to the Mars Line. Every one has a thumbnail under `assets/ships/` rendered from
`visuals.buildExterior`, and the hull names are painted on both flanks from `visuals.decalTexture` (the opening sets the name per instance).

**The convoy** (`src/ships/transport/convoy.js`, pure data and maths): six neighbours for the opening, in the player's transport's frame, with a slow sway:
two sister transports ("Tharsis Promise", "Elysium Overdraft"), two bulkers ("Not A Smuggler", "Regolith Dreams"), two escorts ("Very Sorry About The
Paperwork", "Quick Receipt"); the player's own is "Hellas Dawn". Checked: no two ever come within 15 m of each other (box test, 15 minutes), five hold
station within 150 m of the player's flank so names can be read. **Passenger seats are data** (`def.passengerSeats`, from `_liner/pax.js`): every seat's
room, position and facing, so the opening can sit people in them without knowing how the ship is furnished.

**Livery:** F0's `mars` style read live (`_liner/livery.js`): hull, belly, rust band, thin cyan line, engine glow; the escort wears the second hull colour;
registry marks come out as F0's `MR-0412` form. Slots are the ones F0's `applyLiveryTint` uses, so a later re-dress needs no change here.

**The shared kit** (`src/ships/_liner/`, documented in `docs/ADD-A-SHIP.md`): the lofted hull builder (with a hole for a door or a ramp), the parts every
ship needs (legs, ramps, engines, lift pods, neutral pose), passenger furniture, a room dresser, the livery reader. SH1 to SH13 builders can reuse it.

## What was checked, and how

* `test/pkg-sh14.mjs` (in `node test/validate.mjs`; quick run `node test/_sh-only.mjs`, 129 checks, about 15 s): per ship, a person walks to every room and
  every station; doors and furniture are honest; rooms fit inside the hull; the interior draws every room and seat inside a triangle and draw-call budget
  and no single room costs more than 60,000 triangles; the exterior has every part the game animates; the declared envelope matches the built hardware
  within 8%; the ship rests on its legs, lifts, cruises and lands on the Mars pad (the 240 m ship is checked for thrust over weight and lift only: see
  below); the passenger seats; the F0 livery slots; the convoy's clearances. The fleet-wide checks that loop over every ship (ramps open outward, seats
  have a place to stand) also run on all five new types.
* `node test/sh-browser.mjs`: the REAL game on an iPhone-profile WebKit phone and an isolated authority; each ship is given to a pilot, set on the Mars pad,
  the pilot placed inside it and then outside with a free camera. All five drew with no page error. It also found a real bug (the decal material, see
  the SH14 review).
* Pictures here (jpg, kept local like the rest of docs/qa): in the game `game-<ship>-aboard.jpg` and `game-<ship>-outside.jpg` for transport, descender,
  bulker, escort; renders `transport-promenade`, `-salon`, `-lounge`, `-cafe`, `-gate`, `-bridge`, `-hold`, `-exterior-hero`, `-exterior-stern`;
  `descender-cabin-a`, `-bay`, `-pantry`, `-exterior-hero`; `bulker-passage`, `-bridge`, `-bay`, `-exterior-hero`; `escort-bridge`, `-armoury`,
  `-exterior-hero`. (The inside renders have black windows: the render page has no world behind them; in the game the windows show it.)

## What is honest to say

* **Pad fit is NOT solved and is not mine to solve.** Marineris Port's Pad 01 is 38 x 64 m. The Ares is 28 x 120 m: it does not fit any pad, so "lands at
  Marineris Port the normal way" needs a big-transport apron (a new `PADS` entry in `src/port/portSpec.js`, a shared file I did not touch) or a different
  landing spot. The Kestrel is 66 m long with 31 m wings: it overhangs Pad 01 by 2 m at the ends. The server's pad allocator (`allocPad`) would put a new
  owned ship of any of these types on the existing grid; nobody can buy one (no price), so it only happens in a test.
* **The 240 m ship does not rest on a pad.** Its four legs exist so the registry, the interior and the animation are complete, but the ground under 240 m
  is never flat and the flight model's landing check does not settle on it. It lifts and cruises; it is meant to fly past, not to land.
* **People are not in the ships.** No passengers or crew are placed (the opening does that, from `passengerSeats` and `crewPosts`); I added no speaking lines,
  so no voices were generated.
* **The exteriors are lofted octagons with plating and greebles**, so they read a step simpler than the Meridian's hand-built hull. The interiors are on its
  level because the same builder draws them. The seats are blocky (the triangle budget did not allow soft cushions in 300 of them).
* **Size, as designed.** 120 m, 66 m, 240 m and 44 m are design numbers; there is no real Mars liner to measure. Door and corridor sizes are real human scale.
* **Phone performance is budgeted, not measured.** The Ares interior is about 200,000 triangles in all, but only the rooms near you are drawn (the game's
  room visibility); the heaviest single room is under 60,000. I did not measure frames per second on a phone, only that the real game, in a phone-sized
  WebKit, draws every ship with no error. Not verified on a real iPhone in Safari.
* The convoy and the passenger seat lists are data with tests; nothing in the game flies the convoy yet (the opening is a separate package).
* Livery: the line is neutral Mars (F0). Faction transports (Fortis troopships, Technos liners) would call `linerLivery('<faction>')`; the building blocks are there.

# SH14: the starter ship (the Skiff lifeboat) - review, 2026-10-03

Package SH14 of the bible's build order (BIBLE-v3 section 16, "starter ships, one per start world"). Worktree `../ho-sh14`, branch `cosmos-sh14`.
The shared kit and the five ships of SH15 are reviewed in [../sh15/REVIEW.md](../sh15/REVIEW.md).

## What was built

**One hull type, `lifeboat`, with five world paints.** The bible says "one per world, local look"; the builders' brief lets one hull serve every world.
So there is one ship (`src/ships/lifeboat/`) and `looks.js` holds a paint per start world, picked by `opts.world` when the
exterior is built: Mars, the Moon, Ceres, Earth, Callisto. Every one gets a shipyard picture (`assets/ships/lifeboat.webp` for Mars, and
`lifeboat-moon`, `-ceres`, `-earth`, `-callisto`), rendered from `visuals.buildExterior` by `node tools/render-ship-thumbs.mjs thumbs lifeboat`.

**The boat.** 11 m long, 5 m wide, 6.8 tonnes, three stations (pilot, captain, navigator) under a canopy. Rooms: flight deck, cabin (benches along the
wall, a table, a bunk, a locker, a first-aid box), a vestibule with a side hatch and a gangway, a stores locker, and a rear bay with a ramp. Four short
legs, a big stern bell with two thrusters, four belly lift pods, a beacon mast, grab rails, rivets, scuffed and replaced plates and a sooted stern: it is
meant to look used. Real registry fields: role, blurb, description, stats (`valueCredits` 1,800, no `priceCredits`: it is not sold at the yard), a
thumbnail, `registryId` COS-MARS-VEH-0484. It lists after the Meridian line (`order` 45).

**Livery.** Mars is read live from F0's `mars` faction style (hull, belly, rust band, cyan line, engine glow): the Mars boat and the Mars Line ships match.
The other four worlds have no neutral look in F0 (a world's two factions are not the boat's builder), so those four paints are PLACEHOLDERS in the same
slots (civil blue-white, hi-vis yellow, rescue orange and sea blue, ice-grey with amber), noted as such in `looks.js`. Jaron or F0 can name them.

## What was checked, and how

* `test/pkg-sh14.mjs` (inside `node test/validate.mjs`; quick run `node test/_sh-only.mjs`): the registry card, a person can walk to every room and every
  station, every door has clear floor and sits in the 0.2 m wall, furniture inside its room, rooms inside the lofted hull, the built interior and exterior
  (the parts the game animates), the flight model (rests on four legs, lifts, cruises, lands without damage), the five paints (five different accent
  colours, applied to clones so the Meridian's materials are untouched), and that the game's decal material is used as given.
* `node test/sh-browser.mjs lifeboat`: the REAL game on an iPhone-profile WebKit phone against an isolated authority. The ship is given to a pilot,
  set on the Mars pad, the pilot is placed inside, then outside with a free camera. It drew, with no page error. This test found one real bug while it
  was being written (the game hands `buildExterior` a ready MeshBasicMaterial as `opts.decal`, my first version wrapped it in another and the browser
  failed the shader link and fell back to the safe graphics tier); fixed, covered by a unit check.
* Pictures in this folder (jpg: the repo keeps jpgs local, as the rest of docs/qa does):
  `game-lifeboat-aboard.jpg`, `game-lifeboat-outside.jpg` (the real game), `lifeboat-cockpit.jpg`, `lifeboat-cabin.jpg`, `lifeboat-hold.jpg` (inside),
  `lifeboat-mars.jpg`, `-moon`, `-ceres`, `-earth`, `-callisto` (the five paints). The inside renders have black windows because the render page has no
  world behind them; in the game the windows show the world.

## What is honest to say

* The hull is a lofted octagon, so it reads boxy and bus-like next to the Meridian's greebled plating. The interior is on the Meridian's level (it is built
  by the same builder), the exterior is a step behind it.
* The seats and benches are the existing props. No people are in the boat (that is the opening's job; `def.crewPosts` and the seat list are ready).
* Unverified: a real iPhone in Safari (only Playwright's WebKit iPhone profile was used); frame rate on a phone (I measured triangle budgets, not FPS);
  how the boat comes to the pilot in the opening (not part of this package).
* Open for Jaron: the four non-Mars paints are placeholders (see above). Nothing in this package speaks, so no voices were generated.

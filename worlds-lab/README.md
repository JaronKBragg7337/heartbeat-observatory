# Worlds Lab

**New walkable worlds and a reusable world-building kit for Heartbeat Observatory — staged in their own folder, zero edits to live code.**

Gallery: **[/worlds-lab/](https://www.heartbeatobservatory.com/worlds-lab/)** (unlinked from the live town until Jaron wires it in).

Built 2026-06-11 in a Cowork session. Shared implementation context: BUILD stamps + `?v=` cache busting on every page, boot calls at end-of-file (TDZ check), phone + computer parity on every feature, and clear status language (lab worlds identify themselves as solo previews while they are in development). **Not one line of `/engine/`, `/world2/`, or any other live file was touched.**

## The map

```
worlds-lab/
├── index.html            ← the Lab gallery (flat page, phone friendly)
├── README.md             ← you are here
├── CREDITS.md            ← film sources, licenses, verification trail
├── lib/
│   └── v1/               ← THE KIT (frozen — see freeze law below)
│       ├── kit.js        world chassis: renderer/sky/day-night, World-1 movement
│       │                 feel, touch+keyboard, colliders, doors, interiors, RIDES
│       ├── textures.js   20+ procedural canvas textures (zero downloaded art)
│       ├── props.js      25+ code-built props
│       ├── buildings.js  houses ×7 styles, shops, towers, lighthouse, castle,
│       │                 observatory, control tower, barn, walk-in room shells
│       ├── vehicles.js   cars/taxi/bus/truck/golf cart/boats + patrol + rideable
│       ├── rails.js      track splines, stations, boardable steam trains
│       ├── coaster.js    full roller coaster: rails, supports, energy-based speed
│       ├── rides.js      ferris wheel, carousel, sky swings (all rideable)
│       ├── aircraft.js   helicopter tours, hot air balloon hops, blimps
│       ├── space.js      rocket launch rides, UFOs, shuttle, dish, moon buggy
│       ├── cinema.js     walk-in theaters playing REAL legally-free film
│       ├── layouts.js    terrains (hills/island/canyon/dunes/snow/craters) +
│       │                 plazas, street grids, boardwalks, paths
│       ├── comingsoon.js the honest coming-soon gate kit
│       └── page-template.html  ← shared page scaffold (same UX as /world2/)
├── tools/
│   └── generate-pages.mjs  ← stamps every world's index.html from the template
├── worlds/               ← 8 finished lab worlds (each fully self-contained)
│   ├── theme-park/       Starlight Park — coaster, wheel, carousel, swings
│   ├── railway-valley/   Whistle Stop Valley — rideable steam train, 2 stations
│   ├── skyport/          Skyport Mesa — helicopter tour, balloon, blimp
│   ├── cosmodrome/       Cosmodrome 7 — rocket launch ride, UFOs, NASA theater
│   ├── cinema-district/  Marquee Row — 3 theaters, all legally-free reels
│   ├── island-resort/    Coral Cay — palms, boats, turning lighthouse
│   ├── winter-hollow/    Winter Hollow — the winter pattern kit, dressed
│   └── neon-bazaar/      Neon Bazaar — permanent night market (fixed-time demo)
└── coming-soon/          ← 4 honest gates, plug-in ready
    ├── underwater-reef/  The Reef
    ├── sky-islands/      Sky Islands
    ├── mars-colony/      Dome Nine
    └── haunted-manor/    Hollow Manor
```

Every world is reachable right now at `/worlds-lab/worlds/<slug>/` or `/worlds-lab/coming-soon/<slug>/` — live but unlinked, exactly like a back lot.

## Riding things (the new mechanic)

The kit adds a **ride system** to the proven door/prompt pattern: a door's act can be
`{ type: "ride", ride }` where a ride answers *"where am I at time t?"* The camera
boards it, the prompt becomes "Hop off", and dismount returns you to the platform.
The coaster, train, ferris wheel, carousel, swings, helicopter, balloon and rocket
are all this one mechanic. Anything that moves can be made rideable in ~10 lines.

## How to plug a world into the live site (when one earns it)

1. **Link it.** Add a card/door wherever it belongs — e.g. a `worldcta` on the
   landing page (like World 2's), or a door in a live world using the existing
   doors array pattern. That's the only edit to live code, and it's one line-ish.
2. **Flat page rule** (Lillith's standing rule): every 3D space keeps a normal
   page for people who don't want 3D. The Lab gallery (`/worlds-lab/`) serves
   this for the lab as a whole; give a promoted world its own flat page if it
   becomes a section.
3. **Multiplayer, when wanted** — port the launch-night law set exactly as
   `world2/main.js` documents it: own channel name (`<world>-town`, never reuse
   `engine-town`), 10Hz state cap + idle suppression with 5s keepalive,
   `presence.track()` = join/leave identity only, interpolation delay ≥ 2× send
   interval (250ms), broadcast + 30s ground-truth reconcile for shared objects
   (postgres_changes is unreliable on this project — recorded law).
4. **Deploy law** — any time you edit a world's `main.js`, bump its `BUILD`
   const AND the `?v=` in that folder's `index.html`, same commit.
5. **Verify live** — re-fetch the deployed files, check the console logs
   `Heartbeat Observatory — Worlds Lab build <BUILD>`, walk it on a phone.

## How to make a brand-new world (10 minutes)

1. Add an entry to `tools/generate-pages.mjs` (name, slug, accent, tagline,
   honest note) and run `node worlds-lab/tools/generate-pages.mjs`.
2. Create `worlds/<slug>/main.js`: pick a terrain from `layouts.js`, call
   `createWorld`, compose props/buildings/vehicles/rides, end the file with
   `build(); kit.start();` (TDZ law).
3. Want it "coming soon" instead? Copy any folder in `coming-soon/` and swap
   the name, accent and hero — `comingsoon.js` does the rest, honestly.

## LIB FREEZE LAW (please keep)

Once worlds ship on `lib/v1`, **v1 files never change** — a fix for one world
must not be able to break another (the same isolation law that keeps World 1
untouchable from World 2). Improvements go in a new `lib/v2/` that new worlds
opt into. The only exception: a security fix, applied with all worlds re-walked.

## What is honestly NOT here yet

- No Supabase presence in lab worlds (they say "solo preview" on the way in).
- No seat-binding in theaters, no drivable (free-steer) vehicles — rides are
  scripted paths by design, so phones and computers stay perfectly equal.
- Coming-soon worlds contain exactly what their plaques say: a gate, a preview,
  and the truth.

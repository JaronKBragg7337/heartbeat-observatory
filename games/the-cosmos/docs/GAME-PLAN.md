# The Cosmos: the game plan

One page. What the full game is, what is real today, what comes next, and how we know it is done.
Kept by the lead builder (Fable). Updated after every milestone. Last update: 2026-11-19.

**This is the current plan.** Nothing about the plan had been written since 10/10. It is built from, newest first:

- `AI-Shared/projects/syl/DECISIONS.md` (9/30 to 10/3, Jaron's dated answers; it wins over everything)
- `AI-Shared/projects/syl/BIBLE-v3.md` (10/3, the full design)
- The Cosmos docs in this folder and the README (up to 10/10) and the gap list of 10/8
- `SYL-VISION.md` (9/30)
- Older background only: the SYL-Full-Game vision and roadmaps (8/15), Design Bibles v2.9 and v2.7 (undated, older)

Where they disagree the newest wins. What is still unsettled is listed at the bottom for Jaron.

## The game in a few lines

It is 2080. The Solar System is the real one: real planets and moons, real sizes, real distances, real gravity, real day and night.
You start with nothing, crash on a world, and build your way back up to space. You fly your own ship, walk inside it, hire a crew,
haul, trade, dig, fight raiders, and help your home world grow. Works alone. Works with other players in the same shared world.
This is Game 1: real places, with some made-up tech and resources where real knowledge is thin, and a sense of humour.
Game 2, later, is the exact-real one.

## The player's journey, start to finish

1. **Arrive.** You wake on a big passenger liner coming in to Mars, with huge ships flying beside you. You land at Marineris Port.
2. **Choose.** In the arrivals hall a board shows every world and the two sides on each. You pick a world. Or you stay on Mars
   as a peacekeeper: neutral, building shared stations and earning from them.
3. **Crash.** Your transport goes down on the way. You wake in the wreck, dig out, and get a ride to your world's port.
4. **First ship.** A drained lifeboat sits on your pad. Each side gives you one part. Fit both and she flies.
5. **Work.** People give you jobs when you talk to them. Carry, haul, dig, deliver, survey. Pay arrives when the job is done.
6. **Pick a side by working.** Doing a side's first job joins you to them. No sign-up form. You can switch once a season
   (after day 7), in the open, and it costs you that side's license.
7. **Grow.** Buy bigger ships. Hire crew (pilot, gunners, more). Rent a shop stall. Trade between worlds where prices differ.
8. **Cross.** Fly the long-range drive to another world. Same sky the whole way, no loading screen. Landing at another world's
   port for the first time is "first contact": those people are strangers. Trade with them, build with them, or fight them.
9. **Build home.** Your work moves your world's balance. Sides that work together unlock a shipyard, a relay, a station.
   Sides that compete make a rich, armed, crowded home. Both are real ways to play. Seats (governor, dock boss, leader)
   are held by NPCs until a player earns one or is voted in.
10. **The big story.** A quiet signal, your first crossing, then outward: Callisto, what was found at Europa, and a strange
    ship seen up close once. It is never caught and never explained in Game 1. Then Saturn. One player can reach this ending
    alone inside a season.
11. **Seasons.** A season is 90 days. Each one starts again through Mars, with a new cause for the crash. What you built at
    home stays. Bases far from home, ships not parked at home and unpaid money do not.

## What exists today (live)

- **Worlds you can walk on:** Mars (Marineris Port), Phobos, Deimos, the Moon (three landings: Tranquility, Shackleton, Daedalus),
  Ceres (Occator Works), Earth (a launch complex), Callisto (a camp under Jupiter). All real size, real gravity, real day length.
- **Ground you can dig** in any direction, with real layers. Ice on the Moon, ore and salt on Ceres.
- **Ships:** about ten, all walkable inside (Skiff lifeboat, Meridian, Shrike raider, Drayman hauler, Ares liner, Kestrel, more).
  Seats are how you use a ship. Guns, shields, power, fuel in free flight.
- **Space flight:** take off, fly a course or fly free, land anywhere. The long-range drive reaches every built world with no cut.
- **The opening** (steps 1 to 4 above) for Mars and Ceres starts.
- **Jobs and short stories** on Mars, Earth, Ceres, the Moon and Callisto. Hiring desks on each. Joining a side by its first job.
- **People** with real-looking bodies, names, voices and roles. NPCs hold every seat until a human takes it.
- **Seats, the balance and home strength** per world (first pass, see `ROLES-AND-BALANCE.md`). Ten faction style sheets.
- **Shared world:** a server holds the world, saves it, and lets players see and hear each other.
- **Phone controls** everywhere (thumbstick to walk, buttons for the rest).

## What is weak today (honest)

- **Looks on airless worlds** are a first version: shadows and ground are right, but there are no big boulders yet and the suit is simple and very clean.
- **Night sides** are nearly black with nothing to see by.
- **From space,** the landing area shows as a square patch; Mars looks dim from Phobos.
- **Upkeep is free.** Fuel and repairs cost nothing, so money has less meaning.
- **Earth:** a small ship cannot lift off it yet, and there is no shop.
- **Work repeats thinly.** Stories are one-time. There is no board of repeating freight jobs.
- **Caves** exist in the ground but are not drawn.
- **Not built at all:** seasons, stations and docking, the Belt, the two station factions, building with drones, weather and
  disasters, the main story arc, licenses and labels, player-versus-player rules, world currencies, walking in open space,
  work machines (digger, hauler truck, compactor), public transport, the Earth lifter.

## The parts, in the order a new player meets them

Changed 11/19 (Jaron, 1:59 PM): the target is a production-ready full game, built in whole parts, not a string of small fixes.
Each part is a complete stretch of the game: built, wired, tested on a phone and a desktop, and shipped as one piece.
The story still comes after the worlds it happens in (Jaron, 10/3).

**Every part must pass the same bar before it counts as done:**
a stranger understands it with no help; nothing is lost on a refresh or a dropped connection; it holds a steady frame rate on a
phone and does not grow in memory over a long session; no errors; it still works when the game server is down; it reads at 375 px
wide and on a big screen; it plays with touch, mouse/keyboard and a gamepad, with nothing tied to one platform; it plays fully as the home-screen app (no browser bars, the notch and safe areas, rotation, a fast return from the
background); the key actions have sound and feedback; it looks right in a screenshot; and it has had a full test pass (the normal path
and the odd ones, phone and desktop).

| # | Part | What "done" means | State |
|---|---|---|---|
| 0 | **Looks groundwork** | Suits outside, airless light and shadows, a night you can walk in, Mars bright in a moon's sky. | Shipped 11/19 (first version) |
| 1 | **The first hour** | First launch to your own flying ship: liner, port, board, crash, dig out, ride, fit the lifeboat, first take-off. Clear at every step on a phone, with sound, and it resumes anywhere. | Built; needs the production pass. NEXT |
| 2 | **Mars and its moons, a finished region** | Marineris Port, the open desert, Phobos and Deimos: jobs, shops, a reason to visit each, boulders and landmarks, clean views from orbit to ground, day and night. | Built; thin in places |
| 3 | **Work and money, end to end** | Jobs as a real ladder with rewards, a repeating freight board on every world, trade between worlds, fuel and repairs that cost, buying a bigger ship, hiring crew. A goal to save for. | Pieces built; no loop yet |
| 4 | **The game shell** | Every platform we can reach: phone first (iOS and Android), PC (mouse/keyboard and gamepad), the home-screen app, consoles later through the gamepad layer. One input layer, UI from 375 px to a TV. Settings (sound, controls, quality), quality tiers, save and resume that never loses anything, a clear message and solo play when the server is down, long-session memory, loading that explains itself. | Partly built |
| 5 | **The crossing and the other worlds** | The long-range drive, then the Moon, Ceres, Earth and Callisto each finished like part 2: opening start, shop, a way to leave, both sides' homes. | First passes built |
| 6 | **Sides, seats and seasons** | Joining and switching, licenses and labels, seats and votes, the balance you can see in the place, the 90-day season. | First pass of seats and balance |
| 7 | **Stations, the Belt, the station factions** | Docking, a station over Mars, Vesta and Psyche, the Long Walk, Corsair's Refuge. | Not built |
| 8 | **Building, machines, weather** | Bases and stations built by drones, work machines, storms and disasters, caves you can see. | Not built |
| 9 | **The main story** | The first crossing, Callisto, Europa, the ship seen up close. An ending one player can reach in a season. | Not built |

Small things still open from part 0: suits come off inside buildings and domes; hired crew walking to a ship; real boulders;
the square patch on Phobos seen from space; ships' hulls read as bricks; at Mars dusk the ground takes the sky's blue.

## "Full game" checklist

The bible's own bar for launch: every world standing with its port, both of its faction capitals at least as a first pass,
NPC staff, the opening running end to end, the balance moving, seasons ticking. "All faction worlds at launch, no half game."

- [x] Real Solar System bodies at real scale with real day and night
- [x] Walk, dig, fly, land with no loading screens
- [x] Walkable ships with working seats
- [x] An opening that takes a new player from nothing to a flying ship
- [x] Jobs given by people, paid on arrival
- [x] Crew you can hire
- [x] A shared world that saves
- [x] Works on a phone
- [ ] Plays well on phone (iOS + Android), PC (mouse/keyboard + gamepad), home-screen app; console-ready input and UI for later
  (full screen, notch and safe areas, rotation, fast return from the background; one input layer for touch, mouse/keyboard
  and gamepad; UI that scales from a 375 px phone to a TV at 10 feet; quality tiers from phone to desktop GPU)
- [ ] Production bar met on every part (see the parts table)
- [x] Seats held by NPCs, a balance and home strength per world (first pass)
- [x] Everyone dressed right for where they stand (suits outside; first version)
- [ ] Every world looks like itself in day and at night
- [ ] Clean views from orbit down to the ground on every world
- [ ] The opening works for every start world
- [ ] Repeating work on every world
- [ ] Fuel and repairs cost something
- [ ] Every world has a shop and a way to leave
- [ ] Caves drawn
- [ ] At least one station you can dock at
- [ ] Every faction's home stands (10 factions with the Unbound; 6 have a first pass)
- [ ] The Belt, the Long Walk, Corsair's Refuge
- [ ] Seasons (90 days), elections and votes
- [ ] Switching sides, licenses and labels; rules for fighting other players
- [ ] World currencies and exchange; a shipyard with pictures
- [ ] Building your own base; work machines
- [ ] Weather and disasters
- [ ] The main story to its ending (Europa, the ship seen up close)

## Open questions for Jaron (not decided by any AI)

- What should fuel and repairs cost? What does losing a ship cost? (The bible says "priced later".)
- How does a small ship leave Earth before the Earth lifter exists? (Earth's gravity is too strong for the lifeboat as built.)
- AI models as faction leaders: written down 10/3 as "idea, not approved".
- Names never confirmed: "the Unbound", the world currencies (lunars, shares, dollars), the Meridian as "Patrol Gunship".

## Where the plans disagree (for Jaron to settle)

Already settled by dated decisions, listed so nobody reopens them: real Solar System (not an invented galaxy), real scale,
browser (not Unreal or Unity), the liner-and-crash opening, 90-day seasons, NPCs in every role, fly anywhere from day one.

Still not lined up:

1. **Stations far from home at season end.** The bible (section 5) says they are lost. The newer decision (10/3 12:06 PM) says
   peacekeeper stations stay but drop back a stage. This page follows the newer one. The bible was never updated.
2. **Callisto's second seat.** The bible says it goes to the first player who builds there. The newer decision says the Unbound
   hold it. This page follows the newer one.
3. **Old factions.** The older plans had Custodians and YOM (a relief faction). Nothing ever said they were dropped.
4. **The sun-heat meter and the instability resets** from the old plans. Seasons replaced the resets; the meter was never ruled on.

## Ideas kept from older plans (paused, not dropped)

Only in the older documents, never decided against. Kept here so they are not lost: a companion (Watcher, Crawler, Stride);
an AI director; custodian stages and a stability index; momentum rules so leaders cannot run away with it; intel trading,
bribes and spies; pirate bosses; rebellion and coups; player-made factions and fleet command; crew morale; a council of worlds;
parts that break off ships and can be salvaged; crafting and refining; a snap builder with saved blueprints; the matter beacon;
assisted flying with an expert switch (decided 10/3, partly built); private bases (PSI, "kept for later").

## Shipped by the lead builder

| Date | What |
|---|---|
| 11/19 | Helmet lamp no longer stuck on in sunlight on moons (it washed the ground tan). |
| 11/19 | A night you can walk in on airless worlds: Mars lit and bright in a moon's sky (it went black), Marsshine on the ground, a white helmet beam where you look. |
| 11/19 | Airless worlds look airless: near-black hard shadows, darker ground, small craters everywhere, no more wind ripples on Phobos, no checkerboard on sunlit slopes. A moon inside Mars's shadow now goes dark (it stayed sunlit). |
| 11/19 | Pressure suits and helmets on everyone outside (you, port workers, the Moon, Ceres, Callisto, other players). A slow floating bound in low gravity. |

Build log with pictures: `AI-Shared/projects/games/cosmos-fable-build/BUILD-LOG.md`.

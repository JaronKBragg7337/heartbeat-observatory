# The Cosmos: the game plan

One page. What the full game is, what is real today, what comes next, and how we know it is done.
Kept by the lead builder (Fable). Updated after every milestone. Last update: 2026-11-19, 10:30 PM (after the working desert, Ceres's two sides at work, and the freight board: work that repeats on every world).

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

- **Worlds you can walk on:** Mars (Marineris Port, with ships and people moving), Phobos (Stickney East station, two people to talk to), Deimos (a survey camp, two people to talk to), the Moon (three landings: Tranquility, Shackleton, Daedalus),
  Ceres (Occator Works), Earth (a launch complex), Callisto (a camp under Jupiter). All real size, real gravity, real day length.
- **Ground you can dig** in any direction, with real layers. Ice on the Moon, ore and salt on Ceres.
- **Ships:** about ten, all walkable inside (Skiff lifeboat, Meridian, Shrike raider, Drayman hauler, Ares liner, Kestrel, more).
  Seats are how you use a ship. Guns, shields, power, fuel in free flight.
- **Space flight:** take off, fly a course or fly free, land anywhere. The long-range drive reaches every built world with no cut.
- **The opening** (steps 1 to 4 above) for Mars and Ceres starts.
- **Jobs and short stories** on Mars (and from Mars to Phobos and Deimos), Earth, Ceres, the Moon and Callisto. Hiring desks on each. Joining a side by its first job.
- **A freight board on every world:** work that is always there and pays every run (25 runs: walks out to the ice well, the weather mast and the first landing site, hops to Mars's moons, between them and back down, between the Moon's three landings, digging jobs, crossings between Mars, Ceres and Callisto), and a freight ticket that counts your runs and raises your pay (New hand, Hauler, Senior hauler, Freight master). Needs the game server restarted to go live.
- **The desert north of Marineris Port:** a haul road, a borrow area, a solar field, an ice well with a pipeline, a weather mast, the first landing site, people working. **Ceres's two sides at work:** Ironclad's ore yard and hauler, Greenhaven's tanks and water tender, a board that shows how the two stand.
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
- **Work is still thin above the freight board.** Freight repeats now, but there are no roles beyond the freight ticket, no trade between worlds, and nothing to save for.
- **Caves** exist in the ground but are not drawn.
- **Not built at all:** seasons, stations and docking, the Belt, the two station factions, building with drones, weather and
  disasters, the main story arc, licenses and labels, player-versus-player rules, world currencies, walking in open space,
  work machines (digger, hauler truck, compactor), public transport, the Earth lifter.

## The parts, in the order a new player meets them

Changed 11/19 (Jaron, 1:59 PM): the target is a production-ready full game, built in whole parts, not a string of small fixes.
Each part is a complete stretch of the game: built, wired, tested on a phone and a desktop, and shipped as one piece.
The story still comes after the worlds it happens in (Jaron, 10/3).
Order changed 11/19 (Jaron, 4:15 PM: "all factions working, jobs, missions, more things in environments"): after the first hour come the three parts
that make the worlds feel alive, in this order: a lived-in Mars region, jobs and missions as a ladder, factions that visibly do things. The game shell
keeps growing beside them (each part must pass its bar on every platform anyway). "Lived-in" is now part of what done means for every place.

**Every part must pass the same bar before it counts as done:**
a stranger understands it with no help; nothing is lost on a refresh or a dropped connection; it holds a steady frame rate on a
phone and does not grow in memory over a long session; no errors; it still works when the game server is down; it reads at 375 px
wide and on a big screen; it plays with touch, mouse/keyboard and a gamepad, with nothing tied to one platform; it plays fully as the home-screen app (no browser bars, the notch and safe areas, rotation, a fast return from the
background); the key actions have sound and feedback; it looks right in a screenshot; and it has had a full test pass (the normal path
and the odd ones, phone and desktop).

| # | Part | What "done" means | State |
|---|---|---|---|
| 0 | **Looks groundwork** | Suits outside, airless light and shadows, a night you can walk in, Mars bright in a moon's sky. | Shipped 11/19 (first version) |
| 1 | **The first hour** | First launch to your own flying ship: liner, port, board, crash, dig out, ride, fit the lifeboat, first take-off. Clear at every step on a phone, with sound, and it resumes anywhere. | Production pass and the first take-off shipped 11/19 (see the bar table below). Left: a real phone, a controller through the opening |
| 2 | **Mars and its moons, a lived-in region** | Marineris Port, the open desert, Phobos and Deimos, each with people at work you can see (walking, loading, driving), ships that come and go on their own, props and signs of work, lights at night, and a reason to go there. Mars's own jobs as a chain that leads you to each place in turn. Boulders and landmarks, clean views from orbit to ground, day and night. | Most of it shipped 11/19: Stickney East is a station and Deimos has a survey camp, both with people; ships land and leave at the port by themselves (with engine sound and dust) and a tug drives the apron; five workers walk their beats; three jobs in a chain take you to both moons; the desert north of the port is a working place (road, solar field, ice well, mast, first landing) and three freight runs walk you out to the well, the mast and the first landing; two people on each moon have names, talk, and give freight (down to the port, and between the two moons). Left: voices for the moon people, a shop on Phobos, things you can bump into in the desert (nothing there is solid yet), boulders and the square patch from orbit, suits off indoors, a play-through in a browser as a stranger, the bar below |
| 3 | **Jobs, roles and missions as a ladder** | Missions that lead on from one another with rising rewards, roles a player can take and be known by (hauler, surveyor, digger, escort, trader), a repeating freight board on every world, trade between worlds, fuel and repairs that cost, buying a bigger ship, hiring crew. A goal to save for. | First whole piece shipped 11/19: the freight board (25 repeating runs on five worlds, pay by distance, a freight ticket with four ranks that raises freight pay). 26 one-time missions chained by `needs`. Left: the other roles (surveyor, digger, escort, trader), trade between worlds, fuel and repairs that cost, a bigger ship to save for |
| 4 | **Factions that do things** | Every side has its own people, ships, places and a goal you can watch it work toward: crews building, haulers running its routes, patrols, a home that grows or shrinks with the balance. Joining and switching, licenses and labels, seats and votes, the 90-day season. | First visible piece shipped 11/19, on Ceres only: Ironclad and Greenhaven each have their own yard, people and ship on a shared timetable, a board by the pad shows how they stand, and on every two-sided world (Ceres, the Moon, Earth, Callisto) each side has a repeating run of its own that feeds its home every time. Left: yards, people and ships of their own for the sides of the Moon, Earth and Callisto, patrols, a home that visibly grows or shrinks, switching, licenses, seats and votes, the season |
| 5 | **The game shell** | Every platform we can reach: phone first (iOS and Android), PC (mouse/keyboard and gamepad), the home-screen app, consoles later through the gamepad layer. One input layer, UI from 375 px to a TV. Settings (sound, controls, quality), quality tiers, save and resume that never loses anything, a clear message and solo play when the server is down, long-session memory, loading that explains itself. | Partly built. Controller support shipped 11/19 (first version) |
| 6 | **The crossing and the other worlds** | The long-range drive, then the Moon, Ceres, Earth and Callisto each finished and lived-in like part 2: opening start, shop, a way to leave, both sides' homes. | First passes built |
| 7 | **Stations, the Belt, the station factions** | Docking, a station over Mars, Vesta and Psyche, the Long Walk, Corsair's Refuge. | Not built |
| 8 | **Building, machines, weather** | Bases and stations built by drones, work machines, storms and disasters, caves you can see. | Not built |
| 9 | **The main story** | The first crossing, Callisto, Europa, the ship seen up close. An ending one player can reach in a season. | Not built |

Small things still open from part 0: suits come off inside buildings and domes; hired crew walking to a ship; real boulders;
the square patch on Phobos seen from space; ships' hulls read as bricks; at Mars dusk the ground takes the sky's blue.

## The production bar, part by part

One row per part, one column per rule of the bar. "yes" = tested and passing, "part" = partly, "no" = not yet, "-" = not looked at.
Tests: `test/first-hour-browser.mjs` and `test/first-flight-browser.mjs` (part 1), `test/shell-browser.mjs` and `test/gamepad-browser.mjs` (the shell), `test/phone-check.mjs` (all).

| Part | Stranger understands | Refresh loses nothing | Phone frame rate, memory | No errors | Server down | 375 px and big screen | Touch, keys, pad | Home-screen app | Sound and feedback | Looks in a screenshot | Full test pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 The first hour | yes (words, arrows with names and distances; the lifeboat in 3 steps, the first take-off in 4) | yes (every stage, and after the first flight) | - (not measured on a real phone) | yes | part (says so, offers solo, offers the way back; solo ends the opening at Mars only) | part (375 px yes; big screen not looked at) | part (touch yes, keys yes, pad hints only) | part (tags and manifest; not run installed; sideways works in Chromium, went black in the WebKit test browser: check a real iPhone) | yes (press, dig, lift, latch, yes, no, crash, arrival, power on, first landing) | yes (day and night; the ship lights her own pad at night) | part (iPhone and Android profiles, golden path to the first landing and a refresh in every stage; no real phone) |
| 2 Mars and its moons | part (the three jobs say where to go; not played by a stranger in a browser) | - | part (10 draw calls an outpost, one ship at a time on a phone; not measured on a real phone) | yes | part (ships, walkers and outposts are drawn by the client alone, so solo has them; the new jobs need the server) | part (375 px pictures; big screen not looked at) | - | - | part (ships rumble, thump down and raise dust; the tug whines; nobody has listened on a real phone) | yes (day and night, phone size) | part (the job chain on the real authority 13/13; pictures of every piece; no play-through in a browser yet) |
| 3 Jobs and missions (the freight board) | part (the board says what each run is, what it pays and where to go; the arrow points at the well; not played by a stranger) | yes (runs and the ticket are kept by the server) | - | yes | no (jobs need the server) | part (375 px yes; the desktop pass was run in a software-drawn browser only) | part (touch yes, keys yes, pad not tried) | - | part (the pay line and the rank line speak; no new sounds) | yes | part (30 checks on the real authority with real flights; the board by taps on an iPhone profile 13/13, at the port, with a second player watching, and on Phobos) |
| 5 The game shell | - | - | part (a quality setting and a slow-device offer; memory not measured) | yes | yes (first launch; a drop in mid-game was already handled) | part | part (pad first version) | part | yes | - | part |

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
- [x] Repeating work on every world (the freight board; live after the game server restarts)
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
| 11/19 | The freight board: work that never runs out, on every world. The person who hands out jobs now also keeps a board of runs that are always there and pay every time: at Marineris Port walks up the haul road to the ice well, the weather mast and the first landing site, freight to Phobos and Deimos once you have flown there, and a crossing to Ceres; on the Moon crates between Tranquility, Shackleton and Daedalus, with a load back so nobody flies empty; on Ceres a crossing to Mars; on Earth fill for the sea wall; on Callisto clean ice for the Archive and the longest crossing on the board. Pay follows the distance (80 for a walk, up to 600 for Callisto to Mars). Every run counts on your freight ticket: three runs make you a Hauler and every freight run pays 10% more, then Senior hauler, then Freight master; other players see the rank on your name tag. Every side of every two-sided world has its own run that feeds that side every time (ore for Ironclad's bunker, salt for Greenhaven's trays, rations for Fortis, chip trays for Technos Prime, Skyward's line check, fill for the Homeguard wall, ice for Mystara, drill charges for the Unbound's claim). And the moons answer back: Nadia Ferro (yard hand) and Tomas Reyes (propellant tech) at Stickney East, Zuri Achebe (driller) and Aoi Tanabe (geologist) at the Deimos camp now have names, something to say, and freight of their own: empties and drill cores down to the port, propellant from Phobos to Deimos, survey plates back. Goes live when the game server restarts. |
| 11/19 | Ceres's two sides visibly at work: Ironclad's ore yard with a skip on rails, yard hands and an ore hauler that lands and carries the stockpile away; Greenhaven's grow hall, water tanks with gauges, hands with a filter trolley and a water tender that lands and fills the tanks; a lit board by the pad that shows how the two stand. The desert north of Marineris Port: a haul road, a borrow area with a digger, a solar field, an ice well with a pipeline to the port, a weather mast and the first landing site with its plaque, with people at work. The port's ships now rumble, thump down and blow dust, and the tug whines. |
| 11/19 | Mars and its moons, lived-in (first half): a propellant and survey station at Stickney East on Phobos and a drill camp on Deimos, both with suited people at work; freighters and couriers that fly in, land, unload and leave at Marineris Port on a timetable every player shares, and a cargo tug on the apron; five port workers who walk their beats; and "The Moon Round", three paid jobs from the supply clerk that lead on from one another: stores to Phobos, drill cores from Deimos, then both moons in one run. |
| 11/19 | The first take-off: after "power on" the game now walks a new pilot through it in four plain steps (get in by the ramp, with an arrow; the pilot seat and the door to it; hold LIFT; fly and LAND), then says the first flight is done and moves on to work. Fixed on the way: holding LIFT with the ramp down could leave the ship stuck on its pad (the ramp was asked up, down, up); at night the ground of an airless world could not be lit by any lamp, and a refresh on a night side could throw the game into safe mode; the ship now lights her own pad at night; two server messages no player should see are gone; the Ramp and Course buttons are big enough for a thumb. |
| 11/19 | The game shell, first pieces: a plain "the shared world is not answering" screen with a "Play on your own for now" button, and an offer to return when the server answers again; a Picture quality setting (Auto, Fast, Full detail) and a one-time offer of Fast when the picture runs slow; "Add to Home Screen" from the game's page now opens the game itself, full screen. |
| 11/19 | The first hour, production pass: buttons on a phone no longer show keyboard letters (a controller sees its own button names); every spoken line sits on a dark plate you can read over any scene; an arrow with a name and a distance points at the arrivals hall, the Kestrel, and each step of fitting your lifeboat ("Step 1 of 3"); the liner says how long until landing; sounds answer every press, dig, lift, choice, the crash and arriving home; fitting the second part says "Power on. Your lifeboat flies."; the status card opens with the next step; boarding the Kestrel puts you at a window (after the game server restarts). |
| 11/19 | Helmet lamp no longer stuck on in sunlight on moons (it washed the ground tan). |
| 11/19 | A controller plays the game (sticks, buttons, a focus ring for menus); hints speak in the words of what you are holding (keys, thumbs or a pad). |
| 11/19 | A night you can walk in on airless worlds: Mars lit and bright in a moon's sky (it went black), Marsshine on the ground, a white helmet beam where you look. |
| 11/19 | Airless worlds look airless: near-black hard shadows, darker ground, small craters everywhere, no more wind ripples on Phobos, no checkerboard on sunlit slopes. A moon inside Mars's shadow now goes dark (it stayed sunlit). |
| 11/19 | Pressure suits and helmets on everyone outside (you, port workers, the Moon, Ceres, Callisto, other players). A slow floating bound in low gravity. |

Build log with pictures: `AI-Shared/projects/games/cosmos-fable-build/BUILD-LOG.md`.

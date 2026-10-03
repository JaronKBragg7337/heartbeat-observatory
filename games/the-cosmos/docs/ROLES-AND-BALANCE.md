# Roles, NPC stand-ins, and the balance (F5 and F4)

Bible: BIBLE-v3 section 6 (roles and votes) and 4.6 (two paths per world). Jaron, 10/3 10:46 AM: NPCs fill every role until a human takes it; Mars is neutral. 10/3 10:54 AM: characters have humor, some are assholes.

## Seats (src/roles/seats.js)

Seven places: neutral Mars, Earth, the Moon, Ceres, Callisto, Wanderhome, Corsair's Refuge. Each has seats:

| Tier | Seats | How a human gets it |
| --- | --- | --- |
| job | pilot x2, trader x2, hauler x2, gas station worker, miner x2, medic, patrol x2 | **Show up**: be on that world and ask (`role-take`) |
| office | port master, trade director, security chief | **Earn it**: 25 reputation with a faction of that world |
| top | governor (station commander on the two station homes), and every faction's leader | **Be voted in**: an election, on the schedule |

Mars seats are `npcOnly`: the server refuses every human. Nobody owns anything on Mars.

## Who holds a seat (src/roles/holders.js, npcs.js)

The server keeps **only the humans** (`state.roles.humans`). A seat with no entry is held by an NPC derived from the seat id: a name, a temperament (warm, dry, smug, grumpy, rude, nervous, sour; the last three plus smug are assholes), a Kokoro voice and four lines (greet, job, step aside, come back). Faction leaders and governors have their own lines in their faction's voice. All lines are in `roleLines()` and voiced by `node tools/gen-voices.mjs`; no line contains a number or a name, so a clip is made once per voice and line.

When a human takes a seat the NPC steps aside (and says so); when the human stands down, goes offline for 10 minutes, leaves the faction (leader seats) or is voted out, the NPC is back.

## By the book (src/roles/book.js)

Each faction's name fixes a stance from -1 (compete at home) to +1 (cooperate early): Wanderhome 0.9, Skyward 0.8, Greenhaven 0.6, Technos 0.45, Mystara 0.1, Unbound -0.2, Corsairs -0.4, Ironclad -0.45, Fortis -0.55, Homeguard -0.7. An NPC leader runs at its philosophy; a human leader chooses. NPC governors and officers set tax, fees, margin, patrol and docking from the world's stance, always inside the hard caps: planet tax 0-15%, station fee 0-20%, margin 0-20%, patrol 0-1. A human who holds the seat sets the number; the server refuses anything outside the caps.

NPC voters (120 per faction, deterministic) vote by stance closeness plus how far they believe the candidate (reputation) plus a small incumbency edge. A human with no standing loses to the NPC incumbent; a known member who stands where the faction stands wins. Humans vote with their stored **vote weight** (`1 + carried + sqrt(progress)`), kept per player for seasons: `rollSeason()` (F6 calls it) carries the weight, zeroes progress, and gives every human seat back to its NPC.

Elections open every 30 world-days for every top seat and stay open 3 days (`ROLES_CFG`, one place to change). A season is 90 days (DECISIONS 10/3 12:06).

## The balance and home strength (src/roles/balance.js, F4)

Per settled world, in `state.homes[worldId]`: **balance** 0 (full competition) to 100 (full cooperation), and **home strength**, the mean of wealth, industry, defences, population. Jobs move them (`role-work`): a faction job raises strength and pushes toward competition; a joint job pushes toward cooperation and *spends* strength (reach and hoard pull on the same money); sabotage pushes hard toward competition. The leaders' stance tilts what the board pays. Joint projects (shipyard, relay, refinery, tether) are built from two halves, one per faction, hauled as `parts`; a project with one half delivered stays unfinished; a rich pivoted world can buy the missing half. Home projects (walls, gun towers, market, bank, parade ground, palace, dome city) raise one component. A peace deal is a three-link job chain any player can start. With nobody there the world's NPCs run it and the balance drifts toward competition while strength holds. Station homes have strength only.

Read by: **prices** (`priceFactor`: dear for outsiders and cheap for its own when competing, cheap and busy for everyone when cooperating; wired into the Occator desk and foundry with the governor's tax), **raider spawns** (`lanePressure` scales the fleet's respawn time; a rich fortified world has pirates in the lanes, not in its sky: `skyRaiders` / `laneRaiders`), **unlocks** (`unlocks`, `hullClass`: size follows the unlocks, never range) and **home-ground upkeep** (`homeUpkeepFactor`).

## Actions (all server-checked, idempotent by action id)

`faction-join`, `faction-leave`, `role-talk`, `role-take`, `role-leave`, `role-work`, `role-set`, `role-stand`, `role-vote`, `project-deliver`, `project-buy-half`, `peace-step`. UI: the "World / crew" sheet (src/roles/rolesView.js).

## Not done, honestly

- Worlds other than Mars and Ceres are not reachable yet, so only Ceres exercises seats and prices in play; the rest are covered by tests with the player placed there.
- Hull-class unlocks, docking policy (`canDock`), home upkeep and the garrison/home-upgrade unlocks are computed and shown but not yet enforced by a shipyard or a port on those worlds (they do not exist yet). Mars is neutral by design.
- Heat (the other side remembering sabotage) is a reputation hit with the other faction only; F7 turns it into labels and licenses. Switching factions only leaves a counter (`roles.switches`).
- NPC factions do not yet feud or make peace with each other beyond the stance drift and the NPC governor buying a missing half; no diplomacy events (SY11).
- Seats are taken from the sheet buttons; a person standing at the gas station counter is not tied to the body of the NPC there (the world builders place the bodies).

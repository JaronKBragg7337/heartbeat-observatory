# Jobs, stories and hiring desks (MISSIONS round 1, 2026-10-08)

Design: BIBLE-v3 sections 10.2 (the story), 12 (progression), 13.2 (an oath job is the switch), 17 (mechanics witnessed in the place, no approve buttons).
Gap list that started it: `AI-Shared/state/cosmos-gaps-2026-10-08.md`. Handoff: `AI-Shared/handoffs/2026-10-08-cosmos-missions-r1.md`.

## How a job feels (the rules a builder keeps)
* A person tells you the job when you ask them for work in the Talk panel; you answer **"I'll take it"**. That is their dialogue, not a screen of buttons.
* There is **no hand-in button**. Steps finish by arriving: walk to the place, land the ship, carry the load there, sign the hand on. The pay arrives with the last step.
* The story speaks as steps finish (the ship's message line). A job can end in a question put to you by a person (**choose**): two answers, both paid, both remembered.
* Every step is checked by the authority (`server/missions.mjs`): where you stand, what the hold or the supplies or the hopper hold, where the ship is. The browser only reads.
* A faction job is the faction's. Taking a faction's **oath job** (the first of its thread, `oath: true`) and finishing it joins you to them, or switches you (BIBLE 13.2).
* Mars is neutral: its jobs are `side: 'port'`, take no side and move no meter.
* Earth jobs never ask for a launch (how a ship leaves Earth is Jaron's open call; see the gap list, item 1).

## Where things live
| What | File |
|---|---|
| the jobs and threads (pure data) | `src/missions/catalog.js` |
| where a person or a spot is, and how far you are from it | `src/missions/where.js` |
| the hiring desks and the hands on them | `src/missions/desk.js` |
| the authority side: accept, check, pay, choose, drop, desk hire | `server/missions.mjs` (wired in `server/authority.mjs`, search MISSIONS) |
| the Talk panel (offer, answers, hands for hire) | `src/missions/talk.js`, used by `src/crew/crewUI.js` |
| the NEXT line, the story lines, the goal arrow, the World / crew sheet block | `src/missions/tracker.js` |
| the notice board beside each desk | `src/missions/boardProp.js` |
| what jobs leave standing (Homeguard's footing) | `src/missions/props.js` |
| voiced pitches | `src/missions/lines.js` (read by `src/voice/lines.js`; run `node tools/gen-voices.mjs`) |
| tests | `test/pkg-missions.mjs` (authority, real flights, real purchases, real digging), `test/missions-browser.mjs` (iPhone WebKit through the real screens) |

## Add a job
1. Add a row to `MISSIONS` in `catalog.js`: `id`, `thread`, `world`, `giver` (a person id from `where.js`), `title`, `brief`, `pitch` (what the giver says), `take`, `steps`, `pay` (credits, 60 to 400), `done`.
   Faction jobs: `faction`, `side: 'home'`, `trade` (wealth | industry | defences | population), `oath: true` for the thread's first. Joint jobs: `side: 'joint'`. Mars: `side: 'port'`.
2. Steps: `go` (be within `r` metres of a person or `{ at:[x,z], frame }`; `carry:'label'` puts a load in your hands, `drop:true` takes it), `land` (the ship is down on a frame), `haul` (the hold has it), `give` (hand over from the `hold`, the `supply` or the `hopper`), `hire`, `choose`.
3. Run `node test/pkg-missions.mjs`: it checks the catalog (every place exists and is not inside a wall) and the Mars, Earth, Ceres and Moon drivers show how to play one.
4. Add a driver for it in that test (stand at the places, advance a second, check it pays).
5. Giver with a voice: `node tools/gen-voices.mjs` voices the pitch.

## Add a hiring desk
`DESKS` and `HANDS` in `desk.js` (a dispatcher person, a board spot, six hands), the board is added in that world's `client.js` with `buildBoard`. A hand signs on at once and comes aboard the landed ship (the prize-crew path); a dismissed hand steps off and goes back on the list.

## Not built (named so it is not lost)
* Repeatable board jobs (the stories are one-time; the markets are the repeating work).
* Fuel and repair pricing (the bible says "priced later"), freight between players, convoys.
* A walkable Homeguard building beyond the footing; an Earth shop.
* Callisto, Wanderhome and Corsair jobs (those worlds are not built).
* Voices for Ceres: the people of Occator Works have none yet, so their pitches are text.

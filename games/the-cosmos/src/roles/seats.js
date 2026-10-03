// ============================================================================
// roles/seats.js - F5: every seat in the game. A seat is a named job somebody holds: a pilot, a trader, the gas station worker, the port
// master, a governor, a faction leader. If no human holds it, an NPC does (src/roles/npcs.js). Pure data and lookups: no three.js, no DOM,
// no state. The server (server/roles.mjs) keeps who holds what; the browser reads the same table to label the panel.
//
// THREE TIERS, three ways in (BIBLE-v3 section 6, DECISIONS 10/3 10:46 AM: "humans take a role by showing up, earning it or being voted in"):
//   job      showing up. Be on that world, ask for the post. (pilot, trader, hauler, gas worker, miner, medic, patrol)
//   office   earning it. Reputation with a faction of that world. (port master, trade director, security chief)
//   top      being voted in. An election, on the schedule. (governor / station commander, faction leader)
// MARS IS NEUTRAL: every Mars seat is npcOnly. Nobody owns anything on Mars; its traders and staff stay NPCs forever.
// ============================================================================

/** The settled worlds with two sides (BIBLE-v3 section 4), the station factions, and neutral Mars. `frame` is the player's frameId when there. */
export const WORLDS = [
  { id: 'mars', name: 'Mars', frame: 'mars', factions: [], neutral: true },
  { id: 'earth', name: 'Earth', frame: 'earth', factions: ['homeguard', 'skyward'] },
  { id: 'moon', name: 'the Moon', frame: 'moon', factions: ['fortis', 'technos'] },
  { id: 'ceres', name: 'Ceres', frame: 'ceres', factions: ['ironclad', 'greenhaven'] },
  { id: 'callisto', name: 'Callisto', frame: 'callisto', factions: ['mystara', 'unbound'] },
  { id: 'wanderhome', name: 'Wanderhome', frame: 'station-wanderhome', factions: ['wanderhome'], station: true },
  { id: 'corsairs', name: "Corsair's Refuge", frame: 'station-corsairs', factions: ['corsairs'], station: true },
];
export const worldById = (id) => WORLDS.find((w) => w.id === id) || null;
export const worldOfFrame = (frameId) => WORLDS.find((w) => w.frame === frameId) || (frameId === 'phobos' || frameId === 'deimos' ? WORLDS[0] : null);
export const factionWorld = (factionId) => WORLDS.find((w) => w.factions.includes(factionId)) || null;
/** The ten factions a player can join. */
export const PLAYABLE_FACTIONS = WORLDS.flatMap((w) => w.factions);

export const JOB_KINDS = [
  { kind: 'pilot', title: 'Pilot', n: 2, trade: 'wealth', pay: 38 },
  { kind: 'trader', title: 'Trader', n: 2, trade: 'wealth', pay: 34 },
  { kind: 'hauler', title: 'Hauler', n: 2, trade: 'industry', pay: 42 },
  { kind: 'gas-worker', title: 'Gas station worker', n: 1, trade: 'population', pay: 24 },
  { kind: 'miner', title: 'Miner', n: 2, trade: 'industry', pay: 46 },
  { kind: 'medic', title: 'Medic', n: 1, trade: 'population', pay: 40 },
  { kind: 'patrol', title: 'Patrol', n: 2, trade: 'defences', pay: 36 },
];
export const OFFICE_KINDS = [
  { kind: 'port-master', title: 'Port master', policy: 'dock' },
  { kind: 'trade-director', title: 'Trade director', policy: 'margin' },
  { kind: 'security-chief', title: 'Security chief', policy: 'patrol' },
];
/** The hard caps (BIBLE-v3 section 6): nobody, human or NPC, sets a number outside these. */
export const CAPS = { tax: [0, 0.15], fee: [0, 0.2], margin: [0, 0.2], patrol: [0, 1], stance: [-1, 1] };
/** Reputation with a faction of the world that earns an office. */
export const OFFICE_REP = 25;
/** Reputation needed just to stand in an election. */
export const STAND_REP = 5;
/** A holder who has been offline this long (real seconds) gives the seat back to its NPC. */
export const LAPSE_S = 600;

let CACHE = null;
function build() {
  const seats = [];
  for (const w of WORLDS) {
    const base = { world: w.id, npcOnly: !!w.neutral };
    for (const j of JOB_KINDS) for (let i = 1; i <= j.n; i++) seats.push({ ...base, id: `${w.id}/${j.kind}-${i}`, kind: j.kind, tier: 'job', title: j.title, trade: j.trade, pay: j.pay });
    for (const o of OFFICE_KINDS) seats.push({ ...base, id: `${w.id}/${o.kind}`, kind: o.kind, tier: 'office', title: o.title, policy: o.policy });
    if (w.station) seats.push({ ...base, id: `${w.id}/station-commander`, kind: 'station-commander', tier: 'top', title: 'Station commander', policy: 'fee' });
    else seats.push({ ...base, id: `${w.id}/governor`, kind: 'governor', tier: 'top', title: 'Governor', policy: 'tax' });
    for (const f of w.factions) seats.push({ ...base, id: `${f}/leader`, kind: 'faction-leader', tier: 'top', title: 'Faction leader', faction: f, world: w.id, policy: 'stance' });
  }
  return seats;
}
export const allSeats = () => CACHE || (CACHE = build());
const BY_ID = () => (BY_ID.m ||= new Map(allSeats().map((s) => [s.id, s])));
export const seatById = (id) => BY_ID().get(id) || null;
export const seatsOn = (worldId) => allSeats().filter((s) => s.world === worldId);
/** The factions whose people may vote for / earn standing for a seat. */
export function seatFactions(seat) {
  if (seat.faction) return [seat.faction];
  return worldById(seat.world)?.factions || [];
}
/** The seat of a faction's leader, and of a world's top office. */
export const leaderSeat = (factionId) => seatById(`${factionId}/leader`);
export const topSeat = (worldId) => seatById(`${worldId}/${worldById(worldId)?.station ? 'station-commander' : 'governor'}`);

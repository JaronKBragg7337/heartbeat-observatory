// ============================================================================
// opening/worlds.js - the worlds a new pilot can choose to start on, and the data the arrivals board shows for each (BIBLE-v3 10.1 step 3).
// Pure data and small maths (no three.js, no DOM): the authority checks a choice against this, the client draws the board from it.
//
// WHAT IS LIVE: the numbers come from the registries as they stand NOW. A built world's size, gravity and day come from its def (the same
// def the ground is made from); its distance from Mars is where the ephemeris puts it at this moment; a faction's name, line, colours and
// look come from F0's style sheet (src/factions/); the goods prices come from the economy tables; the player and member counts are the
// shared world's own (passed in by whoever asks). Worlds not built yet (the Moon, Earth, Callisto) show their real published facts
// and say plainly that nobody can land there yet: `status: 'coming'`. Their factions are on the board, so nobody wonders where they went.
// ============================================================================

import { hasWorld, worldDef, worldCentre } from '../worlds/registry.js';
import { hasFaction, factionStyle } from '../factions/registry.js';
import { GOODS } from '../economy/catalog.js';
import { MATTER, SUPPLY_PAY } from '../worlds/ceres/trade.js';
import { CAUSE_INFO } from './season.js';

const G = 6.6743e-11;

/**
 * The start worlds, in the order the board lists them. `open` worlds can be landed on today; `coming` ones are shown honestly and cannot be
 * picked yet (the board offers the nearest open start instead). `factions` is the pair on that world (none on Mars: it is neutral).
 * `port` is the nearest port (BIBLE-v3 7.x); `built` is what is standing today, `money` the local money's name (SPOILER table).
 */
export const START_WORLDS = [
  { id: 'mars', status: 'open', factions: [], port: 'Marineris Port', money: 'marks', startPlace: 'Marineris Port, on the Valles Marineris rim',
    line: 'Neutral and unownable: a port town in rust-coloured dust where every route crosses. No home faction, so nobody owns anything here and the staff are NPCs.',
    good: 'A port anyone can reach, trade, hiring, the Survey Office, Phobos and Deimos.', lacks: 'A home side. Nothing to carry over from here.' },
  { id: 'moon', status: 'coming', factions: ['fortis', 'technos'], port: 'Tranquility Civil Hub', money: 'lunars', nearest: 'mars',
    line: 'Two blocs share one rock: the walls and searchlights of Fortis at the south pole, the glass and dishes of Technos Prime on the far side.',
    good: 'Power, launch mass, security, electronics, comms.', lacks: 'Water, food, metal in bulk.',
    facts: { radiusKm: 1737.4, gravity: 1.62, dayH: 655.7, note: 'a lunar day, Sun to Sun, is 29.5 Earth days; one turn on its axis 27.3' } },
  { id: 'ceres', status: 'open', factions: ['ironclad', 'greenhaven'], port: 'Occator Works (Kerwan Landing is next)', money: 'shares', startPlace: 'Occator Works, on the bright salt flats',
    line: 'The Belt\'s capital: the miners work the bright salt flats of Occator crater, the farmers grow under glass in Kerwan basin. They need each other and say otherwise.',
    good: 'Water ice, fuel, metal, hulls, people who fix things.', lacks: 'Electronics, security, long-range comms.' },
  { id: 'earth', status: 'coming', factions: ['homeguard', 'skyward'], port: 'A launch site on the continent you choose', money: 'dollars', nearest: 'mars',
    line: 'Real continents and oceans, no real cities: you build where you like. Homeguard wants to stay and rebuild; Skyward wants everyone off.',
    good: 'People, food, water, everything in bulk.', lacks: 'Easy launches: the gravity well is deep.',
    facts: { radiusKm: 6371.0, gravity: 9.80665, dayH: 23.934, note: 'real, from the published fact sheets' } },
  { id: 'callisto', status: 'coming', factions: ['mystara', 'unbound'], port: 'Valhalla camp', money: 'credits', nearest: 'mars',
    line: 'The one big Jupiter moon outside the worst radiation. Mystara\'s instruments stand in the Valhalla basin; the second seat is open to whoever raises a building first.',
    good: 'Maps of the Jupiter system, safe ground, the road to Europa.', lacks: 'Industry. They cannot build much.',
    facts: { radiusKm: 2410.3, gravity: 1.236, dayH: 400.5, note: 'one turn is 16.69 days, the same as its orbit round Jupiter; distance from Mars varies with Jupiter' } },
];

/** What each faction is strong and weak at, in plain words (bible v3 section 4). */
export const FACTION_FACTS = {
  ironclad: { good: 'Mining, metal, shipyards, drills, haulers.', lacks: 'Strikes, supply shocks, nobody to grow their food.', home: 'Occator Works' },
  greenhaven: { good: 'Water, fuel from water, food, medicine, bio-repair.', lacks: 'They cannot build a hull and they cannot defend one.', home: 'Kerwan domes' },
  fortis: { good: 'Armour, fleet tools, defence, launch mass.', lacks: 'Loud, visible, slow to change.', home: 'Shackleton, the south pole' },
  technos: { good: 'Scanning, comms, hacking, electronics, diplomacy.', lacks: 'Thin hulls, no heavy industry, few people who can hold a gun.', home: 'Daedalus, the far side' },
  homeguard: { good: 'People, food, water, industry in bulk, the best ground game.', lacks: 'Launches are expensive and their ships are few.', home: 'The sea-wall cities' },
  skyward: { good: 'Launch sites, orbital know-how, bulk trade, allies out there.', lacks: 'Thin on the ground, dependent on Homeguard for what they ship.', home: 'The launch sites' },
  mystara: { good: 'Maps, data, the only safe routes in the Jupiter system, strange tech.', lacks: 'They cannot build or fight, and they are few.', home: 'Valhalla basin' },
  unbound: { good: 'Nothing owed, everything yours; the open seat.', lacks: 'Nothing built yet. Raise the first building and the seat is yours.', home: 'Wherever you raise a roof' },
};

export const startWorld = (id) => START_WORLDS.find((w) => w.id === id) || null;
/** The worlds that can be picked today. */
export const openStartWorlds = () => START_WORLDS.filter((w) => w.status === 'open').map((w) => w.id);

/** Can this (world, faction) be chosen? A faction must be one of that world's pair, or null (no side yet). */
export function validChoice(world, faction) {
  const w = startWorld(world);
  if (!w || w.status !== 'open') return false;
  if (faction === null || faction === undefined || faction === '') return true;
  return w.factions.includes(faction);
}

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const dayText = (h) => (h >= 48 ? `${fmt(h / 24, 1)} Earth days` : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`);

/** Size, gravity and day of a world, from its def when it is built (a registered ground world), else from the published facts. */
export function worldFacts(id) {
  const w = startWorld(id);
  if (id === 'mars' && hasWorld('mars')) {
    const b = worldDef('mars').body;
    return { radiusKm: b.radiusMean / 1000, gravity: b.surfaceGravity, dayH: b.siderealRotationPeriod / 3600, source: 'registry' };
  }
  if (hasWorld(id)) {
    const d = worldDef(id);
    if (!d.placeholder && d.radiusMean && d.massKg) {
      return { radiusKm: d.radiusMean / 1000, gravity: G * d.massKg / (d.radiusMean * d.radiusMean), dayH: d.rotation ? d.rotation.periodS / 3600 : null, source: 'registry' };
    }
  }
  return w && w.facts ? { ...w.facts, source: 'published' } : { source: 'none' };
}

/** How far a world is from Mars right now, in millions of km (null when the registry cannot place it). */
export function distanceFromMarsMkm(id) {
  try {
    if (id === 'mars') return 0;
    if (!hasWorld(id)) return null;
    const c = worldCentre(id);
    return Math.hypot(c.x, c.y, c.z) / 1e9;
  } catch { return null; }
}

/** The goods line the board shows (live from the economy and trade tables). */
export function goodsLines(id) {
  if (id === 'mars') return [`Water ${GOODS.water.buy} marks, food ${GOODS.food.buy} marks, parts ${GOODS.parts.buy} marks a unit at the Exchange`, `The depot pays ${12} marks a tonne for regolith`];
  if (id === 'ceres') return [`Occator ore ${MATTER['ceres-ore'].works} marks a tonne at the foundry, ${MATTER['ceres-ore'].marineris} at the Marineris depot`, `The supply desk pays ${SUPPLY_PAY.water} for water and ${SUPPLY_PAY.parts} for parts, about twice Mars`];
  return [];
}

/** One faction's card: its words and colours from F0's style sheet, its strengths from the bible, its live member count. */
export function factionCard(fid, live = {}) {
  if (!hasFaction(fid)) return { id: fid, name: fid, tagline: '', ethos: '', members: live.factions?.[fid] || 0 };
  const s = factionStyle(fid), f = FACTION_FACTS[fid] || {};
  return { id: fid, name: s.name, tagline: s.tagline, ethos: s.ethos, home: f.home || '', good: f.good || '', lacks: f.lacks || '',
    colors: { primary: s.palette.primary, accent: s.palette.accent, light: s.palette.light, dark: s.palette.dark },
    members: live.factions?.[fid] || 0 };
}

/**
 * The whole board: one card per start world with its facts and its pair, then the two moons of Mars (shown for the map, not startable).
 * `live` = { players: {worldId: n}, online: {worldId: n}, factions: {factionId: n}, season: {number, cause} } from the authority (zeros alone).
 */
export function boardData(live = {}) {
  const worlds = START_WORLDS.map((w) => {
    const facts = worldFacts(w.id), d = distanceFromMarsMkm(w.id);
    return {
      id: w.id, name: w.id === 'mars' ? 'Mars' : hasWorld(w.id) && !worldDef(w.id).placeholder ? worldDef(w.id).name : w.id[0].toUpperCase() + w.id.slice(1),
      status: w.status, line: w.line, port: w.port, money: w.money, good: w.good, lacks: w.lacks,
      facts: { ...facts, distanceMkm: d },
      factions: w.factions.map((f) => factionCard(f, live)),
      goods: goodsLines(w.id),
      players: live.players?.[w.id] || 0, online: live.online?.[w.id] || 0,
      governor: w.id === 'mars' ? 'Port staff (NPC; Mars is neutral)' : 'An NPC governor, until a player is voted in',
      nearest: w.nearest || null,
    };
  });
  const season = live.season || null;
  return { worlds, season: season ? { ...season, ...CAUSE_INFO[season.cause] } : null,
    moons: ['phobos', 'deimos'].filter(hasWorld).map((id) => ({ id, name: worldDef(id).name, line: worldDef(id).blurb, startable: false })) };
}

export { fmt as boardFmt, dayText as boardDayText };

// Heartbeat Rocket - the goal ladder and saved progress (no drawing, no DOM). Shared by the game and the test.
// Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.
import { NOSES, PAYLOADS } from './physics.js';
import { relayRing, kepAt, kepPeri } from './missions.js';

export const GOALS = [
  { id: 'clouds', alt: 2000,  title: 'Touch the clouds', done: 'You touched the clouds!', unlock: ['fins'],
    unlockText: 'New part: fins', unlockSub: 'Fins help your rocket fly straighter.' },
  { id: 'space',  alt: 70000, title: 'Reach space', done: 'You reached space!', unlock: ['tall', 'stages'],
    unlockText: 'New parts: the tall tank and stages', unlockSub: 'A booster now stacks under your rocket. That is enough to go all the way around!' },
  { id: 'orbit',  alt: null,  title: 'Go all the way around', done: 'You went all the way around!', unlock: ['shield'],
    unlockText: 'New: the heat shield, and Do it yourself mode', unlockSub: 'Coming home from orbit is HOT. The shield keeps your capsule cool.' },
  { id: 'home',   alt: null,  title: 'Come home safe', done: 'You came home safe!', unlock: ['stage3'],
    unlockText: 'New: a third stage', unlockSub: 'A giant booster goes under the other two. That is enough push to reach the Moon!' },
  { id: 'moonfly', alt: null, title: 'Fly past the Moon', done: 'You flew past the Moon!', unlock: ['legs'],
    unlockText: 'New part: landing legs', unlockSub: 'Legs keep your rocket standing up on the bumpy Moon.' },
  { id: 'moonland', alt: null, title: 'Land on the Moon', done: 'You landed on the Moon!', unlock: ['flag'],
    unlockText: 'New: a flag with your name', unlockSub: 'Plant it on the Moon. It stays there for good.' },
  { id: 'moonhome', alt: null, title: 'Come home from the Moon', done: 'You came home from the Moon!', unlock: ['weather'],
    unlockText: 'New: satellites', unlockSub: 'Tap the nose in the hangar to carry a weather satellite instead of the capsule.' },
  { id: 'sat',    alt: null, title: 'Put a satellite in orbit', done: 'Your satellite is in orbit!', unlock: ['relay'],
    unlockText: 'New: relay satellites', unlockSub: 'Relays pass messages around the planet. Three of them make a ring.' },
  { id: 'ring',   alt: null, title: 'Build a ring of 3 relay satellites', done: 'Your relay ring works!', unlock: ['telescope', 'module'],
    unlockText: 'New: a space telescope and station parts', unlockSub: 'Build a space station one part at a time.' },
  { id: 'station', alt: null, title: 'Start a space station', done: 'Your space station is in orbit!', unlock: [],
    unlockText: 'Next: bring it a new part', unlockSub: 'Each flight can dock one more part to your station.' },
  { id: 'dock',   alt: null, title: 'Dock a new part to your station', done: 'Docked! Your station grew.', unlock: [],
    unlockText: 'Keep building', unlockSub: 'A bigger station needs more parts.' },
  { id: 'station4', alt: null, title: 'Grow your station to 4 parts', done: 'Your station has 4 parts!', unlock: [],
    unlockText: 'You built a real space station!', unlockSub: 'Keep adding parts, satellites and flags. Your sky remembers.' },
];

export const SAVE_KEY = 'hb-rocket-v1';            // same key since v1, so progress carries over
export const WARPS = [1, 10, 50, 200];
export const DEFAULT_SAVE = {
  v: 3, reached: Object.fromEntries(GOALS.map(g => [g.id, false])),
  unlocked: { fins: false, tall: false, stages: false, shield: false, stage3: false, legs: false, flag: false, weather: false, relay: false, telescope: false, module: false },
  seen: { fins: true, tall: true, stages: true, shield: true, stage3: true, legs: true, flag: true, weather: true, relay: true, telescope: true, module: true },
  config: { nose: 'capsule', tank: 'short', engine: 'small', fins: true, stages: 1, shield: true, legs: true },
  nums: false, sound: true, best: 0, flights: 0, warp: 10,
  diy: false,          // "Do it yourself": no autopilot helpers (unlocks after going all the way around once)
  guideAll: false,     // flight guide: false = a line stops showing after 3 flights; true = every line, every flight
  heard: {},           // how many flights each guide line has been shown in
  worldT: 0,           // the sky's clock (seconds): the Moon and everything you left in orbit keep moving with it
  sats: [],            // satellites you left in orbit: { kind, kep, n }
  station: null,       // { kep, modules: [kind...] }
  flags: [],           // flags on the Moon: { a (angle on the Moon), name }
  name: '',            // the name on your flag
};
export const NOSE_LIST = ['capsule', 'pointy', 'weather', 'relay', 'telescope', 'module'];

// what a saved object from any older version becomes now
export function migrate(s) {
  const out = structuredClone(DEFAULT_SAVE);
  if (!s || typeof s !== 'object') return out;
  for (const k of Object.keys(out)) {
    if (s[k] === undefined || s[k] === null) continue;
    if (Array.isArray(out[k])) { if (Array.isArray(s[k])) out[k] = s[k]; }
    else if (out[k] !== null && typeof out[k] === 'object') out[k] = { ...out[k], ...s[k] };
    else out[k] = s[k];
  }
  if (s.station && typeof s.station === 'object' && s.station.kep) out.station = s.station;
  // v1 -> v2: whoever reached space gets stages (a booster goes on right away); whoever went around gets the shield
  if (!s.v || s.v < 2) {
    if (out.reached.space) { out.unlocked.tall = true; out.unlocked.stages = true; out.seen.stages = false; out.config.stages = 2; }
    if (out.reached.orbit) { out.unlocked.shield = true; out.seen.shield = false; out.config.shield = true; }
  }
  // v2 -> v3: whoever already came home safe gets the third stage (the Moon goal is next for them)
  if (!s.v || s.v < 3) {
    if (out.reached.home && !out.unlocked.stage3) { out.unlocked.stage3 = true; out.seen.stage3 = false; out.config.stages = 3; }
    out.v = 3;
  }
  const c = out.config;
  if (!['short', 'medium', 'tall'].includes(c.tank) || (c.tank === 'tall' && !out.unlocked.tall)) c.tank = 'short';
  if (!noseOk(out, c.nose)) c.nose = 'capsule';
  if (!['small', 'big'].includes(c.engine)) c.engine = 'small';
  const maxSt = out.unlocked.stage3 ? 3 : out.unlocked.stages ? 2 : 1;
  if (![1, 2, 3].includes(c.stages) || c.stages > maxSt) c.stages = Math.min(maxSt, c.stages === 3 ? 3 : c.stages === 2 ? 2 : 1);
  c.legs = c.legs !== false;
  if (!WARPS.includes(out.warp)) out.warp = 10;
  out.diy = !!(out.diy && out.reached.orbit); out.guideAll = !!out.guideAll;
  if (typeof out.worldT !== 'number' || !isFinite(out.worldT)) out.worldT = 0;
  out.sats = out.sats.filter(x => x && x.kep && SATKINDS.includes(x.kind));
  out.flags = out.flags.filter(x => x && typeof x.a === 'number');
  if (out.station && (!out.station.kep || !Array.isArray(out.station.modules))) out.station = null;
  out.name = String(out.name || '').slice(0, 16);
  return out;
}
const SATKINDS = ['weather', 'relay', 'telescope'];
export function noseOk(save, n) {
  if (NOSES[n]) return true;
  if (!PAYLOADS[n]) return false;
  return !!save.unlocked[n];
}
export function noseChoices(save) { return NOSE_LIST.filter(n => noseOk(save, n)); }
export function currentGoal(save) { return GOALS.find(g => !save.reached[g.id]) || null; }

// the relays in orbit right now, and whether they make a ring
export function ringNow(save) {
  const T = save.worldT;
  const pts = save.sats.filter(s => s.kind === 'relay').map(s => kepAt(s.kep, T));
  return relayRing(pts);
}
// does a satellite released with these orbit elements stay up? (its low point is above the air)
export function staysUp(kep) { return kepPeri(kep) > 70000 && kep.e < 1; }

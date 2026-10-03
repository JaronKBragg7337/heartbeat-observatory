// ============================================================================
// roles/balance.js - F4: the balance and home strength. BIBLE-v3 section 4.6 ("two paths per world").
//
// Every settled world has TWO server values, never a slider on a screen:
//   balance   0..100   0 = full competition between its two factions ... 100 = full cooperation
//   strength  0..100   home strength: the mean of wealth, industry, defences and population (each 0..100)
// Players move them (jobs, projects, peace deals); with nobody playing, NPCs run the world and it drifts slowly toward competition while
// strength holds. They are READ by prices, raider spawns, what cooperation unlocks, and the home-ground advantages. Cooperation SPENDS
// strength on reach; competition keeps it at home and grows it. It cannot do both at once: reach and hoard pull on the same money.
//
// Pure functions over a plain record { balance, wealth, industry, defences, population, projects, home, treasury }. No state lives here: the
// server keeps the records (state.homes) and calls these. The browser calls them too, to turn the numbers into words.
// ============================================================================
import { WORLDS } from './seats.js';

export const START = { balance: 40, wealth: 20, industry: 20, defences: 20, population: 20 };
export const COMPONENTS = ['wealth', 'industry', 'defences', 'population'];
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

/** The worlds that carry the two meters: the four two-sided worlds and the two station homes. Mars is neutral and has none. */
export const meteredWorlds = () => WORLDS.filter((w) => !w.neutral);
export const hasMeters = (worldId) => meteredWorlds().some((w) => w.id === worldId);
/** A two-sided world has a real balance between two factions; a station home has strength only (its balance stays where it started). */
export const isTwoSided = (worldId) => (meteredWorlds().find((w) => w.id === worldId)?.factions.length || 0) === 2;

export function newHome(worldId) {
  return { ...START, treasury: 20000, projects: {}, home: {}, intake: 0, at: 0, worldId };
}
export const strengthOf = (h) => round2(COMPONENTS.reduce((a, k) => a + h[k], 0) / COMPONENTS.length);
const comp = (h) => (100 - h.balance) / 100;            // 0..1 how competitive
const coop = (h) => h.balance / 100;
const sN = (h) => strengthOf(h) / 100;

// ---- what a job does ---------------------------------------------------------------------------------------------------------------------
/** The three kinds of job on a board. `size` is 1 for an ordinary shift. */
export const JOB_SIDES = {
  home: { label: 'faction job', blurb: 'Helps only your faction. Pays best. Pushes toward competition and raises home strength.' },
  joint: { label: 'joint job', blurb: 'Helps both factions (a water run, a comms part). Pays less. Pushes toward cooperation and spends home strength on reach.' },
  sabotage: { label: 'sabotage', blurb: 'Blow a pipe, steal a part. Pays very well, pushes hard toward competition, and the other side remembers.' },
};
/** Apply one finished job to a home record (mutates and returns it). `trade` is the component the work feeds (wealth, industry, defences, population). */
export function applyJob(h, side, trade, size = 1) {
  const two = isTwoSided(h.worldId);
  if (side === 'home') { h[trade] = clamp(h[trade] + 2.2 * size); if (two) h.balance = clamp(h.balance - 1.6 * size); }
  else if (side === 'joint') {
    if (two) h.balance = clamp(h.balance + 2.4 * size);
    spend(h, 0.9 * size);                               // reach is paid for out of the home
  } else if (side === 'sabotage') { h[trade] = clamp(h[trade] + 0.6 * size); if (two) h.balance = clamp(h.balance - 3.4 * size); }
  else throw Error('Unknown job side: ' + side);
  return h;
}
/** Take `amount` points from the home, richest component first (cooperation spends what competition hoarded). */
export function spend(h, amount) {
  let left = amount;
  for (const k of [...COMPONENTS].sort((a, b) => h[b] - h[a])) { const take = Math.min(h[k], left); h[k] = round2(h[k] - take); left -= take; if (left <= 0) break; }
  return amount - left;
}
/** A peace deal is a job chain, not a vote; the last link calls this. Peace spends the treasury on the unlocks FAST (a rich world builds in days). */
export function applyPeace(h) {
  const two = isTwoSided(h.worldId);
  if (two) h.balance = clamp(h.balance + 18);
  const s = spend(h, 6);
  h.treasury = Math.max(0, h.treasury - 2000);
  return s;
}

// ---- joint projects and home projects -----------------------------------------------------------------------------------------------------------
/** Built from two halves; each faction delivers its own. A project with one half delivered sits visibly unfinished. `parts` is the count of the `parts` supply per half. */
export const JOINT_PROJECTS = [
  { id: 'shipyard', name: 'Joint shipyard', parts: 60, unlocks: 'hullClass', balanceAtLeast: 20, blurb: 'A yard both factions use: bigger hulls built here.' },
  { id: 'relay', name: 'Comms relay', parts: 40, unlocks: 'relay', balanceAtLeast: 10, blurb: 'Relays in a storm and a talking line between the factions.' },
  { id: 'refinery', name: 'Shared refinery', parts: 80, unlocks: 'fuel', balanceAtLeast: 30, blurb: 'Cheaper fuel and power for everyone.' },
  { id: 'tether', name: 'The tether', parts: 120, unlocks: 'tether', balanceAtLeast: 45, blurb: 'A cable to the sky: the cheap way up for big hulls.' },
];
/** The competing path's build list. Real buildings; each feeds a home component. One half only (it is your own). */
export const HOME_PROJECTS = [
  { id: 'walls', name: 'Walls', parts: 40, feeds: 'defences', gain: 8 },
  { id: 'gun-towers', name: 'Gun towers', parts: 60, feeds: 'defences', gain: 10 },
  { id: 'market', name: 'A bigger market', parts: 50, feeds: 'wealth', gain: 8 },
  { id: 'bank', name: 'A bank', parts: 70, feeds: 'wealth', gain: 10 },
  { id: 'parade-ground', name: 'Parade ground', parts: 30, feeds: 'population', gain: 5 },
  { id: 'palace', name: 'A palace', parts: 90, feeds: 'population', gain: 12 },
  { id: 'dome-city', name: 'Dome city', parts: 140, feeds: 'population', gain: 16 },
];
export const jointProject = (id) => JOINT_PROJECTS.find((p) => p.id === id) || null;
export const homeProject = (id) => HOME_PROJECTS.find((p) => p.id === id) || null;
/** A joint project record: { a, b, done }. Halves are the two factions in the world's order. */
export const jointState = (h, id) => (h.projects[id] ||= { a: 0, b: 0, done: false });
export function deliverJoint(h, id, half, n) {
  const def = jointProject(id); if (!def) throw Error('There is no such project.');
  if (!isTwoSided(h.worldId)) throw Error('Joint projects are between two factions.');
  if (h.balance < def.balanceAtLeast) throw Error(`The two sides are not talking enough yet for ${def.name.toLowerCase()} (balance ${Math.round(h.balance)}, needs ${def.balanceAtLeast}).`);
  const st = jointState(h, id); if (st.done) throw Error('That is already built.');
  if (half !== 'a' && half !== 'b') throw Error('Choose a half.');
  const take = Math.min(n, def.parts - st[half]); if (take < 1) throw Error('That half is already delivered.');
  st[half] += take; spend(h, 0.012 * take);             // hauling reach out of the home
  if (st.a >= def.parts && st.b >= def.parts) { st.done = true; h.balance = clamp(h.balance + 6); }
  return take;
}
/** A rich world that pivots can buy the missing half outright (the catch-up edge). Cost is wealth points. Only when the sides are at least at 50 and the other half is whole. */
export function buyMissingHalf(h, id) {
  const def = jointProject(id); if (!def) throw Error('There is no such project.');
  const st = jointState(h, id); if (st.done) throw Error('That is already built.');
  if (h.balance < Math.max(50, def.balanceAtLeast)) throw Error('Only a world that has pivoted to peace can buy the other half.');
  const half = st.a >= def.parts ? 'b' : st.b >= def.parts ? 'a' : null;
  if (!half) throw Error('One half has to be delivered before the other can be bought.');
  const rest = def.parts - st[half], cost = rest / 4;
  if (h.wealth < cost) throw Error(`Buying the missing half costs ${cost.toFixed(0)} wealth; the home has ${Math.floor(h.wealth)}.`);
  h.wealth = round2(h.wealth - cost); st[half] = def.parts; st.done = true; h.balance = clamp(h.balance + 6);
  return { half, cost };
}
export function deliverHome(h, id, n) {
  const def = homeProject(id); if (!def) throw Error('There is no such project.');
  const st = (h.home[id] ||= { n: 0, done: false }); if (st.done) throw Error('That is already built.');
  const take = Math.min(n, def.parts - st.n); if (take < 1) throw Error('Nothing more to deliver.');
  st.n += take;
  if (st.n >= def.parts) { st.done = true; h[def.feeds] = clamp(h[def.feeds] + def.gain); }
  return take;
}

// ---- what the meters DO ------------------------------------------------------------------------------------------------------------------------
/** Unlocks go live in steps as the balance climbs; each is a real building or ship class at that world's port. Home strength sets how fast (`buildRate`). */
export const UNLOCKS = [
  { id: 'open-gate', name: 'The gate between districts is open', balanceAtLeast: 15 },
  { id: 'joint-yard', name: 'Joint shipyard (medium hulls)', balanceAtLeast: 35, needs: 'shipyard' },
  { id: 'long-relay', name: 'Long-range relay', balanceAtLeast: 50, needs: 'relay' },
  { id: 'big-hulls', name: 'Big hulls (transit and cargo)', balanceAtLeast: 65, needs: 'refinery' },
  { id: 'capital-yard', name: 'Capital hull yard', balanceAtLeast: 85, needs: 'tether' },
];
export const HOME_UNLOCKS = [
  { id: 'garrison', name: 'A garrison on the walls', strengthAtLeast: 35 },
  { id: 'home-upgrades', name: 'Home-only ship upgrades', strengthAtLeast: 50 },
  { id: 'fat-treasury', name: 'A treasury that can buy a whole project', strengthAtLeast: 65 },
];
/** Home strength sets how fast an unlock is built: 0.5x at nothing, 1.5x at full strength. */
export const buildRate = (h) => round2(0.5 + sN(h));
export function unlocks(h) {
  const two = isTwoSided(h.worldId);
  return {
    cooperation: UNLOCKS.map((u) => ({ ...u, open: two && h.balance >= u.balanceAtLeast && (!u.needs || !!h.projects[u.needs]?.done) })),
    home: HOME_UNLOCKS.map((u) => ({ ...u, open: strengthOf(h) >= u.strengthAtLeast })),
  };
}
/** The biggest hull class a world's own yard can start: size follows the unlocks, never range (a small ship can go anywhere, slowly). */
export function hullClass(h) {
  const u = unlocks(h).cooperation, open = (id) => u.find((x) => x.id === id).open;
  if (open('capital-yard')) return 'capital';
  if (open('big-hulls')) return 'transit';
  if (open('joint-yard')) return 'merchant';
  return 'scout';
}

/**
 * Prices follow both meters. A competing world is dear for outsiders and cheap for its own; a cooperating world is cheap and busy for
 * everyone. `side`: 'own' (a member of one of its factions) or 'outsider' (anyone else). Returns a multiplier on what the PLAYER PAYS (buy)
 * or RECEIVES (sell), clamped to 0.7..1.3. Tax is separate (the governor's, in `taxCut`).
 */
export function priceFactor(h, side, direction) {
  const c = comp(h), k = coop(h), s = 0.5 + 0.5 * sN(h);
  let f;
  if (direction === 'buy') f = side === 'own' ? 1 - 0.12 * c * s - 0.04 * k : 1 + 0.25 * c - 0.08 * k;
  else f = side === 'own' ? 1 + 0.1 * c * s + 0.03 * k : 1 - 0.18 * c + 0.07 * k;
  return round2(clamp(f, 0.7, 1.3) / 1);
}
/** Raiders follow the balance, but home strength pushes them back: a rich fortified world has pirates in the lanes around it, not in its sky. Both 0..~1.2, 1 = about the start. */
export function skyRaiders(h, patrol = 0.5) { return round2((0.15 + 0.9 * comp(h) * (1 - 0.85 * (h.defences / 100))) * (1.2 - 0.6 * patrol)); }
export function laneRaiders(h) { return round2(0.2 + 0.8 * comp(h) * (0.4 + 0.6 * sN(h))); }
/** Repairs and fuel and power at home: the competing path's home-ground edge (0.7..1 of the base price). */
export const homeUpkeepFactor = (h) => round2(1 - 0.3 * comp(h) * sN(h));

/** Mean lane pressure across the settled worlds, against the pressure of a world left at its start: the fleet director divides RESPAWN_S by this. */
export function lanePressure(homes) {
  const base = laneRaiders({ ...START }), list = meteredWorlds().map((w) => homes[w.id]).filter(Boolean);
  if (!list.length) return 1;
  const mean = list.reduce((a, h) => a + laneRaiders(h), 0) / list.length;
  return Math.max(0.4, Math.min(2.5, mean / base));
}

// ---- time: nobody playing, and NPCs taking the jobs nobody takes ----------------------------------------------------------------------------------
/**
 * One slow step (per minute of world time) for a world. `stance` is the world's stance (src/roles/book.js), `npcShare` the fraction of the
 * world's job seats held by NPCs (0..1), `humansHere` whether anyone is there. NPCs take the jobs nobody takes, slowly, and by the book:
 * competing stances feed strength and push the balance down; cooperating stances push it up and spend. An empty world turns inward.
 */
export function drift(h, stance, npcShare, humansHere) {
  const w = Math.max(0, npcShare);
  if (isTwoSided(h.worldId)) h.balance = clamp(h.balance + 0.12 * stance * w);
  if (stance < 0) for (const k of COMPONENTS) h[k] = clamp(h[k] + 0.03 * -stance * w);
  else spend(h, 0.02 * stance * w);
  if (!humansHere && isTwoSided(h.worldId)) h.balance = clamp(h.balance - 0.06);      // an empty world turns inward; its strength holds
  h.treasury = Math.min(200000, h.treasury + Math.round(strengthOf(h) * 1.2));
  for (const k of [...COMPONENTS, 'balance']) h[k] = round2(h[k]);
  return h;
}

/** Words for the meters: what a player sees in the place instead of a slider. */
export function describe(h) {
  const b = h.balance, s = strengthOf(h);
  const bw = b < 15 ? 'Open rivalry: two walls, two markets, nobody visits the other side.' : b < 35 ? 'Cold. Each side minds its own gate.' : b < 55 ? 'Wary. Some traffic crosses, most of it carrying a receipt.' : b < 75 ? 'Warm. Joint crews, shared berths, ships leaving.' : 'Open hands. The ports are busy and the vaults are thin.';
  const sw = s < 15 ? 'Thin: a few lights, a short wall.' : s < 35 ? 'Getting by.' : s < 55 ? 'Solid: towers going up, a full market.' : s < 75 ? 'Rich and armed.' : 'A fortress city with a fat treasury.';
  return { balance: bw, strength: sw };
}

/**
 * What the board pays today. The NPC leaders' stance tilts which jobs the board offers (BIBLE-v3 4.6: "a leader sets the faction's stance, which
 * tilts which jobs the board offers"): a hard-competing world pays faction jobs up and joint jobs down; a cooperating one the other way.
 * Multipliers on a seat's base pay.
 */
export function jobBoard(stance) {
  const s = Math.max(-1, Math.min(1, stance));
  return { home: round2(1 + 0.3 * -s), joint: round2(0.75 + 0.35 * s + 0.25), sabotage: 1.9 };
}

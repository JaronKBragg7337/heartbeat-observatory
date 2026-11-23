// ============================================================================
// worlds/yardBook.js - THE YARD BOOK: what stands on every side's stand right now, as one set of PURE numbers (no three.js, no DOM) that the browser, the
// game server and the validator all read. Two things live here:
//   YARD_TT   the timetable facts of each yard built from the shared kit (worlds/_kit/sideYard.js): gravity, slot length, each side's stand, flight and
//             stock numbers. The yard configs (worlds/moon/yards.js, earth/yards.js, callisto/yards.js) take these numbers from here, so the yard a player
//             sees and the yard the server counts cannot drift apart. Occator Works keeps its own hand-made timetable (worlds/ceres/timetable.js).
//   TALLIES   one entry for each of the eight home sides: where its stock stands, what a player is asked to count there, and how the truth is worked out.
//
// WHY: until 11/23 the yards were scenery. A job can now end AT a yard (missions/freight.js "tally" runs, step kind `count`): the player counts what is
// really standing there and signs the number, and the authority checks it against the same clock the yard is drawn from (server/missions.mjs).
// The count is a function of the world clock (space/clock.js) and, in a shared world, of how strong the home is (a strong home stacks its yard higher).
// ============================================================================
import { makeTimetable } from './_kit/yardClock.js';
import { SLOT_S as CERES_SLOT_S, FLY as CERES_FLY, visitAt as ceresVisitAt, oreLevelAt, waterLevelAt } from './ceres/timetable.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const MOON_FLY = { V: 50, a: 0.8, af: 1.4, av: 0.35, Hh: 45, HC: 45, hoverS: 10, descentS: 26, strobeY: 4.2 };
const EARTH_FLY = { V: 85, a: 2.6, af: 3.2, av: 1.1, Hh: 40, HC: 40, hoverS: 6, descentS: 15, strobeY: 4.2 };
const CALLISTO_FLY = { V: 46, a: 0.62, af: 1.1, av: 0.28, Hh: 45, HC: 45, hoverS: 10, descentS: 26, strobeY: 4.2 };

/** The kit yards. Every number is outpost-local metres (x east, z south) measured from the yard's `origin` when it has one. */
export const YARD_TT = {
  shackleton: { g: 1.62, slotS: 720, visitMaxS: 480,
    origin: { x: 20, z: 0 },       // the yard was drawn 20 m further west, where the ice dock's weigh bay already stands
    sides: [{ side: 'fortis', spot: { id: 'supply-stand-6', name: 'Supply stand 6', type: 'courier', x: -48, z: 62, y: 0.06, clearM: 18, bear: 10, out: 190 },
      fly: { ...MOON_FLY, n: 6, name: 'Ration Six' }, stock: { max: 12, mode: 'bring', low: 0.25 } }] },
  daedalus: { g: 1.62, slotS: 720, visitMaxS: 480,
    origin: { x: 0, y: 0.3, z: 0 },       // the whole dock stands on a low white deck: the crater floor here is not as level as the pad
    sides: [{ side: 'technos', spot: { id: 'tray-dock', name: 'bay-2 / tray dock', type: 'courier', x: -44, z: 40, y: 0.06, clearM: 18, bear: -15, out: 165 },
      fly: { ...MOON_FLY, V: 54, n: 2, name: 'Quiet Carrier' }, stock: { max: 10, mode: 'take' } }] },
  earth: { g: 9.81, slotS: 720, visitMaxS: 480,
    sides: [
      { side: 'skyward', spot: { id: 'payload-stand-2', name: 'Payload stand 2', type: 'courier', x: -58, z: 88, y: 0.06, clearM: 18, bear: -25, out: 145 },
        fly: { ...EARTH_FLY, n: 2, name: 'Upbound Two' }, stock: { max: 8, mode: 'bring', low: 0.25 } },
      { side: 'homeguard', spot: { id: 'sea-wall-depot-1', name: 'Sea wall depot 1', type: 'courier', x: 58, z: 88, y: 0.06, clearM: 18, bear: 25, out: 215 },
        fly: { ...EARTH_FLY, V: 78, n: 1, name: 'Tide Table' }, stock: { max: 12, mode: 'take' } },
    ] },
  // Callisto's two places are 1.2 km apart: two yards on ONE rota (`turns: 2`), Mystara's ship has the even slots, the Unbound's the odd.
  'callisto-mystara': { g: 1.236, slotS: 720, visitMaxS: 480, turns: 2, turn0: 0,
    sides: [{ side: 'mystara', spot: { id: 'relay-stand', name: 'Relay stand', type: 'courier', x: 86, z: -6, y: 0.06, clearM: 18, bear: 80, out: -100 },
      fly: { ...CALLISTO_FLY, n: 9, name: 'Ninth Band' }, stock: { max: 9, mode: 'bring', low: 0.22 } }] },
  'callisto-unbound': { g: 1.236, slotS: 720, visitMaxS: 480, turns: 2, turn0: 1,       // port-local metres: origin the Prospectors' Camp's own graded centre
    sides: [{ side: 'unbound', spot: { id: 'claim-pad', name: 'Claim freight pad', type: 'courier', x: 37, z: 2, y: 0.1, clearM: 18, bear: 130, out: -40 },
      fly: { ...CALLISTO_FLY, V: 42, n: 4, name: 'Number Four' }, stock: { max: 10, mode: 'take' } }] },
};

/**
 * What a player is asked to count, side by side. `at` is where the stock stands, in the outpost metres of `frame` (the MAIN pad's, also for the Prospectors'
 * Camp, which the yard itself draws in its own port's frame: 1.2 km north of the Valhalla pad). `max` is the largest answer; `labels` (when the answer is not
 * a plain number) are the words for 0..max; `tol` is how far off a signed answer may be and still be taken. `stand` and `clearM` are the side's landing
 * stand in the same metres: a ship parked inside that circle waves the side's ship off (sideYard.js spotBlocked), and then the stock does not move.
 */
export const TALLIES = {
  fortis: { side: 'fortis', yard: 'shackleton', i: 0, world: 'moon', frame: 'moon-shackleton', place: 'Supply Stand 6', at: [-30.1, 83.6], r: 16, max: 12, tol: 1, stand: [-28, 62], clearM: 18,
    unit: ['crate', 'crates'], ask: 'How many crates stand on the three pallets?' },
  technos: { side: 'technos', yard: 'daedalus', i: 0, world: 'moon', frame: 'moon-daedalus', place: 'the tray dock', at: [-36, 57.9], r: 16, max: 10, tol: 1, stand: [-44, 40], clearM: 18,
    unit: ['sealed case', 'sealed cases'], ask: 'How many sealed cases stand on the plinth?' },
  skyward: { side: 'skyward', yard: 'earth', i: 0, world: 'earth', frame: 'earth', place: 'Payload Stand 2', at: [-58, 111.7], r: 16, max: 8, tol: 1, stand: [-58, 88], clearM: 18,
    unit: ['canister', 'canisters'], ask: 'How many payload canisters stand in the rack?' },
  homeguard: { side: 'homeguard', yard: 'earth', i: 1, world: 'earth', frame: 'earth', place: 'Sea Wall Depot 1', at: [54.8, 111.6], r: 16, max: 12, tol: 1, stand: [58, 88], clearM: 18,
    unit: ['wall block', 'wall blocks'], ask: 'How many wall blocks are stacked on the timbers?' },
  mystara: { side: 'mystara', yard: 'callisto-mystara', i: 0, world: 'callisto', frame: 'callisto', place: 'the Relay Stand', at: [82.5, 16], r: 16, max: 9, tol: 1, stand: [86, -6], clearM: 18,
    unit: ['coil drum', 'coil drums'], ask: 'How many coil drums stand by the measuring house? Count the ones on top too.' },
  unbound: { side: 'unbound', yard: 'callisto-unbound', i: 0, world: 'callisto', frame: 'callisto', place: 'the claim freight pad', at: [33, -1172.5], r: 16, max: 10, tol: 1, stand: [37, -1194.5], clearM: 18,
    unit: ['core box', 'core boxes'], ask: 'How many core boxes are stacked by the awning?' },
  ironclad: { side: 'ironclad', ceres: 'ore', world: 'ceres', frame: 'ceres', place: 'the ore bunker', at: [-42.2, -101], r: 18, max: 3, tol: 0, stand: [-62, -128], clearM: 42,
    unit: ['bay', 'bays'], ask: 'How many of the bunker\'s three bays have ore in them?' },
  greenhaven: { side: 'greenhaven', ceres: 'water', world: 'ceres', frame: 'ceres', place: 'the clean-water tanks', at: [62, 64], r: 16, max: 4, tol: 0.75, stand: [64, 92], clearM: 24,
    labels: ['empty', 'a quarter full', 'half full', 'three quarters full', 'full'], ask: 'How full are the four tanks? Read the lit gauge on their side.' },
};
export const tallyOf = (key) => TALLIES[key] || null;

const _tt = {};
const ttOf = (yard) => (_tt[yard] ||= makeTimetable(YARD_TT[yard]));
/** A home's strength (0..100, roles/balance.js `strengthOf`) as the yard draws it: a strong home stacks to the top, a weak one to half. null = no shared world. */
export const stackShare = (strength) => (strength === null || strength === undefined || !Number.isFinite(strength) ? 1 : 0.5 + 0.5 * clamp01(Math.round(strength) / 100));

/** The slots whose waving-off would change what stands there now. A side's ship is waved off when somebody's ship is parked on her stand; the stock then
 *  does not move. Only looked at when a ship really stands there (`blocked`), so "full" is never a free answer. */
function skipCases(t, now) {
  if (t.ceres) { let k = Math.floor(now / CERES_SLOT_S); if (t.ceres === 'ore' ? (k & 1) : !(k & 1)) k -= 1; return [NaN, k, k - 2]; }
  const tt = ttOf(t.yard); let k = Math.floor(now / tt.SLOT); k -= tt.sideOf(k - t.i - tt.T0); return [NaN, k, k - tt.n];
}
/** What stands there at world time `now` (seconds, space/clock.js). Whole pieces for a stack; quarters (not rounded) for Greenhaven's gauge. */
export function tallyTruth(key, now, share = 1, skipK = NaN) {
  const t = TALLIES[key]; if (!t) return NaN;
  if (t.ceres === 'ore') return Math.ceil(oreLevelAt(now, skipK) / 2);          // a bay shows a heap while it holds anything (activity.js place())
  if (t.ceres === 'water') return waterLevelAt(now, skipK) * 4;
  const S = YARD_TT[t.yard].sides[t.i].stock;
  return Math.round(ttOf(t.yard).stockAt(t.i, now, S.mode, skipK, S.low) * share * S.max);
}
/**
 * Is a signed count right? The stack moves while a ship is down and a player takes a moment between counting and signing, so the answer is held against
 * the last three quarters of a minute, and may be `tol` out. `blocked`: a ship stands on the side's stand right now, so its last visit may have been
 * waved off: that case is taken too. Returns { ok, n (what stands there now, rounded), exact }.
 */
export function tallyCheck(key, answer, now, strength = null, blocked = false) {
  const t = TALLIES[key]; if (!t || !Number.isFinite(answer)) return { ok: false, n: NaN, exact: false };
  const share = stackShare(strength), n = Math.round(tallyTruth(key, now, share));
  let ok = false;
  for (const dt of [0, -15, -30, -45, 10]) for (const sk of (blocked ? skipCases(t, now + dt) : [NaN])) if (Math.abs(answer - tallyTruth(key, now + dt, share, sk)) <= t.tol + 1e-9) ok = true;
  return { ok, n, exact: answer === n };
}
/** A count in words: "9 crates", "1 bay", "half full". */
export function tallyWords(key, n) {
  const t = TALLIES[key]; if (!t) return String(n);
  const v = Math.max(0, Math.min(t.max, Math.round(n)));
  return t.labels ? t.labels[v] : `${v} ${v === 1 ? t.unit[0] : t.unit[1]}`;
}

/** The side's ship at world time `now`: { name, down (she stands on the stand), dueS (seconds until she next touches down; 0 while down) }. */
export function yardShipAt(key, now) {
  const t = TALLIES[key]; if (!t) return null;
  if (t.ceres) {
    const odd = t.ceres === 'water' ? 1 : 0, name = CERES_FLY[t.side].name, v = {};
    for (let k = Math.floor(now / CERES_SLOT_S) - 1, j = 0; j < 6; j++, k++) {
      if ((((k % 2) + 2) % 2) !== odd) continue;
      ceresVisitAt(k, v);
      if (now >= v.start + v.t4 && now < v.start + v.t5) return { name, down: true, dueS: 0 };
      if (now < v.start + v.t4) return { name, down: false, dueS: v.start + v.t4 - now };
    }
    return { name, down: false, dueS: 0 };
  }
  const tt = ttOf(t.yard), name = YARD_TT[t.yard].sides[t.i].fly.name, v = {};
  for (let k = Math.floor(now / tt.SLOT) - 1, j = 0; j < 2 * tt.n + 2; j++, k++) {
    tt.visitAt(k, v); if (v.empty || v.i !== t.i) continue;
    if (now >= v.start + v.t4 && now < v.start + v.t5) return { name, down: true, dueS: 0 };
    if (now < v.start + v.t4) return { name, down: false, dueS: v.start + v.t4 - now };
  }
  return { name, down: false, dueS: 0 };
}
/** One plain sentence about the side's ship, for the line a tally hand says and for the count card. */
export function yardShipWords(key, now) {
  const s = yardShipAt(key, now); if (!s) return '';
  if (s.down) return `${s.name} is down on the stand with her ramp open.`;
  const min = Math.round(s.dueS / 60);
  return min < 1 ? `${s.name} is on her way in: watch the sky.` : `${s.name} is due in about ${min} minute${min === 1 ? '' : 's'}.`;
}

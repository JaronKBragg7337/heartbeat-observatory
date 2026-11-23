// ============================================================================
// worlds/ceres/timetable.js - OCCATOR WORKS' TIMETABLE, PURE (no three.js, no DOM, no imports): when each side's ship comes and goes, where it is, how much
// ore stands in Ironclad's bunker and how full Greenhaven's tanks are. A function of the world clock only (space/clock.js `worldTimeS`), so every player
// sees the same heap, and the game server can check a count a player signs (worlds/yardBook.js, server/missions.mjs).
// Moved here unchanged from activity.js (11/23); activity.js draws the place from it.
// ============================================================================

const DEG = Math.PI / 180;
export const SLOT_S = 600;                 // one visit per slot: the two sides take turns
export const JITTER_S = 20;
const VISIT_MAX_S = SLOT_S - JITTER_S - 5;
const D0 = 2400, H0 = 420, DEND = 2400;    // where a ship is first seen (metres out, metres up) and how far out it is let go
const G_CERES = 0.284;
export const SIDES = ['ironclad', 'greenhaven'];
export const PHASES = ['cruise', 'braking', 'hover', 'final', 'landed', 'lifting', 'departing'];

/** Where each side's ship stands, outpost-local metres (x east, z south; a ship stands nose to -z, north). `bear` is where it comes from
 *  and `out` where it leaves to (degrees, as port/traffic.js measures them), both away from the station's roofs and chimneys. */
export const SPOTS = {
  ironclad: { id: 'ore-yard', name: 'Ore yard stand', side: 'ironclad', type: 'hauler', x: -62, z: -128, clearM: 42, bear: -150, out: 30 },
  greenhaven: { id: 'tender-stand', name: 'Tender stand', side: 'greenhaven', type: 'courier', x: 64, z: 92, clearM: 24, bear: 30, out: -150 },
};
/** How each ship flies its visit. V approach m/s, a braking m/s2, af the drive on the way out, av the vertical lift-off (the hauler leaves
 *  full: a twentieth of a metre per second squared is all its lift engines have left over), Hh the hover height, HC the climb before the turn. */
export const FLY = {
  ironclad: { V: 24, a: 0.16, af: 0.45, av: 0.07, Hh: 45, HC: 50, hoverS: 20, descentS: 40, strobeY: 7.2, n: 7, name: 'Pit Seven' },
  greenhaven: { V: 28, a: 0.2, af: 0.7, av: 0.12, Hh: 36, HC: 45, hoverS: 14, descentS: 34, strobeY: 4.2, n: 12, name: 'Good Soup' },
};
for (const P of Object.values(FLY)) {
  P.brakeS = P.V / P.a; P.cruiseS = (D0 - P.V * P.V / (2 * P.a)) / P.V; P.flare = Math.atan(P.a / G_CERES);
  P.liftS = Math.sqrt(2 * P.HC / P.av); P.liftV = P.av * P.liftS;
  P.departS = 2 + (-1 + Math.sqrt(1 + 2 * (DEND / P.af - 2 / 3)));
}
const RAMP_WAIT_S = 8, RAMP_S = 6, BUTTON_UP_S = 9;

export const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const sm5 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function h01(n, salt) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Visit k of the timetable, written into `v` (pure: the same k gives the same visit on every machine). */
export function visitAt(k, v = {}) {
  const side = SIDES[((k % 2) + 2) % 2], S = SPOTS[side], P = FLY[side];
  v.k = k; v.side = side; v.spot = S; v.type = S.type; v.P = P; v.diverted = false; v.seen = false; v.skip = false;
  v.start = k * SLOT_S + h01(k, 2) * JITTER_S;
  v.da = (S.bear + (h01(k, 6) * 2 - 1) * 14) * DEG; v.dd = (S.out + (h01(k, 7) * 2 - 1) * 14) * DEG;
  const fixed = P.cruiseS + P.brakeS + P.hoverS + P.descentS + RAMP_WAIT_S + 2 * RAMP_S + BUTTON_UP_S + P.liftS + P.departS;
  v.dwell = Math.max(60, VISIT_MAX_S - fixed - h01(k, 8) * 30);          // ramp down: the loading, or the pumping
  v.t1 = P.cruiseS; v.t2 = v.t1 + P.brakeS; v.t3 = v.t2 + P.hoverS; v.t4 = v.t3 + P.descentS;
  v.t5 = v.t4 + RAMP_WAIT_S + 2 * RAMP_S + v.dwell + BUTTON_UP_S; v.t6 = v.t5 + P.liftS; v.t7 = v.t6 + P.departS;
  v.end = v.t7;
  v.workA = v.start + v.t4 + RAMP_WAIT_S + RAMP_S; v.workB = v.start + v.t5 - BUTTON_UP_S - RAMP_S;        // world times the ramp is fully down between
  return v;
}

/** Where visit `v` is `t` seconds after it started, written into `o`. Outpost-local metres; `alt` is the feet above the ground. */
export function poseAt(v, t, o = {}) {
  const P = v.P, S = v.spot;
  let d = 0, dir = v.da, sign = 1, alt = 0, yaw = 0, pitch = 0, gear = 1, ramp = 0, lift = 0, main = 0, phase = 0, ground = -1, hang = 1;
  if (t < v.t2) {
    if (t < v.t1) d = D0 - P.V * t; else { const u = v.t2 - t; d = 0.5 * P.a * u * u; phase = 1; }
    const q = d / D0, slope = 1.4 * (H0 - P.Hh) / D0 * Math.pow(q, 0.4);
    alt = P.Hh + (H0 - P.Hh) * Math.pow(q, 1.4);
    const flare = sm((t - v.t1) / 8) * (1 - sm((t - (v.t2 - 14)) / 14));
    yaw = v.da; pitch = -0.45 * Math.atan(slope) * (1 - flare) + P.flare * flare;
    gear = sm((t - (v.t2 - 44)) / 10);
    lift = 0.45 + 0.55 * sm((t - v.t1) / 4); main = 0.4 * (1 - sm((t - v.t1) / 3));
  } else if (t < v.t3) {
    phase = 2; alt = P.Hh; lift = 0.8;
    yaw = v.da + ((v.diverted ? v.dd : 0) - v.da) * sm((t - v.t2) / P.hoverS);        // the long hover: she turns onto the stand's line in it
  } else if (v.diverted || t >= v.t6) {
    const tau = t - (v.diverted ? v.t3 : v.t6), u = tau - 2;
    d = tau < 2 ? P.af * tau * tau * tau / 12 : P.af * (2 / 3 + u + 0.5 * u * u);
    dir = v.dd; sign = -1; phase = 6; yaw = v.dd;
    alt = (v.diverted ? P.Hh : P.HC + P.liftV * tau) + 0.2 * d;
    pitch = 9 * DEG * sm(tau / 10); gear = 1 - sm((tau - 6) / 9);
    lift = 1 - 0.5 * sm((tau - 10) / 12); main = sm(tau / 3);
  } else if (t < v.t4) {
    phase = 3; alt = P.Hh * (1 - sm5((t - v.t3) / P.descentS)); lift = 0.7;
  } else if (t < v.t5) {
    phase = 4; ground = t - v.t4;
    const up = sm((t - (v.t5 - 4)) / 4);
    lift = Math.max(1 - ground / 2, up) * 0.75; if (lift < 0) lift = 0;
    ramp = sm((ground - RAMP_WAIT_S) / RAMP_S) * (1 - sm((t - (v.t5 - BUTTON_UP_S - RAMP_S)) / RAMP_S));
    hang = Math.exp(-1.6 * ground) * Math.cos(3.2 * ground) + sm((t - (v.t5 - 2)) / 2);       // a slow, soft settle: the gear hardly loads here
  } else {
    const tau = t - v.t5; phase = 5; alt = 0.5 * P.av * tau * tau; lift = 1;
    yaw = v.dd * sm((tau - 4) / (P.liftS - 4));
  }
  o.x = S.x + sign * Math.sin(dir) * d; o.z = S.z + sign * Math.cos(dir) * d; o.alt = alt;
  o.yaw = yaw; o.pitch = pitch; o.gear = gear; o.hang = hang; o.ramp = ramp; o.lift = lift; o.main = main; o.phase = phase; o.ground = ground;
  const end = v.diverted ? v.t3 + P.departS : v.end;
  o.fade = sm(t / 8) * sm((end - t) / 8);
  return o;
}

// ---- what the timetable does to the place ---------------------------------------------------------------------------------
export const ORE_MAX = 6;                  // the bunker's heaps: three bays, each empty, half or full
const REFILL_S = 2 * SLOT_S - 440;         // the pit has the bunker full again well before the next hauler is due
const _va = {}, _vb = {};
/** The ore in the bunker at world time `now`: 0..ORE_MAX. The hauler's stay takes it out heap by heap; the pit puts it back. `skipK`: a
 *  visit that was waved off (it loaded nothing). */
export function oreLevelAt(now, skipK = NaN) {
  let k = Math.floor(now / SLOT_S); if (k & 1) k -= 1;                    // the latest hauler slot (even)
  let v = visitAt(k, _va);
  if (now < v.workA || k === skipK) { k -= 2; v = visitAt(k, _va); if (k === skipK) return ORE_MAX; }
  if (now < v.workB) return Math.max(0, ORE_MAX - Math.floor((ORE_MAX + 0.999) * (now - v.workA) / (v.workB - v.workA)));
  return Math.min(ORE_MAX, Math.floor(ORE_MAX * (now - v.workB) / REFILL_S));
}
const WATER_LOW = 0.22, DRINK_S = 2 * SLOT_S - 300;
/** The clean water in Greenhaven's tanks at `now`: 0..1. The tender's stay fills them; the Works drinks them down. */
export function waterLevelAt(now, skipK = NaN) {
  let k = Math.floor(now / SLOT_S); if (!(k & 1)) k -= 1;                 // the latest tender slot (odd)
  let v = visitAt(k, _vb);
  if (now < v.workA || k === skipK) { k -= 2; v = visitAt(k, _vb); if (k === skipK) return WATER_LOW; }
  if (now < v.workB) return WATER_LOW + (1 - WATER_LOW) * sm((now - v.workA) / (v.workB - v.workA));
  return Math.max(WATER_LOW, 1 - (1 - WATER_LOW) * (now - v.workB) / DRINK_S);
}
export { RAMP_WAIT_S };
export { BUTTON_UP_S };

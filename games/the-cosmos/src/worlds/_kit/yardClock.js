// ============================================================================
// worlds/_kit/yardClock.js - THE TIMETABLE OF A SIDE'S YARD, PURE (no three.js, no DOM, no imports): the same numbers in the browser, on the
// game server and in the validator. worlds/_kit/sideYard.js draws a yard from it; worlds/yardBook.js lets a job ask what is standing on a
// stand right now, so the authority can check a count a player signs (server/missions.mjs, step kind `count`).
//
// Moved here unchanged from sideYard.js (11/23): everything is a function of the world clock (space/clock.js `worldTimeS`).
//   - Slot k (cfg.slotS long) holds ONE visit; with n sides, side i flies slots k = i (mod n). No visit outlasts cfg.visitMaxS.
//   - A ship's pose is `poseAt(visit, t)`. The braking tilt is atan(a / g) for the world's own gravity (cfg.g).
//   - A side's stock is `stockAt(i, now, mode)`: 'take' = the ship's stay carries the stack away and the home rebuilds it; 'bring' = the
//     ship's stay fills it and the home uses it up.
// ============================================================================

const DEG = Math.PI / 180;
export const PHASES = ['cruise', 'braking', 'hover', 'final', 'landed', 'lifting', 'departing'];
export const RAMP_WAIT_S = 8, RAMP_S = 6, BUTTON_UP_S = 9, JITTER_S = 20;

const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const sm5 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export function h01(n, salt) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The timetable of one place, pure (no three.js, no DOM): the same numbers on every machine.
 * cfg: { g, slotS = 600, visitMaxS = slotS - 25, d0 = 2400, h0 = 420, dEnd = 2400,
 *        sides: [{ side, spot: { id, name, type, x, z, clearM, bear, out }, fly: { V, a, af, av, Hh, HC, hoverS, descentS, strobeY, n, name } }] }
 */
export function makeTimetable(cfg) {
  const SLOT = cfg.slotS || 600, MAX = cfg.visitMaxS || SLOT - JITTER_S - 5, D0 = cfg.d0 || 2400, H0 = cfg.h0 || 420, DEND = cfg.dEnd || 2400;
  // Two yards of one world that stand apart (Callisto: the camp and the prospectors' camp) share one rota: `turns` slots in a round, this yard's sides
  // starting at `turn0`. A slot that belongs to the other yard is empty here, so one ship is alive at a time across both.
  const n = cfg.turns || cfg.sides.length, T0 = cfg.turn0 || 0;
  const FLY = cfg.sides.map((s) => {
    const P = { ...s.fly };
    P.brakeS = P.V / P.a; P.cruiseS = Math.max(0, (D0 - P.V * P.V / (2 * P.a)) / P.V); P.flare = Math.atan(P.a / cfg.g);
    P.liftS = Math.sqrt(2 * P.HC / P.av); P.liftV = P.av * P.liftS;
    P.departS = 2 + (-1 + Math.sqrt(1 + 2 * (DEND / P.af - 2 / 3)));
    return P;
  });
  const sideOf = (k) => ((k % n) + n) % n;
  /** Visit k, written into `v`. */
  function visitAt(k, v = {}) {
    const i0 = sideOf(k) - T0, empty = !cfg.sides[i0], i = empty ? 0 : i0, S = cfg.sides[i].spot, P = FLY[i];
    v.k = k; v.i = i; v.side = cfg.sides[i].side; v.spot = S; v.type = S.type; v.P = P; v.diverted = false; v.seen = false; v.skip = empty; v.empty = empty;
    v.start = k * SLOT + h01(k, 2) * JITTER_S;
    v.da = (S.bear + (h01(k, 6) * 2 - 1) * 14) * DEG; v.dd = (S.out + (h01(k, 7) * 2 - 1) * 14) * DEG;
    const fixed = P.cruiseS + P.brakeS + P.hoverS + P.descentS + RAMP_WAIT_S + 2 * RAMP_S + BUTTON_UP_S + P.liftS + P.departS;
    v.dwell = Math.max(60, MAX - fixed - h01(k, 8) * 30);                 // ramp down: the loading, or the unloading
    v.t1 = P.cruiseS; v.t2 = v.t1 + P.brakeS; v.t3 = v.t2 + P.hoverS; v.t4 = v.t3 + P.descentS;
    v.t5 = v.t4 + RAMP_WAIT_S + 2 * RAMP_S + v.dwell + BUTTON_UP_S; v.t6 = v.t5 + P.liftS; v.t7 = v.t6 + P.departS;
    v.end = v.t7;
    v.workA = v.start + v.t4 + RAMP_WAIT_S + RAMP_S; v.workB = v.start + v.t5 - BUTTON_UP_S - RAMP_S;        // world times the ramp is fully down between
    return v;
  }
  /** Where visit `v` is `t` seconds after it started, written into `o`. Outpost-local metres; `alt` is the feet above the pad's plane. */
  function poseAt(v, t, o = {}) {
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
      yaw = v.da + ((v.diverted ? v.dd : (S.yaw || 0)) - v.da) * sm((t - v.t2) / P.hoverS);        // the hover: she turns onto the stand's line in it
    } else if (v.diverted || t >= v.t6) {
      const tau = t - (v.diverted ? v.t3 : v.t6), u = tau - 2;
      d = tau < 2 ? P.af * tau * tau * tau / 12 : P.af * (2 / 3 + u + 0.5 * u * u);
      dir = v.dd; sign = -1; phase = 6; yaw = v.dd;
      alt = (v.diverted ? P.Hh : P.HC + P.liftV * tau) + 0.2 * d;
      pitch = 9 * DEG * sm(tau / 10); gear = 1 - sm((tau - 6) / 9);
      lift = 1 - 0.5 * sm((tau - 10) / 12); main = sm(tau / 3);
    } else if (t < v.t4) {
      phase = 3; alt = P.Hh * (1 - sm5((t - v.t3) / P.descentS)); lift = 0.7; yaw = S.yaw || 0;
    } else if (t < v.t5) {
      phase = 4; ground = t - v.t4; yaw = S.yaw || 0;
      const up = sm((t - (v.t5 - 4)) / 4);
      lift = Math.max(1 - ground / 2, up) * 0.75; if (lift < 0) lift = 0;
      ramp = sm((ground - RAMP_WAIT_S) / RAMP_S) * (1 - sm((t - (v.t5 - BUTTON_UP_S - RAMP_S)) / RAMP_S));
      hang = Math.exp(-1.6 * ground) * Math.cos(3.2 * ground) + sm((t - (v.t5 - 2)) / 2);
    } else {
      const tau = t - v.t5; phase = 5; alt = 0.5 * P.av * tau * tau; lift = 1;
      yaw = (S.yaw || 0) + (v.dd - (S.yaw || 0)) * sm((tau - 4) / (P.liftS - 4));
    }
    o.x = S.x + sign * Math.sin(dir) * d; o.z = S.z + sign * Math.cos(dir) * d; o.alt = alt + (S.y || 0);
    o.yaw = yaw; o.pitch = pitch; o.gear = gear; o.hang = hang; o.ramp = ramp; o.lift = lift; o.main = main; o.phase = phase; o.ground = ground;
    const end = v.diverted ? v.t3 + P.departS : v.end;
    o.fade = sm(t / 8) * sm((end - t) / 8);
    return o;
  }
  const RECOVER_S = Math.max(60, n * SLOT - MAX - JITTER_S - 10), _v = {};
  /** Side i's stock at world time `now`, 0..1. mode 'take': full, emptied by the ship's stay, rebuilt after. 'bring': the reverse.
   *  `skipK`: a visit that was waved off (it moved nothing). `low`: what a 'bring' stock falls back to between ships. */
  function stockAt(i, now, mode = 'take', skipK = NaN, low = 0.15) {
    let k = Math.floor(now / SLOT); k -= sideOf(k - i - T0);
    let v = visitAt(k, _v);
    const rest = mode === 'take' ? 1 : low;
    if (now < v.workA || k === skipK) { k -= n; v = visitAt(k, _v); if (k === skipK) return rest; }
    if (now < v.workB) { const u = (now - v.workA) / (v.workB - v.workA); return mode === 'take' ? 1 - u : low + (1 - low) * u; }
    const u = clamp01((now - v.workB) / RECOVER_S);
    return mode === 'take' ? u : 1 - (1 - low) * u;
  }
  return { SLOT, n, T0, FLY, sideOf, visitAt, poseAt, stockAt };
}

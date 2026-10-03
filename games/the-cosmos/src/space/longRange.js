// ============================================================================
// longRange.js - the long-range drive (package F3): how a ship crosses the real Solar System.
// Pure data and arithmetic: no three.js, no DOM, so the authority (server), the browser and the validator share one answer.
//
// WHAT IT IS
//   The main drive (transit.js) tops out at 30 km/s and flies a flip-and-burn in sub-steps: perfect for Mars's own space, hopeless for
//   Earth (0.4 to 2.7 AU away), Ceres or Callisto (4 to 6 AU). The long-range drive is a second gear for those distances: a constant
//   acceleration and a flip at the half-way point, like the main drive, but its path is a CLOSED FORM, so a trip of weeks costs one
//   multiplication a tick however fast time runs. It is slow on purpose: Earth is days at the drive's own pace, Callisto weeks; the player
//   shortens that with time compression (LONG.warps), never with a different drive.
//
// THE MODEL (so a moving target is no harder than a fixed one)
//   A trip is a straight line from the departure point A to wherever the destination is. With progress s(tau) in 0..1 from the
//   flip-and-burn profile and B(t) the destination's drop-out point at world time t:
//         position(t, tau) = A + (B(t) - A) * s(tau)
//   The ship is at rest at A, at rest relative to B at the end, and exactly ON the moving B whenever it arrives: whatever the orbits do (F2
//   makes them move; src/worlds/_kit/ephemeris.js gives B(t)) the course closes. The duration T is solved so the profile length is the
//   distance to where B WILL be (a fixed-point iteration, three or four rounds: the target moves a few hundred km/s at most against a trip of
//   weeks, so it converges at once).
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * The drive's acceleration is fiction (Game 1 is semi sci-fi); the distances, the sizes and the moving targets are real.
//   * Time compression advances the SHIP's trip clock; the shared world's clock (the planets' sky) runs in real time. The target is read at
//     the world clock, so on arrival it is exactly where the sky says it is: the trip is "shorter than the planet's motion", never ahead of it.
//   * The planets' pull is ignored in the cruise (the computer holds the line), as the main drive does. Free flight (freeflight.js) is the way
//     to fly a hyperbola; the long-range drive does not do orbital mechanics.
//   * One straight line: it does not steer round the Sun or a planet (a planet is a point at these distances; the Sun's own sphere is 7e8 m).
// ============================================================================

import { worldCentre, worldDef } from '../worlds/registry.js';

export const AU_M = 1.495978707e11;

export const LONG = {
  /** The drive's own acceleration, m/s2, at the Meridian's stock engines (the course drive's 13 m/s2 times this fraction). Slow on purpose:
   *  0.5 m/s2 is 5% of a g. A heavier ship or a hurt engine is slower in proportion (the course drive's own rule). */
  accelFrac: 0.04,
  /** Top speed of the cruise, m/s. The ship coasts here on a long enough trip. (400 km/s is a thousandth of c.) */
  vMaxMs: 400_000,
  /** A trip shorter than this is flown by the main drive (transit.js); longer, by the long-range drive. Metres from the ship. */
  minM: 2.0e9,
  /** A ship farther than this from its home region's centre (Mars's, or a far world's) is "out in deep space": it can only come home by the long drive. */
  homeM: 3.0e8,
  /** The compression ladder in the cruise: game seconds per real second. x5400 is an hour and a half a second: Earth in about four minutes. */
  warps: [1, 10, 60, 600, 1800, 5400],
  /** The cruise never runs faster than the time left allows: at least this many REAL seconds of the trip remain at the compression in force
   *  (so the arrival is seen coming and the compression steps down in the last minutes). */
  arriveRealS: 6,
  /** Real seconds the hull takes to swing end for end at the half-way flip (the course drive's own turn rate, 0.12 rad/s: 26 s). */
  flipRealS: 26,
  /** Where a trip ends, metres short of the destination's centre, for a world with no mouth of its own: this many radii (never under minDropM). */
  dropRadii: 14, minDropM: 8.0e6,
  /** A hull heavier than this needs the heavy-drive unlock (bible 16, F3: "small ships can go; big ships need the unlocks"). Kilograms. */
  smallShipMassKg: 150_000,
};

/** The compression ladder a trip may use right now: the long drive's while it has the ship, the course drive's (x1 x5 x20 x60) otherwise. */
export const tripWarps = (trip) => (trip && trip.phase === 'longdrive' ? LONG.warps : COURSE_WARPS);
const COURSE_WARPS = [1, 5, 20, 60];

/** The cruise acceleration for a ship whose course drive makes `aMainMs2` (the same figure the nav computer already uses). */
export const cruiseAccel = (aMainMs2) => Math.max(0.02, aMainMs2 * LONG.accelFrac);

/**
 * The profile of one cruise of length L metres at acceleration a (m/s2), with a speed cap: accelerate to the half-way point (or to the cap, then
 * coast), flip, decelerate to rest. Returns { L, a, vMax, vPeak, tAcc, tCoast, T } (seconds of ship time).
 */
export function cruiseProfile(L, a, vMax = LONG.vMaxMs) {
  L = Math.max(0, L); a = Math.max(1e-9, a);
  const dCap = vMax * vMax / a;                  // distance to speed up to the cap and slow down again from it
  if (L <= dCap) { const tAcc = Math.sqrt(L / a); return { L, a, vMax, vPeak: a * tAcc, tAcc, tCoast: 0, T: 2 * tAcc }; }
  const tAcc = vMax / a, tCoast = (L - dCap) / vMax;
  return { L, a, vMax, vPeak: vMax, tAcc, tCoast, T: 2 * tAcc + tCoast };
}

/**
 * Where the ship is `tau` seconds into a profile: { x (metres along the line), v (m/s), s (0..1), phase, left (s) }.
 * phase: 'accelerate' | 'coast' | 'decelerate' | 'arrived'.
 */
export function cruiseAt(p, tau) {
  const t = Math.max(0, Math.min(p.T, tau));
  let x, v, phase;
  if (t >= p.T) { x = p.L; v = 0; phase = 'arrived'; }
  else if (t < p.tAcc) { x = 0.5 * p.a * t * t; v = p.a * t; phase = 'accelerate'; }
  else if (t < p.tAcc + p.tCoast) { x = 0.5 * p.a * p.tAcc * p.tAcc + p.vPeak * (t - p.tAcc); v = p.vPeak; phase = 'coast'; }
  else { const r = p.T - t; x = p.L - 0.5 * p.a * r * r; v = p.a * r; phase = 'decelerate'; }
  return { x, v, s: p.L > 0 ? x / p.L : 1, phase, left: p.T - t, tau: t };
}

/** The compression allowed `leftS` ship seconds from the end of the cruise, for a ladder: the highest rung that still leaves arriveRealS real seconds. */
export function warpCap(leftS, requested = 1, ladder = LONG.warps) {
  let best = 1;
  for (const w of ladder) if (w <= requested && leftS / w >= LONG.arriveRealS) best = w;
  return best;
}

/**
 * Real seconds the trip takes if the player runs the compression `warp` throughout (held down near the end as warpCap does), by integrating the
 * cap's steps: the number the nav computer quotes. Exact for a ladder rung, because the cap steps are on the same ladder.
 */
export function realSeconds(T, warp = LONG.warps[LONG.warps.length - 1], ladder = LONG.warps) {
  // rung w is allowed while the ship has at least arriveRealS * w seconds to go, so each rung runs from there down to the next lower rung's mark
  const rungs = ladder.filter((w) => w <= warp).sort((x, y) => y - x);
  let left = T, real = 0;
  for (let i = 0; i < rungs.length && left > 1e-9; i++) {
    const w = rungs[i];
    if (left < LONG.arriveRealS * w && i < rungs.length - 1) continue;       // not allowed this early: the next rung down is the cap
    const floor = i < rungs.length - 1 ? LONG.arriveRealS * w : 0;
    const span = Math.max(0, left - floor);
    real += span / w; left -= span;
  }
  return real;
}

// ---------------------------------------------------------------------------
// WHERE: targets that move, and the drop-out point
// ---------------------------------------------------------------------------
/** The drop-out distance from a world's centre: dropRadii radii, never under minDropM. */
export function dropDistanceM(id) {
  const d = worldDef(id), r = d.radiusMean || (d.axes ? (d.axes.a + d.axes.b + d.axes.c) / 3 : d.radiusM) || 0;
  return Math.max(LONG.minDropM, LONG.dropRadii * r);
}

/**
 * Where a cruise to world `id` ends, in the game's axes (Mars's frame), at world time t. `from` is where the ship is (the drop-out is on the
 * side of the world facing it, so a ship never ends a trip behind a planet). A world with a mouth of its own passes `mouthOffset`: the point is
 * then the centre plus that offset, and `from` is not used.
 */
export function targetAt(id, t, from = null, mouthOffset = null) {       // axes: whatever `from` and worldCentre share (Mars's turning axes)
  const c = worldCentre(id, t);
  if (mouthOffset) return { x: c.x + mouthOffset.x, y: c.y + mouthOffset.y, z: c.z + mouthOffset.z };
  const k = dropDistanceM(id);
  let dx = (from ? from.x : 0) - c.x, dy = (from ? from.y : 0) - c.y, dz = (from ? from.z : 0) - c.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l; dy /= l; dz /= l;
  return { x: c.x + dx * k, y: c.y + dy * k, z: c.z + dz * k };
}

/**
 * Plan a cruise from `A` to a moving target. `goalAt(t)` returns the drop-out point at world time t0 + tauSeconds; the duration is solved so that the
 * profile's length is the distance to where the target WILL be at arrival. Returns { A, t0, profile, goal (at arrival), iterations }.
 */
export function planCruise(A, goalAt, t0, aMs2, vMax = LONG.vMaxMs) {
  let T = 0, G = goalAt(t0), prof = null, it = 0;
  for (; it < 12; it++) {
    prof = cruiseProfile(Math.hypot(G.x - A.x, G.y - A.y, G.z - A.z), aMs2, vMax);
    if (Math.abs(prof.T - T) < 0.5) break;
    T = prof.T; G = goalAt(t0 + T);
  }
  return { A: { ...A }, t0, profile: prof, goal: G, iterations: it + 1 };
}

/** The ship's position in the game's axes for a cruise `plan` at ship-time tau, the target read at world time tNow. */
export function cruisePosition(plan, tau, goalNow) {
  const st = cruiseAt(plan.profile, tau), A = plan.A, B = goalNow || plan.goal;
  return { x: A.x + (B.x - A.x) * st.s, y: A.y + (B.y - A.y) * st.s, z: A.z + (B.z - A.z) * st.s, state: st };
}

/** Distance and the line's unit direction from A to the plan's goal (the hull's nose in the first half; the reverse in the second). */
export function cruiseHeading(plan, goalNow) {
  const B = goalNow || plan.goal, d = { x: B.x - plan.A.x, y: B.y - plan.A.y, z: B.z - plan.A.z }, l = Math.hypot(d.x, d.y, d.z) || 1;
  return { x: d.x / l, y: d.y / l, z: d.z / l };
}

// ---------------------------------------------------------------------------
// WHO MAY GO: hull size
// ---------------------------------------------------------------------------
/** { ok, msg } for a ship def (and the unlock flag a later package F4/F7 sets on the record). Small ships go; big ones need the unlock. */
export function longDriveAllowed(def, unlocked = false) {
  if (def && def.longRange === false && !unlocked) return { ok: false, msg: 'This hull has no long-range drive. The heavy drive is an unlock: a shipyard has to build it.' };
  const m = def && def.phys && def.phys.massKg;
  if (!unlocked && m && m > LONG.smallShipMassKg && !(def && def.longRange === true)) return { ok: false, msg: `A ${Math.round(m / 1000)} tonne hull is too heavy for the long-range drive: small ships only until the heavy drive is unlocked.` };
  return { ok: true, msg: '' };
}

// ---------------------------------------------------------------------------
// Formatting: days and hours, the nav computer's way
// ---------------------------------------------------------------------------
export function fmtLong(s) {
  if (s >= 2 * 86400) return `${(s / 86400).toFixed(1)} days`;
  if (s >= 5400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  if (s >= 120) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}
export const fmtAU = (m) => (m >= 0.01 * AU_M ? `${(m / AU_M).toFixed(2)} AU` : `${(m / 1000).toFixed(0)} km`);

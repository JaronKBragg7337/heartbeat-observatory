// ============================================================================
// space/frames.js - where the worlds are and which way they face, in the axes the game uses, at a game time. Pure: no three.js, no DOM.
//
// OWNS: the two sets of axes and the maths between them, the kinematics of every world (centre, velocity, how its own frame is turned),
//   the Sun's direction, local solar time at a place on the surface, and the "where is a moving goal" functions a course chases.
// DOES NOT OWN: the orbits themselves (worlds/_kit/ephemeris.js), the clock (space/clock.js), the engine's frames (core/engine.js),
//   the flight (freeflight.js, spaceTrip.js, transit.js).
//
// THE TWO SETS OF AXES (both Mars-centred, +Y = Mars's north pole)
//   FIXED     Mars's body-fixed axes: they turn with the planet. The whole ground game, the port, the root frame and every ship's
//             `flight.pos` live here (it is what "the Mars frame" has always meant). It spins at OMEGA (one turn per 88,642.66 s).
//   INERTIAL  the same axes frozen at J2000 (the game's axes of record): the Sun, the stars and the planets' orbits are fixed in them,
//             and so are the courses the drive flies and the free-flight physics's own sense of "not accelerating".
//   Rotation about +Y by a: +Z -> +X, +X -> -Z (right-handed). A point fixed to Mars is in INERTIAL axes at rotY(p, spin(t)).
// A MOON'S OWN FRAME (the frame its ground, its players and its ships live in) is Mars's FIXED axes translated to the moon's centre and
//   turned about +Y by `yaw`: a tidally locked moon keeps one face to Mars, so its yaw follows its longitude round Mars (Mars's own turn
//   included). A frame carries `vel` and `yawRate` (in FIXED axes) so a ship, a bolt or a player can be re-expressed with its velocity.
// ============================================================================

import { worldDef } from '../worlds/registry.js';
import { centreAt, centreFixedAt, rootSpin, OMEGA, DEG } from '../worlds/_kit/ephemeris.js';

export { OMEGA, rootSpin };
const TAU = 2 * Math.PI;
export const wrapPi = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };

/** Rotate `v` about +Y by `a` radians (new object, or into `out`). */
export function rotY(v, a, out = {}) {
  const c = Math.cos(a), s = Math.sin(a), x = v.x, z = v.z;
  out.x = x * c + z * s; out.y = v.y; out.z = -x * s + z * c;
  return out;
}
/** A point (or a direction) fixed to Mars, in INERTIAL axes, and back. */
export const toInertial = (p, T, out = {}) => rotY(p, rootSpin(T), out);
export const toFixed = (p, T, out = {}) => rotY(p, -rootSpin(T), out);
/** The velocity in INERTIAL axes of a point at FIXED position `p` moving at `v` (FIXED axes, relative to Mars's turning frame). */
export function velToInertial(p, v, T, out = {}) { return rotY({ x: v.x + OMEGA * p.z, y: v.y, z: v.z - OMEGA * p.x }, rootSpin(T), out); }
/** ...and the velocity in FIXED axes of a point at INERTIAL position `pI` with inertial velocity `vI`. */
export function velToFixed(pI, vI, T, out = {}) {
  const phi = rootSpin(T), p = rotY(pI, -phi), v = rotY(vI, -phi);
  out.x = v.x - OMEGA * p.z; out.y = v.y; out.z = v.z + OMEGA * p.x;
  return out;
}
/** The velocity (FIXED axes) a point at FIXED `p` has because Mars turns: what a ship hovering there is doing in space. */
export const spinVelocity = (p, out = {}) => { out.x = OMEGA * p.z; out.y = 0; out.z = -OMEGA * p.x; return out; };

/** S-longitude (degrees east) of a position, as spaceSpec.equatorial makes one. */
const lonOf = (c) => Math.atan2(-c.z, c.x);

/** The longitude a world's own axes were drawn at: where its +X axis was made to point away from Mars (moonField.js LON_S). A parked world states it; any other uses where it is at the epoch. */
export function refLonS(d) {
  if (d.orbit && d.orbit.parked) return d.lonS;
  return lonOf(fixedCentre(d, 0)) / DEG;
}

/** A world's centre in FIXED axes at game time T. */
export const fixedCentre = (d, T) => centreFixedAt(d, worldDef, T);

const H = 0.5;
/** The yaw (radians, FIXED axes, about +Y) of a world's own frame at time T, given its centre. Zero for a world that does not turn. */
function yawOf(d, T, c) {
  const R = d.rotation;
  if (!R) return 0;
  if (R.lockedTo === 'parent' && d.orbit && d.orbit.parent === 'mars') return wrapPi(lonOf(c) - refLonS(d) * DEG);
  if (R.lockedTo === 'parent' && d.orbit) {                                 // a moon of another world: faces it, seen along the line from the moon to the parent
    const p = fixedCentre(worldDef(d.orbit.parent), T);
    return wrapPi(lonOf({ x: c.x - p.x, y: 0, z: c.z - p.z }) - 0);
  }
  if (R.periodS) return wrapPi((R.prime0Deg || 0) * DEG + TAU * T / R.periodS - rootSpin(T));
  return 0;
}

/**
 * Everything about a world's motion at game time T.
 *   c, v        centre and its velocity, FIXED axes (v is the rate of change of c in Mars's turning axes, which is what a ship
 *               in the Mars frame must match to ride along with it)
 *   yaw, yawRate  how the world's own frame is turned from FIXED axes, radians and radians/s
 *   ci, vi, yawI, yawRateI  the same in INERTIAL axes
 */
export function worldKin(id, T) {
  const d = typeof id === 'string' ? worldDef(id) : id;
  const c = fixedCentre(d, T), cp = fixedCentre(d, T + H), cm = fixedCentre(d, T - H);
  const v = { x: (cp.x - cm.x) / (2 * H), y: (cp.y - cm.y) / (2 * H), z: (cp.z - cm.z) / (2 * H) };
  const yaw = yawOf(d, T, c), yawRate = wrapPi(yawOf(d, T + H, cp) - yawOf(d, T - H, cm)) / (2 * H);
  const phi = rootSpin(T);
  return { c, v, yaw, yawRate, ci: rotY(c, phi), vi: velToInertial(c, v, T), yawI: yaw + phi, yawRateI: yawRate + OMEGA };
}

/** Just the centre and velocity (FIXED axes): the gravity loop's question. */
export function worldCentreFixed(id, T) { return fixedCentre(typeof id === 'string' ? worldDef(id) : id, T); }

// ---- the Sun ------------------------------------------------------------------------------------------------------------------
let _sunI = null, _sunT = -1e18;
/** Unit vector from Mars to the Sun, INERTIAL axes. The Sun moves a degree in two Martian days: recomputed at most once a minute. */
export function sunDirInertial(T) {
  if (Math.abs(T - _sunT) < 60 && _sunI) return _sunI;
  const c = centreAt(worldDef('sun'), worldDef, T), l = Math.hypot(c.x, c.y, c.z) || 1;
  _sunI = { x: c.x / l, y: c.y / l, z: c.z / l }; _sunT = T;
  return _sunI;
}
/** Unit vector toward the Sun in FIXED axes (what the ground sees), at game time T. */
export const sunDirFixed = (T, out = {}) => rotY(sunDirInertial(T), -rootSpin(T), out);
/** Mars's distance from the Sun, metres (the sky does not use it yet; the game's light is one fixed strength). */
export const sunDistance = (T) => { const c = centreAt(worldDef('sun'), worldDef, T); return Math.hypot(c.x, c.y, c.z); };

/** The unit "up" at a latitude/longitude (degrees) on a body whose axes are the game's (+Y north, -Z east): FIXED axes of Mars, or any frame's. */
export function upAt(latDeg, lonDeg, out = {}) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  out.x = Math.cos(la) * Math.cos(lo); out.y = Math.sin(la); out.z = -Math.cos(la) * Math.sin(lo);
  return out;
}
/** Sun's elevation (degrees above the horizon) at a point on Mars, and Mars's local solar time there (hours 0..24 of 24 per sol: noon is 12). */
export function sunAt(latDeg, lonDeg, T) {
  const s = sunDirFixed(T), up = upAt(latDeg, lonDeg);
  const sinE = s.x * up.x + s.y * up.y + s.z * up.z;
  const sunLon = Math.atan2(-s.z, s.x) / DEG;
  let h = 12 + wrapPi((lonDeg - sunLon) * DEG) / DEG / 15;
  h = ((h % 24) + 24) % 24;
  return { elevDeg: Math.asin(Math.max(-1, Math.min(1, sinE))) / DEG, hours: h, sunLonDeg: sunLon };
}
/** One Martian solar day, seconds (24 h 39 m 35 s): how long Mars takes to bring the Sun round again. Measured from the elements, not assumed. */
export const SOL_S = 88775.244;

/**
 * For a QA link (?sky=): the seconds to add to the clock so that, at this place, the sky is at a named time. Scans one sol from `T0`
 * in five-minute steps and takes the first moment that fits. Names: noon, dusk (sun going down through -1 degree), dawn (coming up
 * through -1), sunset (down through +0.5), sunrise (up through +0.5), night (the lowest sun), midnight (same), morning, afternoon.
 */
export function skyShiftFor(name, latDeg, lonDeg, T0) {
  const step = 300, N = Math.ceil(SOL_S / step) + 2;
  const e = (t) => sunAt(latDeg, lonDeg, t).elevDeg;
  let best = null;
  const want = String(name || '').toLowerCase();
  let prev = e(T0);
  for (let k = 1; k <= N; k++) {
    const t = T0 + k * step, cur = e(t);
    const down = (lvl) => prev > lvl && cur <= lvl, up = (lvl) => prev < lvl && cur >= lvl;
    if ((want === 'dusk' && down(-1)) || (want === 'sunset' && down(0.5)) || (want === 'dawn' && up(-1)) || (want === 'sunrise' && up(0.5)) ||
        (want === 'morning' && up(25)) || (want === 'afternoon' && down(25))) { best = t; break; }
    prev = cur;
  }
  if (best === null && (want === 'noon' || want === 'night' || want === 'midnight')) {
    let bt = T0, be = e(T0);
    for (let k = 1; k <= N; k++) { const t = T0 + k * step, c = e(t); if (want === 'noon' ? c > be : c < be) { be = c; bt = t; } }
    best = bt;
  }
  return best === null ? 0 : best - T0;
}

// ---- a goal that moves ---------------------------------------------------------------------------------------------------------
/**
 * A fixed-axes point that may move (a moon's standoff point, the gate over the port) as a course goal in INERTIAL axes:
 * `fixedAt(T)` gives the point in FIXED axes at game time T; the answer for trip time `t` (seconds after `T0`) is its position, velocity
 * and acceleration in INERTIAL axes (by central differences over a second, which is plenty for orbits that take hours).
 */
export function inertialGoal(fixedAt, T0) {
  const posI = (T) => toInertial(fixedAt(T), T);
  return (t) => {
    const T = T0 + t, a = posI(T - 1), b = posI(T), c = posI(T + 1);
    return { pos: b, vel: { x: (c.x - a.x) / 2, y: (c.y - a.y) / 2, z: (c.z - a.z) / 2 }, acc: { x: c.x - 2 * b.x + a.x, y: c.y - 2 * b.y + a.y, z: c.z - 2 * b.z + a.z } };
  };
}
/** The point `local` (in a world's own axes) carried by that world: its position in FIXED axes at time T. */
export function worldPointFixed(id, local, T) {
  const k = worldKin(id, T), r = rotY(local, k.yaw);
  return { x: k.c.x + r.x, y: k.c.y + r.y, z: k.c.z + r.z };
}

// ---- carrying things between frames ----------------------------------------------------------------------------------------------
import { makeFrame, setFrameState, framePoint, frameDir, frameVel, frameTurn } from '../core/frameMath.js';
export { makeFrame, setFrameState, framePoint, frameDir, frameVel, frameTurn };

/** A frame object for world `id` ('mars' is the root: no motion) as it is at game time T. A new object: fine for a one-off transfer; the engine keeps live ones. */
export function frameAt(id, T) {
  const f = makeFrame(id);
  if (id !== 'mars') setFrameState(f, worldKin(id, T));
  return f;
}
/** Carry a ship's flight state (position, velocity, a held attitude) from frame `from` to frame `to`. Nothing is translated twice; velocity keeps the frames' own motion. */
export function carryFlight(f, from, to) {
  frameVel(from, to, f.pos, f.vel, f.vel);
  framePoint(from, to, f.pos, f.pos);
  if (f.attitude) { const d = frameTurn(from, to), Q = f.attitude.constructor; f.attitude.premultiply(new Q(0, Math.sin(d / 2), 0, Math.cos(d / 2))); }
}

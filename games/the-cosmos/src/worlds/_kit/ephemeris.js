// ============================================================================
// worlds/_kit/ephemeris.js - where every world is, and how it turns: Kepler orbits and rotation, as data and pure functions.
//
// OWNS: the orbit and rotation model a world def describes (`orbit`, `rotation`), the Sun as the root of the tree, the game's
//   root axes (Mars's own), and the maths from elements to a position. Pure: no three.js, no DOM, no clock. The server uses it.
// DOES NOT OWN: the clock (there is none yet: package F2), the numbers of any world (src/worlds/<name>/def.js), the real planets'
//   elements (_kit/solar.js), how a frame follows a moving world (F2), the jump drive (F3).
//
// THE SWITCH. `DYNAMICS.orbits` and `DYNAMICS.rotation` are both FALSE: every world sits where it is at the game's start date
// (START_JD, today's sky) and nothing turns. Positions are still computed from real elements, so Earth really is where Earth is
// from Mars. A later package flips the switches and gives the world a clock; nothing in a def changes when it does.
//
// AXES. Everything is expressed in the GAME's axes: the frame the whole game already uses, Mars's body-fixed frame, +Y = Mars's
// north pole, +X = the prime meridian (Airy-0) as it points at J2000, -Z = east. Heliocentric (ecliptic J2000) elements are rotated
// into those axes by the IAU pole and prime-meridian constants below. A world that orbits Mars may give its elements directly in Mars's
// equatorial axes (`frame: 'equator'`, the default for `parent: 'mars'`), which is how Phobos and Deimos are written.
//
// ORBIT (a world's `orbit`):
//   { parent: 'sun' | 'mars' | <world id>,        what it goes round (its mass sets the period if periodS is absent)
//     a: metres, e, i: degrees, node: degrees (longitude of the ascending node),
//     peri: degrees (argument of periapsis)  OR  lonPeri: degrees (longitude of periapsis = node + peri),
//     M0: degrees (mean anomaly at the GAME'S START)  OR  meanLon: degrees (mean longitude at J2000 = lonPeri + M0; give `rates.meanLon` too),
//     periodS?: seconds, rates?: { a (m per century), e, i, node, lonPeri, meanLon (degrees per century) },
//     frame?: 'ecliptic' | 'equator' }
// ROTATION (a world's `rotation`):
//   { periodS: sidereal day in seconds (negative = retrograde), axialTiltDeg, lockedTo?: 'parent' (the same face to what it orbits),
//     prime0Deg?: prime-meridian angle at the epoch }
// ============================================================================

export const DEG = Math.PI / 180;
export const AU = 1.495978707e11;
export const MU_SUN = 1.32712440018e20;
export const G = 6.6743e-11;

/** The switches. A later package (F2: time and sky) sets these and supplies the clock; until then the sky is the sky of START_JD. */
export const DYNAMICS = { orbits: false, rotation: false };

/** The epoch the elements are given for (J2000.0) and the game's start date (2026-10-03 00:00 UT), as Julian dates. */
export const J2000_JD = 2451545.0;
export const START_JD = 2461316.5;
export const jdAt = (tSec = 0) => START_JD + (DYNAMICS.orbits ? tSec : 0) / 86400;
export const centuriesAt = (tSec = 0) => (jdAt(tSec) - J2000_JD) / 36525;

/**
 * The root world's pole and prime meridian at J2000 (IAU 2009 report: alpha0 317.68143, delta0 52.88650, W0 176.630). Recorded from the
 * published table, not measured here: re-confirm by hand like the NSSDC values (docs/PROVENANCE.md). Obliquity of the ecliptic at J2000.
 */
export const ROOT_POLE = { raDeg: 317.68143, decDeg: 52.88650, prime0Deg: 176.630, rotationDegPerDay: 350.89198226 };
export const OBLIQUITY_DEG = 23.4392911;

// ---- the rotation from ICRF equatorial vectors to the game's axes (computed once) ----------------------------------------
const GAME = (() => {
  const a = ROOT_POLE.raDeg * DEG, d = ROOT_POLE.decDeg * DEG, W = ROOT_POLE.prime0Deg * DEG;
  const p = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];             // the pole: game +Y
  const q = [-Math.sin(a), Math.cos(a), 0];                                                  // the ascending node of the equator on the ICRF equator
  const pq = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const x = [q[0] * Math.cos(W) + pq[0] * Math.sin(W), q[1] * Math.cos(W) + pq[1] * Math.sin(W), q[2] * Math.cos(W) + pq[2] * Math.sin(W)];   // prime meridian: game +X
  const z = [x[1] * p[2] - x[2] * p[1], x[2] * p[0] - x[0] * p[2], x[0] * p[1] - x[1] * p[0]];                                                 // x cross y = -east: game +Z
  return { x, y: p, z };
})();
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** An ecliptic-J2000 vector (any units) in the game's axes. */
export function eclipticToGame(v) {
  const c = Math.cos(OBLIQUITY_DEG * DEG), s = Math.sin(OBLIQUITY_DEG * DEG);
  const icrf = [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  return { x: dot3(icrf, GAME.x), y: dot3(icrf, GAME.y), z: dot3(icrf, GAME.z) };
}

// ---- Kepler -------------------------------------------------------------------------------------------------------------------
const wrap = (x) => { x %= 2 * Math.PI; return x > Math.PI ? x - 2 * Math.PI : x < -Math.PI ? x + 2 * Math.PI : x; };
/** Solve M = E - e sin E for E (radians). Newton from a good start; converges in a handful of steps for e < 0.99. */
export function solveKepler(M, e) {
  M = wrap(M);
  if (e === 0) return M;
  let E = e < 0.8 ? M + e * Math.sin(M) : Math.PI * Math.sign(M || 1);
  for (let k = 0; k < 40; k++) { const f = E - e * Math.sin(E) - M, d = f / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; }
  return E;
}

/** The elements of an orbit at `T` centuries from J2000 (rates applied): { a (m), e, i, node, peri, meanAnomaly } in radians. */
function elementsAt(o, T, tSec) {
  const r = o.rates || {};
  const nodeD = (o.node || 0) + (r.node || 0) * T;
  const lonPeriD = o.lonPeri !== undefined ? o.lonPeri + (r.lonPeri || 0) * T : undefined;
  const periD = lonPeriD !== undefined ? lonPeriD - nodeD : (o.peri || 0);
  let M;
  if (o.meanLon !== undefined) M = (o.meanLon + (r.meanLon || 0) * T - (lonPeriD ?? nodeD + periD)) * DEG;     // a table with a mean-longitude rate: exact
  else M = (o.M0 || 0) * DEG;                                                                                   // else M0 is the anomaly at the game's start, advanced by the mean motion below
  return { a: o.a + (r.a || 0) * T, e: o.e + (r.e || 0) * T, i: (o.i || 0) * DEG + (r.i || 0) * T * DEG, node: nodeD * DEG, peri: periD * DEG, M, advance: o.meanLon === undefined && DYNAMICS.orbits ? tSec : 0 };
}

/** Orbital period (s): the def's `periodS`, else Kepler's third law from the parent's mass (its GM, m3/s2). */
export const periodOf = (o, muParent) => o.periodS || 2 * Math.PI * Math.sqrt(o.a ** 3 / muParent);

/**
 * Position of a body relative to its parent, in the PARENT-FRAME axes the elements are given in (X, Y in the reference plane,
 * Z = its pole). `tSec` is game seconds (ignored while DYNAMICS.orbits is false).
 */
export function orbitPosition(o, muParent, tSec = 0) {
  const el = elementsAt(o, centuriesAt(tSec), tSec);
  const M = el.advance ? el.M + (2 * Math.PI / periodOf(o, muParent)) * el.advance : el.M;       // the period is only needed (and the parent's mass only read) when time runs
  const E = solveKepler(M, el.e), cE = Math.cos(E), sE = Math.sin(E);
  const xp = el.a * (cE - el.e), yp = el.a * Math.sqrt(1 - el.e * el.e) * sE;                  // in the orbit plane, periapsis along +x
  const cO = Math.cos(el.node), sO = Math.sin(el.node), cw = Math.cos(el.peri), sw = Math.sin(el.peri), ci = Math.cos(el.i), si = Math.sin(el.i);
  return [
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    (sw * si) * xp + (cw * si) * yp,
  ];
}

/** A tiny registry-free helper: how to read a world's GM (m3/s2). The Sun and the root are known; others come from `massKg`. */
export function muOf(def) {
  if (def.id === 'sun') return MU_SUN;
  if (def.root) return G * def.body.mass;
  return G * def.massKg;
}

/** Position of a world relative to its PARENT, in the game's axes, at game time `tSec`. */
function relToParent(d, lookup, tSec) {
  const o = d.orbit;
  if (!o) throw new Error(`world '${d.id}' has no orbit: it cannot be placed (give it an \`orbit\`, or the legacy orbitRadiusM + lonS)`);
  if (o.offset) return { x: o.offset.x, y: o.offset.y, z: o.offset.z };
  if (o.parked && !DYNAMICS.orbits) {              // the legacy shorthand while nothing moves: a fixed longitude on a circle in the parent's equatorial plane (Phobos, Deimos, test planets), exact to the last bit
    // (with the switch on it is an ordinary circular orbit: M0 = that longitude, advanced by the period)
    const lon = o.M0 * DEG, lat = (o.parkedLatDeg || 0) * DEG, r = o.a;
    return { x: r * Math.cos(lat) * Math.cos(lon), y: r * Math.sin(lat), z: -r * Math.cos(lat) * Math.sin(lon) };
  }
  const parent = lookup(o.parent), rel = orbitPosition(o.parked ? { ...o, i: Math.abs(o.parkedLatDeg || 0) } : o, muOf(parent), tSec);
  const frame = o.frame || (o.parent === 'mars' ? 'equator' : 'ecliptic');
  if (frame === 'equator') return { x: rel[0], y: rel[2], z: -rel[1] };                       // parent equatorial -> game axes: (X, Z, -Y)
  return eclipticToGame(rel);
}

/** The chain from a world up to the Sun: [def, its parent, ..., sun]. */
function chainOf(d, lookup) {
  const out = [d];
  for (let k = 0; k < 8 && out[out.length - 1].id !== 'sun'; k++) { const o = out[out.length - 1].orbit; if (!o) break; out.push(lookup(o.parent)); }
  return out;
}

/**
 * Where a world's centre is, in the game's axes, relative to the ROOT world's centre (Mars), at game time `tSec`.
 * `lookup(id)` returns a def. The offsets are summed up each chain only as far as the two chains meet (a moon of Mars never
 * goes through the Sun, so its position is exact to the last bit: no 2e11 m minus 2e11 m).
 */
export function centreAt(def, lookup, tSec = 0) {
  const A = chainOf(def, lookup), B = chainOf(lookup('mars'), lookup);
  const ids = new Set(B.map((x) => x.id)), meet = A.find((x) => ids.has(x.id));
  if (!meet) throw new Error(`world '${def.id}' is not connected to the Sun (check its orbit.parent chain)`);
  const sumTo = (chain) => { const t = { x: 0, y: 0, z: 0 }; for (const d of chain) { if (d.id === meet.id) break; const r = relToParent(d, lookup, tSec); t.x += r.x; t.y += r.y; t.z += r.z; } return t; };
  const a = sumTo(A), b = sumTo(B);
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** The sidereal rotation angle (radians) of a world at game time `tSec`: its prime meridian's angle from the reference direction. Zero while DYNAMICS.rotation is false. */
export function rotationAngle(def, tSec = 0) {
  const R = def.rotation;
  if (!DYNAMICS.rotation || !R || !R.periodS) return 0;
  return ((R.prime0Deg || 0) * DEG + 2 * Math.PI * tSec / R.periodS) % (2 * Math.PI);
}

/** Epoch placement of a world, in the legacy shorthand's terms: where it sits as seen from the root (distance, S-longitude, latitude). */
export function placementOf(def, lookup, tSec = 0) {
  const c = centreAt(def, lookup, tSec), r = Math.hypot(c.x, c.y, c.z) || 1;
  return { centre: c, distM: r, lonS: Math.atan2(-c.z, c.x) / DEG, latS: Math.asin(Math.max(-1, Math.min(1, c.y / r))) / DEG };
}

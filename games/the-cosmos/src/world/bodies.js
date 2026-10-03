// ============================================================================
// bodies.js — real measured worlds. Every number here has a source.
//
// OWNS: the lookup of the root body's physical parameters (Mars's record moved to src/worlds/mars/def.js, unchanged), and the
//       gravity curve. SI units, at real scale. Nothing is "compressed for gameplay". If a number is invented,
//       it says so in `sourceNote` and carries `measured: false`.
// DOES NOT OWN: terrain shape (field.js), rendering (planetMesh.js), or
//       addressing (geodesy.js).
//
// WHY REAL SCALE, FROM FRAME ONE
// ------------------------------
// A planet's radius is load-bearing for the coordinate system, the horizon
// distance, the gravity curve, the atmosphere profile, the LOD budget, and how
// far "a kilometre" feels. Every one of those is painful to change later and
// free to get right now. Mars is 3,389,500 m here because Mars is 3,389,500 m.
//
// PROVENANCE
// ----------
// Values marked `verified: 'live'` were fetched from a NASA page on 2026-08-16.
// Values marked `verified: 'table'` come from the NSSDC Planetary Fact Sheet,
// which now serves a 307 redirect to automated fetchers — they are recorded
// here as the widely-published table values and must be re-confirmed by a human
// before they are treated as measured evidence. See docs/PROVENANCE.md.
// ============================================================================

import { allWorlds } from '../worlds/registry.js';

export const G = 6.67430e-11;          // CODATA 2018 gravitational constant
export const AU = 1.495978707e11;      // IAU 2012 astronomical unit, metres

// BODIES: the root world's full record (Mars). Every other world is a def in src/worlds/<name>/ (see the registry); a world with a
// frame of its own gets its body record from src/space/moonField.js (makeMoon(id)), built from that def. The Mars record itself now
// lives in src/worlds/mars/def.js, moved there unchanged.
export const BODIES = allWorlds().filter((w) => w.root).map((w) => w.body);

export const getBody = (id) => {
  const b = BODIES.find((x) => x.id === id);
  if (!b) throw new Error(`unknown body: ${id}`);
  return b;
};

// Gravity at a distance r from the body's centre. Inverse-square outside the
// surface; linear taper inside, which is what a uniform-density sphere actually
// does and matters the moment anyone digs.
export function gravityAtRadius(body, r) {
  const R = body.radiusMean;
  const gSurface = body.surfaceGravity;
  if (r <= 0) return 0;
  return r >= R ? gSurface * (R * R) / (r * r) : gSurface * (r / R);
}

// Derived check: does the stated mass agree with the stated surface gravity?
// A body whose numbers disagree with itself is a bug, so this is asserted by
// the test suite rather than trusted.
export function impliedSurfaceGravity(body) {
  return (G * body.mass) / (body.radiusMean * body.radiusMean);
}

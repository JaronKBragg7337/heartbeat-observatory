// ============================================================================
// moonField.js — a moon is a volume, like the planet: density < 0 is rock, > 0 is vacuum.
//
// OWNS: turning a row of MOONS (spaceSpec.js) into a body record field.js understands: a triaxial ellipsoid with real
//       semi-axes, craters at every scale, grooves, a regolith blanket, hydrated-clay pockets (fiction, marked) and a graded
//       landing pad. All deterministic: same seed, same coordinate, same answer, on every device.
// DOES NOT OWN: drawing (moonWorld.js), walking (walker.js, unchanged), digging (digging.js and edits.js, unchanged).
//
// HOW THE SHAPE IS BUILT
//   density(p) = |p| - R(direction)        (negative inside, the same sign rule as Mars)
//   R(direction) = ellipsoid radius along that direction + relief(direction)
// A radial heightfield, as the planet's base field is, so the Newton step the terrain meshes use is exact (one evaluation) and
// everything above the field (edits, ray casts, the walker) is untouched. Digging makes the overhangs.
//
// The body frame: X points at Mars (the long axis, Phobos is tidally locked), Z is Mars's north (+Y here), Y completes the
// right-handed set along the orbit. Frame axes are PARALLEL to the world's (a translated frame, no rotation): only the
// ellipsoid's axes are turned, in here.
// ============================================================================

import { MOONS, moonCentre, moonSurfaceGravity, G_CONST, sunDirection } from './spaceSpec.js';

const DEG = Math.PI / 180;

// ---- deterministic value noise (same family as field.js, self-contained) -----------------------------------------
function hash3(ix, iy, iz, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (ix | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (iy | 0), 0x165667b1);
  h = Math.imul(h ^ (iz | 0), 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;                  // 0..1
}
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function noise3(x, y, z, seed) {                   // -1..1
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, u = smooth(fx), v = smooth(fy), w = smooth(fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d, seed) * 2 - 1;
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u, x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u, x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function fbm(x, y, z, seed, oct) {
  let s = 0, a = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise3(x, y, z, seed + i * 1013) * a; n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; }
  return s / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Crater cell sizes, metres. A crater is at most 0.24 of its cell, so a point only ever needs its own cell. */
const CELLS = [4200, 2100, 1050, 520, 260, 130, 64, 32, 16];

/** Build the body record for a moon id. Cached per id: one record, one field. */
const _bodies = new Map();
export function makeMoon(id) {
  if (_bodies.has(id)) return _bodies.get(id);
  const S = MOONS[id];
  if (!S) throw new Error(`unknown moon: ${id}`);
  const { a, b, c } = S.axes, Rm = S.radiusMean, seed = S.seed, scale = S.craterScale, RS = S.roughScale ?? 1, DENS = S.craterDensity ?? 0.62, CS = S.cellScale ?? 1;
  const centre = moonCentre(S);
  // body axes in world directions
  const lonM = (S.lonS + 180) * DEG;
  const ex = { x: Math.cos(lonM), y: 0, z: -Math.sin(lonM) };
  const ez = { x: 0, y: 1, z: 0 };
  const ey = { x: ez.y * ex.z - ez.z * ex.y, y: ez.z * ex.x - ez.x * ex.z, z: ez.x * ex.y - ez.y * ex.x };

  const dirOf = (latDeg, lonDeg) => { const la = latDeg * DEG, lo = lonDeg * DEG; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
  const feat = S.landmarks.map((l) => ({ ...l, d: dirOf(l.lat, l.lon) }));
  const AGAIN = 1 / (a * a), BGAIN = 1 / (b * b), CGAIN = 1 / (c * c);

  // grooves: planar troughs parallel to the long axis, as the observed ones run. Seeded, so the same every time.
  const grooves = [];
  for (let i = 0; i < 16; i++) {
    const ang = (-25 + 70 * hash3(i, 1, 7, seed)) * DEG;
    grooves.push({ n: [0, Math.cos(ang), Math.sin(ang)], off: (hash3(i, 2, 7, seed) * 2 - 1) * Rm * 0.8,
      w: 55 + 70 * hash3(i, 3, 7, seed), dep: 5 + 11 * hash3(i, 4, 7, seed), phase: i * 17.31 });
  }

  const M = MATS[S.id];
  const pad = S.pad;
  const padDir = dirOf(pad.lat, pad.lon);

  // ---- the relief above the ellipsoid, metres, at a body-frame direction (u,v,w unit) ------------------------------
  function relief(u, v, w, re) {
    const px = u * re, py = v * re, pz = w * re;
    let h = 0;
    // the lumpy potato: low-frequency departures from the ellipsoid
    h += fbm(px * 0.00016, py * 0.00016, pz * 0.00016, seed + 5, 3) * 0.06 * Rm;
    h += fbm(px * 0.0006, py * 0.0006, pz * 0.0006, seed + 9, 3) * 0.016 * Rm;
    // the named craters
    for (const f of feat) {
      const cosang = u * f.d[0] + v * f.d[1] + w * f.d[2];
      if (cosang < 0.5) continue;
      const s = Rm * Math.acos(Math.min(1, cosang));
      const t = s / f.radiusM;
      if (t < 1) { const q = 1 - t * t; h -= f.depthM * Math.pow(q, 1.15) * (t > 0.82 ? 1 : 1); }
      const rimH = f.depthM * 0.12;
      if (t >= 0.8) h += rimH * Math.exp(-(((t - 1.02) / 0.2) ** 2));
      if (t > 1.1 && t < 4) h += f.depthM * 0.035 / (t * t);       // ejecta blanket
    }
    // craters at every scale
    for (let k = 0; k < CELLS.length; k++) {
      const s = CELLS[k] * CS;
      const ix = Math.floor(px / s), iy = Math.floor(py / s), iz = Math.floor(pz / s);
      for (let j = 0; j < 2; j++) {
        const sd = seed + 101 * k + 37 * j;
        if (hash3(ix, iy, iz, sd + 3) > DENS) continue;
        const cx = (ix + 0.3 + 0.4 * hash3(ix, iy, iz, sd)) * s;
        const cy = (iy + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 1)) * s;
        const cz = (iz + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 2)) * s;
        const rc = s * (0.1 + 0.14 * hash3(ix, iy, iz, sd + 4));
        const dx = px - cx, dy = py - cy, dz = pz - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rc * rc * 9) continue;
        const t = Math.sqrt(d2) / rc, D = 2 * rc * scale, dep = 0.16 * D;
        if (t < 1) h -= dep * Math.pow(1 - t * t, 1.2);
        h += 0.04 * D * Math.exp(-(((t - 1.04) / 0.22) ** 2));
        if (t > 1.2) h += 0.012 * D / (t * t * t);
      }
    }
    // grooves
    for (let i = 0; i < grooves.length; i++) {
      const g = grooves[i];
      const dd = Math.abs(py * g.n[1] + pz * g.n[2] - g.off);
      if (dd > g.w * 1.6) continue;
      const along = px * 0.0004 + g.phase;
      const seg = sstep(-0.25, 0.25, noise3(along, g.phase, 3.3, seed + 700));
      if (seg <= 0) continue;
      const t = dd / g.w;
      h -= g.dep * seg * RS * (t < 1 ? (1 - t * t) : 0);
      h += g.dep * 0.25 * seg * RS * Math.exp(-(((t - 1.15) / 0.25) ** 2));
    }
    // regolith roughness: hills you walk over, rocks you step round, grit
    h += fbm(px * 0.012, py * 0.012, pz * 0.012, seed + 21, 3) * 6.0 * RS;
    h += fbm(px * 0.06, py * 0.06, pz * 0.06, seed + 33, 3) * 1.2 * RS;
    h += fbm(px * 0.45, py * 0.45, pz * 0.45, seed + 44, 2) * 0.22 * RS;
    h += noise3(px * 2.4, py * 2.4, pz * 2.4, seed + 55) * 0.05 * RS;
    return h;
  }

  const reOf = (u, v, w) => 1 / Math.sqrt(u * u * AGAIN + v * v * BGAIN + w * w * CGAIN);
  // world direction (unit, world-aligned) -> body-frame unit vector. Declared here: the sun used by crater shadows is converted once, at build.
  const toBodyDir = (dx, dy, dz) => [dx * ex.x + dz * ex.z, dx * ey.x + dz * ey.z, dy];
  const fromBody = (u, v, w, out = {}) => { out.x = u * ex.x + v * ey.x; out.y = w; out.z = u * ex.z + v * ey.z; return out; };

  // Loose rock, in the density field (so a boot and a bucket meet the same stone the mesh draws). One rock per cell, inset so
  // it never crosses into the next cell: the height is zero, with zero slope, on the cell boundary. Phobos only; Deimos stays
  // the smooth one. The steepest ring stays under about 40 degrees, so a running step still meets the surface on 0.0057 g
  // (a steeper face launches the walker and the 90 s grounded check fails).
  const ROCKS = S.id === 'phobos' ? [
    { s: 32, dens: 0.7, rLo: 2.8, rHi: 5.2, hLo: 1.35, hHi: 2.7 },   // boulders: a couple of metres tall, drawn by the near tier
    { s: 12, dens: 0.48, rLo: 1.2, rHi: 2.3, hLo: 0.4, hHi: 1.15 },   // rocks at knee and waist height
    { s: 6, dens: 0.3, rLo: 0.5, rHi: 1.05, hLo: 0.08, hHi: 0.35 },   // stones underfoot
  ] : [];
  function boulderHeight(px, py, pz) {
    let h = 0;
    const r = Math.hypot(px, py, pz) || 1;
    for (let ci = 0; ci < ROCKS.length; ci++) {
      const spec = ROCKS[ci], s = spec.s;
      const ix = Math.floor(px / s), iy = Math.floor(py / s), iz = Math.floor(pz / s);
      const sd = seed + 9100 + ci * 173;
      if (hash3(ix, iy, iz, sd) > spec.dens) continue;
      // The hash point sits in the cell, then slides out to the ellipsoid so the stone is on the ground
      // you walk, not buried in the cube. If that slide leaves the cell, this cell has no stone (no seam).
      let cx = (ix + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 1)) * s;
      let cy = (iy + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 2)) * s;
      let cz = (iz + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 3)) * s;
      const cr = Math.hypot(cx, cy, cz) || 1;
      cx *= r / cr; cy *= r / cr; cz *= r / cr;
      if (Math.floor(cx / s) !== ix || Math.floor(cy / s) !== iy || Math.floor(cz / s) !== iz) continue;
      const margin = Math.min(cx - ix * s, (ix + 1) * s - cx, cy - iy * s, (iy + 1) * s - cy, cz - iz * s, (iz + 1) * s - cz);
      const rc = Math.min(spec.rLo + (spec.rHi - spec.rLo) * hash3(ix, iy, iz, sd + 4), margin * 0.92);
      if (rc < 0.35) continue;
      const dx = px - cx, dy = py - cy, dz = pz - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rc * rc) continue;
      const t = Math.sqrt(d2) / rc;
      const dome = 1 - t * t;
      let hh = spec.hLo + (spec.hHi - spec.hLo) * hash3(ix, iy, iz, sd + 5);
      const slopeCap = 1.15 * rc / 1.54;
      if (hh > slopeCap) hh = slopeCap;
      h += hh * dome * dome;
    }
    return h;
  }

  // Crater-on-crater shadow, as a darkening of the vertex colour. The sun's shadow map only covers the ground under the
  // camera, so a rim does not cast onto the next bowl. This walks the same craters the field uses and darkens the floor
  // on the up-sun side, where that rim blocks the sun. Nested bowls multiply. Grooves take a little dust-shadow too.
  const sunW = sunDirection();
  const sunB = toBodyDir(sunW.x, sunW.y, sunW.z);
  const SHADE_CELLS = CELLS.filter((c) => c >= 64);
  function shadeAt(px, py, pz, u, v, w) {
    const elev = u * sunB[0] + v * sunB[1] + w * sunB[2];
    let sx = sunB[0] - u * elev, sy = sunB[1] - v * elev, sz = sunB[2] - w * elev;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl; sy /= sl; sz /= sl;
    const tanE = elev > 0.08 ? elev / Math.sqrt(Math.max(1e-4, 1 - elev * elev)) : 0;
    let shade = 1;
    const addCrater = (cx, cy, cz, rc, dep) => {
      if (tanE <= 0) return;
      const dx = px - cx, dy = py - cy, dz = pz - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > rc * rc) return;
      const along = dx * sx + dy * sy + dz * sz;          // metres toward the sun from the crater centre
      const fromRim = rc - along;                         // 0 at the up-sun rim, 2 rc at the down-sun rim
      const shadowLen = Math.min(rc * 1.85, dep / tanE);
      if (fromRim < shadowLen) {
        const t = Math.sqrt(d2) / rc;
        const k = (1 - fromRim / shadowLen) * (1 - t * 0.3);
        shade *= 1 - Math.min(0.58, 0.62 * k);
      }
    };
    for (const f of feat) {
      const cre = reOf(f.d[0], f.d[1], f.d[2]);
      addCrater(f.d[0] * cre, f.d[1] * cre, f.d[2] * cre, f.radiusM, f.depthM);
    }
    for (let k = 0; k < SHADE_CELLS.length; k++) {
      const s = SHADE_CELLS[k] * CS;
      const ix = Math.floor(px / s), iy = Math.floor(py / s), iz = Math.floor(pz / s);
      for (let j = 0; j < 2; j++) {
        const sd = seed + 101 * CELLS.indexOf(SHADE_CELLS[k]) + 37 * j;
        if (hash3(ix, iy, iz, sd + 3) > DENS) continue;
        const cx = (ix + 0.3 + 0.4 * hash3(ix, iy, iz, sd)) * s;
        const cy = (iy + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 1)) * s;
        const cz = (iz + 0.3 + 0.4 * hash3(ix, iy, iz, sd + 2)) * s;
        const rc = s * (0.1 + 0.14 * hash3(ix, iy, iz, sd + 4));
        const dx = px - cx, dy = py - cy, dz = pz - cz;
        if (dx * dx + dy * dy + dz * dz > rc * rc * 4) continue;
        addCrater(cx, cy, cz, rc, 0.16 * 2 * rc * scale);
      }
    }
    if (RS > 0.5) {
      for (let i = 0; i < grooves.length; i++) {
        const gg = grooves[i];
        const dd = Math.abs(py * gg.n[1] + pz * gg.n[2] - gg.off);
        if (dd < gg.w) shade *= 1 - 0.16 * (1 - (dd / gg.w) * (dd / gg.w));
      }
    }
    return Math.max(0.42, Math.min(1, shade));
  }

  // the graded pad: a true plane perpendicular to the radial through the pad's centre, blended into the natural ground
  const padRc = (() => { const re = reOf(...padDir); return re + relief(padDir[0], padDir[1], padDir[2], re) - 0.0; })();
  const padPlaneR = padRc;
  function surfaceRadiusBody(u, v, w) {
    const re = reOf(u, v, w);
    let R = re + relief(u, v, w, re);
    const cosp = u * padDir[0] + v * padDir[1] + w * padDir[2];
    let padS = 1e9;
    if (cosp > 0.97) {
      padS = Rm * Math.acos(Math.min(1, cosp));
      if (padS < pad.blendM) {
        const wt = 1 - sstep(pad.flatM, pad.blendM, padS);
        R += (padPlaneR / cosp - R) * wt;
      }
    }
    // rocks sit on the graded ground, and they stay off the landing plane (flat to 5 cm inside the pad)
    R += rockAdded(u, v, w, re);
    return R;
  }
  function rockAdded(u, v, w, re) {
    if (!ROCKS.length) return 0;
    const cosp = u * padDir[0] + v * padDir[1] + w * padDir[2];
    let along = 1e9;
    if (cosp > 0.97) along = Rm * Math.acos(Math.min(1, cosp));
    let fade = 1;
    if (along < 58) fade = 0;
    else if (along < 86) fade = sstep(58, 86, along);
    if (fade <= 0) return 0;
    return fade * boulderHeight(u * re, v * re, w * re);
  }

  const surfaceRadius = (dx, dy, dz) => { const q = toBodyDir(dx, dy, dz); return surfaceRadiusBody(q[0], q[1], q[2]); };

  const baseField = (px, py, pz) => {
    const r = Math.hypot(px, py, pz);
    if (r < 1e-6) return -Rm;
    const q = toBodyDir(px / r, py / r, pz / r);
    return r - surfaceRadiusBody(q[0], q[1], q[2]);
  };

  const materialField = (px, py, pz) => {
    const r = Math.hypot(px, py, pz) || 1;
    const q = toBodyDir(px / r, py / r, pz / r);
    const depth = surfaceRadiusBody(q[0], q[1], q[2]) - r;
    const cosp = q[0] * padDir[0] + q[1] * padDir[1] + q[2] * padDir[2];
    const sp = cosp > 0.97 ? Rm * Math.acos(Math.min(1, cosp)) : 1e9;
    const reg = S.regolithDepthM * (0.55 + 0.45 * (0.5 + 0.5 * noise3(px * 0.004, py * 0.004, pz * 0.004, seed + 77)));
    if (depth < reg) return M.regolith;
    if (depth > 2.2 && feat.length && M.clay) {
      const f = feat[0], cosang = q[0] * f.d[0] + q[1] * f.d[1] + q[2] * f.d[2];
      const t = Rm * Math.acos(Math.min(1, cosang)) / f.radiusM;
      if (t > 1.05 && t < 2.7 && noise3(px * 0.004, py * 0.004, pz * 0.004, seed + 91) > 0.12 && depth < 160) return M.clay;
    }
    return M.rubble;
  };

  // lat / lon of a world-aligned local point, in the MOON's own body frame (longitude from the sub-Mars meridian)
  const bodyLatLon = (px, py, pz) => {
    const r = Math.hypot(px, py, pz) || 1, q = toBodyDir(px / r, py / r, pz / r);
    return { lat: Math.asin(Math.max(-1, Math.min(1, q[2]))) / DEG, lon: Math.atan2(q[1], q[0]) / DEG };
  };

  // The pad: where the Meridian sets down, and the three places a survey takes a sample.
  const surfacePoint = (u, v, w) => { const R = surfaceRadiusBody(u, v, w); return fromBody(u * R, v * R, w * R, {}); };
  const surfaceDirPoint = (dx, dy, dz) => { const R = surfaceRadius(dx, dy, dz); return { x: dx * R, y: dy * R, z: dz * R }; };
  const padPoint = surfacePoint(...padDir);
  const padUp = (() => { const l = Math.hypot(padPoint.x, padPoint.y, padPoint.z); return { x: padPoint.x / l, y: padPoint.y / l, z: padPoint.z / l }; })();
  // east/north at the pad, world-aligned (same convention as geodesy.js: east = -Z at lon 0)
  const padEast = (() => { const l = Math.hypot(padUp.x, padUp.z) || 1; return { x: padUp.z / l, y: 0, z: -padUp.x / l }; })();
  const padNorth = (() => { const u = padUp, e = padEast; return { x: u.y * e.z - u.z * e.y, y: u.z * e.x - u.x * e.z, z: u.x * e.y - u.y * e.x }; })();
  const SITES = [[170, 70], [640, 150], [1100, 20]];
  const sampleSites = SITES.map(([dist, brg], i) => {
    const bb = brg * DEG, k = dist / Rm;
    const dx = padUp.x + (padEast.x * Math.sin(bb) + padNorth.x * Math.cos(bb)) * k, dy = padUp.y + (padEast.y * Math.sin(bb) + padNorth.y * Math.cos(bb)) * k, dz = padUp.z + (padEast.z * Math.sin(bb) + padNorth.z * Math.cos(bb)) * k;
    const l = Math.hypot(dx, dy, dz), p = surfaceDirPoint(dx / l, dy / l, dz / l);
    return { id: `S${i + 1}`, distM: dist, bearingDeg: brg, point: p };
  });

  const derelict = S.derelict ? (() => {
    const bb = S.derelict.bearingDeg * DEG, k = S.derelict.distM / Rm;
    const dx = padUp.x + (padEast.x * Math.sin(bb) + padNorth.x * Math.cos(bb)) * k, dy = padUp.y + (padEast.y * Math.sin(bb) + padNorth.y * Math.cos(bb)) * k, dz = padUp.z + (padEast.z * Math.sin(bb) + padNorth.z * Math.cos(bb)) * k;
    const l = Math.hypot(dx, dy, dz), p = surfaceDirPoint(dx / l, dy / l, dz / l), pl = Math.hypot(p.x, p.y, p.z);
    return { point: p, up: { x: p.x / pl, y: p.y / pl, z: p.z / pl } };
  })() : null;

  const g0 = moonSurfaceGravity(S);
  const body = {
    id: S.id, name: S.name, designation: S.designation, kind: 'moon', parentId: 'mars',
    radiusMean: Rm, radiusEquatorial: Rm, radiusPolar: Rm,      // the sphere the lat/lon grid and the walker use; the real shape is baseField
    axes: S.axes, mass: S.massKg, surfaceGravity: g0, escapeVelocity: Math.sqrt(2 * G_CONST * S.massKg / Rm),
    siderealRotationPeriod: S.orbitPeriodS, obliquityDeg: 0,
    atmosphere: null, datum: 'mean radius',
    terrain: { seed, reliefMax: 4200, reliefMin: -2400, localRelief: 700, crustThickness: Rm * 0.95 },
    // lat/lon here are in the world-aligned grid geodesy.js uses (so the nav screens place them); `bodyLon` is the moon's own
    // longitude, measured from the sub-Mars meridian, which is the one the HUD and the real maps use
    landmarks: S.landmarks.map((l) => ({ ...l, bodyLon: l.lon, lon: ((l.lon + S.lonS + 180 + 540) % 360) - 180, elevation: 0, verified: 'table' })),
    sources: [
      { field: 'axes, radiusMean, orbit', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', verified: 'live', note: 'fetched 2026-10-01' },
      { field: 'overall size, Stickney, regolith depth', url: `https://science.nasa.gov/mars/moons/${S.id}/`, verified: 'live', note: 'fetched 2026-10-01: 27x22x18 km (Phobos), 15x12x11 km (Deimos)' },
    ],
    centre,                       // where its centre is in Mars's frame
    spec: S,
    baseField, materialField, surfaceRadius,
    /** Metres of loose rock added to the surface along a world direction. Zero on Deimos and on the Phobos pad. */
    rockRelief: (dx, dy, dz) => {
      const l = Math.hypot(dx, dy, dz) || 1;
      const q = toBodyDir(dx / l, dy / l, dz / l);
      return rockAdded(q[0], q[1], q[2], reOf(q[0], q[1], q[2]));
    },
    // helpers
    bodyLatLon, surfacePoint, padInfo: { ...pad, point: padPoint, up: padUp, east: padEast, north: padNorth, planeR: padPlaneR },
    sampleSites, derelict,
    axesWorld: { ex, ey, ez },
    toBodyDir, fromBody,
    /** 0.42..1 darkening from crater rims and groove floors. 1 on the graded pad, where those shapes were planed off. */
    cavityShade: (x, y, z) => {
      const r = Math.hypot(x, y, z) || 1;
      const q = toBodyDir(x / r, y / r, z / r);
      const re = reOf(q[0], q[1], q[2]);
      let s = shadeAt(q[0] * re, q[1] * re, q[2] * re, q[0], q[1], q[2]);
      const cosp = q[0] * padDir[0] + q[1] * padDir[1] + q[2] * padDir[2];
      if (cosp > 0.97) {
        const padS = Rm * Math.acos(Math.min(1, cosp));
        if (padS < pad.flatM) s = 1;
        else if (padS < pad.blendM) s += (1 - s) * (1 - sstep(pad.flatM, pad.blendM, padS));
      }
      return s;
    },
    /** the bare ellipsoid's radius along a world direction (no relief): for measuring how rough the ground is */
    ellipsoidRadius: (dx, dy, dz) => { const q = toBodyDir(dx, dy, dz); return reOf(q[0], q[1], q[2]); },
    /** where the ship stops before it descends: straight above the pad */
    standoffPoint: (alt) => { const l = Math.hypot(padPoint.x, padPoint.y, padPoint.z); return { x: padPoint.x / l * (l + alt), y: padPoint.y / l * (l + alt), z: padPoint.z / l * (l + alt) }; },
  };
  _bodies.set(id, body);
  return body;
}

// materials are looked up lazily from field.js's list (so this file stays importable in any order)
import { MATERIALS } from '../world/field.js';
const MATS = {
  phobos: { regolith: MATERIALS.phobosRegolith, rubble: MATERIALS.phobosRubble, clay: MATERIALS.phobosClay },
  deimos: { regolith: MATERIALS.deimosRegolith, rubble: MATERIALS.deimosRubble, clay: null },
};

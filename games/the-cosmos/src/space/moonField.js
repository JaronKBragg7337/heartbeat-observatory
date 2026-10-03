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

import { moonCentre, moonSurfaceGravity, G_CONST, sunDirection } from './spaceSpec.js';
import { worldDef, isFrameWorld, worldPlacement } from '../worlds/registry.js';
import { profileOf, profileParams, pick } from '../worlds/_kit/terrain.js';

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
// Per-ship pads, read when the field is sampled. Empty until an authority (or the remote client) attaches them.
// The cached body stays valid: the getter is read at query time, and it is null while the survey pad is built.
let _getMoonPads = () => [];
export function attachMoonPads(get) { _getMoonPads = typeof get === 'function' ? get : (() => []); }
function padsFor(bodyId) {
  let all = [];
  try { all = _getMoonPads() || []; } catch { all = []; }
  return all.filter((a) => a && a.bodyId === bodyId && Number.isFinite(a.east) && Number.isFinite(a.north));
}
// ROUND7: which crater cells can reach a point. A cell's crater centre sits 0.3..0.7 cells in, and its rim and ejecta reach `reach` cells from the
// centre, so a point near a cell wall is also under the neighbouring cell's craters. Looking only at its own cell cut every big rim and ejecta
// blanket off at the cell wall: a straight step up to tens of metres on the biggest craters. Per axis the neighbours whose centre box is within
// reach are kept, then the 3-D distance to the box is checked, so most points still look at one to three cells (and no hash is computed for the rest).
const _cells = new Int32Array(27 * 3), _o = [new Int8Array(3), new Int8Array(3), new Int8Array(3)], _dd = [new Float64Array(3), new Float64Array(3), new Float64Array(3)], _n = [0, 0, 0], _P = [0, 0, 0], _B = [0, 0, 0];
function nearCells(px, py, pz, s, reach) {
  _P[0] = px / s; _P[1] = py / s; _P[2] = pz / s;
  for (let a = 0; a < 3; a++) {
    const b = Math.floor(_P[a]); _B[a] = b; const f = _P[a] - b; let n = 0;
    for (let o = -1; o <= 1; o++) { const lo = o + 0.3, hi = o + 0.7, d = f < lo ? lo - f : f > hi ? f - hi : 0; if (d <= reach) { _o[a][n] = o; _dd[a][n] = d * d; n++; } }
    _n[a] = n;
  }
  const r2 = reach * reach; let c = 0;
  for (let i = 0; i < _n[0]; i++) for (let j = 0; j < _n[1]; j++) {
    const dij = _dd[0][i] + _dd[1][j]; if (dij > r2) continue;
    for (let k = 0; k < _n[2]; k++) { if (dij + _dd[2][k] > r2) continue; _cells[c++] = _B[0] + _o[0][i]; _cells[c++] = _B[1] + _o[1][j]; _cells[c++] = _B[2] + _o[2][k]; }
  }
  return c / 3;
}

export function makeMoon(id) {
  if (_bodies.has(id)) return _bodies.get(id);
  const S = worldDef(id);
  if (!isFrameWorld(S)) throw new Error(`unknown moon: ${id}`);
  const PROF = profileOf(S), PP = profileParams(S);                      // the terrain profile (rocky for Phobos and Deimos: adds nothing)
  const { a, b, c } = S.axes, Rm = S.radiusMean, seed = S.seed, scale = pick(S, 'craterScale', 1), RS = pick(S, 'roughScale', 1), DENS = pick(S, 'craterDensity', 0.62), CS = pick(S, 'cellScale', 1);
  // Low-frequency lumpiness: amplitude as a share of the radius and a spatial frequency in 1/metres. A potato moon: 6% and 1.6%, at
  // 6 km and 1.7 km wavelengths. A PLANET must lower all four (a 2,000 km world at 6% would be 120 km high and as steep as a wall):
  // set `lump`, `lump2`, `lumpFreq`, `lump2Freq` in the def so the wavelengths are a good share of the radius.
  const LUMP = S.lump ?? 0.06, LUMP2 = S.lump2 ?? 0.016, LF = S.lumpFreq ?? 0.00016, LF2 = S.lump2Freq ?? 0.0006;
  const REGOLITH_M = pick(S, 'regolithDepthM', 50);
  const centre = moonCentre(S);
  // body axes in world directions
  // where it sits as seen from Mars (its +X axis points at Mars: tidal lock): the parked shorthand's own longitude, or the one the orbit puts it at
  const LON_S = S.orbit && !S.orbit.parked ? worldPlacement(S.id).lonS : S.lonS;
  const lonM = (LON_S + 180) * DEG;
  const ex = { x: Math.cos(lonM), y: 0, z: -Math.sin(lonM) };
  const ez = { x: 0, y: 1, z: 0 };
  const ey = { x: ez.y * ex.z - ez.z * ex.y, y: ez.z * ex.x - ez.x * ex.z, z: ez.x * ex.y - ez.y * ex.x };

  const dirOf = (latDeg, lonDeg) => { const la = latDeg * DEG, lo = lonDeg * DEG; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
  const feat = S.landmarks.map((l) => ({ ...l, d: dirOf(l.lat, l.lon) }));
  const AGAIN = 1 / (a * a), BGAIN = 1 / (b * b), CGAIN = 1 / (c * c);

  // grooves: planar troughs parallel to the long axis, as the observed ones run. Seeded, so the same every time.
  const grooves = [];
  for (let i = 0; i < (pick(S, 'grooves', true) === false ? 0 : 16); i++) {
    const ang = (-25 + 70 * hash3(i, 1, 7, seed)) * DEG;
    // Wide and deep enough to read from orbit (the real ones are 100-200 m across and tens of metres deep). About a third carry a
    // chain of pits along the floor, as the real grooves do.
    grooves.push({ n: [0, Math.cos(ang), Math.sin(ang)], off: (hash3(i, 2, 7, seed) * 2 - 1) * Rm * 0.8,
      w: 70 + 85 * hash3(i, 3, 7, seed), dep: 8 + 14 * hash3(i, 4, 7, seed), phase: i * 17.31,
      chain: hash3(i, 5, 7, seed) < 0.42 ? { rp: 15 + 22 * hash3(i, 6, 7, seed), gap: 2.4 + 0.8 * hash3(i, 8, 7, seed) } : null });
  }

  const M = materialsOf(S);
  const pad = S.pad;
  const padDir = dirOf(pad.lat, pad.lon);

  // ---- the relief above the ellipsoid, metres, at a body-frame direction (u,v,w unit) ------------------------------
  function relief(u, v, w, re) {
    const px = u * re, py = v * re, pz = w * re;
    let h = 0;
    // the lumpy potato: low-frequency departures from the ellipsoid
    h += fbm(px * LF, py * LF, pz * LF, seed + 5, 3) * LUMP * Rm;
    h += fbm(px * LF2, py * LF2, pz * LF2, seed + 9, 3) * LUMP2 * Rm;
    // the named craters
    for (const f of feat) {
      const cosang = u * f.d[0] + v * f.d[1] + w * f.d[2];
      if (cosang < 0) continue;                                    // ROUND7: was 0.5 (60 degrees): Stickney's blanket was still 9 m thick there and ended in a 9 m cliff
      const s = Rm * Math.acos(Math.min(1, cosang));
      const t = s / f.radiusM, tQuarter = Rm * Math.PI / 2 / f.radiusM;
      if (t < 1) { const q = 1 - t * t; h -= f.depthM * Math.pow(q, 1.15) * (t > 0.82 ? 1 : 1); }
      // The rim and the ejecta blanket fade in and out smoothly: they used to switch on at a fixed radius, and a switch is a cliff
      // (60 m round Stickney's rim, 49 m where its blanket starts, 3.7 m where it ends)
      const rimH = f.depthM * 0.12;
      h += rimH * Math.exp(-(((t - 1.02) / 0.2) ** 2));
      if (t > 0.9 && t < 4.4) h += f.depthM * 0.035 / (t * t) * sstep(0.9, 1.5, t) * (1 - sstep(3, 4.4, t)) * (1 - sstep(0.55 * tQuarter, tQuarter, t));       // ejecta blanket, gone before the cut at 90 degrees
    }
    // craters at every scale
    for (let k = 0; k < CELLS.length; k++) {
      const s = CELLS[k] * CS;
      const nc = nearCells(px, py, pz, s, 0.72);                   // 3 rc <= 0.72 cells: the reach of the rim and the ejecta
      for (let q = 0; q < nc; q++) {
        const ix = _cells[3 * q], iy = _cells[3 * q + 1], iz = _cells[3 * q + 2];
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
          // the ejecta tail dies away smoothly before the 3 rc cut (it used to stop at 0.0004 D: a step of a metre round the biggest bowls)
          h += 0.012 * D / (t * t * t) * sstep(1.0, 1.45, t) * (1 - sstep(2.2, 3.0, t));
        }
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
      // the pit chain: round pits one after another down the middle of the trough
      if (g.chain && seg > 0.5 && RS > 0.5 && dd < g.w * 0.5) {
        const tt = -py * g.n[2] + pz * g.n[1], rr = Math.hypot(px, tt) || 1;       // in the groove's plane, about the body's long axis
        const sp = g.chain.rp * 2 * g.chain.gap, dphi = sp / rr, phi = Math.atan2(tt, px);
        const k = Math.round(phi / dphi), dph = (phi - k * dphi) * rr;
        const ps = Math.hypot(dph, dd), q = ps / g.chain.rp;
        if (q < 1.6 && hash3(k, i, 11, seed) > 0.18) {
          const dp = g.chain.rp * (0.22 + 0.1 * hash3(k, i, 12, seed));
          if (q < 1) h -= dp * Math.pow(1 - q * q, 1.15);
          h += dp * 0.16 * Math.exp(-(((q - 1.08) / 0.2) ** 2));
        }
      }
    }
    // regolith roughness: hills you walk over, rocks you step round, grit
    h += fbm(px * 0.012, py * 0.012, pz * 0.012, seed + 21, 3) * 6.0 * RS;
    h += fbm(px * 0.06, py * 0.06, pz * 0.06, seed + 33, 3) * 1.2 * RS;
    h += fbm(px * 0.45, py * 0.45, pz * 0.45, seed + 44, 2) * 0.22 * RS;
    h += noise3(px * 2.4, py * 2.4, pz * 2.4, seed + 55) * 0.05 * RS;
    if (PROF.relief) h += PROF.relief({ px, py, pz, seed, Rm, p: PP });          // the world's terrain profile (dunes, ice cracks, volcanoes, islands)
    return h;
  }

  const reOf = (u, v, w) => 1 / Math.sqrt(u * u * AGAIN + v * v * BGAIN + w * w * CGAIN);
  // world direction (unit, world-aligned) -> body-frame unit vector. Declared here: the sun used by crater shadows is converted once, at build.
  const toBodyDir = (dx, dy, dz) => [dx * ex.x + dz * ex.z, dx * ey.x + dz * ey.z, dy];
  const fromBody = (u, v, w, out = {}) => { out.x = u * ex.x + v * ey.x; out.y = w; out.z = u * ex.z + v * ey.z; return out; };

  // Loose rock, in the density field (so a boot and a bucket meet the same stone the mesh draws). One rock per cell, inset so
  // it never crosses into the next cell: the height is zero on the footprint's edge, and the footprint stays inside the cell.
  // Phobos is rocky; Deimos has only a few low blocks and stones standing out of its dust.
  //
  // A rock is an ANGULAR block, not a dome: a 5-7 sided footprint (each facet its own distance and turn), a flat-ish top cut by two
  // tilted planes (so there is a ridge), and straight walls that rise from the footprint's edge at no more than about 40 degrees,
  // so a running step still meets the surface on 0.0057 g (a steeper face launches the walker and the 90 s grounded check fails).
  // The height is min(wall, planeA, planeB): crisp creases where the faces meet, still one number per point of the radial field.
  // The world's own loose rock (def.rocks; Phobos boulders, Deimos low blocks). A world that names none gets a gentle scatter; `rocks: []` has none.
  const ROCKS = S.rocks ?? [
    { s: 40, dens: 0.34, rLo: 4, rHi: 8, hLo: 0.7, hHi: 1.6 },
    { s: 9, dens: 0.2, rLo: 1.2, rHi: 2.6, hLo: 0.2, hHi: 0.55 },
    { s: 6, dens: 0.22, rLo: 0.7, rHi: 1.3, hLo: 0.08, hHi: 0.3 },
  ];
  // Named rocks around the survey pad (east, north metres from the pad centre; rc footprint radius, h height). The pad is graded flat out to
  // 62 m and the loose rock is kept off it, so these stand at its edge and beyond: something to frame a ship, shade a rover and
  // throw a shadow across the dust. The same angular block as the scatter, so they walk and dig like it.
  const HEROES = S.heroes ?? [];
  let heroes = null;                                                   // built on first use: it needs the pad's frame
  let derelictU = null;                                                // unit direction of the drifting cargo module: no loose rock under it
  const MAX_WALL = 0.82;                                               // tan of the steepest face, about 39 degrees
  const HERO_WALL = 1.6;                                               // the named rocks stand at the pad's edge, off the walking routes: chunky blocks with steep faces (about 58 degrees)
  /**
   * Height of one angular block at tangent-plane offset (a, b) from its centre. rand(k) is the block's own deterministic stream
   * (the same k offsets the scatter always used, so the scatter is unchanged); rc footprint radius; hLo..hHi the height range.
   */
  function blockTop(a, b, rc, hLo, hHi, rand, maxWall = MAX_WALL) {
    // footprint: N facets, each at its own turn and distance (apothem up to 0.6 rc keeps every corner inside rc)
    const N = 5 + Math.floor(rand(6) * 3);
    const th0 = rand(7) * Math.PI * 2;
    let t = -1e9, apMin = 1e9;
    for (let i = 0; i < N; i++) {
      const phi = th0 + (i / N) * Math.PI * 2 + (rand(20 + i) - 0.5) * 0.5;
      const ap = rc * 0.6 * (0.8 + 0.2 * rand(40 + i));
      if (ap < apMin) apMin = ap;
      const ti = (a * Math.cos(phi) + b * Math.sin(phi)) / ap;
      if (ti > t) t = ti;
    }
    if (t >= 1) return 0;
    const tf = 0.3 + 0.2 * rand(8);                                    // share of the footprint that is top
    let hh = hLo + (hHi - hLo) * rand(5);
    hh = Math.min(hh, maxWall * (1 - tf) * apMin);
    let top = Math.min(1, (1 - t) / (1 - tf)) * hh;                    // the straight wall
    // two cutting planes tilt the top and make a ridge; a plane's slope is at most 0.3 of hh over the stone's radius
    for (let q = 0; q < 2; q++) {
      const al = rand(60 + q) * Math.PI * 2, k = (0.12 + 0.2 * rand(70 + q)) * hh / rc;
      const plane = hh * (1 + 0.1 * (q ? -1 : 1)) + k * (a * Math.cos(al) + b * Math.sin(al)) * (q ? 1.4 : 1);
      if (plane < top) top = plane;
    }
    return top > 0 ? top : 0;
  }
  /** Two tangent axes at a unit radial u: e1 from the least-aligned world axis, e2 completes the set. */
  function tangentAxes(ux, uy, uz) {
    let ax = 0, ay = 0, az = 0;
    if (Math.abs(ux) <= Math.abs(uy) && Math.abs(ux) <= Math.abs(uz)) ax = 1; else if (Math.abs(uy) <= Math.abs(uz)) ay = 1; else az = 1;
    let e1x = uy * az - uz * ay, e1y = uz * ax - ux * az, e1z = ux * ay - uy * ax;
    const e1l = Math.hypot(e1x, e1y, e1z) || 1; e1x /= e1l; e1y /= e1l; e1z /= e1l;
    return [e1x, e1y, e1z, uy * e1z - uz * e1y, uz * e1x - ux * e1z, ux * e1y - uy * e1x];
  }
  /** Rock height at a body-frame point on the surface; `classFrom` skips the larger classes (the stones near the pad are the last). */
  function boulderHeight(px, py, pz, classFrom = 0) {
    let h = 0;
    const r = Math.hypot(px, py, pz) || 1;
    for (let ci = classFrom; ci < ROCKS.length; ci++) {
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
      if (rc < 0.4) continue;
      const dx = px - cx, dy = py - cy, dz = pz - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rc * rc) continue;
      const ax = tangentAxes(cx / cr, cy / cr, cz / cr);
      const a = dx * ax[0] + dy * ax[1] + dz * ax[2], b = dx * ax[3] + dy * ax[4] + dz * ax[5];
      h += blockTop(a, b, rc, spec.hLo, spec.hHi, (k) => hash3(ix, iy, iz, sd + k));
    }
    return h;
  }
  /** The named rocks around the pad. */
  function heroHeight(px, py, pz) {
    if (!padFrame) return 0;
    if (!heroes) {
      heroes = HEROES.map((hr, i) => {
        const d = tangentDir(hr.e, hr.n), q = toBodyDir(d[0], d[1], d[2]), re = reOf(q[0], q[1], q[2]);
        return { c: [q[0] * re, q[1] * re, q[2] * re], rc: hr.rc, h: hr.h, i, ax: tangentAxes(q[0], q[1], q[2]) };
      });
    }
    let h = 0;
    for (const hr of heroes) {
      const dx = px - hr.c[0], dy = py - hr.c[1], dz = pz - hr.c[2];
      if (dx * dx + dy * dy + dz * dz >= hr.rc * hr.rc) continue;
      const ax = hr.ax;
      h += blockTop(dx * ax[0] + dy * ax[1] + dz * ax[2], dx * ax[3] + dy * ax[4] + dz * ax[5], hr.rc, hr.h * 0.999, hr.h, (k) => hash3(hr.i, 3, 5, seed + 300 + k), HERO_WALL);
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
      const nc = nearCells(px, py, pz, s, 0.48);                   // 2 rc <= 0.48 cells: a bowl's shadow reaches past its own cell too
      for (let q = 0; q < nc; q++) {
        const ix = _cells[3 * q], iy = _cells[3 * q + 1], iz = _cells[3 * q + 2];
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
    }
    if (RS > 0.5) {
      for (let i = 0; i < grooves.length; i++) {
        const gg = grooves[i];
        const dd = Math.abs(py * gg.n[1] + pz * gg.n[2] - gg.off);
        if (dd < gg.w) shade *= 1 - 0.3 * (1 - (dd / gg.w) * (dd / gg.w));      // a trough reads from orbit as a dark lane
      }
    }
    return Math.max(0.42, Math.min(1, shade));
  }

  // the graded survey pad: a true plane perpendicular to the radial through the pad's centre, blended into the natural ground
  // Extra named ports (def.ports): more graded sites on the same ground. The arrival pad above stays the one a course lands at.
  const ports = (S.ports || []).map((q) => { const d = dirOf(q.lat, q.lon), re = reOf(d[0], d[1], d[2]); return { ...q, d, plane: re + relief(d[0], d[1], d[2], re) }; });
  const padRc = (() => { const re = reOf(...padDir); return re + relief(padDir[0], padDir[1], padDir[2], re) - 0.0; })();
  const padPlaneR = padRc;
  // Null until the survey pad's east/north exist, so measuring that pad cannot see a player pad.
  let padFrame = null;
  const geomCache = new Map();
  function radiusBare(u, v, w) {
    const re = reOf(u, v, w);
    let R = re + relief(u, v, w, re);
    const cosp = u * padDir[0] + v * padDir[1] + w * padDir[2];
    if (cosp > 0.97) {
      const padS = Rm * Math.acos(Math.min(1, cosp));
      if (padS < pad.blendM) {
        const wt = 1 - sstep(pad.flatM, pad.blendM, padS);
        R += (padPlaneR / cosp - R) * wt;
      }
    }
    for (let i = 0; i < ports.length; i++) {
      const q = ports[i], cq = u * q.d[0] + v * q.d[1] + w * q.d[2];
      if (cq > 0.97) { const s = Rm * Math.acos(Math.min(1, cq)); if (s < q.blendM) R += (q.plane / cq - R) * (1 - sstep(q.flatM, q.blendM, s)); }
    }
    return R;
  }
  // east/north metres in the survey pad's tangent plane -> unit moon-local direction. Small-angle, same as the sample sites.
  function tangentDir(eastM, northM) {
    const ke = eastM / Rm, kn = northM / Rm;
    const dx = padUp.x + padEast.x * ke + padNorth.x * kn;
    const dy = padUp.y + padEast.y * ke + padNorth.y * kn;
    const dz = padUp.z + padEast.z * ke + padNorth.z * kn;
    const l = Math.hypot(dx, dy, dz) || 1;
    return [dx / l, dy / l, dz / l];
  }
  function geomOf(a) {
    let g = geomCache.get(a.id);
    if (g) return g;
    const d = tangentDir(a.east, a.north);
    const q = toBodyDir(d[0], d[1], d[2]);
    g = { d, q, plane: radiusBare(q[0], q[1], q[2]) };
    geomCache.set(a.id, g);
    return g;
  }
  // The nearest player pad's plane, or null. One pad wins, so two shoulders do not stack.
  function playerWeight(u, v, w) {
    if (!padFrame) return null;
    let bestWt = 0, best = null;
    for (const a of padsFor(S.id)) {
      const g = geomOf(a);
      const cosp = u * g.q[0] + v * g.q[1] + w * g.q[2];
      if (cosp <= 0.97) continue;
      const s = Rm * Math.acos(Math.min(1, cosp));
      if (!(s < a.blendM)) continue;
      const wt = 1 - sstep(a.flatM, a.blendM, s);
      if (wt > bestWt) bestWt = wt, best = { wt, plane: g.plane, cosp, flat: s < a.flatM };
    }
    return best;
  }
  function surfaceRadiusBody(u, v, w) {
    let R = radiusBare(u, v, w);
    const pw = playerWeight(u, v, w);
    if (pw) R += (pw.plane / pw.cosp - R) * pw.wt;
    // rocks sit on the graded ground, and they stay off every landing plane
    R += rockAdded(u, v, w, reOf(u, v, w));
    return R;
  }
  function rockAdded(u, v, w, re) {
    if (!ROCKS.length) return 0;
    const cosp = u * padDir[0] + v * padDir[1] + w * padDir[2];
    let along = 1e9;
    if (cosp > 0.97) along = Rm * Math.acos(Math.min(1, cosp));
    for (let i = 0; i < ports.length; i++) { const q = ports[i], cq = u * q.d[0] + v * q.d[1] + w * q.d[2]; if (cq > 0.97) along = Math.min(along, Rm * Math.acos(Math.min(1, cq))); }       // no loose rock on a port
    let fade = 1, fadeStones = 1;
    if (along < 58) fade = 0;
    else if (along < 86) fade = sstep(58, 86, along);
    if (along < 26) fadeStones = 0;                                    // the smallest stones come in close to the pad: a few ankle-high ones around the ship
    else if (along < 44) fadeStones = sstep(26, 44, along);
    const pw = playerWeight(u, v, w);
    if (pw) { if (pw.flat) return 0; fade = Math.min(fade, 1 - pw.wt); fadeStones = Math.min(fadeStones, 1 - pw.wt); }
    let keepOff = 1;
    if (derelictU) {
      const cd = u * derelictU[0] + v * derelictU[1] + w * derelictU[2];
      if (cd > 0.9999) { const dd = Rm * Math.acos(Math.min(1, cd)); keepOff = sstep(9, 17, dd); }
    }
    fade = Math.min(fade, keepOff); fadeStones = Math.min(fadeStones, keepOff);
    const px = u * re, py = v * re, pz = w * re;
    let h = 0;
    if (fade > 0) h += fade * boulderHeight(px, py, pz);
    if (fadeStones > fade) h += (fadeStones - fade) * boulderHeight(px, py, pz, ROCKS.length - 1);
    if (along < 90 && keepOff > 0) h += keepOff * (pw ? 1 - pw.wt : 1) * heroHeight(px, py, pz);
    return h;
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
    const reg = REGOLITH_M * (0.55 + 0.45 * (0.5 + 0.5 * noise3(px * 0.004, py * 0.004, pz * 0.004, seed + 77)));
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
  padFrame = { up: padUp, east: padEast, north: padNorth };
  const SITES = [[170, 70], [640, 150], [1100, 20]];
  const sampleSites = SITES.map(([dist, brg], i) => {
    const bb = brg * DEG, k = dist / Rm;
    const dx = padUp.x + (padEast.x * Math.sin(bb) + padNorth.x * Math.cos(bb)) * k, dy = padUp.y + (padEast.y * Math.sin(bb) + padNorth.y * Math.cos(bb)) * k, dz = padUp.z + (padEast.z * Math.sin(bb) + padNorth.z * Math.cos(bb)) * k;
    const l = Math.hypot(dx, dy, dz), p = surfaceDirPoint(dx / l, dy / l, dz / l);
    return { id: `S${i + 1}`, distM: dist, bearingDeg: brg, point: p };
  });

  if (S.derelict) {
    // the direction first, so the rocks can leave room for the module before its ground is measured
    const bb = S.derelict.bearingDeg * DEG, k = S.derelict.distM / Rm;
    const dx = padUp.x + (padEast.x * Math.sin(bb) + padNorth.x * Math.cos(bb)) * k, dy = padUp.y + (padEast.y * Math.sin(bb) + padNorth.y * Math.cos(bb)) * k, dz = padUp.z + (padEast.z * Math.sin(bb) + padNorth.z * Math.cos(bb)) * k;
    const l = Math.hypot(dx, dy, dz), q = toBodyDir(dx / l, dy / l, dz / l);
    derelictU = q;
  }
  const derelict = S.derelict ? (() => {
    const bb = S.derelict.bearingDeg * DEG, k = S.derelict.distM / Rm;
    const dx = padUp.x + (padEast.x * Math.sin(bb) + padNorth.x * Math.cos(bb)) * k, dy = padUp.y + (padEast.y * Math.sin(bb) + padNorth.y * Math.cos(bb)) * k, dz = padUp.z + (padEast.z * Math.sin(bb) + padNorth.z * Math.cos(bb)) * k;
    const l = Math.hypot(dx, dy, dz), p = surfaceDirPoint(dx / l, dy / l, dz / l), pl = Math.hypot(p.x, p.y, p.z);
    return { point: p, up: { x: p.x / pl, y: p.y / pl, z: p.z / pl } };
  })() : null;

  const LOOK = S.look || {}, LK = LOOK.k || [1, 0.12, 0.08], LR = LOOK.red || [0, 0.2, 0.2];            // albedo units (def.look)
  const g0 = moonSurfaceGravity(S);
  const body = {
    id: S.id, name: S.name, designation: S.designation, kind: 'moon', parentId: 'mars',
    radiusMean: Rm, radiusEquatorial: Rm, radiusPolar: Rm,      // the sphere the lat/lon grid and the walker use; the real shape is baseField
    axes: S.axes, mass: S.massKg, surfaceGravity: g0, escapeVelocity: Math.sqrt(2 * G_CONST * S.massKg / Rm),
    siderealRotationPeriod: (S.rotation && S.rotation.periodS) || S.orbitPeriodS, obliquityDeg: (S.rotation && S.rotation.axialTiltDeg) || 0,
    rotation: S.rotation || null, orbit: S.orbit || null,                // the ephemeris data (src/worlds/_kit/ephemeris.js); nothing turns or moves until DYNAMICS is switched on
    worldKind: S.kind,                                          // the world's real kind (planet, moon, ...); `kind: 'moon'` above means "has a frame of its own"
    atmosphere: S.atmosphere ? { ...S.atmosphere, scaleHeight: S.atmosphere.scaleHeightM, surfacePressure: S.atmosphere.surfacePressure ?? 0 } : null, datum: 'mean radius',
    terrain: { seed, reliefMax: 4200, reliefMin: -2400, localRelief: 700, crustThickness: Rm * 0.95 },
    // lat/lon here are in the world-aligned grid geodesy.js uses (so the nav screens place them); `bodyLon` is the moon's own
    // longitude, measured from the sub-Mars meridian, which is the one the HUD and the real maps use
    landmarks: S.landmarks.map((l) => ({ ...l, bodyLon: l.lon, lon: ((l.lon + LON_S + 180 + 540) % 360) - 180, elevation: 0, verified: 'table' })),
    sources: S.sources || [{ field: 'everything', url: '', verified: 'invented', note: `${S.name} is a game world: its numbers are the world's own and not measured (state each source in the def's \`sources\`).` }],
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
    /** A per-ship pad in moon-local metres. `standoff` is where a descent starts, straight above that pad. */
    playerPad(eastM, northM) {
      const d = tangentDir(eastM, northM);
      const q = toBodyDir(d[0], d[1], d[2]);
      const plane = radiusBare(q[0], q[1], q[2]);
      const up = { x: d[0], y: d[1], z: d[2] };
      const point = { x: up.x * plane, y: up.y * plane, z: up.z * plane };
      const dotE = padEast.x * up.x + padEast.y * up.y + padEast.z * up.z;
      const ex = padEast.x - up.x * dotE, ey = padEast.y - up.y * dotE, ez = padEast.z - up.z * dotE;
      const el = Math.hypot(ex, ey, ez) || 1;
      const east = { x: ex / el, y: ey / el, z: ez / el };
      const north = { x: up.y * east.z - up.z * east.y, y: up.z * east.x - up.x * east.z, z: up.x * east.y - up.y * east.x };
      return { up, point, east, north, planeR: plane, standoff(alt) { const L = plane + alt; return { x: up.x * L, y: up.y * L, z: up.z * L }; } };
    },
    sampleSites, derelict,
    /** Extra named ports (def.ports) with their graded point and up vector, body-local. */
    ports: ports.map((q) => { const pt = surfacePoint(q.d[0], q.d[1], q.d[2]), l = Math.hypot(pt.x, pt.y, pt.z); return { id: q.id, name: q.name, flatM: q.flatM, point: pt, up: { x: pt.x / l, y: pt.y / l, z: pt.z / l } }; }),
    axesWorld: { ex, ey, ez },
    /** The world-aligned unit vector toward the Sun (the patches cast shadows along it). */
    sunDir: sunW,
    toBodyDir, fromBody,
    /**
     * Albedo variation at a world-aligned point: out.k a brightness multiplier (about 0.7..1.35), out.red -1..1 (negative = bluer unit).
     * Phobos has a redder, darker unit and a bluer, brighter one (the ejecta around Stickney is the blue one), so from orbit it is not
     * one grey. Deimos is a dusty, low-contrast blanket: a little brighter and warmer, with soft patches.
     */
    albedo: (x, y, z, out) => {
      const r = Math.hypot(x, y, z) || 1, q = toBodyDir(x / r, y / r, z / r), re = reOf(q[0], q[1], q[2]);
      const px = q[0] * re, py = q[1] * re, pz = q[2] * re;
      const lo = fbm(px * 0.00042, py * 0.00042, pz * 0.00042, seed + 301, 3);       // thousands of metres: the red and blue units
      const mid = fbm(px * 0.0032, py * 0.0032, pz * 0.0032, seed + 313, 2);        // a few hundred metres: dust drifts and old ejecta
      let k, red;
      k = LK[0] + LK[1] * lo + LK[2] * mid; red = LR[0] + LR[1] * lo + LR[2] * mid;
      const f = feat[0];
      if (f) {
        const cosang = q[0] * f.d[0] + q[1] * f.d[1] + q[2] * f.d[2];
        if (cosang > 0.2) {
          const t = Rm * Math.acos(Math.min(1, cosang)) / f.radiusM;
          if (LOOK.ejecta) { const e = Math.exp(-(((t - LOOK.ejecta.centre) / LOOK.ejecta.width) ** 2)); k *= 1 + LOOK.ejecta.k * e; red -= LOOK.ejecta.red * e; }       // Phobos: the blue, bright ejecta blanket
          else if (LOOK.rim && t < LOOK.rim.edge) k *= 1 + LOOK.rim.k * Math.exp(-(((t - 1) / LOOK.rim.width) ** 2));                                          // Deimos: a bright rim on Voltaire
        }
      }
      out.k = k; out.red = red;
      return out;
    },
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
      const pw = playerWeight(q[0], q[1], q[2]);
      if (pw) { if (pw.flat) s = 1; else s += (1 - s) * pw.wt; }
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

// A world's materials: names of entries in field.js's MATERIALS, or material objects (the registry has already appended those).
const matOf = (m) => (typeof m === 'string' ? MATERIALS[m] : m);
const materialsOf = (S) => ({ regolith: matOf(S.materials.regolith), rubble: matOf(S.materials.rubble), clay: S.materials.clay ? matOf(S.materials.clay) : null });
import { MATERIALS } from '../world/field.js';

// ============================================================================
// shipExterior.js — the hull, the gear, the guns, the engines.
//
// OWNS: everything you see of the ship from outside, and every part that moves:
//       landing legs, ramps, gun mounts, engine glow.
// DOES NOT OWN: any interior surface, or how the ship flies.
//
// THE HULL IS LOFTED, NOT BOXED
// -----------------------------
// The body is a surface swept along the ship's length through a table of cross
// sections (half-width, keel, deck). Each section is a superellipse, which is
// what turns a rectangle into a fuselage: flat sides and a flat keel that still
// roll over into rounded shoulders. The interior rooms are rectangles that fit
// inside that surface with margin, and the validator checks the fit.
//
// Panels, rivets, seams and weathering come from the hull texture, laid out in
// METRES so a 2 m plate is a 2 m plate along the whole ship.
// ============================================================================

import * as THREE from 'three';
import { Kit } from './shipKit.js';
import { mulberry } from './shipTextures.js';
import { SHIP_NAME, SHIP_ID, GEAR, GUNS, RAMPS, DECK } from './shipSpec.js';

// z, half-width, keel y, deck y
export const HULL_STATIONS = [
  [-21.0, 0.40, 1.60, 2.60],
  [-20.0, 1.80, 0.90, 3.50],
  [-18.0, 3.90, -0.20, 4.90],
  [-16.0, 5.70, -0.80, 5.60],
  [-13.0, 6.85, -1.10, 6.10],
  [-9.0, 7.20, -1.10, 6.70],
  [-3.0, 7.45, -1.10, 6.80],
  [4.0, 7.45, -1.10, 6.80],
  [10.0, 7.15, -1.10, 6.85],
  [15.0, 7.05, -1.10, 6.90],
  [19.0, 6.95, -1.05, 6.90],
  [21.0, 6.75, -0.95, 6.80],
];
const HULL_N = 5.0;       // superellipse exponent: 2 is an ellipse, infinity is a box

/** Cubic Hermite through the stations, monotone enough for a hull. */
function sampleStations(z) {
  const S = HULL_STATIONS;
  if (z <= S[0][0]) return { hw: S[0][1], yb: S[0][2], yt: S[0][3] };
  if (z >= S[S.length - 1][0]) { const e = S[S.length - 1]; return { hw: e[1], yb: e[2], yt: e[3] }; }
  let i = 0;
  while (z > S[i + 1][0]) i++;
  const a = S[i], b = S[i + 1];
  const h = b[0] - a[0];
  const t = (z - a[0]) / h;
  const tangent = (k, idx) => {
    const p = S[Math.max(0, idx - 1)], n = S[Math.min(S.length - 1, idx + 1)];
    const dz = n[0] - p[0];
    return dz > 0 ? (n[k] - p[k]) / dz : 0;
  };
  const out = {};
  [['hw', 1], ['yb', 2], ['yt', 3]].forEach(([name, k]) => {
    const m0 = tangent(k, i) * h, m1 = tangent(k, i + 1) * h;
    const t2 = t * t, t3 = t2 * t;
    out[name] = (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
  });
  return out;
}

/** Is a ship-local point inside the lofted hull, with `margin` metres to spare? */
export function insideHull(x, y, z, margin = 0) {
  const s = sampleStations(z);
  const yc = (s.yt + s.yb) / 2, hh = (s.yt - s.yb) / 2 - margin, hw = s.hw - margin;
  if (hw <= 0 || hh <= 0) return false;
  return Math.pow(Math.abs(x) / hw, HULL_N) + Math.pow(Math.abs(y - yc) / hh, HULL_N) <= 1;
}

/** A point on the hull surface at station z and ring angle t (0 = starboard, PI/2 = deck). */
export function hullPoint(z, t) {
  const s = sampleStations(z);
  const yc = (s.yt + s.yb) / 2, hh = (s.yt - s.yb) / 2;
  const c = Math.cos(t), sn = Math.sin(t);
  const e = 2 / HULL_N;
  return {
    x: s.hw * Math.sign(c) * Math.pow(Math.abs(c), e),
    y: yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), e),
    z,
  };
}

function buildHullMesh(mats, opts) {
  const ringN = opts.low ? 32 : 56;
  const dz = opts.low ? 1.2 : 0.7;
  const zs = [];
  for (let z = -21; z < 21 - 1e-6; z += dz) zs.push(z);
  zs.push(21);
  const rings = zs.length;
  const pos = [], uv = [], col = [], idx = [];
  const rnd = mulberry(77);
  // low-frequency mottling so the plating does not read as one flat paint job
  const mottle = (x, y, z) => 0.5 + 0.25 * Math.sin(x * 0.9 + z * 0.35) * Math.cos(y * 1.1 - z * 0.2) + 0.25 * Math.sin(z * 0.61 + y * 0.8);
  const perim = new Array(rings).fill(0);
  for (let i = 0; i < rings; i++) {
    let acc = 0, prev = null;
    for (let j = 0; j <= ringN; j++) {
      const t = (j / ringN) * Math.PI * 2;
      const p = hullPoint(zs[i], t);
      if (prev) acc += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
      pos.push(p.x, p.y, p.z);
      uv.push(acc / 8, p.z / 8);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < ringN; j++) {
    const a = i * (ringN + 1) + j, b = a + 1, c = a + ringN + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // end caps
  const capFan = (zRing, z, up) => {
    const s = sampleStations(z);
    const yc = (s.yt + s.yb) / 2;
    const cIdx = pos.length / 3;
    pos.push(0, yc, z); uv.push(0, z / 8);
    for (let j = 0; j <= ringN; j++) {
      const k = zRing * (ringN + 1) + j;
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); uv.push(pos[k * 3] / 8, pos[k * 3 + 1] / 8);
    }
    for (let j = 0; j < ringN; j++) {
      if (up) idx.push(cIdx, cIdx + 1 + j, cIdx + 2 + j);
      else idx.push(cIdx, cIdx + 2 + j, cIdx + 1 + j);
    }
  };
  capFan(rings - 1, 21, true);
  capFan(0, -21, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // colour pass: dust on top, grime underneath, orange band, mottling
  const nrm = geo.attributes.normal;
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const ny = nrm.getY(i);
    const m = 0.9 + 0.16 * mottle(x, y, z);
    let r = m, g = m, b = m;
    // Mars dust settles on upward faces
    const dust = Math.max(0, ny) * 0.32;
    r = r * (1 - dust) + 0.95 * dust; g = g * (1 - dust) + 0.72 * dust; b = b * (1 - dust) + 0.5 * dust;
    // grime under the belly
    if (ny < -0.2) { const k = Math.min(1, -ny) * 0.35; r *= 1 - k; g *= 1 - k; b *= 1 - k; }
    // paint scheme: an orange band around the forward hull and a stripe near the stern
    const band = (z > -12.4 && z < -10.6) || (z > 11.2 && z < 11.9);
    if (band) { r *= 1.0; g *= 0.52; b *= 0.28; }
    // dark nose
    if (z < -19.2) { r *= 0.42; g *= 0.44; b *= 0.46; }
    col.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, mats.hull);
  mesh.name = 'hull';
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------

export function buildExterior(layout, mats, opts = {}) {
  const low = opts.tier === 'low';
  const root = new THREE.Group(); root.name = 'ship-exterior';
  const ext = { root, legs: [], ramps: {}, guns: {}, engines: [], liftPods: [], nav: [], triangles: 0, decals: null };

  root.add(buildHullMesh(mats, { low }));

  // --- Static parts, one kit --------------------------------------------------------
  const k = new Kit();
  k.tiles = { hull: 8, metal: 1 };
  const rnd = mulberry(5);

  // bridge blister: sloped armoured skirt under the windows, roof plate, pillars
  {
    const ys = 4.6, yw = 7.05, yr = 8.72;
    // front glacis
    const zf0 = -20.4, zf1 = -19.55;
    const face = (pts, nrm) => k._faceQuadUV('hullDark', pts, nrm, null);
    // sides at x = +/- 4.3 (skirt)
    for (const s of [-1, 1]) {
      // sloped skirt from hull shoulder (x = s*5.2, y = 5.5) up to the sill (x = s*4.15)
      face([[s * 5.3, 5.5, -13.0], [s * 4.16, yw, -13.3], [s * 4.16, yw, -19.55], [s * 4.9, 5.0, -19.0]], [s, 0.6, 0]);
      // window frame top rail and roof edge
      k.bevelBox('metal', s * 4.14, yr + 0.06, (-19.6 + -13.0) / 2, 0.32, 0.22, 6.7, 0.04);
      k.bevelBox('hullDark', s * 4.1, yw + 0.02, (-19.6 + -13.3) / 2, 0.14, 0.12, 6.4, 0.02);
    }
    // front skirt
    face([[-4.9, 5.0, -19.0], [-4.16, yw, -19.55], [4.16, yw, -19.55], [4.9, 5.0, -19.0]], [0, 0.7, -1]);
    // the tapered nose glacis blending into the hull (covers the gap to the nose)
    face([[-4.9, 5.0, -19.0], [4.9, 5.0, -19.0], [4.9, 4.4, -19.4], [-4.9, 4.4, -19.4]], [0, 0, -1]);
    // roof: slightly domed, in two plates with a raised spine
    k.bevelBox('hull', 0, yr + 0.12, -16.3, 8.9, 0.24, 7.3, 0.08);
    k.bevelBox('metal', 0, yr + 0.3, -16.3, 1.4, 0.1, 5.8, 0.03);
    // sensor mast and dish on the roof
    k.cyl('metal', 0, yr + 0.9, -13.6, 0.05, 1.3, 8);
    k.bevelBox('metal', 0, yr + 1.6, -13.6, 0.5, 0.06, 0.06, 0.01);
    for (const s of [-1, 1]) { k.cyl('metal', s * 3.6, yr + 0.55, -14.3, 0.025, 0.7, 6); k.dome('metal', s * 3.6, yr + 0.9, -14.3, 0.06, 8, 4); }
    // canopy pillars, outer faces
    for (const x of [-4.14, -2.7, -1.35, 0, 1.35, 2.7, 4.14]) {
      k.pipe('metal', [x, yw - 0.04, -19.55], [x, yr, -19.55 + 0.6], 0.06, 8);
    }
  }

  // --- Dorsal blister (the turret nest) ---------------------------------------------
  {
    const yt = 8.42;
    const cx = 0.2, cz = 2.8;
    // the roof plate and a skirt down to the hull
    k.bevelBox('hull', -0.45, yt + 0.12, cz, 4.3, 0.24, 2.6, 0.08);
    for (const [x0, x1] of [[-2.7, -2.5], [1.5, 1.7]]) k.bevelBox('hullDark', (x0 + x1) / 2, 7.3, cz, 0.2, 2.3, 2.4, 0.03);
    for (const z of [1.5, 4.1]) k.bevelBox('hullDark', -0.45, 7.2, z, 4.4, 2.1, 0.16, 0.03);
    // the turret ring on the roof
    k.cyl('metal', cx, yt + 0.28, cz, 1.2, 0.16, 28);
    k.cyl('engine', cx, yt + 0.2, cz, 1.32, 0.08, 28);
  }

  // --- Sponsons and wing stubs ------------------------------------------------------
  for (const s of [-1, 1]) {
    for (const [z0, z1, w, h] of [[-17.2, -10.6, 1.9, 2.4], [10.0, 17.4, 2.0, 2.6]]) {
      const cx = s * (6.9 + w / 2 - 0.4);
      const cz = (z0 + z1) / 2;
      k.bevelBox('hull', cx, 1.1, cz, w, h, z1 - z0, 0.18);
      k.bevelBox('metal', cx, 0.0, cz, w - 0.2, 0.1, z1 - z0 - 0.4, 0.03);
      // access panels, vents
      for (let z = z0 + 0.8; z < z1 - 0.5; z += 1.6) {
        k.bevelBox('hullDark', s * (6.9 + w - 0.42), 1.5, z, 0.08, 0.6, 1.0, 0.02);
        for (let v = 0; v < 3; v++) k.box('gunmetal', s * (6.9 + w - 0.37), 0.7 + v * 0.11, z, 0.03, 0.04, 0.9);
      }
    }
    // wingtip nav lights
    k.box(s < 0 ? 'glowRed' : 'glowGreen', s * 8.86, 1.9, -13.9, 0.1, 0.16, 0.34);
    k.box(s < 0 ? 'glowRed' : 'glowGreen', s * 8.95, 1.9, 13.7, 0.1, 0.16, 0.34);
  }

  // --- Tail fins ---------------------------------------------------------------------
  for (const s of [-1, 1]) {
    const x = s * 4.2;
    const fin = [[x - 0.15, 6.6, 12.5], [x + 0.15, 6.6, 12.5], [x + 0.15, 6.6, 20.5], [x - 0.15, 6.6, 20.5]];
    // two side faces of a swept fin
    k._faceQuadUV('hull', [[x - 0.15, 6.5, 12.0], [x - 0.15, 6.5, 20.6], [x - 0.15, 10.2, 20.6], [x - 0.15, 8.6, 15.0]], [-1, 0, 0], null);
    k._faceQuadUV('hull', [[x + 0.15, 6.5, 12.0], [x + 0.15, 6.5, 20.6], [x + 0.15, 10.2, 20.6], [x + 0.15, 8.6, 15.0]], [1, 0, 0], null);
    k._faceQuadUV('metal', [[x - 0.15, 8.6, 15.0], [x + 0.15, 8.6, 15.0], [x + 0.15, 10.2, 20.6], [x - 0.15, 10.2, 20.6]], [0, 0.8, -0.6], null);
    k._faceQuadUV('hullAccent', [[x - 0.15, 10.2, 20.6], [x + 0.15, 10.2, 20.6], [x + 0.15, 6.5, 20.6], [x - 0.15, 6.5, 20.6]], [0, 0, 1], null);
    k.box(s < 0 ? 'glowRed' : 'glowGreen', x, 10.28, 20.5, 0.12, 0.12, 0.12);
  }

  // --- Dorsal detail on the hull --------------------------------------------------------
  for (const [x, z, w, d] of [[-3.0, -9.0, 1.6, 2.2], [3.0, -9.0, 1.6, 2.2], [-4.0, 7.5, 1.6, 1.4], [4.0, 7.5, 1.6, 1.4], [0, 12.0, 2.4, 1.6], [0, 15.5, 2.0, 1.4], [-4.8, -2.0, 1.4, 1.2], [4.8, 3.0, 1.4, 1.2]]) {
    const h = hullPoint(z, Math.PI / 2 + (x > 0 ? -Math.atan2(Math.abs(x), 6) : Math.atan2(Math.abs(x), 6)));
    const y = sampleStations(z).yt - Math.pow(Math.abs(x) / sampleStations(z).hw, 5) * 1.4 - 0.05;
    k.bevelBox('hullDark', x, y + 0.08, z, w, 0.16, d, 0.04);
    k.bevelBox('metal', x, y + 0.2, z, w * 0.7, 0.06, d * 0.7, 0.02);
    for (let v = 0; v < 4; v++) k.box('gunmetal', x, y + 0.245, z - d * 0.3 + v * d * 0.2, w * 0.55, 0.012, 0.03);
  }
  // antenna farm on the aft spine
  for (const [x, z, h] of [[-1.5, 14.0, 1.6], [1.5, 14.0, 1.2], [0.0, 17.5, 2.2], [-2.6, 9.0, 0.9]]) {
    k.cyl('metal', x, 6.85 + h / 2, z, 0.03, h, 6);
    k.dome('metal', x, 6.85 + h, z, 0.05, 8, 4);
  }
  // radar dish (animated separately)
  // RCS thruster blocks
  for (const [x, y, z] of [[-6.2, 6.2, -12.2], [6.2, 6.2, -12.2], [-6.9, 6.4, 8.5], [6.9, 6.4, 8.5], [-5.6, 0.2, -19.0], [5.6, 0.2, -19.0]]) {
    k.bevelBox('hullDark', x, y, z, 0.5, 0.36, 0.6, 0.05);
    for (const dx of [-0.16, 0.16]) k.cyl('engine', x + dx, y, z + 0.32, 0.06, 0.06, 8, { axis: 'z' });
  }
  // vertical lift pods under the hull
  for (const [x, z] of [[-3.8, -6.5], [3.8, -6.5], [-3.8, 6.5], [3.8, 6.5]]) {
    k.cyl('engine', x, -1.28, z, 0.85, 0.34, 20);
    k.cyl('metal', x, -1.13, z, 0.95, 0.1, 20);
    k.cyl('gunmetal', x, -1.5, z, 0.62, 0.06, 20);
    ext.liftPods.push({ x, y: -1.56, z });
  }

  // --- Engines at the stern -----------------------------------------------------------------
  {
    const zc = 21.0;
    // stern plate with the ramp opening framed
    for (const s of [-1, 1]) {
      const x = s * 3.4;
      // main engine: housing, bell, struts. Everything runs along Z, starting behind the stern plate.
      k.cyl('engine', x, 3.4, zc + 1.3, 1.5, 2.5, 24, { axis: 'z' });
      k.cyl('metal', x, 3.4, zc + 0.12, 1.62, 0.16, 24, { axis: 'z' });
      k.lathe('engine', x, 3.4, zc + 2.3, [[1.05, 0.0], [1.15, 0.4], [1.42, 1.1], [1.62, 1.7], [1.68, 2.0], [1.62, 2.0], [1.36, 1.1], [1.08, 0.4], [0.96, 0.0]], 28, { axis: 'z' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.pipe('metal', [x + Math.cos(a) * 1.5, 3.4 + Math.sin(a) * 1.5, zc + 0.3], [x + Math.cos(a) * 1.5, 3.4 + Math.sin(a) * 1.5, zc + 2.4], 0.05, 6);
      }
      // aux thrusters beside them
      const x2 = s * 5.8;
      k.cyl('engine', x2, 4.4, zc + 0.6, 0.55, 1.2, 16, { axis: 'z' });
      k.cyl('gunmetal', x2, 4.4, zc + 1.22, 0.44, 0.06, 16, { axis: 'z' });
    }
    // ramp frame
    k.bevelBox('hullDark', 0, 5.3, zc + 0.02, 4.4, 0.36, 0.34, 0.05);
    for (const s of [-1, 1]) k.bevelBox('hullDark', s * 2.05, 2.6, zc + 0.02, 0.3, 5.5, 0.34, 0.05);
    for (let i = 0; i < 9; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -1.7 + i * 0.43, 5.3, zc + 0.2, 0.22, 0.22, 0.01);
  }

  // --- Airlock hatch frame -------------------------------------------------------------------
  {
    const x = -6.6 - 0.32;   // hull skin at the airlock
    // the frame stands proud of the hull side
    for (const s of [-1, 1]) k.bevelBox('hullDark', -7.32, 1.1, -10.8 + s * 0.78, 0.22, 2.4, 0.16, 0.03);
    k.bevelBox('hullDark', -7.32, 2.32, -10.8, 0.22, 0.16, 1.7, 0.03);
    k.bevelBox('hullDark', -7.32, -0.02, -10.8, 0.22, 0.12, 1.7, 0.03);
    k.box('glowAmber', -7.44, 2.36, -10.8, 0.02, 0.06, 0.6);
  }

  // --- Chin, nose and gun housings ------------------------------------------------------------
  {
    for (const s of [-1, 1]) {
      k.bevelBox('hullDark', s * 1.55, 1.0, -20.6, 0.9, 0.8, 2.2, 0.1);
      k.bevelBox('metal', s * 1.55, 1.0, -19.2, 0.7, 0.55, 0.5, 0.06);
    }
    // nose plate lights
    k.box('glowCool', 0, 2.2, -20.9, 0.9, 0.05, 0.05);
  }

  // decals: name and registry
  if (opts.decal) {
    const m = opts.decal;
    for (const s of [-1, 1]) {
      const z0 = -6.9, z1 = 6.5;
      // placed a hair off the hull on the flank
      const x = s * (7.36 + 0.005);
      const pts = s > 0
        ? [[x, 3.6, z1], [x, 3.6, z0], [x, 4.5, z0], [x, 4.5, z1]]
        : [[x, 3.6, z0], [x, 3.6, z1], [x, 4.5, z1], [x, 4.5, z0]];
      const dk = new Kit();
      dk.poly('decal', pts, [[1, 0], [0, 0], [0, 1], [1, 1]].map((q) => (s > 0 ? q : [1 - q[0], q[1]])));
      const g = dk.toGroup({ decal: m }, { name: 'decal' });
      root.add(g);
    }
  }

  const staticGroup = k.toGroup(mats, { name: 'ext-static', cast: true, receive: true });
  ext.triangles += k.triangles;
  root.add(staticGroup);
  ext.staticGroup = staticGroup;

  // --- Landing legs (each is animated) -------------------------------------------------------------
  for (const leg of GEAR.legs) {
    const g = new THREE.Group(); g.name = 'leg:' + leg.id;
    g.position.set(leg.x, 0, leg.z);
    const kk = new Kit();
    // fixed part: the housing and upper sleeve
    kk.bevelBox('metal', 0, 0.2, 0, 0.7, 0.7, 0.7, 0.1);
    kk.cyl('engine', 0, -0.4, 0, 0.24, 1.3, 14);
    kk.cyl('metal', 0, -1.0, 0, 0.29, 0.12, 14);
    // struts to the hull
    const out = Math.sign(leg.x);
    kk.pipe('metal', [0, -0.5, 0], [-out * 0.9, 0.7, 0.0], 0.09, 8);
    kk.pipe('metal', [0, -0.5, 0], [0, 0.5, leg.z < 0 ? 0.9 : -0.9], 0.09, 8);
    const fixed = kk.toGroup(mats, { name: 'leg-fixed', cast: true, receive: true });
    g.add(fixed);
    // moving part: piston (unit height, scaled) and foot (moved)
    const pk = new Kit();
    pk.cyl('steel', 0, -0.5, 0, 0.16, 1.0, 12);      // unit height, centred at -0.5
    const pistonG = pk.toGroup(mats, { name: 'piston', cast: true });
    const piston = new THREE.Group(); piston.add(pistonG);
    g.add(piston);
    const fk = new Kit();
    fk.cyl('engine', 0, 0.12, 0, 0.26, 0.24, 12);
    fk.cyl('metal', 0, -0.1, 0, GEAR.padRadius, 0.18, 24, { r2: GEAR.padRadius * 0.9 });
    fk.cyl('rubber', 0, -0.2, 0, GEAR.padRadius * 0.95, 0.05, 24);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fk.box('hazard', Math.cos(a) * GEAR.padRadius * 0.72, -0.005, Math.sin(a) * GEAR.padRadius * 0.72, 0.16, 0.012, 0.05); }
    const foot = fk.toGroup(mats, { name: 'foot', cast: true, receive: true });
    g.add(foot);
    root.add(g);
    ext.legs.push({ id: leg.id, group: g, piston, foot, x: leg.x, z: leg.z });
  }

  // --- Ramps -----------------------------------------------------------------------------------------
  for (const key of ['cargo', 'airlock']) {
    const R = RAMPS[key];
    const hinge = new THREE.Group(); hinge.name = 'ramp:' + key;
    hinge.position.set(R.hinge.x, R.hinge.y, R.hinge.z);
    const rk = new Kit();
    rk.tiles = { 'floor:deck': 2, hull: 8, metal: 1 };
    const len = R.length, w = R.width, t = R.panel.thickness;
    // Built lying along +Z from the hinge, top face up.
    rk.bevelBox('hullDark', 0, -t / 2, len / 2, w, t, len, 0.03);
    rk.poly('floor:deck', [[-w / 2 + 0.06, 0.004, len - 0.05], [w / 2 - 0.06, 0.004, len - 0.05], [w / 2 - 0.06, 0.004, 0.05], [-w / 2 + 0.06, 0.004, 0.05]]);
    // cleats every 0.4 m, side rails, lip
    for (let z = 0.4; z < len - 0.1; z += 0.4) rk.box('metal', 0, 0.02, z, w - 0.2, 0.02, 0.05);
    for (const s of [-1, 1]) { rk.bevelBox('metal', s * (w / 2 - 0.04), 0.08, len / 2, 0.08, 0.16, len, 0.02); rk.box(key === 'cargo' ? 'glowAmber' : 'glowAmber', s * (w / 2 - 0.04), 0.17, len / 2, 0.02, 0.01, len - 0.4); }
    rk.bevelBox('metal', 0, -0.06, len, w, 0.12, 0.18, 0.02);
    const m = rk.toGroup(mats, { name: 'ramp-mesh:' + key, cast: true, receive: true });
    hinge.add(m);
    root.add(hinge);
    ext.ramps[key] = { hinge, mesh: m, def: R };
    ext.triangles += rk.triangles;
  }

  // --- Guns -----------------------------------------------------------------------------------------------
  {
    // main guns: one group per side, pivoting at the housing
    ext.guns.main = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 1.55, 1.0, -20.5);
      const kk = new Kit();
      kk.cyl('gunmetal', 0, 0, -1.3, 0.13, 2.6, 14, { axis: 'z' });
      kk.cyl('steel', 0, 0, -1.3, 0.18, 1.0, 14, { axis: 'z' });
      kk.cyl('metal', 0, 0, -2.6, 0.17, 0.3, 14, { axis: 'z' });
      for (let i = 0; i < 3; i++) kk.box('gunmetal', 0.0, 0.15, -2.55 - i * 0.05, 0.02, 0.1, 0.03);
      kk.bevelBox('hullDark', 0, 0.0, -0.1, 0.42, 0.4, 0.5, 0.04);
      kk.box('glowAmber', 0, 0.22, -0.4, 0.06, 0.02, 0.5);
      g.add(kk.toGroup(mats, { name: 'main-gun', cast: true, receive: true }));
      root.add(g);
      ext.guns.main.push({ group: g, muzzle: new THREE.Vector3(0, 0, -2.75) });
      ext.triangles += kk.triangles;
    }
    // dorsal and ventral turrets: yaw group -> pitch group -> barrels
    const turret = (id, pos, mat) => {
      const yaw = new THREE.Group(); yaw.position.set(pos.x, pos.y, pos.z);
      const pitch = new THREE.Group(); yaw.add(pitch);
      const kk = new Kit();
      kk.tiles = { hull: 8, metal: 1 };
      // yoke arms out at radius 1.5 so the barrels clear the canopy
      for (const s of [-1, 1]) {
        kk.bevelBox('hullDark', s * 1.45, 0, -0.2, 0.5, 0.6, 1.1, 0.06);
        kk.cyl('gunmetal', s * 1.45, 0.0, -1.7, 0.1, 2.2, 12, { axis: 'z' });
        kk.cyl('steel', s * 1.45, 0.0, -1.1, 0.15, 0.8, 12, { axis: 'z' });
        kk.cyl('metal', s * 1.45, 0.0, -2.8, 0.14, 0.26, 12, { axis: 'z' });
        kk.box('glowAmber', s * 1.45, 0.3, -0.2, 0.05, 0.02, 0.6);
      }
      kk.bevelBox('hullDark', 0, 0.0, 0.7, 3.1, 0.3, 0.5, 0.05);
      pitch.add(kk.toGroup(mats, { name: id + '-barrels', cast: true, receive: true }));
      ext.triangles += kk.triangles;
      root.add(yaw);
      return { yaw, pitch, muzzles: [new THREE.Vector3(-1.45, 0, -2.95), new THREE.Vector3(1.45, 0, -2.95)] };
    };
    ext.guns.dorsal = turret('dorsal', { x: 0.2, y: 8.9, z: 2.8 });
    ext.guns.ventral = turret('ventral', { x: 0.0, y: -0.35, z: -15.3 });
    // The ventral turret's hull-side mount is visible from the ground
    const vk = new Kit();
    vk.cyl('engine', 0, -0.4, -15.3, 1.6, 0.25, 26);
    vk.cyl('metal', 0, -0.55, -15.3, 1.7, 0.08, 26);
    root.add(vk.toGroup(mats, { name: 'ventral-mount', cast: true, receive: true }));
  }

  // --- Engine glow (additive, animated by thrust) --------------------------------------------------------------
  {
    const flame = (r0, r1, len) => {
      const g = new THREE.CylinderGeometry(r0, r1, len, 20, 1, true);
      g.rotateX(Math.PI / 2);          // axis along Z
      g.translate(0, 0, len / 2);
      return g;
    };
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(flame(1.1, 0.25, 7), mats.engineGlow.clone());
      m.position.set(s * 3.4, 3.4, 24.2);
      m.name = 'exhaust';
      root.add(m);
      const core = new THREE.Mesh(flame(0.65, 0.08, 4.4), mats.nozzleInner.clone());
      core.position.copy(m.position);
      root.add(core);
      ext.engines.push({ outer: m, core, side: s });
    }
    // vertical lift jets (point down)
    for (const p of ext.liftPods) {
      const g = new THREE.CylinderGeometry(0.55, 0.12, 5.5, 16, 1, true);
      g.translate(0, -2.75, 0);
      const m = new THREE.Mesh(g, mats.engineGlow.clone());
      m.position.set(p.x, p.y, p.z);
      root.add(m);
      const g2 = new THREE.CylinderGeometry(0.32, 0.05, 3.2, 12, 1, true); g2.translate(0, -1.6, 0);
      const c = new THREE.Mesh(g2, mats.nozzleInner.clone());
      c.position.copy(m.position);
      root.add(c);
      ext.liftPods[ext.liftPods.indexOf(p)].mesh = m; p.core = c;
    }
  }

  ext.tier = low ? 'low' : 'high';
  return ext;
}

/**
 * The pose the ship's size is defined in: gear at its nominal length, both ramps
 * raised, guns level. The registry measures the ship in THIS pose so a lowered
 * ramp or a compressed leg never reads as a change of size.
 */
export function applyNeutralPose(ext) {
  ext.legs.forEach((leg) => {
    leg.foot.position.y = -GEAR.nominal;
    leg.piston.scale.y = GEAR.nominal + 0.2;
    leg.piston.position.y = 0.2;
  });
  ext.ramps.cargo.hinge.rotation.set(-Math.PI / 2, 0, 0);
  ext.ramps.cargo.hinge.scale.set(1, 1, 1);
  const g = ext.ramps.airlock.hinge;
  g.scale.set(1, 1, 2.5 / RAMPS.airlock.length);
  g.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
}

/** Ship-local bounds of the exterior at rest, for the registry (measured, not authored). */
export function decalCanvasTexture(THREE_) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#20262b';
  g.font = '700 150px "Arial Narrow", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(SHIP_NAME.toUpperCase().replace('MSV ', ''), 90, 110);
  g.font = '600 56px ui-monospace, Consolas, monospace';
  g.fillText(SHIP_ID, 96, 222);
  g.fillStyle = '#c8632c';
  g.fillRect(1350, 60, 620, 26);
  g.fillRect(1350, 110, 460, 26);
  g.fillStyle = '#20262b';
  g.font = '700 84px Arial, sans-serif';
  g.fillText('01', 1700, 190);
  const t = new THREE_.CanvasTexture(c);
  t.colorSpace = THREE_.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

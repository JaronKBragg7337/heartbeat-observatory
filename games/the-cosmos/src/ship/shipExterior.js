// ============================================================================
// shipExterior.js — the hull, the wings, the gear, the guns, the engines.
//
// OWNS: everything you see of the ship from outside, and every part that moves:
//       landing legs, ramps, gun mounts, engine glow.
// DOES NOT OWN: any interior surface, or how the ship flies.
//
// THE HULL IS LOFTED FROM FLAT ARMOUR, NOT ROUNDED OFF
// ----------------------------------------------------
// The body is swept along the ship's length through a table of cross sections.
// Each section is an octagon: a vertical flank, a flat deck, a flat belly, and
// a chamfer at each shoulder. That is what makes it read as plate rather than as
// a sausage. Faces are flat-shaded, so every plate edge catches light, and the
// hull texture (2 m x 1 m panels, rivets, seams, weathering) is laid out in
// METRES so a plate is a plate along the whole ship.
//
// The interior rooms are rectangles that fit inside the octagon with margin; the
// validator checks that fit, room by room, corner by corner.
// ============================================================================

import * as THREE from 'three';
import { Kit } from './shipKit.js';
import { mulberry } from './shipTextures.js';
import { SHIP_NAME, SHIP_ID, GEAR, GUNS, RAMPS } from './shipSpec.js';

// z, half-width, keel y, deck y, top chamfer, bottom chamfer
export const HULL_STATIONS = [
  [-21.0, 0.90, 1.40, 2.60, 0.35, 0.35],
  [-19.5, 2.60, 0.60, 3.60, 0.70, 0.70],
  [-17.5, 4.60, -0.20, 4.80, 1.00, 1.00],
  [-15.0, 6.10, -0.90, 5.45, 1.20, 1.30],
  [-13.0, 7.00, -1.10, 5.85, 1.30, 1.30],
  [-9.0, 7.40, -1.10, 6.75, 1.20, 1.50],
  [-3.0, 7.50, -1.10, 6.85, 1.10, 1.50],
  [4.0, 7.50, -1.10, 6.85, 1.10, 1.50],
  [10.0, 7.20, -1.10, 6.90, 1.10, 1.50],
  [15.0, 7.10, -1.10, 6.95, 1.10, 1.50],
  [19.0, 7.00, -1.05, 6.95, 1.10, 1.40],
  [21.0, 6.80, -0.95, 6.85, 1.10, 1.30],
];

/** Cubic Hermite through the stations, for every column. */
function section(z) {
  const S = HULL_STATIONS;
  const cols = ['hw', 'yb', 'yt', 'ct', 'cb'];
  const out = {};
  if (z <= S[0][0]) { cols.forEach((c, i) => { out[c] = S[0][i + 1]; }); return out; }
  if (z >= S[S.length - 1][0]) { cols.forEach((c, i) => { out[c] = S[S.length - 1][i + 1]; }); return out; }
  let i = 0;
  while (z > S[i + 1][0]) i++;
  const a = S[i], b = S[i + 1];
  const h = b[0] - a[0], t = (z - a[0]) / h;
  const tangent = (k, idx) => {
    const p = S[Math.max(0, idx - 1)], n = S[Math.min(S.length - 1, idx + 1)];
    const dz = n[0] - p[0];
    return dz > 0 ? (n[k] - p[k]) / dz : 0;
  };
  cols.forEach((c, ci) => {
    const k = ci + 1;
    const m0 = tangent(k, i) * h, m1 = tangent(k, i + 1) * h;
    const t2 = t * t, t3 = t2 * t;
    out[c] = (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
  });
  return out;
}

/** The octagon at station z, counter-clockwise seen from +Z. */
function octagon(z, inset = 0) {
  const s = section(z);
  const hw = s.hw - inset, yb = s.yb + inset, yt = s.yt - inset;
  const ct = Math.max(0.01, s.ct - inset * 0.414), cb = Math.max(0.01, s.cb - inset * 0.414);
  return [
    [hw, yb + cb], [hw, yt - ct], [hw - ct, yt], [-(hw - ct), yt],
    [-hw, yt - ct], [-hw, yb + cb], [-(hw - cb), yb], [hw - cb, yb],
  ];
}

/** Is a ship-local point inside the hull, with `margin` metres to spare? */
export function insideHull(x, y, z, margin = 0) {
  const P = octagon(z);
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const l = Math.hypot(ex, ey);
    // inside is on the left of a CCW edge
    const d = (-(x - a[0]) * ey + (y - a[1]) * ex) / l;
    if (d < margin) return false;
  }
  return true;
}

export const hullTop = (z) => section(z).yt;
export const hullHalfWidth = (z) => section(z).hw;

function buildHullMesh(mats, opts) {
  const dz = opts.low ? 1.5 : 0.75;
  const zs = [];
  for (let z = -21; z < 21 - 1e-6; z += dz) zs.push(z);
  zs.push(21);
  const pos = [], uv = [], col = [];
  const rings = zs.map((z) => octagon(z));
  // cumulative perimeter, for continuous u across the flat faces
  const cum = rings.map((P) => {
    const c = [0];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; c.push(c[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    return c;
  });
  const push = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u / 8, v / 8); };
  const faceHash = (fi, zi) => { const t = Math.sin(fi * 12.9898 + Math.floor(zi / 3) * 78.233) * 43758.5453; return t - Math.floor(t); };
  const tints = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let f = 0; f < 8; f++) {
      const a0 = A[f], a1 = A[(f + 1) % 8], b0 = B[f], b1 = B[(f + 1) % 8];
      const ua0 = cum[i][f], ua1 = cum[i][f + 1], ub0 = cum[i + 1][f], ub1 = cum[i + 1][f + 1];
      // (a0, a1, b1) and (a0, b1, b0): outward for a counter-clockwise ring swept toward +Z
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(a1[0], a1[1], zs[i], ua1, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]);
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]); push(b0[0], b0[1], zs[i + 1], ub0, zs[i + 1]);
      const tint = 0.95 + 0.09 * faceHash(f, zs[i]);
      for (let k = 0; k < 6; k++) tints.push(tint);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();          // non-indexed: every face keeps its own flat normal
  const nrm = geo.attributes.normal;
  // A lofted quad is not quite planar where the section changes fast (the nose), and
  // its two triangles would shade differently, leaving a diagonal seam. Give both
  // triangles of every quad the same normal: the average.
  for (let q = 0; q < nrm.count; q += 6) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 6; i++) { x += nrm.getX(q + i); y += nrm.getY(q + i); z += nrm.getZ(q + i); }
    const l = Math.hypot(x, y, z) || 1;
    for (let i = 0; i < 6; i++) nrm.setXYZ(q + i, x / l, y / l, z / l);
  }
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const ny = nrm.getY(i);
    let m = tints[i];
    m *= 0.94 + 0.08 * (0.5 + 0.5 * Math.sin(x * 0.7 + z * 0.31) * Math.cos(y * 0.9 - z * 0.17));
    let r = m, g = m, b = m;
    // fine Mars dust settles on the upward faces, and only lightly
    const dust = Math.max(0, ny) * 0.14;
    r = r * (1 - dust) + 0.93 * dust; g = g * (1 - dust) + 0.78 * dust; b = b * (1 - dust) + 0.62 * dust;
    // grime under the belly
    if (ny < -0.2) { const k = Math.min(1, -ny) * 0.4; r *= 1 - k; g *= 1 - k; b *= 1 - k; }
    // paint scheme: an orange band round the forward hull and a stripe near the stern
    const band = (z > -12.2 && z < -10.8) || (z > 11.1 && z < 11.9) || (z > -6.1 && z < -5.9);
    if (band) { r *= 1.02; g *= 0.5; b *= 0.26; }
    // dark nose plating
    if (z < -19.0) { r *= 0.45; g *= 0.47; b *= 0.5; }
    col.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, mats.hull);
  mesh.name = 'hull';
  mesh.castShadow = true; mesh.receiveShadow = true;

  // end plates. The stern one has the boarding ramp's opening cut out of it.
  const caps = new THREE.Group();
  const makeCap = (z, facing, hole) => {
    const P = octagon(z);
    const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p[0], p[1])));
    if (hole) {
      const h = new THREE.Path();
      h.moveTo(hole.x0, hole.y0); h.lineTo(hole.x1, hole.y0); h.lineTo(hole.x1, hole.y1); h.lineTo(hole.x0, hole.y1); h.closePath();
      shape.holes.push(h);
    }
    const g = new THREE.ShapeGeometry(shape);
    if (facing < 0) {
      const index = g.getIndex();
      if (index) { const a = index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    }
    g.translate(0, 0, z);
    g.computeVertexNormals();
    if (facing < 0) { const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setZ(i, -1); }
    const u = g.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 8, u.getY(i) / 8);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.9), 3));
    const m = new THREE.Mesh(g, mats.hull);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  caps.add(makeCap(21, +1, { x0: -1.9, x1: 1.9, y0: 0.0, y1: 5.2 }), makeCap(-21, -1, null));
  caps.name = 'hull-caps';
  return { mesh, caps };
}

// ---------------------------------------------------------------------------

export function buildExterior(layout, mats, opts = {}) {
  const low = opts.tier === 'low';
  const root = new THREE.Group(); root.name = 'ship-exterior';
  const ext = { root, legs: [], ramps: {}, guns: {}, engines: [], liftPods: [], nav: [], triangles: 0, decals: null };

  const hull = buildHullMesh(mats, { low });
  root.add(hull.mesh, hull.caps);

  // --- Static parts, one kit --------------------------------------------------------
  const k = new Kit();
  k.tiles = { hull: 8, metal: 1 };
  const rnd = mulberry(5);
  const mirror = [-1, 1];

  // ============== dorsal armour: a spine, plates, hatches, vents ==================
  {
    for (const [z0, z1] of [[-12.0, -6.0], [-5.6, 1.0], [5.2, 12.5], [12.9, 20.0]]) {
      const zc = (z0 + z1) / 2;
      const yt = hullTop(zc);
      k.bevelBox('hull', 0, yt + 0.16, zc, 2.2, 0.32, z1 - z0, 0.08);
      k.bevelBox('hullDark', 0, yt + 0.34, zc, 1.2, 0.06, z1 - z0 - 0.6, 0.02);
    }
    for (let z = -12.0; z < 19.0; z += 3.05) {
      const yt = hullTop(z + 1.4);
      for (const s of mirror) {
        const inner = 1.6, outer = hullHalfWidth(z) - 1.6;
        const w = (outer - inner) * (0.82 + 0.16 * rnd());
        const cx = s * (inner + w / 2 + 0.05);
        k.bevelBox(rnd() < 0.35 ? 'hullDark' : 'hull', cx, yt + 0.06, z + 1.4, w, 0.12, 2.75, 0.05);
      }
    }
    for (const [x, z] of [[-3.2, -8.0], [3.4, -8.6], [-3.6, 8.0], [3.2, 7.4], [-3.4, 14.4], [3.6, 16.2]]) {
      const yt = hullTop(z) + 0.14;
      k.bevelBox('metal', x, yt + 0.06, z, 1.5, 0.12, 1.1, 0.04);
      for (let v = 0; v < 4; v++) k.box('gunmetal', x, yt + 0.13, z - 0.38 + v * 0.25, 1.2, 0.02, 0.07);
    }
    for (const [x, z, h] of [[-1.5, 14.0, 1.6], [1.5, 14.0, 1.2], [0.0, 17.5, 2.2], [-2.6, 9.0, 0.9]]) {
      const yt = hullTop(z) + 0.32;
      k.cyl('metal', x, yt + h / 2, z, 0.03, h, 6);
      k.dome('metal', x, yt + h, z, 0.05, 8, 4);
    }
    // a radar dish
    const yd = hullTop(-4.0);
    k.cyl('metal', -2.2, yd + 0.55, -4.0, 0.08, 0.5, 8);
    k.dome('metal', -2.2, yd + 1.0, -4.0, 0.7, 20, 6, { thetaMax: 1.2, scaleY: 0.45 });
    k.cyl('metal', -2.2, yd + 1.12, -4.0, 0.03, 0.4, 6);
  }

  // ============== flank armour and portholes ======================================
  {
    for (let z = -12.6; z < 19.6; z += 3.3) {
      const hw = hullHalfWidth(z + 1.4);
      const sec = section(z + 1.4);
      const hgt = (sec.yt - sec.ct) - (sec.yb + sec.cb) - 0.9;
      const cy = (sec.yt - sec.ct + sec.yb + sec.cb) / 2;
      for (const s of mirror) {
        if (Math.abs(z + 1.4 + 10.8) < 1.6 && s < 0) continue;              // the airlock hatch lives here
        k.bevelBox(rnd() < 0.3 ? 'hullDark' : 'hull', s * (hw + 0.045), cy, z + 1.4, 0.09, hgt, 3.05, 0.04);
      }
    }
    for (let z = -7.6; z < 8.4; z += 1.4) {
      const hw = hullHalfWidth(z);
      for (const s of mirror) {
        k.bevelBox('gunmetal', s * (hw + 0.115), 4.5, z, 0.05, 0.36, 0.5, 0.03);
        k.box('glowAmber', s * (hw + 0.145), 4.5, z, 0.008, 0.26, 0.4);
      }
    }
    for (const s of mirror) {
      for (let z = -4.6; z < 6.0; z += 2.0) k.box('hazard', s * (hullHalfWidth(z) + 0.07), 0.55, z, 0.02, 0.1, 0.9);
    }
  }

  // ============== wings ==============================================================
  {
    for (const s of mirror) {
      const P = [[7.0, -6.6], [11.6, 2.6], [11.6, 7.2], [7.0, 9.8]].map(([x, z]) => [s * x, z]);
      k.prism('hull', s > 0 ? P : P.slice().reverse(), 1.35, 2.35, 0.2, 0.18);
      for (let i = 0; i < 4; i++) k.bevelBox('metal', s * (8.2 + i * 0.8), 2.42, 1.6 + i * 2.6, 1.2, 0.05, 0.9, 0.02);
      const tx = s * 11.6;
      k.cyl('engine', tx, 1.85, 3.2, 0.62, 5.6, 16, { axis: 'z' });
      k.cyl('metal', tx, 1.85, 0.4, 0.66, 0.16, 16, { axis: 'z' });
      k.dome('hullDark', tx, 1.85, 0.4, 0.6, 14, 6, { thetaMin: 0, thetaMax: Math.PI / 2 });
      for (const dx of [-0.2, 0.2]) k.cyl('gunmetal', tx + dx, 1.4, -1.2, 0.045, 2.0, 8, { axis: 'z' });
      k.box(s < 0 ? 'glowRed' : 'glowGreen', tx, 2.3, 0.15, 0.22, 0.22, 0.3);
      k.box('glowWhite', tx, 1.85, 6.05, 0.2, 0.2, 0.1);
    }
  }

  // ============== leg pods under the belly ============================================
  {
    for (const l of GEAR.legs) {
      k.bevelBox('hullDark', l.x, -0.75, l.z, 1.9, 1.0, 3.0, 0.18);
      k.bevelBox('metal', l.x, -1.28, l.z, 1.3, 0.12, 2.3, 0.04);
      for (let i = -1; i <= 1; i += 2) k.box('hazard', l.x, -0.45, l.z + i * 1.2, 1.5, 0.05, 0.16);
    }
  }

  // ============== the bridge tower ====================================================
  {
    const yw = 7.05, yr = 8.72;
    // A hollow ring of armour round the bridge, NOT a solid block: the room's floor and the
    // consoles must stay visible from inside. Two side walls and a raked front wedge.
    for (const s of mirror) {
      k.bevelBox('hull', s * 4.42, (5.0 + yw) / 2, -16.2, 0.72, yw - 5.0, 7.5, 0.12);
      k.bevelBox('hullDark', s * 4.12, yw + 0.03, -16.2, 0.12, 0.08, 6.5, 0.02);
    }
    k.prism('hull', [[-4.8, -19.4], [4.8, -19.4], [3.5, -20.6], [-3.5, -20.6]].reverse(), 5.0, yw, 0.3, 0.3);
    k.bevelBox('hullDark', 0, yw - 0.28, -19.75, 6.3, 0.5, 0.5, 0.08);
    const roof = [[-4.7, -12.9], [4.7, -12.9], [4.55, -19.4], [3.4, -20.3], [-3.4, -20.3], [-4.55, -19.4]];
    k.prism('hull', roof.slice().reverse(), yr, yr + 0.34, 0.25, 0.2);
    k.bevelBox('metal', 0, yr + 0.5, -16.4, 1.5, 0.14, 5.6, 0.05);
    for (const dx of [-3.1, 3.1]) k.dome('hullDark', dx, yr + 0.34, -14.0, 0.46, 14, 6, { thetaMax: Math.PI / 2 });
    k.cyl('metal', 0, yr + 1.2, -13.4, 0.05, 1.7, 8);
    k.bevelBox('metal', 0, yr + 2.05, -13.4, 0.9, 0.06, 0.06, 0.01);
    k.bevelBox('metal', 0, yr + 1.75, -13.4, 0.5, 0.06, 0.06, 0.01);
    for (const x of [-4.2, -2.6, -1.3, 1.3, 2.6, 4.2]) k.pipe('metal', [x, yw, -19.6], [x, yr, -19.6 + 0.6], 0.06, 8);
    for (const s of mirror) {
      k.bevelBox('metal', s * 4.2, yr - 0.05, -16.3, 0.2, 0.2, 6.8, 0.04);
      k.bevelBox('metal', s * 4.2, yw + 0.05, -16.3, 0.18, 0.12, 6.4, 0.03);
      for (const z of [-19.0, -17.2, -15.4, -13.6]) k.pipe('metal', [s * 4.2, yw, z], [s * 4.2, yr, z], 0.05, 6);
    }
    k.box('glowWhite', -1.6, yw - 0.5, -20.05, 0.5, 0.1, 0.08);
    k.box('glowWhite', 1.6, yw - 0.5, -20.05, 0.5, 0.1, 0.08);
  }

  // ============== the dorsal nest (turret room) =========================================
  {
    const yt = 9.35, cx = 0.2, cz = 2.8, ys = 6.8;       // roof, and the deck it stands on
    const hgt = yt - ys, yc = (yt + ys) / 2;
    k.bevelBox('hull', -0.45, yt + 0.12, cz, 4.4, 0.24, 2.7, 0.08);
    for (const [x0, x1] of [[-2.7, -2.5], [1.5, 1.7]]) k.bevelBox('hull', (x0 + x1) / 2, yc, cz, 0.22, hgt, 2.5, 0.05);
    // fore and aft skirts stop at the sill of the glass band (6.95 + 1.0), so the gunner can see out
    for (const z of [1.45, 4.15]) k.bevelBox('hull', -0.45, (ys + 7.9) / 2, z, 4.5, 7.9 - ys, 0.18, 0.05);
    k.cyl('metal', cx, yt + 0.28, cz, 1.2, 0.16, 28);
    k.cyl('engine', cx, yt + 0.2, cz, 1.32, 0.08, 28);
  }

  // ============== tail fins ====================================================================
  {
    for (const s of mirror) {
      const x = s * 4.3;
      k._faceQuadUV('hull', [[x - 0.16, 6.9, 11.0], [x - 0.16, 6.9, 20.8], [x - 0.16, 10.6, 20.8], [x - 0.16, 8.8, 14.0]], [-1, 0, 0], null);
      k._faceQuadUV('hull', [[x + 0.16, 6.9, 11.0], [x + 0.16, 6.9, 20.8], [x + 0.16, 10.6, 20.8], [x + 0.16, 8.8, 14.0]], [1, 0, 0], null);
      k._faceQuadUV('metal', [[x - 0.16, 8.8, 14.0], [x + 0.16, 8.8, 14.0], [x + 0.16, 10.6, 20.8], [x - 0.16, 10.6, 20.8]], [0, 0.8, -0.6], null);
      k._faceQuadUV('hullAccent', [[x - 0.16, 10.6, 20.8], [x + 0.16, 10.6, 20.8], [x + 0.16, 6.9, 20.8], [x - 0.16, 6.9, 20.8]], [0, 0, 1], null);
      k._faceQuadUV('hullAccent', [[x - 0.17, 8.8, 14.0], [x - 0.17, 10.6, 20.8], [x - 0.17, 10.6, 19.0], [x - 0.17, 9.0, 14.0]], [-1, 0, 0], null);
      k.box(s < 0 ? 'glowRed' : 'glowGreen', x, 10.68, 20.7, 0.14, 0.14, 0.14);
    }
  }

  // ============== RCS blocks, lift pods ==========================================================
  {
    for (const [x, y, z] of [[-6.4, 6.3, -12.2], [6.4, 6.3, -12.2], [-6.9, 6.5, 8.5], [6.9, 6.5, 8.5], [-6.0, 0.4, -19.0], [6.0, 0.4, -19.0]]) {
      k.bevelBox('hullDark', x, y, z, 0.55, 0.4, 0.65, 0.06);
      for (const dx of [-0.17, 0.17]) k.cyl('engine', x + dx, y, z + 0.34, 0.06, 0.06, 8, { axis: 'z' });
    }
    for (const [x, z] of [[-3.8, -6.5], [3.8, -6.5], [-3.8, 6.5], [3.8, 6.5]]) {
      k.cyl('engine', x, -1.28, z, 0.85, 0.34, 20);
      k.cyl('metal', x, -1.13, z, 0.95, 0.1, 20);
      k.cyl('gunmetal', x, -1.5, z, 0.62, 0.06, 20);
      ext.liftPods.push({ x, y: -1.56, z });
    }
  }

  // ============== engines =========================================================================
  {
    const zc = 21.0;
    k.bevelBox('hullDark', -4.55, 3.4, zc + 0.12, 3.5, 6.0, 0.26, 0.06);
    k.bevelBox('hullDark', 4.55, 3.4, zc + 0.12, 3.5, 6.0, 0.26, 0.06);
    k.bevelBox('hullDark', 0, 6.35, zc + 0.12, 10.2, 1.0, 0.26, 0.06);
    for (const s of mirror) {
      const x = s * 3.6;
      k.cyl('engine', x, 3.5, zc + 1.4, 1.5, 2.5, 24, { axis: 'z' });
      k.cyl('metal', x, 3.5, zc + 0.3, 1.66, 0.16, 24, { axis: 'z' });
      k.lathe('engine', x, 3.5, zc + 2.4, [[1.05, 0.0], [1.15, 0.4], [1.42, 1.1], [1.62, 1.7], [1.68, 2.0], [1.62, 2.0], [1.36, 1.1], [1.08, 0.4], [0.96, 0.0]], 28, { axis: 'z' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.pipe('metal', [x + Math.cos(a) * 1.55, 3.5 + Math.sin(a) * 1.55, zc + 0.4], [x + Math.cos(a) * 1.55, 3.5 + Math.sin(a) * 1.55, zc + 2.5], 0.05, 6);
      }
      for (let i = 0; i < 5; i++) k.bevelBox('gunmetal', x, 3.5 + 1.72, zc + 0.9 + i * 0.32, 0.9, 0.06, 0.14, 0.02);
      const x2 = s * 5.7;
      k.cyl('engine', x2, 4.3, zc + 0.9, 0.55, 1.4, 16, { axis: 'z' });
      k.cyl('gunmetal', x2, 4.3, zc + 1.62, 0.44, 0.06, 16, { axis: 'z' });
      k.cyl('engine', x2, 1.6, zc + 0.7, 0.42, 1.0, 16, { axis: 'z' });
      k.cyl('gunmetal', x2, 1.6, zc + 1.22, 0.34, 0.06, 16, { axis: 'z' });
    }
    k.bevelBox('hullDark', 0, 5.4, zc + 0.02, 4.5, 0.4, 0.36, 0.05);
    for (const s of mirror) k.bevelBox('hullDark', s * 2.1, 2.7, zc + 0.02, 0.3, 5.5, 0.36, 0.05);
    for (let i = 0; i < 9; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -1.7 + i * 0.43, 5.4, zc + 0.22, 0.22, 0.24, 0.01);
  }

  // ============== the airlock hatch: a frame, and a lit recess ================================
  {
    const x = -(hullHalfWidth(-10.8) + 0.05);
    for (const s of mirror) k.bevelBox('hullDark', x, 1.1, -10.8 + s * 0.85, 0.26, 2.5, 0.18, 0.03);
    k.bevelBox('hullDark', x, 2.4, -10.8, 0.26, 0.18, 1.9, 0.03);
    k.bevelBox('hullDark', x, -0.02, -10.8, 0.26, 0.14, 1.9, 0.03);
    k.box('glowAmber', x - 0.14, 2.52, -10.8, 0.02, 0.06, 0.7);
    ext.airlockX = x;
  }

  // ============== nose ================================================================================
  {
    for (const s of mirror) {
      k.bevelBox('hullDark', s * 1.55, 1.0, -20.6, 0.95, 0.85, 2.3, 0.1);
      k.bevelBox('metal', s * 1.55, 1.0, -19.2, 0.75, 0.6, 0.5, 0.06);
      k.box('glowAmber', s * 1.55, 1.5, -20.9, 0.5, 0.04, 0.8);
    }
    k.bevelBox('gunmetal', 0, 2.1, -20.85, 1.3, 0.26, 0.4, 0.05);
    k.box('glowCool', 0, 2.1, -21.06, 1.0, 0.05, 0.03);
  }

  // decals: name and registry
  if (opts.decal) {
    for (const s of mirror) {
      const z0 = -6.9, z1 = 6.5;
      const x = s * (hullHalfWidth(0) + 0.2);
      // each list starts bottom-left as seen from OUTSIDE
      const pts = s > 0
        ? [[x, 3.5, z1], [x, 3.5, z0], [x, 4.4, z0], [x, 4.4, z1]]
        : [[x, 3.5, z0], [x, 3.5, z1], [x, 4.4, z1], [x, 4.4, z0]];
      const dk = new Kit();
      dk.poly('decal', pts, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      root.add(dk.toGroup({ decal: opts.decal }, { name: 'decal' }));
    }
  }

  // the fixed parts of each leg never move relative to the hull: they go in the static kit
  for (const leg of GEAR.legs) {
    k.push(leg.x, 0, leg.z, 0);
    const out = Math.sign(leg.x);
    k.bevelBox('hullDark', 0, 0.05, 0, 0.95, 0.9, 0.95, 0.14);
    k.cyl('engine', 0, -0.55, 0, 0.46, 1.5, 18);
    k.cyl('metal', 0, -1.34, 0, 0.52, 0.16, 18);
    k.cyl('gunmetal', 0, -0.2, 0, 0.52, 0.12, 18);
    k.pipe('engine', [0, -0.4, 0.0], [-out * 1.2, 0.5, 0.0], 0.17, 10);
    k.pipe('engine', [0, -0.45, 0], [0, 0.4, leg.z < 0 ? 1.4 : -1.4], 0.16, 10);
    k.cyl('metal', -out * 1.2, 0.5, 0, 0.17, 0.18, 10, { axis: 'x' });
    k.pipe('pipeYellow', [0.34, -0.15, 0.0], [0.34, -1.2, 0.0], 0.03, 6);
    k.cyl('hazard', 0, -0.95, 0, 0.475, 0.16, 18);
    k.pop();
  }

  const staticGroup = k.toGroup(mats, { name: 'ext-static', cast: true, receive: true });
  ext.triangles += k.triangles;
  root.add(staticGroup);
  ext.staticGroup = staticGroup;

  // ============== landing legs ======================================================================
  for (const leg of GEAR.legs) {
    const g = new THREE.Group(); g.name = 'leg:' + leg.id;
    g.position.set(leg.x, 0, leg.z);
    const pk = new Kit();
    pk.cyl('steel', 0, -0.5, 0, 0.31, 1.0, 16);       // unit height, centred at -0.5
    const piston = new THREE.Group(); piston.add(pk.toGroup(mats, { name: 'piston', cast: true }));
    g.add(piston);
    const fk = new Kit();
    fk.bevelBox('engine', 0, 0.16, 0, 0.5, 0.32, 0.5, 0.06);
    fk.cyl('metal', 0, -0.1, 0, GEAR.padRadius, 0.2, 24, { r2: GEAR.padRadius * 0.9 });
    fk.cyl('rubber', 0, -0.22, 0, GEAR.padRadius * 0.96, 0.06, 24);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fk.box('hazard', Math.cos(a) * GEAR.padRadius * 0.7, 0.02, Math.sin(a) * GEAR.padRadius * 0.7, 0.18, 0.012, 0.06); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; fk.pipe('engine', [0, 0.1, 0], [Math.cos(a) * 0.62, -0.04, Math.sin(a) * 0.62], 0.06, 6); }
    const foot = fk.toGroup(mats, { name: 'foot', cast: true, receive: true });
    g.add(foot);
    root.add(g);
    ext.legs.push({ id: leg.id, group: g, piston, foot, x: leg.x, z: leg.z });
  }

  // ============== ramps =================================================================================
  for (const key of ['cargo', 'airlock']) {
    const R = RAMPS[key];
    const hinge = new THREE.Group(); hinge.name = 'ramp:' + key;
    hinge.position.set(R.hinge.x, R.hinge.y, R.hinge.z);
    const rk = new Kit();
    rk.tiles = { 'floor:deck': 2, hull: 8, metal: 1 };
    const len = R.length, w = R.width, t = R.panel.thickness;
    rk.bevelBox('hullDark', 0, -t / 2, len / 2, w, t, len, 0.03);
    rk.poly('floor:deck', [[-w / 2 + 0.06, 0.004, len - 0.05], [w / 2 - 0.06, 0.004, len - 0.05], [w / 2 - 0.06, 0.004, 0.05], [-w / 2 + 0.06, 0.004, 0.05]]);
    for (let z = 0.4; z < len - 0.1; z += 0.4) rk.box('metal', 0, 0.02, z, w - 0.2, 0.02, 0.05);
    for (const s of [-1, 1]) { rk.bevelBox('metal', s * (w / 2 - 0.04), 0.08, len / 2, 0.08, 0.16, len, 0.02); rk.box('glowAmber', s * (w / 2 - 0.04), 0.17, len / 2, 0.02, 0.01, len - 0.4); }
    rk.bevelBox('metal', 0, -0.06, len, w, 0.12, 0.18, 0.02);
    if (key === 'cargo') for (let i = 0; i < 6; i++) rk.box(i % 2 ? 'hazard' : 'gunmetal', 0, -t - 0.004, 0.5 + i * 0.5, w - 0.3, 0.008, 0.25);
    const m = rk.toGroup(mats, { name: 'ramp-mesh:' + key, cast: true, receive: true });
    hinge.add(m);
    root.add(hinge);
    ext.ramps[key] = { hinge, mesh: m, def: R };
    ext.triangles += rk.triangles;
  }

  // ============== guns ====================================================================================
  {
    ext.guns.main = [];
    for (const s of mirror) {
      const g = new THREE.Group(); g.position.set(s * 1.55, 1.0, -20.5);
      const kk = new Kit();
      kk.cyl('gunmetal', 0, 0, -1.3, 0.14, 2.6, 14, { axis: 'z' });
      kk.cyl('steel', 0, 0, -1.3, 0.2, 1.0, 14, { axis: 'z' });
      kk.cyl('metal', 0, 0, -2.6, 0.18, 0.3, 14, { axis: 'z' });
      for (let i = 0; i < 3; i++) kk.box('gunmetal', 0.0, 0.16, -2.55 - i * 0.05, 0.02, 0.1, 0.03);
      kk.bevelBox('hullDark', 0, 0.0, -0.1, 0.45, 0.42, 0.5, 0.04);
      kk.box('glowAmber', 0, 0.23, -0.4, 0.06, 0.02, 0.5);
      g.add(kk.toGroup(mats, { name: 'main-gun', cast: true, receive: true }));
      root.add(g);
      ext.guns.main.push({ group: g, muzzle: new THREE.Vector3(0, 0, -2.75) });
      ext.triangles += kk.triangles;
    }
    const turret = (id, pos) => {
      const yaw = new THREE.Group(); yaw.position.set(pos.x, pos.y, pos.z);
      const pitch = new THREE.Group(); yaw.add(pitch);
      const kk = new Kit();
      kk.tiles = { hull: 8, metal: 1 };
      for (const s of mirror) {
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
    ext.guns.dorsal = turret('dorsal', { x: 0.2, y: 9.9, z: 2.8 });
    ext.guns.ventral = turret('ventral', { x: 0.0, y: -1.75, z: -15.3 });
    // the ventral mount is a RING under the belly, open in the middle so the gunner can see down
    const vk = new Kit();
    vk.lathe('engine', 0, -1.2, -15.3, [[1.3, 0.12], [1.95, 0.12], [1.95, -0.08], [1.3, -0.08]], 32);
    vk.lathe('metal', 0, -1.2, -15.3, [[1.28, 0.14], [1.97, 0.14]], 32);
    root.add(vk.toGroup(mats, { name: 'ventral-mount', cast: true, receive: true }));
  }

  // ============== engine glow, additive, driven by thrust ===================================================
  {
    const flame = (r0, r1, len) => {
      const g = new THREE.CylinderGeometry(r0, r1, len, 20, 1, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, len / 2);
      return g;
    };
    for (const s of mirror) {
      const m = new THREE.Mesh(flame(1.1, 0.25, 7), mats.engineGlow.clone());
      m.position.set(s * 3.6, 3.5, 24.4);
      m.name = 'exhaust';
      root.add(m);
      const core = new THREE.Mesh(flame(0.65, 0.08, 4.4), mats.nozzleInner.clone());
      core.position.copy(m.position);
      root.add(core);
      ext.engines.push({ outer: m, core, side: s });
    }
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
      p.mesh = m; p.core = c;
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

/** The name and registry number painted on the flank. */
export function decalCanvasTexture(THREE_) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#1c2228';
  g.font = '800 168px "Arial Narrow", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(SHIP_NAME.toUpperCase().replace('MSV ', ''), 90, 108);
  g.font = '600 52px ui-monospace, Consolas, monospace';
  g.fillText(SHIP_ID, 96, 216);
  g.fillStyle = '#c8632c';
  g.fillRect(1240, 46, 700, 30);
  g.fillRect(1240, 96, 520, 30);
  g.fillStyle = '#1c2228';
  g.font = '800 96px Arial, sans-serif';
  g.fillText('01', 1790, 188);
  const t = new THREE_.CanvasTexture(c);
  t.colorSpace = THREE_.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ============================================================================
// ships/raider/exterior.js - the raider's hull, wings, gear, guns and engines.
//
// OWNS: everything you see of a Shrike from outside, and every part that moves: landing legs, ramps, gun mounts, engine glow.
// DOES NOT OWN: any interior surface (src/ship/shipInterior.js draws the rooms from spec.js), or how it flies.
//
// Built the way the Meridian is (src/ship/shipExterior.js): the body is LOFTED from flat armour through the table of cross sections in
// spec.js, so it reads as plate, not as a sausage, and the part list the rest of the game animates is the same list:
//   ext = { root, legs[], ramps{cargo, airlock}, guns{main[], dorsal}, engines[], liftPods[], ... }
// Every position comes from spec.js (a gear leg is where GEAR says it is, a muzzle where GUNS says), never from a second table.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { mulberry, Layers, enableDepthLift } from '../../ship/shipTextures.js';
import { HULL, HULL_STATIONS, GEAR, GUNS, RAMPS, RAIDER_CLASS, SEATS, LAYOUT } from './spec.js';

export { HULL_STATIONS };
const hullTop = (z) => HULL.top(z);
const hullHalfWidth = (z) => HULL.halfWidth(z);

function buildHullMesh(mats, opts) {
  const dz = opts.low ? 1.5 : 0.75;
  const zs = [];
  for (let z = HULL.z0; z < HULL.z1 - 1e-6; z += dz) zs.push(z);
  zs.push(HULL.z1);
  const pos = [], uv = [], col = [];
  const rings = zs.map((z) => HULL.octagon(z));
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
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(a1[0], a1[1], zs[i], ua1, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]);
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]); push(b0[0], b0[1], zs[i + 1], ub0, zs[i + 1]);
      const tint = 0.95 + 0.09 * faceHash(f, zs[i]);
      for (let k = 0; k < 6; k++) tints.push(tint);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  // both triangles of every quad share the average normal (no diagonal seam where the section changes fast)
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
    // Scorched charcoal, red primer where a plate was replaced, black where the engines cooked the skin.
    // Bands stay: one behind the canopy, one across the stern. Numbers are the vertex colours the looks check measures.
    const panel = Math.floor((z + 20) / 2.2) * 11 + Math.floor(x * 1.3 + (y > 1.2 ? 5 : 0));
    const h = faceHash(panel, 0), h2 = faceHash(panel + 19, 9);
    const band = (z > -9.4 && z < -7.2) || (z > 11.6 && z < 13.6);
    const scorch = z > 13.15 || h2 < 0.08 || (ny < -0.35 && z > 9);
    let r, g, b;
    if (scorch) { r = 0.05; g = 0.045; b = 0.04; }
    else if (band || h > 0.8) { r = 0.86; g = 0.15; b = 0.1; }
    else {
      const tone = (0.28 + 0.1 * h) * (0.94 + 0.08 * (m - 0.95));
      r = tone * 0.94; g = tone * 0.98; b = tone;
    }
    col.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, mats.hull);
  mesh.name = 'hull';
  mesh.castShadow = true; mesh.receiveShadow = true;

  const caps = new THREE.Group();
  const makeCap = (z, facing, hole) => {
    const P = HULL.octagon(z);
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
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.32), 3));
    const m = new THREE.Mesh(g, mats.hull);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const ramp = RAMPS.cargo;
  caps.add(makeCap(HULL.z1, +1, { x0: -ramp.width / 2 - 0.1, x1: ramp.width / 2 + 0.1, y0: 0.0, y1: ramp.raisedHeight }), makeCap(HULL.z0, -1, null));
  caps.name = 'hull-caps';
  return { mesh, caps };
}

// ---------------------------------------------------------------------------

/** Dark armour tile for the Shrike. The Meridian's paintHull stays pale; this one is only assigned to a cloned hull material. */
function paintRaiderHull(pxPerM, seed) {
  const L = new Layers(8, 8, pxPerM, seed);
  const rnd = L.rnd;
  L.fill({ c: '#3c4146', h: 78, r: 0.72, m: 0.48 });
  const tones = ['#454b50', '#3a342f', '#2e3236', '#514840', '#3d2c2a', '#34383c', '#5a4038', '#26282b', '#4a4e52'];
  const rowH = 1.0;
  for (let j = 0; j < 8; j++) {
    const off = (j % 2) * 1.0;
    for (let i = -1; i < 5; i++) {
      const x = i * 2.0 + off, y = j * rowH;
      const roll = rnd();
      const tone = roll < 0.14 ? '#7a2a22' : roll < 0.22 ? '#1a1816' : roll < 0.34 ? '#6e726e' : tones[Math.floor(rnd() * tones.length)];
      L.rect(x + 0.012, y + 0.012, 1.976, rowH - 0.024, { c: tone, h: 60 + rnd() * 40, r: 0.55 + rnd() * 0.3, m: 0.35 + rnd() * 0.4 });
      L.rect(x, y, 2.0, 0.014, { c: '#121416', h: 30, r: 0.85, m: 0.2 });
      L.rect(x, y, 0.014, rowH, { c: '#121416', h: 30, r: 0.85, m: 0.2 });
      if (rnd() < 0.35) {
        const cx = x + rnd() * 1.6, cy = y + rnd() * 0.7;
        L.rect(cx, cy, 0.08 + rnd() * 0.35, 0.04, { c: '#141210', h: 24, r: 0.9, m: 0.15, a: 0.85 });
      }
    }
  }
  L.streaks(28, 0.03, 0.4, 2.2, { c: '#100e0c', a: 0.45, r: 0.9 });
  L.streaks(12, 0.02, 0.3, 1.2, { c: '#8a2e24', a: 0.35, r: 0.7 });
  L.speckle(900, 0.006, 0.02, { c: '#1a1816', a: 0.4, jitter: 1 });
  return L.finish(2.4);
}

/**
 * A real 2D canvas. The validator installs a stand-in `document` for the hiring board, and that stand-in's
 * getContext answers every call with undefined. `typeof document` is then true, and painting would throw.
 * The Meridian's painter decided this once, at import, before that stand-in exists. Match the outcome here.
 */
function canvasPaints() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  try {
    const c = document.createElement('canvas');
    const g = c && c.getContext && c.getContext('2d');
    if (!g || typeof g.getImageData !== 'function') return false;
    const img = g.getImageData(0, 0, 1, 1);
    return !!(img && img.data && img.data.length);
  } catch {
    return false;
  }
}

/** Clone every material. The caller's set is what the Meridian is built with next; nothing here may write into it. */
function raiderFinish(matsIn, opts) {
  const mats = {};
  for (const k of Object.keys(matsIn)) {
    if (k === '_textures') { mats[k] = matsIn[k]; continue; }
    mats[k] = matsIn[k] && matsIn[k].clone ? matsIn[k].clone() : matsIn[k];
  }
  const hull = mats.hull;
  if (hull) {
    if (canvasPaints()) {
      const tex = paintRaiderHull(opts.tier === 'low' ? 40 : 72, 91);
      hull.map = tex.albedo; hull.normalMap = tex.normal;
      hull.roughnessMap = tex.orm; hull.metalnessMap = tex.orm;
      hull.normalScale = new THREE.Vector2(1.15, 1.15);
      hull.color.setHex(0xffffff); hull.roughness = 1; hull.metalness = 1;
    } else {
      hull.map = null; hull.normalMap = null; hull.roughnessMap = null; hull.metalnessMap = null;
      hull.color.setHex(0x5c6166); hull.roughness = 0.72; hull.metalness = 0.42;
    }
    hull.needsUpdate = true;
  }
  if (mats.hullAccent) mats.hullAccent.color.setHex(0x8e1e18);
  if (mats.hullStripe) mats.hullStripe.color.setHex(0x141414);
  if (mats.engineGlow) mats.engineGlow.color.setHex(0xff6a3a);
  for (const k of Object.keys(mats)) enableDepthLift(mats[k]);
  return mats;
}

/** Dusk walls, dark decks, blood-red hazard tape. Called on the interior material set only. */
export function applyRaiderInteriorPalette(mats) {
  if (!mats) return mats;
  for (const k of Object.keys(mats)) {
    if (!mats[k] || !mats[k].color) continue;
    if (k.startsWith('wall:')) mats[k].color.setHex(0x6a5348);
    else if (k.startsWith('floor:')) mats[k].color.setHex(0x4a403c);
  }
  if (mats.ceil && mats.ceil.color) mats.ceil.color.setHex(0x3e3a38);
  if (mats.hazard && mats.hazard.color) mats.hazard.color.setHex(0x8e1e18);
  return mats;
}

export function buildRaiderExterior(layout, matsIn, opts = {}) {
  const mats = raiderFinish(matsIn, opts);
  const low = opts.tier === 'low';
  const root = new THREE.Group(); root.name = 'ship-exterior';
  const ext = { root, legs: [], ramps: {}, guns: {}, engines: [], liftPods: [], nav: [], triangles: 0, decals: null, type: 'raider' };

  const hull = buildHullMesh(mats, { low });
  root.add(hull.mesh, hull.caps);

  const k = new Kit();
  k.tiles = { hull: 8, metal: 1 };
  const rnd = mulberry(11);
  const mirror = [-1, 1];

  // ============== dorsal armour: a spine, plates, vents ===========================================
  {
    for (const [z0, z1] of [[-7.2, -2.4], [5.0, 9.4], [9.8, 15.6]]) {
      const zc = (z0 + z1) / 2, yt = hullTop(zc);
      k.bevelBox('hull', 0, yt + 0.12, zc, 1.8, 0.24, z1 - z0, 0.07);
      k.bevelBox('hullDark', 0, yt + 0.27, zc, 0.9, 0.05, z1 - z0 - 0.5, 0.02);
    }
    for (let z = -7.2; z < 15.0; z += 2.6) {
      if (z > 0.6 && z < 4.6) continue;                                  // the turret nest stands here
      const yt = hullTop(z + 1.2);
      for (const s of mirror) {
        const inner = 1.4, outer = hullHalfWidth(z) - 1.3;
        const w = (outer - inner) * (0.8 + 0.16 * rnd());
        k.bevelBox(rnd() < 0.35 ? 'hullDark' : 'hull', s * (inner + w / 2 + 0.05), yt + 0.05, z + 1.2, w, 0.1, 2.3, 0.05);
      }
    }
    for (const [x, z] of [[-2.8, -6.2], [2.9, -5.4], [-3.0, 7.0], [3.0, 11.0]]) {
      const yt = hullTop(z) + 0.1;
      k.bevelBox('metal', x, yt + 0.06, z, 1.2, 0.1, 0.9, 0.04);
      for (let v = 0; v < 4; v++) k.box('gunmetal', x, yt + 0.12, z - 0.3 + v * 0.2, 0.95, 0.02, 0.06);
    }
    // whip aerials, and a radar dish like the Meridian carries
    for (const [x, z, h] of [[-2.0, 11.0, 2.4], [2.2, 13.0, 1.6], [0.0, -6.0, 1.1]]) {
      const yt = hullTop(z) + 0.2;
      k.cyl('metal', x, yt + h / 2, z, 0.025, h, 6);
      k.dome('metal', x, yt + h, z, 0.04, 8, 4);
    }
    const yd = hullTop(-5.0) + 0.1;
    k.cyl('metal', 2.4, yd + 0.4, -5.0, 0.07, 0.4, 8);
    k.dome('metal', 2.4, yd + 0.78, -5.0, 0.55, 18, 6, { thetaMax: 1.2, scaleY: 0.45 });
  }

  // ============== flank armour and portholes ==========================================================
  {
    for (let z = -7.4; z < 15.0; z += 2.7) {
      const hw = hullHalfWidth(z + 1.2);
      const sec = HULL.section(z + 1.2);
      const hgt = (sec.yt - sec.ct) - (sec.yb + sec.cb) - 0.7;
      const cy = (sec.yt - sec.ct + sec.yb + sec.cb) / 2;
      for (const s of mirror) {
        if (Math.abs(z + 1.2 - 0.6) < 1.4 && s < 0) continue;              // the airlock hatch lives here
        k.bevelBox(rnd() < 0.3 ? 'hullDark' : 'hull', s * (hw + 0.04), cy, z + 1.2, 0.08, hgt, 2.5, 0.04);
      }
    }
    for (let z = -6.2; z < 9.4; z += 1.3) {
      const hw = hullHalfWidth(z);
      for (const s of mirror) {
        k.bevelBox('gunmetal', s * (hw + 0.1), 1.8, z, 0.05, 0.3, 0.45, 0.03);
        k.box('glowRed', s * (hw + 0.13), 1.8, z, 0.008, 0.2, 0.34);
      }
    }
    for (const s of mirror) for (let z = -3.4; z < 8.0; z += 2.2) k.box('red', s * (hullHalfWidth(z) + 0.06), 0.05, z, 0.02, 0.1, 0.8);
  }

  // ============== swept wings with engine pods at the tips ============================================
  {
    for (const s of mirror) {
      const P = [[5.0, -3.6], [8.6, 5.4], [8.6, 8.4], [5.0, 8.6]].map(([x, z]) => [s * x, z]);
      k.prism('hull', s > 0 ? P : P.slice().reverse(), 0.55, 1.1, 0.16, 0.14);
      for (let i = 0; i < 3; i++) k.bevelBox('metal', s * (6.0 + i * 0.8), 1.15, 0.6 + i * 2.6, 1.0, 0.04, 0.8, 0.02);
      const tx = s * 8.6;
      k.cyl('engine', tx, 0.85, 6.4, 0.5, 4.0, 14, { axis: 'z' });
      k.cyl('metal', tx, 0.85, 4.4, 0.54, 0.14, 14, { axis: 'z' });
      k.dome('hullDark', tx, 0.85, 4.4, 0.5, 12, 5, { thetaMin: 0, thetaMax: Math.PI / 2 });
      k.box(s < 0 ? 'glowRed' : 'glowGreen', tx, 1.38, 4.6, 0.18, 0.18, 0.24);
      k.box('glowWhite', tx, 0.85, 8.45, 0.16, 0.16, 0.08);
      for (const dx of [-0.16, 0.16]) k.cyl('gunmetal', tx + dx, 0.5, 2.4, 0.04, 1.8, 8, { axis: 'z' });   // a pair of wing guns, for show
    }
  }

  // ============== canards beside the cockpit =================================================================
  for (const s of mirror) {
    const P = [[4.4, -11.6], [6.4, -9.6], [6.4, -8.9], [4.4, -8.8]].map(([x, z]) => [s * x, z]);
    k.prism('hullDark', s > 0 ? P : P.slice().reverse(), 0.42, 0.7, 0.1, 0.08);
  }

  // ============== leg pods under the belly ===================================================================
  for (const l of GEAR.legs) {
    k.bevelBox('hullDark', l.x, -0.7, l.z, 1.5, 0.8, 2.4, 0.15);
    k.bevelBox('metal', l.x, -1.12, l.z, 1.1, 0.1, 1.9, 0.04);
    for (let i = -1; i <= 1; i += 2) k.box('red', l.x, -0.42, l.z + i * 0.95, 1.2, 0.05, 0.14);
  }

  // ============== the cockpit canopy: armoured frame, roof, nose cannon housings ===========================
  {
    const C = LAYOUT.roomById.get('cockpit');
    const ys = C.y + 1.05, yr = C.y + C.h;
    for (const s of mirror) {
      // side rails and posts (the glass between them is in the interior scene; the remote view adds its own, below)
      k.bevelBox('hull', s * (C.x1 + 0.12), (ys + yr) / 2 - 0.05, (C.z0 + C.z1) / 2 + 0.2, 0.2, 0.14, C.z1 - C.z0, 0.03);
      for (const z of [C.z0 - 0.1, C.z0 + 1.2, C.z0 + 2.4, C.z1 - 0.3]) k.bevelBox('hull', s * (C.x1 + 0.1), (ys + yr) / 2, z, 0.16, yr - ys, 0.16, 0.03);
    }
    k.bevelBox('hullDark', 0, yr + 0.06, (C.z0 + C.z1) / 2 + 0.1, C.x1 * 2 + 0.5, 0.2, C.z1 - C.z0 + 0.6, 0.06);        // the roof plate
    k.bevelBox('metal', 0, yr + 0.22, -10.6, 1.4, 0.1, 2.4, 0.04);
    for (const x of [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4]) k.pipe('metal', [x, ys, C.z0 - 0.05], [x, yr, C.z0 + 0.5], 0.05, 6);
    k.bevelBox('hullDark', 0, ys - 0.06, C.z0 - 0.3, C.x1 * 2 + 0.4, 0.2, 0.5, 0.05);                                 // the brow under the windscreen
    k.box('glowWhite', -1.2, yr - 0.12, C.z0 - 0.05, 0.4, 0.07, 0.06);
    k.box('glowWhite', 1.2, yr - 0.12, C.z0 - 0.05, 0.4, 0.07, 0.06);
    for (const s of mirror) {
      k.bevelBox('hullDark', s * 0.85, 0.6, -15.4, 0.8, 0.7, 2.2, 0.08);
      k.bevelBox('metal', s * 0.85, 0.6, -14.3, 0.62, 0.55, 0.4, 0.05);
      k.box('glowRed', s * 0.85, 1.0, -15.8, 0.4, 0.04, 0.6);
    }
    k.bevelBox('gunmetal', 0, 0.45, -16.6, 0.6, 0.22, 0.4, 0.04);
    k.box('glowCool', 0, 0.45, -16.82, 0.4, 0.04, 0.03);
  }

  // ============== the dorsal nest =============================================================================
  {
    const N = LAYOUT.roomById.get('turret');
    const ys = N.y, yp = N.y + 0.65, yt = N.y + N.h;
    const cx = (N.x0 + N.x1) / 2, cz = (N.z0 + N.z1) / 2;
    k.bevelBox('hull', cx, yt + 0.12, cz, N.x1 - N.x0 + 0.5, 0.24, N.z1 - N.z0 + 0.4, 0.07);
    for (const [x0, x1] of [[N.x0 - 0.1, N.x0 + 0.1], [N.x1 - 0.1, N.x1 + 0.1]]) k.bevelBox('hull', (x0 + x1) / 2, (ys + yp) / 2, cz, 0.22, yp - ys, N.z1 - N.z0, 0.05);
    for (const z of [N.z0 - 0.05, N.z1 + 0.05]) k.bevelBox('hull', cx, (ys + yp) / 2, z, N.x1 - N.x0, yp - ys, 0.18, 0.05);
    for (const x of [N.x0, N.x1]) for (const z of [N.z0 - 0.05, N.z1 + 0.05]) k.bevelBox('hull', x, (yp + yt) / 2, z, 0.2, yt - yp, 0.2, 0.04);
    k.cyl('metal', GUNS.dorsal.pivot.x, yt + 0.3, GUNS.dorsal.pivot.z, 0.95, 0.14, 24);
    k.cyl('engine', GUNS.dorsal.pivot.x, yt + 0.22, GUNS.dorsal.pivot.z, 1.06, 0.08, 24);
  }

  // ============== tail fins ======================================================================================
  for (const s of mirror) {
    const x = s * 3.7;
    k._faceQuadUV('hull', [[x - 0.14, 3.7, 9.4], [x - 0.14, 3.7, 16.4], [x - 0.14, 7.0, 16.4], [x - 0.14, 5.6, 11.6]], [-1, 0, 0], null);
    k._faceQuadUV('hull', [[x + 0.14, 3.7, 9.4], [x + 0.14, 3.7, 16.4], [x + 0.14, 7.0, 16.4], [x + 0.14, 5.6, 11.6]], [1, 0, 0], null);
    k._faceQuadUV('metal', [[x - 0.14, 5.6, 11.6], [x + 0.14, 5.6, 11.6], [x + 0.14, 7.0, 16.4], [x - 0.14, 7.0, 16.4]], [0, 0.8, -0.6], null);
    k._faceQuadUV('hullAccent', [[x - 0.14, 7.0, 16.4], [x + 0.14, 7.0, 16.4], [x + 0.14, 3.7, 16.4], [x - 0.14, 3.7, 16.4]], [0, 0, 1], null);
    k._faceQuadUV('hullAccent', [[x - 0.15, 5.6, 11.6], [x - 0.15, 7.0, 16.4], [x - 0.15, 7.0, 15.0], [x - 0.15, 5.8, 11.6]], [-1, 0, 0], null);
    k.box(s < 0 ? 'glowRed' : 'glowGreen', x, 7.08, 16.3, 0.12, 0.12, 0.12);
  }

  // ============== RCS blocks and lift pods ============================================================================
  {
    for (const [x, y, z] of [[-4.9, 0.9, -9.6], [4.9, 0.9, -9.6], [-5.0, 3.8, 12.4], [5.0, 3.8, 12.4], [-1.5, 0.3, -16.0], [1.5, 0.3, -16.0]]) {
      k.bevelBox('hullDark', x, y, z, 0.5, 0.36, 0.55, 0.06);
      for (const dx of [-0.14, 0.14]) k.cyl('engine', x + dx, y, z + 0.3, 0.05, 0.05, 8, { axis: 'z' });
    }
    for (const [x, z] of [[-3.0, -4.6], [3.0, -4.6], [-3.0, 7.0], [3.0, 7.0]]) {
      k.cyl('engine', x, -0.78, z, 0.7, 0.3, 18);
      k.cyl('metal', x, -0.64, z, 0.78, 0.09, 18);
      k.cyl('gunmetal', x, -0.95, z, 0.52, 0.05, 18);
      ext.liftPods.push({ x, y: -1.0, z });
    }
  }

  // ============== the main engines, either side of the ramp ====================================================
  {
    const zc = HULL.z1;
    k.bevelBox('hullDark', -3.3, 1.55, zc + 0.1, 2.6, 3.1, 0.22, 0.05);
    k.bevelBox('hullDark', 3.3, 1.55, zc + 0.1, 2.6, 3.1, 0.22, 0.05);
    k.bevelBox('hullDark', 0, 3.05, zc + 0.1, 8.8, 0.7, 0.22, 0.05);
    for (const s of mirror) {
      const x = s * 3.2;
      k.cyl('engine', x, 1.6, zc + 1.0, 1.0, 1.8, 20, { axis: 'z' });
      k.cyl('metal', x, 1.6, zc + 0.2, 1.1, 0.14, 20, { axis: 'z' });
      k.lathe('engine', x, 1.6, zc + 1.8, [[0.72, 0.0], [0.8, 0.3], [0.96, 0.8], [1.08, 1.2], [1.12, 1.4], [1.06, 1.4], [0.9, 0.8], [0.74, 0.3], [0.66, 0.0]], 24, { axis: 'z' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.pipe('metal', [x + Math.cos(a) * 1.05, 1.6 + Math.sin(a) * 1.05, zc + 0.3], [x + Math.cos(a) * 1.05, 1.6 + Math.sin(a) * 1.05, zc + 1.8], 0.04, 6);
      }
      for (let i = 0; i < 4; i++) k.bevelBox('gunmetal', x, 1.6 + 1.18, zc + 0.6 + i * 0.28, 0.7, 0.05, 0.12, 0.02);
    }
    for (let i = 0; i < 7; i++) k.box(i % 2 ? 'red' : 'gunmetal', -1.2 + i * 0.4, 3.05, zc + 0.22, 0.2, 0.2, 0.01);
  }

  // ============== the airlock hatch: a frame, and a lit recess =====================================================
  {
    const x = -(hullHalfWidth(0.6) + 0.05), z = RAMPS.airlock.hinge.z;
    for (const s of mirror) k.bevelBox('hullDark', x, 1.1, z + s * 0.8, 0.26, 2.4, 0.16, 0.03);
    k.bevelBox('hullDark', x, 2.3, z, 0.26, 0.16, 1.8, 0.03);
    k.bevelBox('hullDark', x, -0.02, z, 0.26, 0.12, 1.8, 0.03);
    k.box('glowAmber', x - 0.14, 2.42, z, 0.02, 0.06, 0.6);
    ext.airlockX = x;
  }

  // ============== decals: the boat name and its registry =====================================================================
  if (opts.decal) {
    for (const s of mirror) {
      const z0 = -6.4, z1 = 6.0;
      const x = s * (hullHalfWidth(0) + 0.14);
      const pts = s > 0
        ? [[x, 1.5, z1], [x, 1.5, z0], [x, 2.35, z0], [x, 2.35, z1]]
        : [[x, 1.5, z0], [x, 1.5, z1], [x, 2.35, z1], [x, 2.35, z0]];
      const dk = new Kit();
      dk.poly('decal', pts, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      root.add(dk.toGroup({ decal: opts.decal }, { name: 'decal' }));
    }
  }

  // the fixed parts of each leg never move relative to the hull: they go in the static kit
  for (const leg of GEAR.legs) {
    k.push(leg.x, 0, leg.z, 0);
    const out = Math.sign(leg.x);
    k.bevelBox('hullDark', 0, 0.05, 0, 0.8, 0.8, 0.8, 0.12);
    k.cyl('engine', 0, -0.5, 0, 0.38, 1.3, 16);
    k.cyl('metal', 0, -1.16, 0, 0.44, 0.14, 16);
    k.cyl('gunmetal', 0, -0.2, 0, 0.44, 0.1, 16);
    k.pipe('engine', [0, -0.4, 0.0], [-out * 0.9, 0.4, 0.0], 0.14, 10);
    k.pipe('engine', [0, -0.45, 0], [0, 0.35, leg.z < 0 ? 1.1 : -1.1], 0.13, 10);
    k.cyl('metal', -out * 0.9, 0.4, 0, 0.14, 0.16, 10, { axis: 'x' });
    k.pipe('pipeYellow', [0.3, -0.15, 0.0], [0.3, -1.0, 0.0], 0.026, 6);
    k.cyl('red', 0, -0.85, 0, 0.4, 0.14, 16);
    k.pop();
  }

  // Silhouette that is the Shrike's own: a sawtooth spine, one cheek heavier than the other, a chin blade, one wing fence.
  // Every piece stays inside the measured envelope (wing tips |x| 9.14, tail y 7, nose z -17.2, nozzles z ~19.35).
  {
    const sk = new Kit();
    sk.tiles = { hull: 8, metal: 1 };
    const dark = [0.16, 0.16, 0.17], primer = [1.15, 0.22, 0.16], bare = [0.78, 0.76, 0.7], soot = [0.07, 0.06, 0.055];
    for (let z = -6.2, n = 0; z < 14.2; z += 1.45, n++) {
      const h = 0.28 + (n % 3) * 0.22;
      const yt = hullTop(z + 0.4);
      const col = n % 5 === 0 ? primer : n % 4 === 0 ? bare : dark;
      sk.box('hull', 0, yt + 0.16 + h / 2, z + 0.4, 0.22 + (n % 2) * 0.08, h, 0.7, { col });
    }
    // port cheek: a short dark patch. Starboard: a longer primer plate and a bare-metal cover that does not match it.
    const hwP = hullHalfWidth(-1.5), hwS = hullHalfWidth(3.5);
    sk.box('hull', -(hwP + 0.06), 1.55, -1.6, 0.08, 0.9, 1.7, { col: dark });
    sk.box('hull', hwS + 0.08, 1.7, 3.4, 0.1, 1.25, 2.8, { col: primer });
    sk.box('hull', hwS + 0.12, 1.35, 4.5, 0.06, 0.55, 1.1, { col: bare });
    // chin blade under the nose, above the gear feet
    sk.box('hull', 0, -0.32, -15.85, 0.62, 0.14, 1.35, { col: dark });
    sk.box('red', 0, -0.26, -15.7, 0.28, 0.04, 0.7);
    // one fence, starboard wing only, inboard of the tip pod
    sk.box('hull', 7.15, 1.48, 6.1, 0.06, 0.62, 1.25, { col: dark });
    sk.box('red', 7.15, 1.72, 6.1, 0.07, 0.08, 0.9);
    // soot and a mismatched plate by the engines, short of the nozzles
    sk.box('hull', -2.4, 2.55, 14.6, 1.3, 0.55, 0.06, { col: soot });
    sk.box('hull', 2.15, 2.15, 14.2, 0.9, 0.4, 0.07, { col: bare });
    sk.box('hull', 1.1, 3.15, 13.4, 0.7, 0.28, 0.05, { col: primer });
    const scars = sk.toGroup(mats, { name: 'raider-scars', cast: true, receive: true });
    root.add(scars);
    ext.triangles += sk.triangles;
    ext.scars = scars;
  }

  const staticGroup = k.toGroup(mats, { name: 'ext-static', cast: true, receive: true });
  ext.triangles += k.triangles;
  root.add(staticGroup);
  ext.staticGroup = staticGroup;

  // ============== landing legs (they move) ===================================================================================
  for (const leg of GEAR.legs) {
    const g = new THREE.Group(); g.name = 'leg:' + leg.id;
    g.position.set(leg.x, 0, leg.z);
    const pk = new Kit();
    pk.cyl('steel', 0, -0.5, 0, 0.26, 1.0, 14);
    const piston = new THREE.Group(); piston.add(pk.toGroup(mats, { name: 'piston', cast: true }));
    g.add(piston);
    const fk = new Kit();
    fk.bevelBox('engine', 0, 0.14, 0, 0.42, 0.28, 0.42, 0.05);
    fk.cyl('metal', 0, -0.1, 0, GEAR.padRadius, 0.18, 22, { r2: GEAR.padRadius * 0.9 });
    fk.cyl('rubber', 0, -0.21, 0, GEAR.padRadius * 0.96, 0.06, 22);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fk.box('red', Math.cos(a) * GEAR.padRadius * 0.7, 0.02, Math.sin(a) * GEAR.padRadius * 0.7, 0.16, 0.012, 0.05); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; fk.pipe('engine', [0, 0.1, 0], [Math.cos(a) * 0.5, -0.04, Math.sin(a) * 0.5], 0.05, 6); }
    const foot = fk.toGroup(mats, { name: 'foot', cast: true, receive: true });
    g.add(foot);
    root.add(g);
    ext.legs.push({ id: leg.id, group: g, piston, foot, x: leg.x, z: leg.z });
  }

  // ============== ramps ==============================================================================================================
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
    for (const s of [-1, 1]) { rk.bevelBox('metal', s * (w / 2 - 0.04), 0.08, len / 2, 0.08, 0.16, len, 0.02); rk.box('glowRed', s * (w / 2 - 0.04), 0.17, len / 2, 0.02, 0.01, len - 0.4); }
    rk.bevelBox('metal', 0, -0.06, len, w, 0.12, 0.18, 0.02);
    if (key === 'cargo') for (let i = 0; i < 5; i++) rk.box(i % 2 ? 'red' : 'gunmetal', 0, -t - 0.004, 0.5 + i * 0.5, w - 0.3, 0.008, 0.25);
    const m = rk.toGroup(mats, { name: 'ramp-mesh:' + key, cast: true, receive: true });
    hinge.add(m);
    root.add(hinge);
    ext.ramps[key] = { hinge, mesh: m, def: R };
    ext.triangles += rk.triangles;
  }

  // ============== guns ===========================================================================================================================
  {
    ext.guns.main = [];
    const G = GUNS.main;
    for (const s of mirror) {
      const g = new THREE.Group(); g.position.set(s * 0.85, G.muzzles[0].y, -15.2);
      const kk = new Kit();
      kk.cyl('gunmetal', 0, 0, -0.9, 0.11, 1.8, 12, { axis: 'z' });
      kk.cyl('steel', 0, 0, -0.7, 0.16, 0.8, 12, { axis: 'z' });
      kk.cyl('metal', 0, 0, -1.8, 0.15, 0.24, 12, { axis: 'z' });
      for (let i = 0; i < 3; i++) kk.box('gunmetal', 0.0, 0.13, -1.75 - i * 0.04, 0.02, 0.08, 0.03);
      kk.bevelBox('hullDark', 0, 0.0, -0.1, 0.36, 0.34, 0.4, 0.04);
      kk.box('glowRed', 0, 0.19, -0.3, 0.05, 0.02, 0.4);
      g.add(kk.toGroup(mats, { name: 'main-gun', cast: true, receive: true }));
      root.add(g);
      ext.guns.main.push({ group: g, muzzle: new THREE.Vector3(0, 0, -1.9) });
      ext.triangles += kk.triangles;
    }
    {
      const D = GUNS.dorsal;
      const yaw = new THREE.Group(); yaw.position.set(D.pivot.x, D.pivot.y, D.pivot.z);
      const pitch = new THREE.Group(); yaw.add(pitch);
      const kk = new Kit();
      kk.tiles = { hull: 8, metal: 1 };
      for (const s of mirror) {
        kk.bevelBox('hullDark', s * 0.95, 0, -0.15, 0.42, 0.5, 0.9, 0.06);
        kk.cyl('gunmetal', s * 0.95, 0.0, -1.2, 0.085, 1.6, 12, { axis: 'z' });
        kk.cyl('steel', s * 0.95, 0.0, -0.8, 0.13, 0.7, 12, { axis: 'z' });
        kk.cyl('metal', s * 0.95, 0.0, -1.95, 0.12, 0.22, 12, { axis: 'z' });
        kk.box('glowRed', s * 0.95, 0.27, -0.15, 0.05, 0.02, 0.5);
      }
      kk.bevelBox('hullDark', 0, 0.0, 0.55, 2.3, 0.26, 0.42, 0.05);
      pitch.add(kk.toGroup(mats, { name: 'dorsal-barrels', cast: true, receive: true }));
      ext.triangles += kk.triangles;
      root.add(yaw);
      ext.guns.dorsal = { yaw, pitch, muzzles: D.muzzles.map((m) => new THREE.Vector3(m.x, 0, m.z)) };
    }
  }

  // ============== engine glow, additive, driven by thrust ============================================================================================
  {
    const flame = (r0, r1, len) => {
      const g = new THREE.CylinderGeometry(r0, r1, len, 18, 1, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, len / 2);
      return g;
    };
    for (const s of mirror) {
      const m = new THREE.Mesh(flame(0.8, 0.18, 5.2), mats.engineGlow.clone());
      m.position.set(s * 3.2, 1.6, HULL.z1 + 3.2);
      m.name = 'exhaust';
      root.add(m);
      const core = new THREE.Mesh(flame(0.48, 0.06, 3.3), mats.nozzleInner.clone());
      core.position.copy(m.position);
      root.add(core);
      ext.engines.push({ outer: m, core, side: s });
    }
    for (const p of ext.liftPods) {
      const g = new THREE.CylinderGeometry(0.42, 0.1, 4.2, 14, 1, true);
      g.translate(0, -2.1, 0);
      const m = new THREE.Mesh(g, mats.engineGlow.clone());
      m.position.set(p.x, p.y, p.z);
      root.add(m);
      const g2 = new THREE.CylinderGeometry(0.24, 0.04, 2.4, 10, 1, true); g2.translate(0, -1.2, 0);
      const c = new THREE.Mesh(g2, mats.nozzleInner.clone());
      c.position.copy(m.position);
      root.add(c);
      p.mesh = m; p.core = c;
    }
  }

  // ============== a remote view adds its own glass, so the people at the stations can be seen through the canopy ==================================
  if (opts.remote) {
    const gk = new Kit();
    const C = LAYOUT.roomById.get('cockpit'), N = LAYOUT.roomById.get('turret');
    const yb = C.y + 1.05, yt = C.y + C.h;
    gk.poly('glassTint', [[C.x0, yb, C.z0], [C.x1, yb, C.z0], [C.x1, yt, C.z0 + 0.5], [C.x0, yt, C.z0 + 0.5]]);
    for (const s of [-1, 1]) {
      const x = s > 0 ? C.x1 : C.x0;
      gk.poly('glassTint', s > 0 ? [[x, yb, C.z0], [x, yb, C.z1 - 0.4], [x, yt, C.z1 - 0.4], [x, yt, C.z0]] : [[x, yb, C.z1 - 0.4], [x, yb, C.z0], [x, yt, C.z0], [x, yt, C.z1 - 0.4]]);
    }
    const ny0 = N.y + 0.65, ny1 = N.y + N.h;
    gk.poly('glassTint', [[N.x0, ny0, N.z0], [N.x1, ny0, N.z0], [N.x1, ny1, N.z0], [N.x0, ny1, N.z0]]);
    gk.poly('glassTint', [[N.x1, ny0, N.z1], [N.x0, ny0, N.z1], [N.x0, ny1, N.z1], [N.x1, ny1, N.z1]]);
    gk.poly('glassTint', [[N.x1, ny0, N.z0], [N.x1, ny0, N.z1], [N.x1, ny1, N.z1], [N.x1, ny1, N.z0]]);
    gk.poly('glassTint', [[N.x0, ny0, N.z1], [N.x0, ny0, N.z0], [N.x0, ny1, N.z0], [N.x0, ny1, N.z1]]);
    const gg = gk.toGroup(mats, { name: 'remote-glass' });
    gg.traverse((m) => { if (m.isMesh) m.renderOrder = 6; });
    root.add(gg);
    ext.remoteGlass = gg;
  }

  ext.tier = low ? 'low' : 'high';
  ext.paint = 'shrike-scorched';
  return ext;
}

/** The pose the ship size is defined in: gear at its nominal length, both ramps raised, guns level. */
export function applyRaiderNeutralPose(ext) {
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

/** The boat name and registry number painted on the flank. */
export function raiderDecalTexture(THREE_, def, name = 'SHRIKE', registry = 'SHRIKE CLASS') {
  if (!canvasPaints()) return null;
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#d8d2c8';
  g.font = '800 150px "Arial Narrow", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(String(name).toUpperCase(), 90, 104);
  g.font = '600 48px ui-monospace, Consolas, monospace';
  g.fillText(registry, 96, 214);
  g.fillStyle = '#b02a22';
  g.fillRect(1300, 50, 640, 34);
  g.fillRect(1300, 104, 460, 34);
  const t = new THREE_.CanvasTexture(c);
  t.colorSpace = THREE_.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export { RAIDER_CLASS, SEATS };

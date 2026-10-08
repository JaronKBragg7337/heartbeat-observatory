// ============================================================================
// worlds/earth/life.js - what grows on the Cape: cabbage palms and scrub, scattered in groves round the complex (never on a pad, a road, a building or the beach).
// Palms are two instanced meshes (a tapering trunk, a crown of drooping fronds), scrub one more: about 3 draw calls and under 20,000 triangles. Everything stands on the
// real ground height at its own spot (the same surfaceRadius the walker is held up by) and is placed in the complex's own outpost-local frame (x east, y up, z south),
// so the numbers stay small. Client only (three.js).
// ============================================================================
import * as THREE from 'three';
import { outpostToFrame } from '../moon/place.js';
import { solidAtEarth } from './layout.js';

const h31 = (i, j, s) => { let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

function crownGeometry() {
  const pos = [], idx = [], N = 10, SEG = 4;
  for (let f = 0; f < N; f++) {
    const a = f / N * Math.PI * 2 + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), L = 2.6 + (f % 3) * 0.35, up0 = 0.55 + (f % 2) * 0.35;
    const base = pos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG, r = t * L, y = up0 * Math.sin(t * 2.2) * 1.2 - t * t * 1.9, w = 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.1)) * (1 - 0.15 * t);
      pos.push(ca * r - sa * w, y, sa * r + ca * w, ca * r + sa * w, y - 0.04, sa * r - ca * w);
    }
    for (let s = 0; s < SEG; s++) { const i = base + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function buildLife({ engine, world, complex, tier }) {
  const low = tier === 'low', body = world.body, pi = body.padInfo, root = complex.root;
  const groundY = (x, z) => { const p = outpostToFrame(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = body.surfaceRadius(p.x / l, p.y / l, p.z / l); const s = { x: p.x / l * R - pi.point.x, y: p.y / l * R - pi.point.y, z: p.z / l * R - pi.point.z }; return s.x * pi.up.x + s.y * pi.up.y + s.z * pi.up.z; };
  const keepClear = (x, z) => {
    if (Math.abs(x) < 76 && Math.abs(z) < 76) return true;                                         // the pad and its aprons
    if (z > -196 && z < -148 && x > -230 && x < 120) return true;                                  // the crawlerway
    if (x > 24 && x < 120 && z < 6 && z > -50 && Math.abs((x - 34) * 40 + (z) * 74) < 74 * 9) return true;   // the training hall's road
    return solidAtEarth(x, z, 9);
  };
  const palms = [], bushes = [];
  const COUNT = low ? 240 : 420, SCRUB = low ? 380 : 700;
  for (let i = 0, tries = 0; palms.length < COUNT && tries < COUNT * 40; tries++, i++) {
    // groves: a cell of 90 m decides whether it has a grove and how thick
    const x = (h31(i, 1, 11) - 0.5) * 900, z = (h31(i, 2, 11) - 0.5) * 900, cell = h31(Math.floor(x / 90), Math.floor(z / 90), 17);
    if (cell < 0.45 || h31(i, 3, 11) > cell) continue;
    if (keepClear(x, z)) continue;
    const y = groundY(x, z); if (y < -2.0 || y > 12) continue;                                     // (the pad plane is 4.6 m over the sea): only on land with room above the beach
    palms.push({ x, y, z, s: 0.7 + h31(i, 4, 11) * 0.8, yaw: h31(i, 5, 11) * 6.28, lean: (h31(i, 6, 11) - 0.5) * 0.14 });
  }
  for (let i = 0, tries = 0; bushes.length < SCRUB && tries < SCRUB * 30; tries++, i++) {
    const x = (h31(i, 1, 23) - 0.5) * 800, z = (h31(i, 2, 23) - 0.5) * 800;
    if (keepClear(x, z) || h31(Math.floor(x / 60), Math.floor(z / 60), 29) < 0.25) continue;
    const y = groundY(x, z); if (y < -2.0 || y > 12) continue;
    bushes.push({ x, y, z, s: 0.7 + h31(i, 4, 23) * 1.2, sy: 0.4 + h31(i, 5, 23) * 0.35, yaw: h31(i, 6, 23) * 6.28 });
  }
  // keep palms and scrub off the sand: where the real ground is that low it is the beach (the surfaceRadius there is below 2.6 m over the sea)
  const trunkG = new THREE.CylinderGeometry(0.16, 0.3, 1, low ? 5 : 6, 1); trunkG.translate(0, 0.5, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1, flatShading: true });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x4f8a34, roughness: 0.9, side: THREE.DoubleSide });
  // scrub: a lumpy clump of palmetto, not a faceted ball: an icosphere of 80 faces with every corner pushed in or out a little (the same corner moves together, so it stays closed), smooth-shaded
  const bushG = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(); {
    const ps = bushG.attributes.position, seen = new Map();
    for (let i = 0; i < ps.count; i++) {
      const k = `${ps.getX(i).toFixed(3)},${ps.getY(i).toFixed(3)},${ps.getZ(i).toFixed(3)}`; if (!seen.has(k)) seen.set(k, [0.72 + h31(seen.size, 3, 41) * 0.5, 0.9 + 0.2 * h31(seen.size, 4, 41)]);
      const [r, ky] = seen.get(k); ps.setXYZ(i, ps.getX(i) * r, ps.getY(i) * r * ky, ps.getZ(i) * r);
    }
    bushG.deleteAttribute('normal'); bushG.computeVertexNormals();
    const merged = new Map(), nr = bushG.attributes.normal;               // average the normal at each shared corner: smooth shading
    for (let i = 0; i < ps.count; i++) { const k = `${ps.getX(i).toFixed(3)},${ps.getY(i).toFixed(3)},${ps.getZ(i).toFixed(3)}`, a = merged.get(k) || [0, 0, 0]; a[0] += nr.getX(i); a[1] += nr.getY(i); a[2] += nr.getZ(i); merged.set(k, a); }
    for (let i = 0; i < ps.count; i++) { const a = merged.get(`${ps.getX(i).toFixed(3)},${ps.getY(i).toFixed(3)},${ps.getZ(i).toFixed(3)}`), l = Math.hypot(...a) || 1; nr.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  }
  const bushM = new THREE.MeshStandardMaterial({ color: 0x8a9c52, roughness: 1, flatShading: false });
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, Math.max(1, palms.length)), crowns = new THREE.InstancedMesh(crownGeometry(), crownM, Math.max(1, palms.length)), bush = new THREE.InstancedMesh(bushG, bushM, Math.max(1, bushes.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  palms.forEach((a, i) => {
    const h = 5 + 5.5 * a.s, tilt = a.lean;
    e.set(tilt, a.yaw, tilt * 0.6); q.setFromEuler(e); p.set(a.x, a.y - 0.15, a.z); s.set(a.s, h, a.s); m.compose(p, q, s); trunks.setMatrixAt(i, m);
    const top = new THREE.Vector3(Math.sin(tilt * 0.6) * -h * 0.5, h, Math.sin(tilt) * h * 0.5).applyEuler(new THREE.Euler(0, a.yaw, 0));
    p.set(a.x + top.x, a.y - 0.15 + top.y - 0.1, a.z + top.z); s.setScalar(0.85 + a.s * 0.6); q.setFromEuler(e.set(0, a.yaw * 3.1, 0)); m.compose(p, q, s); crowns.setMatrixAt(i, m);
    col.setHSL(0.27 + (h31(i, 8, 5) - 0.5) * 0.04, 0.45, 0.3 + h31(i, 9, 5) * 0.12); crowns.setColorAt(i, col);
  });
  bushes.forEach((a, i) => { e.set(0, a.yaw, 0); q.setFromEuler(e); p.set(a.x, a.y + a.s * a.sy * 0.2, a.z); s.set(a.s, a.s * a.sy, a.s); m.compose(p, q, s); bush.setMatrixAt(i, m); col.setHSL(0.21 + (h31(i, 8, 7) - 0.5) * 0.08, 0.34, 0.36 + h31(i, 9, 7) * 0.2); bush.setColorAt(i, col); });
  for (const o of [trunks, crowns, bush]) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; o.frustumCulled = false; o.castShadow = !low; o.receiveShadow = false; o.name = 'earth-life'; root.add(o); }
  trunks.count = palms.length; crowns.count = palms.length; bush.count = bushes.length;
  return { palms: palms.length, scrub: bushes.length, dispose() { for (const o of [trunks, crowns, bush]) { root.remove(o); o.dispose(); } trunkG.dispose(); bushG.dispose(); crowns.geometry.dispose(); trunkM.dispose(); crownM.dispose(); bushM.dispose(); } };
}

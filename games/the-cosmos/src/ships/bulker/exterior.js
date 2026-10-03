// ============================================================================
// ships/bulker/exterior.js - the Long Haul from outside: a wide crew block at the nose with a bridge on a low prow, a spine girder behind it
// carrying ten ore pods (long capsules on ring frames, rust-red with white bands) and four tank spheres, a lit window band on the crew block,
// radiator ladders, six big engine bells in two rows at the tail, a hold ramp and a boarding gangway under the crew block.
// PLACEHOLDER livery: mars (neutral). mats.hull / hullDark / hullAccent / hullStripe stay the livery slots for F0's applyLiveryTint.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { buildHullShell, panelTone, nameDecals, finishMats, hash } from '../_liner/hullShell.js';
import { addLegs, addRamps, addEngine, addLiftPod, addNoseGuns, poseNeutral, navLights } from '../_liner/parts.js';
import { HULL, WINDOWS } from './spec.js';
import { BULKER } from './def.js';
import { linerLivery } from '../_liner/livery.js';

const LIV = linerLivery('mars');
export const PALETTE = LIV.palette;
const POD_Z = [-50, -20, 10, 40, 70];

export function buildBulkerExterior(layout, matsIn, opts = {}) {
  const mats = finishMats(matsIn, PALETTE);
  const root = new THREE.Group(); root.name = 'long-haul-bulker';
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 8.45 };
  const low = opts.tier === 'low';

  const colorFn = (x, y, z, ny) => {
    const t = panelTone(x, y, z, 2.4);
    const H = LIV.hull, B = LIV.belly;
    if (ny < -0.3) return [B[0] * t, B[1] * t, B[2] * t];
    if (ny > 0.8) return [H[0] * 0.9 * t, H[1] * 0.9 * t, H[2] * 0.9 * t];
    return [H[0] * t, H[1] * t, H[2] * t];
  };
  const { mesh, caps } = buildHullShell(HULL, mats, {
    dz: low ? 4 : 2, colorFn, capColor: [0.45, 0.45, 0.45], tail: true,
    cutouts: [{ side: 1, z0: -100.4, z1: -98.4, y0: 0, y1: 2.3 }],
  });
  root.add(mesh, caps);

  const k = new Kit(); k.tiles = { hull: 8, metal: 1 };
  const hwAt = (z) => HULL.halfWidth(z) + 0.012;
  // crew block: stripe, window band, ribs
  for (const s of [-1, 1]) for (const [y, h, key] of [[2.9, 0.4, 'hullStripe'], [3.3, 0.1, 'hullAccent']]) {
    for (let z = -110; z < -76; z += 2) {
      const a = z, b = Math.min(-76, z + 2);
      k.poly(key, s > 0 ? [[hwAt(a), y - h / 2, a], [hwAt(a), y + h / 2, a], [hwAt(b), y + h / 2, b], [hwAt(b), y - h / 2, b]] : [[-hwAt(a), y + h / 2, a], [-hwAt(a), y - h / 2, a], [-hwAt(b), y - h / 2, b], [-hwAt(b), y + h / 2, b]]);
    }
  }
  for (const w of WINDOWS) {
    const s = w.wall === 'x1' ? 1 : -1, yc = (w.y0 + w.y1) / 2 - 3.0, h = w.y1 - w.y0, x = s * (HULL.halfWidth(w.c) + 0.02);
    k.box('steelDark', x, yc, w.c, 0.02, h + 0.2, w.w + 0.2); k.box('glowWhite', x + s * 0.014, yc, w.c, 0.02, h, w.w, { col: [0.5, 0.42, 0.3] });
  }
  for (let z = -108; z <= -80; z += 1.7) for (const s of [-1, 1]) { const lit = hash(z * 3.1, s) > 0.2; k.box(lit ? 'glowWhite' : 'steelDark', s * (HULL.halfWidth(z) + 0.02), 1.6, z, 0.02, 0.4, 0.55, { col: lit ? [0.5, 0.42, 0.3] : undefined }); }
  for (const z of [-110, -102, -94, -86, -78]) for (const s of [-1, 1]) k.bevelBox('steelDark', s * (HULL.halfWidth(z) + 0.05), 2.0, z, 0.14, 4.4, 0.3, 0.03, { col: [0.75, 0.75, 0.75] });
  // crew block roof: hatches, a dome, the dish
  for (let i = 0; i < 18; i++) {
    const zz = -108 + i * 1.8, xx = (((i * 17) % 11) / 11 - 0.5) * 14;
    if (Math.abs(xx) < 1.5 || Math.abs(xx) > 8) continue;
    k.bevelBox(i % 3 ? 'hullDark' : 'hull', xx, 6.83, zz, 0.9 + (i % 4) * 0.3, 0.05, 1.1, 0.015, { col: i % 2 ? [0.7, 0.72, 0.72] : [0.55, 0.57, 0.6] });
  }
  k.cyl('steelDark', 0, 6.9, -92, 0.12, 4.5, 8); k.dome('white', 0, 9.3, -92, 0.9, 14, 6);
  k.dome('hull', 0, 6.9, -100, 1.6, 14, 6, { thetaMax: 1.45 });
  // prow cheeks and canopy frame
  for (const s of [-1, 1]) {
    k.prism('hullDark', [[s * 5.0, -118.7], [s * 5.5, -111.7], [s * 8.4, -111.7], [s * 6.4, -119.6]], 0.9, 1.25, 0.04, 0.04);
    k.pipe('steel', [s * 5.1, 1.05, -118.8], [s * 5.1, 3.0, -117.8], 0.06, 8); k.pipe('steel', [s * 5.1, 1.05, -111.6], [s * 5.1, 3.0, -111.6], 0.06, 8);
  }
  for (const x of [-3.4, -1.7, 0, 1.7, 3.4]) k.pipe('steel', [x, 1.05, -118.8], [x, 3.0, -117.8], 0.05, 8);
  k.pipe('steel', [-5.2, 3.0, -117.8], [5.2, 3.0, -117.8], 0.07, 8);
  navLights(k, -8.0, 8.0, 1.0, -112);
  k.bevelBox('hullDark', 9.46, 1.2, -99.4, 0.12, 2.6, 1.9, 0.03); k.box('glowGreen', 9.52, 2.6, -99.4, 0.02, 0.1, 1.4);
  // the spine: ring frames every 6 m, a gantry rail along the top, radiator ladders, strobes
  for (let z = -72; z <= 98; z += 6) { for (const s of [-1, 1]) k.bevelBox('steelDark', s * 4.45, 1.3, z, 0.12, 5.2, 0.5, 0.03, { col: [0.8, 0.8, 0.8] }); k.bevelBox('steelDark', 0, 5.5, z, 8.8, 0.12, 0.4, 0.03, { col: [0.8, 0.8, 0.8] }); }
  k.bevelBox('hullDark', 0, 5.6, 14, 1.4, 0.3, 170, 0.1);
  for (let z = -70; z <= 98; z += 14) k.bevelBox('hullDark', 0, 6.0, z, 0.6, 0.5, 0.6, 0.05);
  k.box('glowRed', 0, 6.4, -71, 0.2, 0.2, 0.2); k.box('glowRed', 0, 6.4, 99, 0.2, 0.2, 0.2); k.box('glowWhite', 0, 6.4, 14, 0.2, 0.2, 0.2);
  // ore pods: ten capsules on ring clamps, rust with white bands and a hatch row
  for (const s of [-1, 1]) for (const z of POD_Z) {
    const x = s * 10.4, y = 4.6, L = 26, R = 5.1;
    k.lathe('crateA', x, y, z, [[0.6, -L / 2], [R * 0.7, -L / 2 + 1.0], [R, -L / 2 + 3], [R, L / 2 - 3], [R * 0.7, L / 2 - 1.0], [0.6, L / 2]], 16, { axis: 'z', col: [0.78, 0.4, 0.3] });
    for (const dz of [-L / 2 + 5, 0, L / 2 - 5]) {
      k.lathe('white', x, y, z + dz, [[R + 0.02, -0.5], [R + 0.1, -0.5], [R + 0.1, 0.5], [R + 0.02, 0.5]], 16, { axis: 'z' });
      k.lathe('steelDark', x, y, z + dz + 1.2, [[R + 0.03, -0.12], [R + 0.18, -0.12], [R + 0.18, 0.12], [R + 0.03, 0.12]], 16, { axis: 'z' });
    }
    for (let i = -2; i <= 2; i++) k.bevelBox('hullDark', x, y + R + 0.04, z + i * 4.2, 1.6, 0.1, 2.4, 0.03);
    // the clamp arms: from the spine's flank out to the pod's ring bands
    for (const dz of [-L / 2 + 5, 0, L / 2 - 5]) {
      k.pipe('steel', [s * 4.3, 3.0, z + dz], [s * 6.0, 4.6, z + dz], 0.22, 8); k.pipe('steel', [s * 4.3, 0.2, z + dz], [s * 6.0, 2.4, z + dz], 0.22, 8);
    }
    k.box('glowAmber', x, y, z - L / 2 - 0.15, 0.3, 0.3, 0.1);
  }
  // pod names and numbers: a number plate on every pod flank (white box with a dark centre bar; no text without a canvas)
  for (const s of [-1, 1]) POD_Z.forEach((z, i) => { k.bevelBox('white', s * 15.6, 4.6, z, 0.06, 1.4, 3.6, 0.02); k.box('hullAccent', s * 15.64, 4.6, z, 0.02, 1.0, 0.5 + 0.3 * i); });
  // tank spheres on the top of the spine
  for (const z of [-40, -5, 30, 65]) {
    k.dome('white', 0, 6.0, z, 4.2, 20, 10, { thetaMax: Math.PI * 0.62 });
    k.lathe('hullAccent', 0, 6.0, z, [[3.95, -0.15], [4.12, -0.15], [4.12, 0.15], [3.95, 0.15]], 20);
    for (const a of [0, 1.57, 3.14, 4.71]) k.pipe('steelDark', [Math.cos(a) * 3.2, 7.4, z + Math.sin(a) * 3.2], [Math.cos(a) * 2.2, 5.6, z + Math.sin(a) * 2.2], 0.1, 6);
  }
  // tail block: engine frame, radiators, six bells
  k.bevelBox('hullDark', 0, 2.0, 119.9, 14.4, 9.0, 0.5, 0.05);
  const bells = [[-4.4, 4.4], [0, 4.4], [4.4, 4.4], [-4.4, -0.2], [0, -0.2], [4.4, -0.2]];
  for (const [x, y] of bells) addEngine(ext, mats, k, x, y, 120.1, 1.8, 4.0, x > 0 ? 1 : -1);
  for (const [x, z] of [[-3.5, -60], [3.5, -60], [-3.5, 20], [3.5, 20], [-3.5, 90], [3.5, 90]]) addLiftPod(ext, mats, k, x, -2.6, z, 1.2);
  ext.staticGroup = k.toGroup(mats, { name: 'long-haul-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  addLegs(ext, BULKER, mats, { r: 0.6, padW: 4.2, padD: 3.6, padH: 0.55 });
  addRamps(ext, BULKER, mats, { step: 0.6 });
  addNoseGuns(ext, mats, BULKER, { r: 0.14, len: 2.0, back: 0.2 });

  if (opts.remote) {
    const gk = new Kit(), b = layout.roomById.get('bridge');
    gk.poly('glassTint', [[b.x0, 1.05, b.z0], [b.x1, 1.05, b.z0], [b.x1 - 0.4, 3.0, b.z0 + 1.1], [b.x0 + 0.4, 3.0, b.z0 + 1.1]]);
    for (const s of [-1, 1]) gk.poly('glassTint', s < 0 ? [[b.x0, 1.05, b.z1], [b.x0, 1.05, b.z0], [b.x0 + 0.4, 3.0, b.z0 + 1.1], [b.x0, 3.0, b.z1]] : [[b.x1, 1.05, b.z0], [b.x1, 1.05, b.z1], [b.x1, 3.0, b.z1], [b.x1 - 0.4, 3.0, b.z0 + 1.1]]);
    gk.poly('hullDark', [[b.x0, 3.0, b.z0 + 1.1], [b.x1, 3.0, b.z0 + 1.1], [b.x1, 3.0, b.z1], [b.x0, 3.0, b.z1]]);
    root.add(gk.toGroup(mats)); ext.remoteGlass = true;
  }
  ext.decals = nameDecals(root, opts.decal, HULL, { w: 17, h: 2.1, z: -89, y: 4.2 });
  ext.matsOwned = mats;
  return ext;
}

export function bulkerNeutral(ext) { poseNeutral(ext, BULKER); }

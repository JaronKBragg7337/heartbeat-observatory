// ============================================================================
// ships/descender/exterior.js - the Kestrel from outside: a wedge-bodied lander in the Mars Line's white with a rust band and teal line, a dark
// ablative belly (the heat shield) with tile seams, short delta strakes, a tail fin with a nav light, rows of lit windows where the cabin
// glass is, a nose canopy, two big and two small stern engines, four landing legs, a side gangway and a stern ramp into the boat bay.
// PLACEHOLDER livery: the mars (neutral) palette; mats.hull / hullDark / hullAccent / hullStripe so F0's applyLiveryTint can recolour it.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { buildHullShell, panelTone, windowRows, nameDecals, finishMats, hash } from '../_liner/hullShell.js';
import { addLegs, addRamps, addEngine, addLiftPod, addNoseGuns, poseNeutral, navLights } from '../_liner/parts.js';
import { HULL, WINDOWS } from './spec.js';
import { DESCENDER } from './def.js';
import { linerLivery } from '../_liner/livery.js';

const LIV = linerLivery('mars');
export const PALETTE = LIV.palette;

export function buildDescenderExterior(layout, matsIn, opts = {}) {
  const mats = finishMats(matsIn, PALETTE);
  const root = new THREE.Group(); root.name = 'kestrel-descender';
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 10.75 };
  const low = opts.tier === 'low';

  const colorFn = (x, y, z, ny) => {
    const t = panelTone(x, y, z, 1.8);
    if (ny < -0.25) { const h = hash(Math.floor(x * 0.9), Math.floor(z * 0.7)); return [0.2 * t * (0.8 + 0.4 * h), 0.19 * t, 0.2 * t]; }     // the heat shield: charcoal tiles
    const H = LIV.hull;
    if (ny > 0.8) return [H[0] * 0.92 * t, H[1] * 0.92 * t, H[2] * 0.92 * t];
    return [H[0] * t, H[1] * t, H[2] * t];
  };
  const { mesh, caps } = buildHullShell(HULL, mats, {
    dz: low ? 2 : 1, colorFn, capColor: [0.45, 0.45, 0.45], tail: { hole: { x0: -2.4, x1: 2.4, y0: 0, y1: 3.5 } },
    cutouts: [{ side: 1, z0: 8.4, z1: 10.2, y0: 0, y1: 2.3 }],
  });
  root.add(mesh, caps);

  const k = new Kit(); k.tiles = { hull: 8, metal: 1 };
  const hwAt = (z) => HULL.halfWidth(z) + 0.012;
  for (const s of [-1, 1]) for (const [y, h, key] of [[2.6, 0.36, 'hullStripe'], [2.95, 0.09, 'hullAccent']]) {
    for (let z = -20; z < 30; z += 2) {
      const a = z, b = Math.min(30, z + 2);
      k.poly(key, s > 0 ? [[hwAt(a), y - h / 2, a], [hwAt(a), y + h / 2, a], [hwAt(b), y + h / 2, b], [hwAt(b), y - h / 2, b]] : [[-hwAt(a), y + h / 2, a], [-hwAt(a), y - h / 2, a], [-hwAt(b), y - h / 2, b], [-hwAt(b), y + h / 2, b]]);
    }
  }
  for (const w of WINDOWS) {
    const s = w.wall === 'x1' ? 1 : -1, yc = (w.y0 + w.y1) / 2 - 3.0, h = w.y1 - w.y0, x = s * (HULL.halfWidth(w.c) + 0.02);
    // the cabin walls stand inboard of the hull flank: the glass is drawn on the flank where the window is
    k.box('steelDark', x, yc, w.c, 0.02, h + 0.2, w.w + 0.2);
    k.box('glowWhite', x + s * 0.014, yc, w.c, 0.02, h, w.w, { col: [0.5, 0.42, 0.3] });
  }
  windowRows(k, HULL, -18, 24, 1.6, [1.5], { w: 0.5, h: 0.4, key: 'glowWhite', dark: 0.3 });
  // belly: tile seams (a grid of thin dark lines), ablative edge strips
  for (let z = -22; z <= 28; z += 2.4) k.box('steelDark', 0, -2.215, z, 17, 0.01, 0.04, { col: [0.25, 0.25, 0.25] });
  for (let x = -8; x <= 8; x += 2.2) k.box('steelDark', x, -2.22, 3, 0.04, 0.01, 54, { col: [0.25, 0.25, 0.25] });
  // dorsal: a raised spine, hatches, a dish, a mast, the tail fin
  k.bevelBox('hullDark', 0, 5.7, 5, 2.6, 0.4, 36, 0.15);
  for (const z of [-12, 0, 12, 22]) { k.dome('hull', 0, 5.9, z, 1.3, 14, 6, { thetaMax: 1.45 }); k.cyl('steelDark', 0, 5.9, z, 1.4, 0.1, 18); }
  k.cyl('steelDark', 0, 5.9, -20, 0.1, 3.2, 8); k.dome('white', 0, 7.5, -20, 0.55, 12, 6);
  k.bevelBox('hull', 0, 8.4, 21.5, 0.3, 5.0, 8.0, 0.06, { col: [0.9, 0.9, 0.88] });
  k.bevelBox('hullStripe', 0, 8.4, 21.5, 0.34, 1.0, 5.0, 0.04);
  k.box('glowRed', 0, 10.95, 25.4, 0.14, 0.14, 0.14);
  // delta strakes: low and short, in the hull's own plating, with a lit leading edge
  for (const s of [-1, 1]) {
    k.prism('hull', [[s * 11.0, -4], [s * 15.4, 18], [s * 15.4, 25], [s * 11.0, 25]], -0.4, 0.5, 0.08, 0.08, [0.9, 0.9, 0.88]);
    k.box('glowAmber', s * 13.2, 0.1, 6, 0.04, 0.04, 20, { col: [0.8, 0.5, 0.3] });
    k.box(s > 0 ? 'glowGreen' : 'glowRed', s * 15.45, 0.1, 21.5, 0.2, 0.12, 0.4);
    k.bevelBox('hullStripe', s * 13.6, 0.52, 20, 3.4, 0.03, 4.8, 0.01);
  }
  // prow cheeks and canopy frame
  for (const s of [-1, 1]) {
    k.prism('hullDark', [[s * 3.7, -27.4], [s * 4.2, -22.3], [s * 6.8, -22.3], [s * 4.9, -28.6]], 0.9, 1.25, 0.04, 0.04);
    k.pipe('steel', [s * 3.65, 1.05, -27.4], [s * 3.65, 3.0, -26.4], 0.06, 8); k.pipe('steel', [s * 3.65, 1.05, -22.3], [s * 3.65, 3.0, -22.3], 0.06, 8);
  }
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) k.pipe('steel', [x, 1.05, -27.4], [x, 3.0, -26.4], 0.05, 8);
  k.pipe('steel', [-3.6, 3.0, -26.4], [3.6, 3.0, -26.4], 0.07, 8);
  navLights(k, -6.9, 6.9, 1.0, -23);
  // flank frame ribs and hatches on the roof
  for (const z of [-22, -5, 11.7, 17]) for (const s of [-1, 1]) k.bevelBox('steelDark', s * (HULL.halfWidth(z) + 0.05), 1.7, z, 0.14, 4.0, 0.3, 0.03, { col: [0.75, 0.75, 0.75] });
  for (let i = 0; i < 26; i++) {
    const zz = -20 + i * 1.8, xx = (((i * 17) % 11) / 11 - 0.5) * 14;
    if (Math.abs(xx) < 1.8 || Math.abs(xx) > 8.5) continue;
    k.bevelBox(i % 3 ? 'hullDark' : 'hull', xx, 5.38, zz, 0.9 + (i % 4) * 0.3, 0.05, 1.1, 0.015, { col: i % 2 ? [0.7, 0.72, 0.72] : [0.55, 0.57, 0.6] });
  }
  // gate hall frame and landing light; stern ramp frame
  k.bevelBox('hullDark', 11.2, 1.2, 9.3, 0.12, 2.6, 1.9, 0.03);
  k.box('glowGreen', 11.27, 2.6, 9.3, 0.02, 0.1, 1.4);
  for (const sx of [-1, 1]) k.bevelBox('hullDark', sx * 2.55, 1.8, 32.9, 0.3, 3.7, 0.4, 0.04);
  k.bevelBox('hullDark', 0, 3.65, 32.9, 5.4, 0.3, 0.4, 0.04);
  for (let i = 0; i < 10; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -2.25 + i * 0.5, 3.65, 33.12, 0.25, 0.2, 0.02);
  // engines: two big, two small
  for (const x of [-6, 6]) addEngine(ext, mats, k, x, 1.4, 33.2, 1.3, 2.8, x > 0 ? 1 : -1);
  for (const x of [-6, 6]) addEngine(ext, mats, k, x, 4.0, 33.2, 0.7, 1.6, x > 0 ? 1 : -1);
  // retro pods and lift pods
  for (const [x, z] of [[-7, -16], [7, -16], [-7.5, 6], [7.5, 6], [-7, 20], [7, 20]]) addLiftPod(ext, mats, k, x, -2.1, z, 0.8);
  ext.staticGroup = k.toGroup(mats, { name: 'kestrel-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  addLegs(ext, DESCENDER, mats, { r: 0.4, padW: 2.8, padD: 2.4, padH: 0.4 });
  addRamps(ext, DESCENDER, mats, { step: 0.5 });
  addNoseGuns(ext, mats, DESCENDER, { r: 0.1, len: 1.4, back: 0.2 });

  if (opts.remote) {
    const gk = new Kit(), b = layout.roomById.get('bridge');
    gk.poly('glassTint', [[b.x0, 1.05, b.z0], [b.x1, 1.05, b.z0], [b.x1 - 0.4, 3.0, b.z0 + 1.0], [b.x0 + 0.4, 3.0, b.z0 + 1.0]]);
    for (const s of [-1, 1]) gk.poly('glassTint', s < 0 ? [[b.x0, 1.05, b.z1], [b.x0, 1.05, b.z0], [b.x0 + 0.4, 3.0, b.z0 + 1.0], [b.x0, 3.0, b.z1]] : [[b.x1, 1.05, b.z0], [b.x1, 1.05, b.z1], [b.x1, 3.0, b.z1], [b.x1 - 0.4, 3.0, b.z0 + 1.0]]);
    gk.poly('hullDark', [[b.x0, 3.0, b.z0 + 1.0], [b.x1, 3.0, b.z0 + 1.0], [b.x1, 3.0, b.z1], [b.x0, 3.0, b.z1]]);
    root.add(gk.toGroup(mats)); ext.remoteGlass = true;
  }
  ext.decals = nameDecals(root, opts.decal, HULL, { w: 12, h: 1.5, z: -9, y: 3.7 });
  ext.matsOwned = mats;
  return ext;
}

export function descenderNeutral(ext) { poseNeutral(ext, DESCENDER); }

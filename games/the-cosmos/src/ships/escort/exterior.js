// ============================================================================
// ships/escort/exterior.js - the Line Marshal from outside: a sleek plated hull in the Mars Line's white with a bold ochre band and a teal
// line, long swept wings with lit leading edges and sensor pods at the tips, a dorsal fin and a point turret, a chin cannon pair, two engines,
// four short legs, a side gangway and a stern ramp. PLACEHOLDER livery: mars (neutral) with the line's ochre as the escort colour.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { buildHullShell, panelTone, windowRows, nameDecals, finishMats } from '../_liner/hullShell.js';
import { addLegs, addRamps, addEngine, addLiftPod, addNoseGuns, poseNeutral, navLights } from '../_liner/parts.js';
import { HULL, WINDOWS } from './spec.js';
import { ESCORT } from './def.js';
import { linerLivery } from '../_liner/livery.js';

const LIV = linerLivery('mars', { alt: true });
export const PALETTE = LIV.palette;

export function buildEscortExterior(layout, matsIn, opts = {}) {
  const mats = finishMats(matsIn, PALETTE);
  const root = new THREE.Group(); root.name = 'line-marshal-escort';
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 3.75 };
  const low = opts.tier === 'low';
  const colorFn = (x, y, z, ny) => {
    const t = panelTone(x, y, z, 1.4);
    const H = LIV.hull, B = LIV.belly;
    if (ny < -0.3) return [B[0] * t, B[1] * t, B[2] * t];
    if (ny > 0.8) return [H[0] * 0.92 * t, H[1] * 0.92 * t, H[2] * 0.92 * t];
    return [H[0] * t, H[1] * t, H[2] * t];
  };
  const { mesh, caps } = buildHullShell(HULL, mats, {
    dz: low ? 1.5 : 0.8, colorFn, capColor: [0.45, 0.45, 0.45], tail: { hole: { x0: -1.5, x1: 1.5, y0: 0, y1: 2.9 } },
    cutouts: [{ side: 1, z0: -4.8, z1: -3.2, y0: 0, y1: 2.2 }],
  });
  root.add(mesh, caps);

  const k = new Kit(); k.tiles = { hull: 6, metal: 1 };
  const hwAt = (z) => HULL.halfWidth(z) + 0.012;
  for (const s of [-1, 1]) for (const [y, h, key] of [[2.0, 0.5, 'hullStripe'], [2.45, 0.1, 'hullAccent']]) {
    for (let z = -13; z < 20; z += 1.6) {
      const a = z, b = Math.min(20, z + 1.6);
      k.poly(key, s > 0 ? [[hwAt(a), y - h / 2, a], [hwAt(a), y + h / 2, a], [hwAt(b), y + h / 2, b], [hwAt(b), y - h / 2, b]] : [[-hwAt(a), y + h / 2, a], [-hwAt(a), y - h / 2, a], [-hwAt(b), y - h / 2, b], [-hwAt(b), y + h / 2, b]]);
    }
  }
  for (const w of WINDOWS) {
    const s = w.wall === 'x1' ? 1 : -1, yc = (w.y0 + w.y1) / 2 - 3.0, h = w.y1 - w.y0, x = s * (HULL.halfWidth(w.c) + 0.02);
    k.box('steelDark', x, yc, w.c, 0.02, h + 0.2, w.w + 0.2); k.box('glowWhite', x + s * 0.014, yc, w.c, 0.02, h, w.w, { col: [0.5, 0.45, 0.35] });
  }
  windowRows(k, HULL, -12, 8, 1.4, [1.0], { w: 0.3, h: 0.25, key: 'glowWhite', dark: 0.3 });
  // wings: swept, with a lit leading edge, an ochre panel, a fence and a tip pod
  for (const s of [-1, 1]) {
    k.prism('hull', [[s * 3.8, -6], [s * 14.6, 12.5], [s * 14.6, 17], [s * 3.8, 17]], -0.45, 0.35, 0.06, 0.06, [0.93, 0.93, 0.9]);
    k.bevelBox('hullStripe', s * 10.0, 0.4, 13.2, 6.5, 0.04, 3.2, 0.015);
    k.pipe('glowAmber', [s * 3.9, 0.0, -5.7], [s * 14.5, 0.0, 12.3], 0.03, 5, { col: [0.8, 0.5, 0.3] });
    k.bevelBox('hullDark', s * 9.0, 0.7, 8.5, 0.08, 0.7, 7.0, 0.02);
    k.cyl('hull', s * 14.6, 0.0, 14.5, 0.55, 5.0, 14, { axis: 'z', col: [0.9, 0.9, 0.88] });
    k.dome('white', s * 14.6, 0.0, 12.0, 0.55, 12, 6);
    k.box(s > 0 ? 'glowGreen' : 'glowRed', s * 14.6, 0.55, 12.2, 0.18, 0.12, 0.3);
    k.bevelBox('hullDark', s * 4.7, -0.1, -8, 0.3, 0.4, 0.8, 0.05);
  }
  // dorsal: a fin, an antenna, a point turret, hatches
  k.bevelBox('hull', 0, 5.4, 15.5, 0.26, 3.2, 5.0, 0.06, { col: [0.93, 0.93, 0.9] });
  k.bevelBox('hullStripe', 0, 5.4, 15.8, 0.3, 1.3, 2.4, 0.03);
  k.box('glowRed', 0, 7.0, 17.9, 0.14, 0.14, 0.14);
  k.pipe('steel', [0, 3.9, 6.0], [0, 6.2, 6.0], 0.04, 6);
  k.cyl('steelDark', 0, 3.95, -2.0, 0.65, 0.2, 14); k.dome('gunmetal', 0, 4.05, -2.0, 0.55, 12, 6, { thetaMax: 1.45 });
  k.pipe('gunmetal', [-0.12, 4.35, -2.6], [-0.12, 4.4, -4.0], 0.06, 6); k.pipe('gunmetal', [0.12, 4.35, -2.6], [0.12, 4.4, -4.0], 0.06, 6);
  for (let i = 0; i < 14; i++) { const zz = -10 + i * 1.8, xx = (((i * 17) % 7) / 7 - 0.5) * 6; if (Math.abs(xx) < 0.9) continue; k.bevelBox(i % 3 ? 'hullDark' : 'hull', xx, 3.93, zz, 0.7, 0.05, 0.9, 0.015, { col: [0.6, 0.62, 0.64] }); }
  // prow
  for (const s of [-1, 1]) {
    k.prism('hullDark', [[s * 3.0, -18.9], [s * 3.4, -13.7], [s * 5.4, -13.7], [s * 3.8, -19.6]], 0.9, 1.25, 0.04, 0.04);
    k.pipe('steel', [s * 3.0, 1.05, -18.8], [s * 3.0, 2.7, -17.9], 0.05, 8); k.pipe('steel', [s * 3.0, 1.05, -13.6], [s * 3.0, 2.7, -13.6], 0.05, 8);
  }
  for (const x of [-2.0, -1.0, 0, 1.0, 2.0]) k.pipe('steel', [x, 1.05, -18.8], [x, 2.7, -17.9], 0.04, 8);
  k.pipe('steel', [-3.0, 2.7, -17.9], [3.0, 2.7, -17.9], 0.06, 8);
  navLights(k, -4.3, 4.3, 0.9, -13.4);
  // hatch frame and stern ramp frame
  k.bevelBox('hullDark', 4.76, 1.1, -4.0, 0.12, 2.4, 1.7, 0.03); k.box('glowGreen', 4.82, 2.2, -4.0, 0.02, 0.1, 1.2);
  for (const sx of [-1, 1]) k.bevelBox('hullDark', sx * 1.65, 1.5, 21.9, 0.24, 3.0, 0.3, 0.04);
  k.bevelBox('hullDark', 0, 3.0, 21.9, 3.5, 0.24, 0.3, 0.04);
  // engines and lift pods
  for (const x of [-2.9, 2.9]) addEngine(ext, mats, k, x, 1.5, 22.1, 0.95, 2.0, x > 0 ? 1 : -1);
  for (const [x, z] of [[-2.4, -9], [2.4, -9], [-2.4, 11], [2.4, 11]]) addLiftPod(ext, mats, k, x, -1.15, z, 0.5);
  ext.staticGroup = k.toGroup(mats, { name: 'marshal-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  addLegs(ext, ESCORT, mats, { r: 0.18, padW: 1.5, padD: 1.2, padH: 0.28 });
  addRamps(ext, ESCORT, mats, { step: 0.3 });
  addNoseGuns(ext, mats, ESCORT, { r: 0.09, len: 1.8, back: 0.2 });

  if (opts.remote) {
    const gk = new Kit(), b = layout.roomById.get('bridge');
    gk.poly('glassTint', [[b.x0, 1.05, b.z0], [b.x1, 1.05, b.z0], [b.x1 - 0.3, 2.7, b.z0 + 0.9], [b.x0 + 0.3, 2.7, b.z0 + 0.9]]);
    for (const s of [-1, 1]) gk.poly('glassTint', s < 0 ? [[b.x0, 1.05, b.z1], [b.x0, 1.05, b.z0], [b.x0 + 0.3, 2.7, b.z0 + 0.9], [b.x0, 2.7, b.z1]] : [[b.x1, 1.05, b.z0], [b.x1, 1.05, b.z1], [b.x1, 2.7, b.z1], [b.x1 - 0.3, 2.7, b.z0 + 0.9]]);
    gk.poly('hullDark', [[b.x0, 2.7, b.z0 + 0.9], [b.x1, 2.7, b.z0 + 0.9], [b.x1, 2.7, b.z1], [b.x0, 2.7, b.z1]]);
    root.add(gk.toGroup(mats)); ext.remoteGlass = true;
  }
  ext.decals = nameDecals(root, opts.decal, HULL, { w: 8.4, h: 1.05, z: -1, y: 3.0 });
  ext.matsOwned = mats;
  return ext;
}

export function escortNeutral(ext) { poseNeutral(ext, ESCORT); }

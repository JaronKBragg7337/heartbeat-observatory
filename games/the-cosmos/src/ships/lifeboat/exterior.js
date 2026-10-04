// ============================================================================
// ships/lifeboat/exterior.js - the Skiff from outside: a plated lifeboat hull in the world's own paint (looks.js), worn: scuffed panels,
// a sooted stern, replaced plates a shade off. A canopy over the flight deck, a side hatch with a grab rail, a rear ramp, four bells on the
// stern shoulders and lower flanks (the ramp mouth stays clear), four stubby legs, belly lift pods, a beacon mast and handrails.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { buildHullShell, panelTone, hash, nameDecals, finishMats } from '../_liner/hullShell.js';
import { addLegs, addRamps, addEngine, addLiftPod, addNoseGuns, poseNeutral } from '../_liner/parts.js';
import { HULL } from './spec.js';
import { LIFEBOAT } from './def.js';
import { lifeboatLook } from './looks.js';

export function buildLifeboatExterior(layout, matsIn, opts = {}) {
  const look = lifeboatLook(opts.world || (opts.look && opts.look.id));
  const mats = finishMats(matsIn, look);
  const root = new THREE.Group(); root.name = 'skiff-' + look.id;
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 2.45, look: look.id };
  const wear = look.weather;

  const colorFn = (x, y, z, ny) => {
    const t = panelTone(x, y, z, 1.1) * (0.93 + 0.1 * hash(Math.floor(x * 1.3), Math.floor(z * 0.9) + 40));
    let c = ny < -0.3 ? look.belly : look.tint;
    c = [c[0] * t, c[1] * t, c[2] * t];
    if (z > 4.4) { const s = Math.min(1, (z - 4.4) / 1.2) * 0.55 * wear; c = [c[0] * (1 - s), c[1] * (1 - s), c[2] * (1 - s)]; }       // soot at the stern
    if (hash(Math.floor(x * 2), Math.floor(z * 1.6) + 7) > 0.93 - 0.08 * wear) c = [c[0] * 0.72, c[1] * 0.7, c[2] * 0.68];             // a replaced plate
    return c;
  };
  const { mesh, caps } = buildHullShell(HULL, mats, {
    dz: 0.4, colorFn, capColor: [0.45, 0.45, 0.45], tail: { hole: { x0: -1.25, x1: 1.25, y0: 0, y1: 2.25 } },
    cutouts: [{ side: 1, z0: -1.4, z1: -0.4, y0: 0, y1: 2.05 }],
  });
  root.add(mesh, caps);

  const k = new Kit(); k.tiles = { hull: 4, metal: 1 };
  const hwAt = (z) => HULL.halfWidth(z);
  // livery stripes down the flanks (accent over stripe), a nose band, the world's colour on the roof hatch
  for (const s of [-1, 1]) for (const [y, h, key] of [[1.35, 0.32, 'hullStripe'], [1.66, 0.07, 'hullAccent']]) {
    for (let z = -2.4; z < 5.0; z += 0.8) {
      const a = z, b = Math.min(5.0, z + 0.8), xa = hwAt(a) + 0.012, xb = hwAt(b) + 0.012;
      k.poly(key, s > 0 ? [[xa, y - h / 2, a], [xa, y + h / 2, a], [xb, y + h / 2, b], [xb, y - h / 2, b]] : [[-xa, y + h / 2, a], [-xa, y - h / 2, a], [-xb, y - h / 2, b], [-xb, y + h / 2, b]]);
    }
  }
  // portholes along the cabin flanks and the hatch frame
  for (const w of layout.windows) {
    const s = w.wall === 'x1' ? 1 : -1, yc = (w.y0 + w.y1) / 2 - 3.0, h = w.y1 - w.y0;
    k.bevelBox('steelDark', s * (hwAt(w.c) + 0.02), yc, w.c, 0.06, h + 0.16, w.w + 0.16, 0.03);
    k.box('glowWhite', s * (hwAt(w.c) + 0.052), yc, w.c, 0.02, h, w.w, { col: [0.4, 0.46, 0.55] });
  }
  k.bevelBox('steelDark', 2.62, 1.05, -0.9, 0.1, 2.3, 1.3, 0.04, { col: [1.1, 1.1, 1.1] });                                  // hatch frame
  k.box('glowGreen', 2.65, 2.0, -0.9, 0.02, 0.1, 0.7);
  k.pipe('steel', [2.62, 0.5, -1.4], [2.62, 1.7, -1.4], 0.03, 6); k.pipe('steel', [2.62, 0.5, -0.4], [2.62, 1.7, -0.4], 0.03, 6);   // the grab rails
  // ribs and strakes
  for (const z of [-2.7, -1.5, 0.9, 2.0, 3.2, 4.4]) for (const s of [-1, 1]) {
    k.bevelBox('steelDark', s * (hwAt(z) + 0.03), 1.0, z, 0.08, 2.0, 0.14, 0.02, { col: [0.95, 0.95, 0.95] });
  }
  for (const s of [-1, 1]) { for (let i = 0; i < 12; i++) k.cyl('steel', s * (hwAt(-2 + i * 0.6) + 0.055), 0.62, -2 + i * 0.6, 0.025, 0.03, 6, { axis: 'x' }); }
  // the roof: a hatch, a beacon mast, a strobe, grab rails, two cargo eyes
  k.cyl('steelDark', 0.6, 3.1, 0.2, 0.55, 0.12, 14); k.cyl('hullStripe', 0.6, 3.17, 0.2, 0.46, 0.04, 14);
  k.pipe('steel', [-0.9, 3.05, 1.8], [-0.9, 4.1, 1.8], 0.03, 6); k.dome('white', -0.9, 4.1, 1.8, 0.1, 8, 4); k.box('glowAmber', -0.9, 4.22, 1.8, 0.1, 0.1, 0.1);
  k.pipe('steel', [-1.6, 3.05, -1.0], [-1.6, 3.3, -1.0], 0.025, 6); k.pipe('steel', [-1.6, 3.3, -1.0], [-1.6, 3.3, 3.2], 0.03, 6); k.pipe('steel', [-1.6, 3.3, 3.2], [-1.6, 3.05, 3.2], 0.025, 6);
  k.pipe('steel', [1.6, 3.05, -1.0], [1.6, 3.3, -1.0], 0.025, 6); k.pipe('steel', [1.6, 3.3, -1.0], [1.6, 3.3, 3.2], 0.03, 6); k.pipe('steel', [1.6, 3.3, 3.2], [1.6, 3.05, 3.2], 0.025, 6);
  for (const z of [-1.6, 3.6]) for (const s of [-1, 1]) k.bevelBox('hullDark', s * 0.55, 3.07, z, 0.5, 0.06, 0.4, 0.02);
  // the canopy frame and the nose: mullions, a sill rail, two floods and a ram bar
  const zf = -5.1;
  for (const x of [-1.9, -1.0, 0, 1.0, 1.9]) k.pipe('gunmetal', [x, 1.05, zf], [x, 2.4, zf + 0.4], 0.035, 8);
  k.pipe('gunmetal', [-2.0, 2.4, zf + 0.4], [2.0, 2.4, zf + 0.4], 0.05, 8); k.pipe('gunmetal', [-2.0, 1.05, zf], [2.0, 1.05, zf], 0.05, 8);
  for (const s of [-1, 1]) { k.pipe('gunmetal', [s * 2.0, 1.05, zf], [s * 2.0, 2.4, zf], 0.04, 8); k.pipe('gunmetal', [s * 2.0, 1.05, -2.6], [s * 2.0, 2.4, -2.6], 0.04, 8); k.pipe('gunmetal', [s * 2.0, 2.4, zf], [s * 2.0, 2.4, -2.6], 0.05, 8); k.pipe('gunmetal', [s * 2.0, 1.05, zf], [s * 2.0, 1.05, -2.6], 0.05, 8); }
  for (const s of [-1, 1]) { k.cyl('white', s * 0.9, 0.55, -5.4, 0.16, 0.1, 12, { axis: 'z' }); k.cyl('glowWhite', s * 0.9, 0.55, -5.47, 0.12, 0.02, 12, { axis: 'z' }); }
  k.bevelBox('hullDark', 0, 0.35, -5.35, 1.4, 0.14, 0.14, 0.03);
  k.box('glowRed', -1.5, 0.6, -4.6, 0.08, 0.1, 0.18); k.box('glowGreen', 1.5, 0.6, -4.6, 0.08, 0.1, 0.18);
  // stern: a bumper ring round the ramp mouth. looks-r1: the bells sit on the shoulders and the lower flanks,
  // outboard of the hatch (x -1.25..1.25, y 0..2.25) so the ramp (hinge z 5.4, width 2.4) drops through a clear opening.
  for (const sx of [-1, 1]) k.bevelBox('hullDark', sx * 1.35, 1.1, 5.55, 0.24, 2.3, 0.3, 0.04);
  k.bevelBox('hullDark', 0, 2.3, 5.55, 2.9, 0.24, 0.3, 0.04);
  for (const x of [-1.95, 1.95]) addEngine(ext, mats, k, x, 2.45, 5.95, 0.32, 0.7, x > 0 ? 1 : -1);
  for (const x of [-2.05, 2.05]) addEngine(ext, mats, k, x, 0.55, 5.05, 0.22, 0.55, x > 0 ? 1 : -1);
  for (const [x, z] of [[-1.5, -3], [1.5, -3], [-1.5, 3.4], [1.5, 3.4]]) addLiftPod(ext, mats, k, x, -0.85, z, 0.32);
  ext.staticGroup = k.toGroup(mats, { name: 'skiff-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  addLegs(ext, LIFEBOAT, mats, { r: 0.1, padW: 0.8, padD: 0.7, padH: 0.16 });
  addRamps(ext, LIFEBOAT, mats, { step: 0.25 });
  addNoseGuns(ext, mats, LIFEBOAT, { r: 0.05, len: 0.6, back: 0.1 });

  if (opts.remote) {
    const gk = new Kit();
    gk.poly('glassTint', [[-2.0, 1.05, zf], [2.0, 1.05, zf], [1.6, 2.4, zf + 0.4], [-1.6, 2.4, zf + 0.4]]);
    for (const s of [-1, 1]) gk.poly('glassTint', s < 0 ? [[-2.0, 1.05, -2.6], [-2.0, 1.05, zf], [-1.6, 2.4, zf + 0.4], [-2.0, 2.4, -2.6]] : [[2.0, 1.05, zf], [2.0, 1.05, -2.6], [2.0, 2.4, -2.6], [1.6, 2.4, zf + 0.4]]);
    gk.poly('hullDark', [[-2.0, 2.4, zf + 0.4], [2.0, 2.4, zf + 0.4], [2.0, 2.4, -2.6], [-2.0, 2.4, -2.6]]);
    root.add(gk.toGroup(mats)); ext.remoteGlass = true;
  }
  ext.decals = nameDecals(root, opts.decal, HULL, { w: 3.6, h: 0.45, z: 1.7, y: 0.55 });
  ext.matsOwned = mats;
  return ext;
}

export function lifeboatNeutral(ext) { poseNeutral(ext, LIFEBOAT); }

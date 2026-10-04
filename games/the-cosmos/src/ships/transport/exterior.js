// ============================================================================
// ships/transport/exterior.js - the Ares-class liner from outside: a lofted plated hull in the Mars Line's white with a rust and teal
// stripe, lit salon windows where the real windows are, a dorsal spine with radiator fins and antennas, four engine bells, six belly lift
// pods, four long landing legs, a stern cargo ramp and a boarding gangway, and the ship's name along both flanks.
// LIVERY: the mars (neutral) palette from F0's style sheet, written here as a placeholder palette until the faction registry is merged:
// the hull uses mats.hull / hullDark / hullAccent / hullStripe so applyLiveryTint can recolour it later without touching this file.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { buildHullShell, panelTone, windowRows, nameDecals, finishMats } from '../_liner/hullShell.js';
import { addLegs, addRamps, addEngine, addLiftPod, addNoseGuns, poseNeutral, navLights } from '../_liner/parts.js';
import { HULL, WINDOWS, GEAR } from './spec.js';
import { TRANSPORT } from './def.js';
import { linerLivery } from '../_liner/livery.js';

const LIV = linerLivery('mars');
export const PALETTE = LIV.palette;

export function buildTransportExterior(layout, matsIn, opts = {}) {
  const mats = finishMats(matsIn, PALETTE);
  const root = new THREE.Group(); root.name = 'ares-transport';
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 13.4 };
  const low = opts.tier === 'low';

  // ---- the plated hull
  const colorFn = (x, y, z, ny) => {
    const t = panelTone(x, y, z);
    const H = LIV.hull, B = LIV.belly;
    if (ny < -0.3) return [B[0] * t, B[1] * t, B[2] * t];                       // belly: the livery's belly colour
    if (ny > 0.8) return [H[0] * 0.92 * t, H[1] * 0.92 * t, H[2] * 0.92 * t];   // roof: a touch greyer, dusted
    return [H[0] * t, H[1] * t, H[2] * t];                                      // flanks: the livery's hull colour
  };
  const { mesh, caps } = buildHullShell(HULL, mats, {
    dz: low ? 2 : 1, colorFn, capColor: [0.5, 0.5, 0.5], tail: { hole: { x0: -2.4, x1: 2.4, y0: 0, y1: 3.7 } },
    cutouts: [{ side: 1, z0: 25.8, z1: 27.6, y0: 0, y1: 2.4 }],
  });
  root.add(mesh, caps);

  // ---- plating detail, windows, stripes, the spine
  const k = new Kit(); k.tiles = { hull: 8, metal: 1 };
  for (const s of [-1, 1]) {
    for (const z of [-30, 0, 30]) void z;
    // the stripe: a rust band over the windows along the whole flank, a thin teal line above it
    for (const [y, h, key] of [[2.85, 0.4, 'hullStripe'], [3.25, 0.1, 'hullAccent']]) {
      const z0 = -34, z1 = 52, hwAt = (z) => HULL.halfWidth(z) + 0.012;
      for (let z = z0; z < z1; z += 2) {
        const za = z, zb = Math.min(z1, z + 2);
        k.poly(key, s > 0 ? [[hwAt(za), y - h / 2, za], [hwAt(za), y + h / 2, za], [hwAt(zb), y + h / 2, zb], [hwAt(zb), y - h / 2, zb]]
          : [[-hwAt(za), y + h / 2, za], [-hwAt(za), y - h / 2, za], [-hwAt(zb), y - h / 2, zb], [-hwAt(zb), y + h / 2, zb]]);
      }
    }
  }
  // salon windows exactly where the real ones are. looks-r1: a dark recess, warm cabin glass,
  // and a frame proud of the skin. Mullions are wide enough to read from the pad. Positions stay tied to WINDOWS.
  for (const w of WINDOWS) {
    if (w.room === 'crew_q') continue;
    const s = w.wall === 'x1' ? 1 : -1, hw = HULL.halfWidth(w.c);
    const yc = (w.y0 + w.y1) / 2 - 3.0, h = w.y1 - w.y0;
    const panes = Math.max(2, Math.round(w.w / 2.2));
    const out = hw + 0.02;
    // Dark paint, not lit metal: a sun-facing steel frame washed out to the hull colour from the pad.
    const frame = [0.22, 0.24, 0.28];
    k.box('plasticDark', s * out, yc, w.c, 0.08, h + 0.2, w.w + 0.28, { col: frame });
    k.box('glowAmber', s * (out + 0.06), yc, w.c, 0.02, h - 0.5, w.w - 0.7, { col: [0.7, 0.42, 0.22] });
    k.box('glassTint', s * (out + 0.09), yc, w.c, 0.018, h - 0.28, w.w - 0.4);
    k.box('plasticDark', s * (out + 0.16), yc + h / 2 - 0.04, w.c, 0.2, 0.32, w.w + 0.44, { col: frame });
    k.box('plasticDark', s * (out + 0.16), yc - h / 2 + 0.04, w.c, 0.2, 0.32, w.w + 0.44, { col: frame });
    for (let i = 0; i <= panes; i++) {
      const z = w.c - w.w / 2 + (w.w / panes) * i;
      const end = i === 0 || i === panes;
      k.box('plasticDark', s * (out + 0.18), yc, z, 0.22, h + 0.28, end ? 0.4 : 0.28, { col: frame });
    }
  }
  // a quiet row of small lit portholes between the salon windows
  windowRows(k, HULL, -29, 28, 1.7, [2.7], { w: 0.28, h: 0.28, key: 'glowWhite', dark: 0.25 });
  k.push(0, -0.7, 0);
  // dorsal spine: a raised ridge, hatches, domes, a dish, a mast, radiator fins, strobes
  k.bevelBox('hullDark', 0, 7.6, 6, 3.2, 0.5, 86, 0.2);
  for (const z of [-30, -14, 4, 20, 36]) { k.dome('hull', 0, 7.85, z, 1.6, 14, 6, { thetaMax: 1.45 }); k.cyl('steelDark', 0, 7.85, z, 1.7, 0.1, 18); }
  k.cyl('steelDark', 0, 8.0, -38, 0.12, 4.0, 8); k.dome('white', 0, 10.0, -38, 0.7, 14, 6);                  // the comms mast and dish
  for (const x of [-0.8, 0.8]) k.pipe('steel', [x, 8.0, 46], [x, 12.0, 46], 0.05, 6);
  for (const z of [-26, -10, 8, 24, 40]) for (const s of [-1, 1]) {
    k.bevelBox('white', s * 3.4, 9.2, z, 0.22, 3.2, 6.4, 0.05, { col: [0.86, 0.9, 0.96] });                     // radiator fin
    k.bevelBox('hullDark', s * 3.4, 10.9, z, 0.3, 0.12, 6.5, 0.03);                                           // its leading edge
    for (let i = -2; i <= 2; i++) k.box('steelDark', s * 3.53, 9.2, z + i * 1.25, 0.02, 2.8, 0.05);          // louvre ribs
    for (let j = 0; j < 4; j++) k.box('steelDark', s * 3.52, 8.2 + j * 0.62, z, 0.02, 0.04, 6.0);
    k.box('glowAmber', s * 3.53, 7.7, z, 0.02, 0.06, 6.0);
  }
  // frame ribs down the flanks at the room boundaries, access hatches and vents on the roof
  for (const z of [-34, -17, -2, 12.7, 22.7, 31, 40]) for (const s of [-1, 1]) {
    const hw = HULL.halfWidth(z);
    k.bevelBox('steelDark', s * (hw + 0.05), 2.3, z, 0.14, 5.0, 0.3, 0.03, { col: [0.75, 0.75, 0.75] });
  }
  for (let i = 0; i < 46; i++) {
    const zz = -36 + i * 1.9, xx = (((i * 17) % 11) / 11 - 0.5) * 18;
    if (Math.abs(xx) < 2.2 || Math.abs(xx) > 10) continue;
    k.bevelBox(i % 3 ? 'hullDark' : 'hull', xx, 7.53, zz, 0.9 + (i % 4) * 0.35, 0.05, 1.2, 0.015, { col: i % 2 ? [0.7, 0.72, 0.72] : [0.55, 0.57, 0.6] });
    if (i % 5 === 0) { k.cyl('steelDark', xx + 1.4, 7.6, zz, 0.28, 0.12, 10); k.cyl('gunmetal', xx + 1.4, 7.68, zz, 0.2, 0.04, 10); }
  }
  // lifeboat pods: six along each upper flank, hugging the hull, in the line's rust orange, each with a hatch and a light
  for (const z of [-29, -22, -15, 7, 14, 21]) for (const s of [-1, 1]) {
    const hw = HULL.halfWidth(z);
    k.bevelBox('hullStripe', s * (hw + 0.55), 4.5, z, 1.1, 1.3, 3.6, 0.35);
    k.bevelBox('hullDark', s * (hw + 0.55), 3.78, z, 1.2, 0.12, 3.8, 0.04);
    k.box('glowAmber', s * (hw + 1.12), 4.7, z, 0.02, 0.16, 0.7);
    k.bevelBox('steelDark', s * (hw + 1.1), 4.22, z, 0.04, 0.4, 1.45, 0.012);   // looks-r1: hatch, not a blank white panel
    k.box('glowAmber', s * (hw + 1.14), 4.22, z + 0.42, 0.012, 0.05, 0.1);
  }
  // an upper docking collar on the spine, with its tube
  k.cyl('steelDark', 0, 8.0, 12, 2.0, 0.5, 20); k.cyl('hull', 0, 8.45, 12, 1.5, 0.6, 20, { col: [0.85, 0.86, 0.84] }); k.cyl('gunmetal', 0, 8.8, 12, 1.1, 0.1, 20);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box('hazard', Math.cos(a) * 1.78, 8.25, 12 + Math.sin(a) * 1.78, 0.18, 0.1, 0.1); }
  k.box('glowWhite', 0, 12.1, 46, 0.18, 0.18, 0.18); k.box('glowRed', 0, 8.1, -44, 0.2, 0.2, 0.2); k.box('glowRed', 0, 8.1, 54, 0.2, 0.2, 0.2);
  k.pop();
  // the prow: two cheek ridges either side of the bridge, and the canopy frame
  for (const s of [-1, 1]) {
    k.prism('hullDark', [[s * 4.9, -49.6], [s * 5.4, -42.2], [s * 8.4, -42.2], [s * 6.2, -50.6]], 0.9, 1.25, 0.04, 0.04);
    k.pipe('steel', [s * 5.0, 1.05, -49.5], [s * 5.0, 3.0, -48.3], 0.06, 8);
    k.pipe('steel', [s * 5.0, 1.05, -42.1], [s * 5.0, 3.0, -42.1], 0.06, 8);
  }
  for (const x of [-3.4, -1.7, 0, 1.7, 3.4]) k.pipe('steel', [x, 1.05, -49.5], [x, 3.0, -48.3], 0.05, 8);
  k.pipe('steel', [-5, 3.0, -48.3], [5, 3.0, -48.3], 0.07, 8);
  navLights(k, -10.6, 10.6, 1.0, -43);
  navLights(k, -14.05, 14.05, 5.5, 20);
  // boarding hall: the door frame and a landing light over it
  k.bevelBox('hullDark', 14.04, 1.3, 26.7, 0.12, 2.8, 2.2, 0.03);
  k.box('glowGreen', 14.1, 2.8, 26.7, 0.02, 0.1, 1.6);
  // stern: the ramp frame and hazard chevrons
  for (const sx of [-1, 1]) k.bevelBox('hullDark', sx * 2.55, 1.9, 59.9, 0.3, 3.9, 0.4, 0.04);
  k.bevelBox('hullDark', 0, 3.85, 59.9, 5.4, 0.3, 0.4, 0.04);
  for (let i = 0; i < 10; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -2.25 + i * 0.5, 3.85, 60.12, 0.25, 0.2, 0.02);
  // engines: four bells at the stern
  for (const [x, y] of [[-7, 1.6], [7, 1.6], [-7, 5.0], [7, 5.0]]) addEngine(ext, mats, k, x, y, 60.2, 1.5, 3.2, x > 0 ? 1 : -1);
  // belly lift pods
  for (const [x, z] of [[-8, -34], [8, -34], [-9.5, 8], [9.5, 8], [-8, 40], [8, 40]]) addLiftPod(ext, mats, k, x, -1.6, z, 0.9);

  ext.staticGroup = k.toGroup(mats, { name: 'ares-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  addLegs(ext, TRANSPORT, mats, { r: 0.45, padW: 3.2, padD: 2.8, padH: 0.45 });
  addRamps(ext, TRANSPORT, mats, { step: 0.5 });
  addNoseGuns(ext, mats, TRANSPORT, { r: 0.12, len: 1.6, back: 0.2 });

  if (opts.remote) {
    const gk = new Kit(), b = layout.roomById.get('bridge');
    gk.poly('glassTint', [[b.x0, 1.05, b.z0], [b.x1, 1.05, b.z0], [b.x1 - 0.4, 3.0, b.z0 + 1.1], [b.x0 + 0.4, 3.0, b.z0 + 1.1]]);
    for (const s of [-1, 1]) gk.poly('glassTint', s < 0 ? [[b.x0, 1.05, b.z1], [b.x0, 1.05, b.z0], [b.x0 + 0.4, 3.0, b.z0 + 1.1], [b.x0, 3.0, b.z1]] : [[b.x1, 1.05, b.z0], [b.x1, 1.05, b.z1], [b.x1, 3.0, b.z1], [b.x1 - 0.4, 3.0, b.z0 + 1.1]]);
    gk.poly('hullDark', [[b.x0, 3.0, b.z0 + 1.1], [b.x1, 3.0, b.z0 + 1.1], [b.x1, 3.0, b.z1], [b.x0, 3.0, b.z1]]);
    root.add(gk.toGroup(mats));
    ext.remoteGlass = true;
  }
  ext.decals = nameDecals(root, opts.decal, HULL, { w: 17, h: 2.1, z: -4, y: 4.1 });
  ext.matsOwned = mats;
  return ext;
}

export function transportNeutral(ext) { poseNeutral(ext, TRANSPORT); }
void GEAR;

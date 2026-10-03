// ============================================================================
// ships/hauler/interior.js - the dressing that is not furniture: the flight deck canopy frame, the engine room pipe racks, and the hold:
// gantry rails and trolley, ribs, six rover cradles with wheel chocks, clamp posts and status lights, tie-down rails along both walls,
// and the stern door frame. Called by the shared interior builder for each room of a layout that carries `custom`.
// Pieces here are thin: the walkable geometry is the layout, not these meshes.
// ============================================================================

import '../raider/props.js';
import { BERTHS } from './spec.js';

const HAZ = 'hazard';

function cradle(k, b, yF) {
  const { x, z } = b;
  k.bevelBox('steelDark', x, yF + 0.025, z, 2.9, 0.05, 4.8, 0.02);                       // the cradle plate
  for (const sx of [-1, 1]) k.box(HAZ, x + sx * 1.38, yF + 0.055, z, 0.1, 0.006, 4.7);   // hazard edge lines
  for (const sz of [-1, 1]) k.box('glowAmber', x, yF + 0.055, z + sz * 2.34, 2.7, 0.006, 0.05);
  // wheel chocks and slots at the three wheel stations a side (the rover's wheels sit at z -1.45, 0, 1.45)
  for (const sx of [-1, 1]) for (const dz of [-1.45, 0, 1.45]) {
    k.bevelBox('steel', x + sx * 1.05, yF + 0.08, z + dz, 0.5, 0.05, 0.46, 0.01);
    k.bevelBox('rubber', x + sx * 1.05, yF + 0.13, z + dz + 0.3, 0.3, 0.1, 0.12, 0.012);
    k.bevelBox('rubber', x + sx * 1.05, yF + 0.13, z + dz - 0.3, 0.3, 0.1, 0.12, 0.012);
  }
  // clamp posts at the cradle's four corners: a steel post, an arm that folds over the rover's frame, a green light when it is locked
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = x + sx * 1.5, pz = z + sz * 2.0;
    k.bevelBox('gunmetal', px, yF + 0.35, pz, 0.14, 0.7, 0.14, 0.015);
    k.bevelBox('steel', px - sx * 0.1, yF + 0.72, pz, 0.26, 0.07, 0.12, 0.012);
    k.cyl('steelDark', px, yF + 0.03, pz, 0.12, 0.06, 10);
    k.box('glowGreen', px + sx * 0.075, yF + 0.5, pz, 0.008, 0.05, 0.05);
  }
  k.box('white', x, yF + 0.06, z - 2.2, 0.5, 0.004, 0.18);                                 // the berth number plate
}

export function dressHaulerRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h;
  if (r.id === 'cockpit') {
    // the canopy frame: raked mullions up the windscreen, a rail along the sill and the roof edge, posts down each side
    const ybase = yF + 1.05, ytop = yC, raked = 0.55, zf = r.z0;
    for (const x of [-3.1, -2.1, -1.05, 0, 1.05, 2.1, 3.1]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + raked], 0.036, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + raked], [r.x1, ytop, zf + raked], 0.05, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.05, 8);
    for (const s of [-1, 1]) {
      const x = s * r.x1;
      for (const z of [r.z0, r.z0 + 1.2, r.z0 + 2.4, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.04, 8);
      k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.05, 8);
      k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.05, 8);
    }
    k.box('glowAmber', 0, ytop - 0.06, zf + raked + 0.2, 6.0, 0.012, 0.03);
    // an amber stripe across the back wall: the haulers' mark
    k.box('glowAmber', 0, yF + 1.55, r.z1 - 0.012, r.x1 - r.x0 - 0.2, 0.12, 0.006);
    return;
  }
  if (r.id === 'engine') {
    for (const [x, key] of [[-4.9, 'pipeBlue'], [-4.45, 'pipeRed'], [4.2, 'pipeYellow']]) {
      k.pipe(key, [x, yC - 0.2, r.z0 + 0.2], [x, yC - 0.2, r.z1 - 0.2], 0.06, 10);
      for (let z = r.z0 + 0.7; z < r.z1 - 0.4; z += 1.6) k.box('steelDark', x, yC - 0.1, z, 0.1, 0.1, 0.09);
    }
    k.lathe(HAZ, -2.8, yF + 0.005, 9.9, [[1.3, 0], [1.42, 0]], 28);
    for (const x of [-0.6, 1.4]) k.box(HAZ, x, yF + 0.012, 9.9, 0.06, 0.003, 4.6);       // walkway lines to the hold door
    out.coreSpec = { room: 'engine', x: -2.8, y: yF + 1.2, z: 9.9, r: 0.4, h: 1.5 };
    return;
  }
  if (r.id === 'hold') {
    const zc = (r.z0 + r.z1) / 2, L = r.z1 - r.z0;
    // overhead gantry: two rails the length of the hold, a cross-beam, and a trolley with a hook block
    for (const x of [-4.6, 4.6]) k.bevelBox('steelDark', x, yC - 0.3, zc, 0.26, 0.32, L - 0.4, 0.02);
    k.bevelBox('steelDark', 0, yC - 0.3, 20.8, 9.4, 0.3, 0.3, 0.02);
    k.bevelBox(HAZ, 0, yC - 0.62, 20.8, 0.8, 0.34, 0.56, 0.03);
    k.pipe('steel', [0, yC - 0.8, 20.8], [0, yC - 2.2, 20.8], 0.025);
    k.bevelBox('red', 0, yC - 2.3, 20.8, 0.3, 0.16, 0.16, 0.02);
    // ribs: frames up the walls and over the roof every 1.6 m
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.6) for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02);
    // tie-down rails along both walls, with rings every 0.8 m
    for (const sx of [-1, 1]) {
      k.bevelBox('gunmetal', sx * (r.x1 - 0.2), yF + 0.45, zc, 0.1, 0.12, L - 0.8, 0.012);
      for (let z = r.z0 + 0.8; z < r.z1 - 0.6; z += 0.8) k.cyl('steel', sx * (r.x1 - 0.27), yF + 0.45, z, 0.05, 0.03, 8, { axis: 'x' });
    }
    // the aisle: two amber guide lines and a yellow centre dash between the cradle columns
    for (const x of [-1.5, 1.5]) k.box('glowAmber', x, yF + 0.012, zc, 0.06, 0.003, L - 1.2);
    for (let z = r.z0 + 1.2; z < r.z1 - 1.0; z += 1.4) k.box(HAZ, 0, yF + 0.012, z, 0.18, 0.003, 0.7);
    for (const b of BERTHS) cradle(k, b, yF);
    // the stern door: a frame round the ramp opening, hazard chevrons along its head, status lamps either side
    const w = 7.0, h = 4.4;
    k.bevelBox('steelDark', -w / 2 - 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.12, r.z1 - 0.06, w + 0.5, 0.24, 0.3, 0.02);
    for (let i = 0; i < 12; i++) k.box(i % 2 ? HAZ : 'gunmetal', -w / 2 + 0.2 + i * 0.4, h + 0.12, r.z1 - 0.215, 0.2, 0.16, 0.01);
    for (const sx of [-1, 1]) { k.box('glowAmber', sx * (w / 2 + 0.12), 2.2, r.z1 - 0.22, 0.1, 0.1, 0.01); k.box('glowGreen', sx * (w / 2 + 0.12), 1.9, r.z1 - 0.22, 0.1, 0.1, 0.01); }
    return;
  }
  if (r.id === 'airlock') {
    k.box(HAZ, r.x0 + 0.012, yF + 2.3, -1.2, 0.006, 0.12, 1.2);
    k.box('glowAmber', r.x0 + 0.012, yF + 2.55, -1.2, 0.006, 0.08, 0.3);
    return;
  }
  if (r.id === 'control') {
    // the berth board: six lit squares on the back wall, the same order as the cradles
    for (let i = 0; i < 6; i++) {
      const bx = r.x1 - 0.012, by = yF + 2.0 + (i % 2) * 0.0, bz = r.z0 + 0.7 + Math.floor(i / 2) * 0.55;
      k.box('steelDark', bx, by + 0.12, bz, 0.01, 0.34, 0.45);
      k.box('glowGreen', bx - 0.004, by + 0.12 + (i % 2 ? -0.1 : 0.1), bz, 0.006, 0.07, 0.3);
    }
    k.box(HAZ, r.x0 + 0.5, yF + 2.4, r.z1 - 0.012, 1.4, 0.1, 0.006);
    return;
  }
  if (r.id === 'crew_a' || r.id === 'galley') {
    const x = r.id === 'crew_a' ? r.x0 + 0.014 : r.x1 - 0.014, n = r.id === 'crew_a' ? 1 : -1;
    k.box('glowAmber', x, yF + 2.2, (r.z0 + r.z1) / 2 + 0.6, 0.006, 0.3, 0.9);
    k.box('steelDark', x + n * 0.004, yF + 1.35, (r.z0 + r.z1) / 2 - 0.9, 0.012, 0.7, 0.42);
  }
}

export const HAULER_CUSTOM = { dress: dressHaulerRoom };

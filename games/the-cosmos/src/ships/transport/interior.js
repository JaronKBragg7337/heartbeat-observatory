// ============================================================================
// ships/transport/interior.js - the dressing that is not furniture: the flight deck canopy frame, the promenade's ceiling ribs, light
// panels and floor strips, the salons' luggage rails and window frames, the lounge's glass rail, the cafe's pendants, machinery pipe racks,
// the hold's ribs and tie-down rails. Called by the shared interior builder for each room of a layout that carries `custom`.
// Pieces here are thin: the walkable geometry is the layout, not these meshes.
// ============================================================================

import '../raider/props.js';
import '../_liner/props.js';

const HAZ = 'hazard';

function ribs(k, r, pitch, key = 'steelDark') {
  const yC = r.y + r.h;
  for (let z = r.z0 + pitch / 2; z < r.z1 - 0.2; z += pitch) {
    k.bevelBox(key, (r.x0 + r.x1) / 2, yC - 0.06, z, r.x1 - r.x0 - 0.3, 0.12, 0.14, 0.02);
    for (const s of [-1, 1]) k.bevelBox(key, s < 0 ? r.x0 + 0.08 : r.x1 - 0.08, (r.y + yC) / 2 + 0.5, z, 0.1, r.h - 1.0, 0.14, 0.015);
  }
}
function lightStrip(k, r, x, key = 'glowWhite', w = 0.3) {
  k.box(key, x, r.y + r.h - 0.025, (r.z0 + r.z1) / 2, w, 0.02, r.z1 - r.z0 - 0.8);
}

export function dressTransportRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h, xm = (r.x0 + r.x1) / 2;
  if (r.id === 'bridge') {
    const ybase = yF + 1.05, ytop = yC, raked = 0.5, zf = r.z0;
    for (const x of [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + raked], 0.04, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + raked], [r.x1, ytop, zf + raked], 0.055, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.055, 8);
    for (const s of [-1, 1]) {
      const x = s * r.x1;
      for (const z of [r.z0, r.z0 + 2.0, r.z0 + 4.0, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.045, 8);
      k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.055, 8);
      k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.055, 8);
    }
    k.box('glowBlue', 0, ytop - 0.06, zf + raked + 0.2, 8.0, 0.012, 0.03);
    k.box('hullAccent', 0, yF + 1.5, r.z1 - 0.012, r.x1 - r.x0 - 0.2, 0.14, 0.006);          // the line's stripe on the back wall
    k.bevelBox('steelDark', 0, yC - 0.1, -46.0, 6.0, 0.18, 1.2, 0.03);                       // overhead panel
    for (let i = 0; i < 8; i++) k.box(i % 3 ? 'glowCyan' : 'glowAmber', -2.7 + i * 0.77, yC - 0.2, -46.0, 0.2, 0.012, 0.9);
    return;
  }
  if (r.id === 'promenade') {
    ribs(k, r, 4.0, 'steelDark');
    for (const x of [-1.6, 1.6]) lightStrip(k, r, x, 'glowWhite', 0.5);
    lightStrip(k, r, 0, 'glowCool', 0.12);
    for (const s of [-1, 1]) {
      k.box('glowAmber', s * 3.18, yF + 0.012, (r.z0 + r.z1) / 2, 0.02, 0.004, r.z1 - r.z0 - 0.6);
      k.bevelBox('steelDark', s * 3.28, yF + 0.5, (r.z0 + r.z1) / 2, 0.04, 0.9, r.z1 - r.z0 - 0.4, 0.01);   // lower wall band (kick plate)
    }
    // a pale polished-tile walkway down the middle, so the long carpeted hall reads as a hall and not a tunnel; seams every 4 m
    k.box('tile', 0, yF + 0.012, (r.z0 + r.z1) / 2, 3.0, 0.006, r.z1 - r.z0 - 0.6, { col: [0.82, 0.84, 0.86] });
    for (let z = r.z0 + 2; z < r.z1 - 1; z += 4) k.box('steelDark', 0, yF + 0.017, z, 3.0, 0.002, 0.03);
    k.box('hullStripe', 0, yF + 0.02, (r.z0 + r.z1) / 2, 0.06, 0.004, r.z1 - r.z0 - 1.0);
    for (let z = r.z0 + 3; z < r.z1 - 3; z += 3.2) { k.box('hullAccent', -0.18, yF + 0.01, z, 0.3, 0.004, 0.05); k.box('hullAccent', 0.18, yF + 0.01, z, 0.3, 0.004, 0.05); }
    for (const z of [-24.3, -9.5, 5.3, 17.7, 26.7]) for (const s of [-1, 1]) { k.bevelBox('plasticDark', s * 3.2, yC - 0.6, z, 0.06, 0.34, 1.0, 0.01); k.box('glowCyan', s * 3.165, yC - 0.6, z, 0.004, 0.06, 0.7); }
    return;
  }
  if (r.id.startsWith('sal_')) {
    const s = r.id.includes('_p') ? -1 : 1;
    ribs(k, r, 3.6, 'steelDark');
    lightStrip(k, r, xm - 1.2 * s, 'glowWhite', 0.4); lightStrip(k, r, xm + 2.6 * s, 'glowWhite', 0.4);
    const xo = s < 0 ? r.x0 + 0.16 : r.x1 - 0.16;
    k.bevelBox('gunmetal', xo, yC - 0.55, (r.z0 + r.z1) / 2, 0.3, 0.06, r.z1 - r.z0 - 0.6, 0.015);
    k.bevelBox('steelDark', xo, yC - 0.34, (r.z0 + r.z1) / 2, 0.34, 0.34, r.z1 - r.z0 - 0.7, 0.04);
    k.box('glowAmber', xo - s * 0.17, yC - 0.52, (r.z0 + r.z1) / 2, 0.01, 0.02, r.z1 - r.z0 - 0.9);
    for (let i = 0; i < 6; i++) k.box('glowCyan', xm + 2.6 * s, yC - 0.05, r.z0 + 1.3 + i * 2.3, 0.2, 0.012, 0.1);
    return;
  }
  if (r.id === 'lounge') {
    ribs(k, r, 3.0, 'steelDark');
    k.box('glowWhite', xm, yC - 0.025, (r.z0 + r.z1) / 2, 0.5, 0.02, r.z1 - r.z0 - 1.0);
    k.box('glowAmber', r.x1 - 0.1, yF + 0.012, 5.3, 0.04, 0.004, 11.0);                         // floor edge light along the glass
    for (let z = r.z0 + 1.4; z < r.z1 - 0.7; z += 2.8) k.bevelBox('steelDark', r.x1 - 0.1, yF + 1.6, z, 0.12, 2.6, 0.08, 0.015);
    return;
  }
  if (r.id === 'cafe') {
    for (let z = r.z0 + 1.2; z < r.z1 - 0.8; z += 2.6) for (const x of [-11.8, -8.4]) {
      k.pipe('steel', [x, yC, z], [x, yC - 0.8, z], 0.01, 5);
      k.cyl('white', x, yC - 0.88, z, 0.2, 0.1, 14); k.cyl('glowAmber', x, yC - 0.94, z, 0.16, 0.012, 14);
    }
    k.box('glowAmber', -9.4, 2.2, 12.82, 6.0, 0.05, 0.01);                                      // the menu bar over the counter
    k.box('glowWhite', xm, yC - 0.025, (r.z0 + r.z1) / 2, 0.4, 0.02, r.z1 - r.z0 - 1.0);
    return;
  }
  if (r.id === 'medbay') {
    k.box('glowWhite', xm, yC - 0.025, (r.z0 + r.z1) / 2, 0.8, 0.02, r.z1 - r.z0 - 1.0);
    k.box('glowGreen', r.x0 + 0.012, yF + 2.2, 17.7, 0.006, 0.4, 0.4); k.box('glowWhite', r.x0 + 0.014, yF + 2.2, 17.7, 0.007, 0.1, 0.34);
    return;
  }
  if (r.id === 'gate') {
    k.box(HAZ, r.x1 - 0.012, yF + 2.55, 26.7, 0.006, 0.12, 2.6);
    k.box('glowGreen', r.x1 - 0.012, yF + 2.8, 26.7, 0.006, 0.08, 0.4);
    for (let i = 0; i < 8; i++) k.box(i % 2 ? HAZ : 'gunmetal', r.x1 - 0.014, yF + 2.45, 25.5 + i * 0.3, 0.006, 0.14, 0.15);
    ribs(k, r, 3.4, 'steelDark');
    return;
  }
  if (r.id === 'engine') {
    for (const [x, key] of [[-9.2, 'pipeBlue'], [-8.7, 'pipeRed'], [8.8, 'pipeYellow'], [9.3, 'pipeSteel']]) {
      k.pipe(key, [x, yC - 0.25, r.z0 + 0.2], [x, yC - 0.25, r.z1 - 0.2], 0.07, 10);
      for (let z = r.z0 + 0.8; z < r.z1 - 0.4; z += 1.8) k.box('steelDark', x, yC - 0.12, z, 0.12, 0.14, 0.1);
    }
    k.lathe(HAZ, -3.4, yF + 0.005, 38, [[1.5, 0], [1.65, 0]], 28);
    k.box(HAZ, 0, yF + 0.012, 38, 0.1, 0.003, 12);
    out.coreSpec = { room: 'engine', x: -3.4, y: yF + 1.4, z: 38, r: 0.45, h: 1.7 };
    return;
  }
  if (r.id === 'hold') {
    const L = r.z1 - r.z0, zc = (r.z0 + r.z1) / 2;
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.8) { for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02); k.bevelBox('steelDark', 0, yC - 0.1, z, r.x1 - r.x0, 0.14, 0.16, 0.02); }
    for (const sx of [-1, 1]) {
      k.bevelBox('gunmetal', sx * (r.x1 - 0.2), yF + 0.45, zc, 0.1, 0.12, L - 0.8, 0.012);
      for (let z = r.z0 + 0.8; z < r.z1 - 0.6; z += 0.8) k.cyl('steel', sx * (r.x1 - 0.27), yF + 0.45, z, 0.05, 0.03, 8, { axis: 'x' });
    }
    for (const x of [-1.4, 1.4]) k.box('glowAmber', x, yF + 0.012, zc, 0.06, 0.003, L - 1.2);
    const w = 4.8, h = 3.8;
    k.bevelBox('steelDark', -w / 2 - 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.12, r.z1 - 0.06, w + 0.5, 0.24, 0.3, 0.02);
    for (let i = 0; i < 10; i++) k.box(i % 2 ? HAZ : 'gunmetal', -w / 2 + 0.2 + i * 0.5, h + 0.12, r.z1 - 0.215, 0.25, 0.16, 0.01);
    return;
  }
  if (r.id === 'stores') {
    k.box('glowWhite', xm, yC - 0.025, (r.z0 + r.z1) / 2, 0.4, 0.02, r.z1 - r.z0 - 1.0);
    return;
  }
  if (r.id === 'crew_q' || r.id === 'crew_mess') {
    k.box('glowWhite', xm, yC - 0.025, (r.z0 + r.z1) / 2, 0.5, 0.02, r.z1 - r.z0 - 0.8);
    const x = r.id === 'crew_q' ? r.x0 + 0.014 : r.x1 - 0.014;
    k.box('glowAmber', x, yF + 2.2, (r.z0 + r.z1) / 2 + 0.6, 0.006, 0.3, 0.9);
  }
}

export const TRANSPORT_CUSTOM = { dress: dressTransportRoom };

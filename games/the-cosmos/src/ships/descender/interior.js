// ============================================================================
// ships/descender/interior.js - the dressing that is not furniture: canopy frame, ceiling ribs and light panels, luggage rails over the seat
// banks, restraint-harness pods, the pantry's lit menu, a hatch frame, the machinery pipe runs, and the bay's gantry rail and tie-downs.
// Thin pieces: the walkable geometry is the layout, not these meshes.
// ============================================================================

import '../raider/props.js';
import '../_liner/props.js';

function ribs(k, r, pitch) {
  const yC = r.y + r.h;
  for (let z = r.z0 + pitch / 2; z < r.z1 - 0.2; z += pitch) {
    k.bevelBox('steelDark', (r.x0 + r.x1) / 2, yC - 0.06, z, r.x1 - r.x0 - 0.3, 0.12, 0.14, 0.02);
    for (const s of [-1, 1]) k.bevelBox('steelDark', s < 0 ? r.x0 + 0.08 : r.x1 - 0.08, (r.y + yC) / 2 + 0.4, z, 0.1, r.h - 0.8, 0.14, 0.015);
  }
}

export function dressDescenderRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h, xm = (r.x0 + r.x1) / 2, zm = (r.z0 + r.z1) / 2;
  if (r.id === 'bridge') {
    const ybase = yF + 1.05, ytop = yC, zf = r.z0;
    for (const x of [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + 0.5], 0.04, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + 0.5], [r.x1, ytop, zf + 0.5], 0.055, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.055, 8);
    for (const s of [-1, 1]) { const x = s * r.x1; for (const z of [r.z0, r.z0 + 1.8, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.045, 8); k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.055, 8); k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.055, 8); }
    k.box('glowBlue', 0, ytop - 0.06, zf + 0.7, 6.0, 0.012, 0.03);
    k.box('hullAccent', 0, yF + 1.5, r.z1 - 0.012, r.x1 - r.x0 - 0.2, 0.14, 0.006);
    for (let i = 0; i < 6; i++) k.box(i % 3 ? 'glowCyan' : 'glowAmber', -2.0 + i * 0.8, yC - 0.2, -24.5, 0.2, 0.012, 0.8);
    return;
  }
  if (r.id === 'cabin_a' || r.id === 'cabin_b') {
    ribs(k, r, 3.2);
    for (const x of [-2.6, 2.6]) k.box('glowWhite', x, yC - 0.025, zm, 0.5, 0.02, r.z1 - r.z0 - 0.8);
    k.box('glowCool', 0, yC - 0.025, zm, 0.12, 0.02, r.z1 - r.z0 - 0.8);
    // overhead luggage rails over the window banks
    for (const s of [-1, 1]) {
      k.bevelBox('gunmetal', s * 5.3, yC - 0.5, zm, 3.7, 0.06, r.z1 - r.z0 - 0.6, 0.015);
      k.bevelBox('steelDark', s * 5.3, yC - 0.32, zm, 3.76, 0.32, r.z1 - r.z0 - 0.7, 0.04);
      k.box('glowAmber', s * 5.3, yC - 0.5, zm, 3.5, 0.02, 0.02);
    }
    // floor guide lights down both aisles
    for (const x of [-1.8 - 0.8, 1.8 + 0.8]) k.box('glowAmber', x, yF + 0.012, zm, 0.03, 0.004, r.z1 - r.z0 - 0.6);
    for (let i = 0; i < 6; i++) k.box('glowCyan', 0, yC - 0.05, r.z0 + 1.0 + i * 2.6, 0.2, 0.012, 0.1);
    return;
  }
  if (r.id === 'galley') { k.box('glowAmber', r.x0 + 0.012, yF + 2.1, 0.4, 0.006, 0.3, 2.4); k.box('glowWhite', xm, yC - 0.025, zm, 0.4, 0.02, r.z1 - r.z0 - 0.8); return; }
  if (r.id === 'gate') { k.box('hazard', r.x1 - 0.012, yF + 2.4, 9.3, 0.006, 0.12, 2.0); k.box('glowGreen', r.x1 - 0.012, yF + 2.65, 9.3, 0.006, 0.08, 0.4); k.box('glowWhite', xm, yC - 0.025, zm, 0.4, 0.02, r.z1 - r.z0 - 0.8); return; }
  if (r.id === 'machinery') {
    for (const [x, key] of [[-5.5, 'pipeBlue'], [-5.1, 'pipeRed'], [5.4, 'pipeYellow'], [5.7, 'pipeSteel']]) {
      k.pipe(key, [x, yC - 0.22, r.z0 + 0.2], [x, yC - 0.22, r.z1 - 0.2], 0.06, 10);
      for (let z = r.z0 + 0.7; z < r.z1 - 0.4; z += 1.6) k.box('steelDark', x, yC - 0.11, z, 0.1, 0.12, 0.09);
    }
    k.lathe('hazard', -2.6, yF + 0.005, 14.4, [[1.5, 0], [1.62, 0]], 28);
    out.coreSpec = { room: 'machinery', x: -2.6, y: yF + 1.4, z: 14.4, r: 0.45, h: 1.7 };
    return;
  }
  if (r.id === 'bay') {
    const L = r.z1 - r.z0;
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.8) { for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02); k.bevelBox('steelDark', 0, yC - 0.1, z, r.x1 - r.x0, 0.14, 0.16, 0.02); }
    for (const sx of [-1, 1]) { k.bevelBox('gunmetal', sx * (r.x1 - 0.2), yF + 0.45, zm, 0.1, 0.12, L - 0.8, 0.012); for (let z = r.z0 + 0.8; z < r.z1 - 0.6; z += 0.8) k.cyl('steel', sx * (r.x1 - 0.27), yF + 0.45, z, 0.05, 0.03, 8, { axis: 'x' }); }
    for (const x of [-2.1, 2.1]) k.box('glowAmber', x, yF + 0.012, zm, 0.06, 0.003, L - 1.0);
    // a gantry rail down the bay with a hoist block over the boat
    k.bevelBox('steelDark', 0, yC - 0.3, zm - 2, 0.3, 0.3, L - 1.5, 0.02);
    k.bevelBox('hazard', 0, yC - 0.62, 22, 0.6, 0.3, 0.5, 0.03); k.pipe('steel', [0, yC - 0.8, 22], [0, yC - 1.4, 22], 0.025);
    const w = 4.8, h = 3.2;
    k.bevelBox('steelDark', -w / 2 - 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.12, r.z1 - 0.06, w + 0.5, 0.24, 0.3, 0.02);
    for (let i = 0; i < 10; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -w / 2 + 0.2 + i * 0.5, h + 0.12, r.z1 - 0.215, 0.25, 0.16, 0.01);
    return;
  }
  k.box('glowWhite', xm, yC - 0.025, zm, 0.4, 0.02, Math.max(0.4, r.z1 - r.z0 - 0.8));
}
export const DESCENDER_CUSTOM = { dress: dressDescenderRoom };

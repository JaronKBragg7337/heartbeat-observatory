// ============================================================================
// ships/bulker/interior.js - the crew block's dressing: canopy frame, passage ceiling ribs and conduits, the cargo control board, the
// machinery pipe racks and the hold bay's ribs, tie-down rails and stern door frame. Thin pieces: the walkable geometry is the layout.
// ============================================================================

import '../raider/props.js';
import '../_liner/props.js';

export function dressBulkerRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h, xm = (r.x0 + r.x1) / 2, zm = (r.z0 + r.z1) / 2, HAZ = 'hazard';
  if (r.id === 'bridge') {
    const ybase = yF + 1.05, ytop = yC, zf = r.z0;
    for (const x of [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + 0.5], 0.04, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + 0.5], [r.x1, ytop, zf + 0.5], 0.055, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.055, 8);
    for (const s of [-1, 1]) { const x = s * r.x1; for (const z of [r.z0, r.z0 + 2.2, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.045, 8); k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.055, 8); k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.055, 8); }
    k.box('glowBlue', 0, ytop - 0.06, zf + 0.7, 8.0, 0.012, 0.03);
    k.box('hullAccent', 0, yF + 1.5, r.z1 - 0.012, r.x1 - r.x0 - 0.2, 0.14, 0.006);
    for (let i = 0; i < 8; i++) k.box(i % 3 ? 'glowCyan' : 'glowAmber', -2.7 + i * 0.77, yC - 0.2, -116.0, 0.2, 0.012, 0.9);
    return;
  }
  if (r.id === 'passage') {
    for (const sx of [-1, 1]) { k.pipe(sx < 0 ? 'pipeBlue' : 'pipeRed', [sx * 0.6, yC - 0.14, r.z0 + 0.1], [sx * 0.6, yC - 0.14, r.z1 - 0.1], 0.04, 8); k.box('glowAmber', sx * 0.62, yF + 0.006, zm, 0.012, 0.004, r.z1 - r.z0 - 0.4); }
    k.box('glowWhite', 0, yC - 0.025, zm, 0.3, 0.02, r.z1 - r.z0 - 0.6);
    for (let z = r.z0 + 1; z < r.z1 - 0.6; z += 3) k.bevelBox('steelDark', 0, yC - 0.05, z, 2.0, 0.1, 0.1, 0.015);
    return;
  }
  if (r.id === 'machinery') {
    for (const [x, key] of [[-7.8, 'pipeBlue'], [-7.4, 'pipeRed'], [-1.7, 'pipeYellow']]) { k.pipe(key, [x, yC - 0.22, r.z0 + 0.2], [x, yC - 0.22, r.z1 - 0.2], 0.06, 10); for (let z = r.z0 + 0.7; z < r.z1 - 0.4; z += 1.6) k.box('steelDark', x, yC - 0.11, z, 0.1, 0.12, 0.09); }
    k.lathe(HAZ, -6.0, yF + 0.005, -97.4, [[1.5, 0], [1.62, 0]], 28);
    out.coreSpec = { room: 'machinery', x: -6.0, y: yF + 1.4, z: -97.4, r: 0.45, h: 1.7 };
    return;
  }
  if (r.id === 'control') {
    for (let i = 0; i < 6; i++) { const bx = r.x0 + 0.012, bz = r.z0 + 0.7 + (i % 3) * 1.1, by = yF + 1.7 + Math.floor(i / 3) * 0.6; k.box('steelDark', bx, by, bz, 0.01, 0.4, 0.8); k.box('glowGreen', bx + 0.004, by + (i % 2 ? -0.1 : 0.1), bz, 0.006, 0.07, 0.6); }
    k.box('glowWhite', xm, yC - 0.025, zm, 0.4, 0.02, r.z1 - r.z0 - 0.8);
    return;
  }
  if (r.id === 'bay') {
    const L = r.z1 - r.z0;
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.8) { for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02); k.bevelBox('steelDark', 0, yC - 0.1, z, r.x1 - r.x0, 0.14, 0.16, 0.02); }
    for (const sx of [-1, 1]) { k.bevelBox('gunmetal', sx * (r.x1 - 0.2), yF + 0.45, zm, 0.1, 0.12, L - 0.8, 0.012); for (let z = r.z0 + 0.8; z < r.z1 - 0.6; z += 0.8) k.cyl('steel', sx * (r.x1 - 0.27), yF + 0.45, z, 0.05, 0.03, 8, { axis: 'x' }); }
    for (const x of [-1.6, 1.6]) k.box('glowAmber', x, yF + 0.012, zm, 0.06, 0.003, L - 1.0);
    const w = 6.0, h = 4.2;
    k.bevelBox('steelDark', -w / 2 - 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.12, r.z1 - 0.06, w + 0.5, 0.24, 0.3, 0.02);
    for (let i = 0; i < 12; i++) k.box(i % 2 ? HAZ : 'gunmetal', -w / 2 + 0.2 + i * 0.5, h + 0.12, r.z1 - 0.215, 0.25, 0.16, 0.01);
    return;
  }
  if (r.id === 'gate') { k.box(HAZ, r.x1 - 0.012, yF + 2.3, -99.4, 0.006, 0.12, 1.2); k.box('glowAmber', r.x1 - 0.012, yF + 2.55, -99.4, 0.006, 0.08, 0.3); }
  k.box('glowWhite', xm, yC - 0.025, zm, 0.4, 0.02, Math.max(0.4, r.z1 - r.z0 - 0.8));
}
export const BULKER_CUSTOM = { dress: dressBulkerRoom };

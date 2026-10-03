// ============================================================================
// ships/lifeboat/interior.js - the dressing that is not furniture, for a boat built to be used hard: canopy frame, ribs, a handrail down the
// cabin, pipe runs, a plated stern bay, hazard tape at the hatch. Thin pieces: the walkable geometry is the layout, not these meshes.
// ============================================================================

import '../raider/props.js';
import '../_liner/props.js';

export function dressLifeboatRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h, xm = (r.x0 + r.x1) / 2, zm = (r.z0 + r.z1) / 2;
  if (r.id === 'cockpit') {
    const ybase = yF + 1.05, ytop = yC, zf = r.z0;
    for (const x of [-1.9, -1.0, 0, 1.0, 1.9]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + 0.4], 0.035, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + 0.4], [r.x1, ytop, zf + 0.4], 0.05, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.05, 8);
    for (const s of [-1, 1]) { const x = s * r.x1; for (const z of [r.z0, r.z1 - 0.3]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.04, 8); k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.3], 0.05, 8); k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.3], 0.05, 8); }
    k.box('glowAmber', 0, ytop - 0.06, zf + 0.5, 3.0, 0.012, 0.03);
    for (let i = 0; i < 5; i++) k.box(i % 2 ? 'glowCyan' : 'glowAmber', -1.0 + i * 0.5, yC - 0.1, -3.4, 0.14, 0.012, 0.5);
    return;
  }
  if (r.id === 'cabin') {
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.3) k.bevelBox('steelDark', xm, yC - 0.05, z, r.x1 - r.x0 - 0.2, 0.1, 0.1, 0.015);
    for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.3) for (const x of [r.x0 + 0.06, r.x1 - 0.06]) k.bevelBox('steelDark', x, (yF + yC) / 2, z, 0.08, r.h, 0.1, 0.012);
    k.pipe('steel', [r.x0 + 0.08, yF + 1.1, r.z0 + 0.3], [r.x0 + 0.08, yF + 1.1, r.z1 - 0.3], 0.025, 6);                   // the handrail down the port wall
    k.pipe('pipeBlue', [xm + 0.4, yC - 0.14, r.z0 + 0.1], [xm + 0.4, yC - 0.14, r.z1 - 0.1], 0.04, 8);
    k.pipe('pipeRed', [xm + 0.62, yC - 0.14, r.z0 + 0.1], [xm + 0.62, yC - 0.14, r.z1 - 0.1], 0.03, 8);
    k.box('glowWhite', xm, yC - 0.025, zm, 0.3, 0.02, r.z1 - r.z0 - 0.8);
    k.box('hazard', xm, yF + 0.01, r.z1 - 0.2, r.x1 - r.x0 - 0.2, 0.003, 0.08);
    return;
  }
  if (r.id === 'lock') {
    k.box('hazard', r.x1 - 0.012, yF + 2.0, -0.9, 0.006, 0.1, 1.1);
    k.box('glowAmber', r.x1 - 0.012, yF + 2.2, -0.9, 0.006, 0.06, 0.3);
    return;
  }
  if (r.id === 'hold') {
    for (let z = r.z0 + 0.4; z < r.z1; z += 0.8) for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.06), (yF + yC) / 2, z, 0.08, r.h, 0.1, 0.012);
    for (const sx of [-1, 1]) for (let z = r.z0 + 0.3; z < r.z1 - 0.2; z += 0.5) k.cyl('steel', sx * (r.x1 - 0.14), yF + 0.4, z, 0.03, 0.03, 6, { axis: 'x' });
    for (const x of [-0.5, 0.5]) k.box('glowAmber', x, yF + 0.01, zm, 0.04, 0.003, r.z1 - r.z0 - 0.6);
    k.box('glowWhite', xm, yC - 0.025, zm, 0.3, 0.02, r.z1 - r.z0 - 0.5);
    return;
  }
  k.box('glowWhite', xm, yC - 0.025, zm, 0.3, 0.02, Math.max(0.4, r.z1 - r.z0 - 0.5));
}
export const LIFEBOAT_CUSTOM = { dress: dressLifeboatRoom };

// ============================================================================
// ships/_liner/dress.js - a generic room dresser for the small ships of the line: it reads a room's kind and adds the dressing that is not
// furniture (canopy frame, ceiling ribs and light strips, conduit runs, pipe racks, bay ribs and tie-down rails, a stern door frame, hazard
// tape at a hatch). Pieces are thin: the walkable geometry is the layout, not these meshes.
// ============================================================================

import '../raider/props.js';
import '../_liner/props.js';

const HAZ = 'hazard';

/** cfg: { doorW, doorH } for the stern door frame of a cargo room. */
export function dressGeneric(k, layout, r, out, cfg = {}) {
  const yF = r.y, yC = r.y + r.h, xm = (r.x0 + r.x1) / 2, zm = (r.z0 + r.z1) / 2, W = r.x1 - r.x0, L = r.z1 - r.z0;
  if (r.kind === 'bridge') {
    const ybase = yF + 1.05, ytop = yC, zf = r.z0, n = Math.max(3, Math.round(W / 1.4));
    for (let i = 0; i <= n; i++) { const x = r.x0 + 0.3 + ((W - 0.6) * i) / n; k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + 0.5], 0.04, 8); }
    k.pipe('gunmetal', [r.x0, ytop, zf + 0.5], [r.x1, ytop, zf + 0.5], 0.055, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.055, 8);
    for (const s of [-1, 1]) { const x = s < 0 ? r.x0 : r.x1; for (const z of [r.z0, r.z0 + L * 0.4, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.045, 8); k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.055, 8); k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.055, 8); }
    k.box('glowBlue', xm, ytop - 0.06, zf + 0.7, W - 1.2, 0.012, 0.03);
    k.box('hullAccent', xm, yF + 1.5, r.z1 - 0.012, W - 0.2, 0.14, 0.006);
    for (let i = 0; i < 6; i++) k.box(i % 3 ? 'glowCyan' : 'glowAmber', xm - 1.8 + i * 0.7, yC - 0.2, zf + L * 0.45, 0.2, 0.012, 0.8);
    return;
  }
  if (r.kind === 'corridor') {
    for (const sx of [-1, 1]) { k.pipe(sx < 0 ? 'pipeBlue' : 'pipeRed', [xm + sx * 0.6, yC - 0.14, r.z0 + 0.1], [xm + sx * 0.6, yC - 0.14, r.z1 - 0.1], 0.04, 8); k.box('glowAmber', xm + sx * 0.62, yF + 0.006, zm, 0.012, 0.004, L - 0.4); }
    k.box('glowWhite', xm, yC - 0.025, zm, 0.3, 0.02, L - 0.6);
    for (let z = r.z0 + 1; z < r.z1 - 0.6; z += 3) k.bevelBox('steelDark', xm, yC - 0.05, z, W - 0.2, 0.1, 0.1, 0.015);
    return;
  }
  if (r.kind === 'engineering') {
    for (const [x, key] of [[r.x0 + 0.4, 'pipeBlue'], [r.x0 + 0.8, 'pipeRed'], [r.x1 - 0.5, 'pipeYellow'], [r.x1 - 0.9, 'pipeSteel']]) {
      k.pipe(key, [x, yC - 0.22, r.z0 + 0.2], [x, yC - 0.22, r.z1 - 0.2], 0.06, 10);
      for (let z = r.z0 + 0.7; z < r.z1 - 0.4; z += 1.6) k.box('steelDark', x, yC - 0.11, z, 0.1, 0.12, 0.09);
    }
    const core = layout.props.find((p) => p.room === r.id && p.kind === 'minireactor');
    if (core) { k.lathe(HAZ, core.x, yF + 0.005, core.z, [[1.3, 0], [1.42, 0]], 28); out.coreSpec = { room: r.id, x: core.x, y: yF + 1.2, z: core.z, r: 0.4, h: 1.5 }; }
    return;
  }
  if (r.kind === 'cargo') {
    for (let z = r.z0 + 0.7; z < r.z1 - 0.3; z += 1.6) { for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (W / 2 - 0.08) + xm, (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02); k.bevelBox('steelDark', xm, yC - 0.1, z, W, 0.14, 0.16, 0.02); }
    for (const sx of [-1, 1]) { k.bevelBox('gunmetal', xm + sx * (W / 2 - 0.2), yF + 0.45, zm, 0.1, 0.12, L - 0.8, 0.012); for (let z = r.z0 + 0.7; z < r.z1 - 0.6; z += 0.8) k.cyl('steel', xm + sx * (W / 2 - 0.27), yF + 0.45, z, 0.05, 0.03, 8, { axis: 'x' }); }
    for (const x of [xm - 0.7, xm + 0.7]) k.box('glowAmber', x, yF + 0.012, zm, 0.06, 0.003, L - 0.8);
    const w = cfg.doorW ?? 2.8, h = cfg.doorH ?? 2.8;
    k.bevelBox('steelDark', xm - w / 2 - 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', xm + w / 2 + 0.12, h / 2, r.z1 - 0.06, 0.24, h + 0.24, 0.3, 0.02);
    k.bevelBox('steelDark', xm, h + 0.12, r.z1 - 0.06, w + 0.5, 0.24, 0.3, 0.02);
    const n = Math.round(w / 0.25);
    for (let i = 0; i < n; i++) k.box(i % 2 ? HAZ : 'gunmetal', xm - w / 2 + 0.12 + i * (w / n), h + 0.12, r.z1 - 0.215, w / n, 0.16, 0.01);
    return;
  }
  if (r.kind === 'airlock') {
    const od = layout.doors.find((d) => d.a === r.id && d.kind === 'outer');
    if (od) { k.box(HAZ, od.at - 0.012, yF + 2.3, od.c, 0.006, 0.12, od.w + 0.4); k.box('glowAmber', od.at - 0.012, yF + 2.55, od.c, 0.006, 0.08, 0.3); }
  }
  if (r.kind === 'crew' || r.kind === 'galley') { const x = r.x0 + 0.014; k.box('glowAmber', x, yF + 2.2, zm + 0.4, 0.006, 0.3, 0.8); }
  k.box('glowWhite', xm, yC - 0.025, zm, Math.min(0.5, W * 0.15), 0.02, Math.max(0.4, L - 0.8));
}

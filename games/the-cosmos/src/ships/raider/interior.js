// ============================================================================
// ships/raider/interior.js - the dressing that is not furniture: the cockpit canopy frame, the engine room pipe racks, the hold ribs
// and tie-downs, the airlock hazard frame. Called by the shared interior builder (src/ship/shipInterior.js) for each room of a
// layout that carries `custom` (a ship that does its own dressing). Same Kit, same materials as the Meridian.
// ============================================================================

import './props.js';

const HAZ = 'hazard';

export function dressRaiderRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h;
  if (r.id === 'cockpit') {
    // the canopy frame: raked mullions up the windscreen, a rail along the sill and the roof edge, posts down each side
    const ybase = yF + 1.05, ytop = yC, raked = 0.5, zf = r.z0;
    for (const x of [-2.8, -1.9, -0.95, 0.95, 1.9, 2.8]) k.pipe('gunmetal', [x, ybase, zf], [x, ytop, zf + raked], 0.034, 8);
    k.pipe('gunmetal', [r.x0, ytop, zf + raked], [r.x1, ytop, zf + raked], 0.05, 8);
    k.pipe('gunmetal', [r.x0, ybase, zf], [r.x1, ybase, zf], 0.05, 8);
    for (const s of [-1, 1]) {
      const x = s * r.x1;
      for (const z of [r.z0, r.z0 + 1.1, r.z0 + 2.2, r.z1 - 0.4]) k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.04, 8);
      k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.05, 8);
      k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.05, 8);
    }
    k.box('glowBlue', 0, ytop - 0.06, zf + raked + 0.2, 5.0, 0.012, 0.03);
    // a red stripe across the back wall: the raiders mark
    k.box('red', 0, yF + 1.55, r.z1 - 0.012, r.x1 - r.x0 - 0.2, 0.14, 0.006);
    return;
  }
  if (r.id === 'engine') {
    for (const [x, key] of [[-3.9, 'pipeBlue'], [-3.55, 'pipeRed'], [3.2, 'pipeYellow']]) {
      k.pipe(key, [x, yC - 0.2, r.z0 + 0.2], [x, yC - 0.2, r.z1 - 0.2], 0.06, 10);
      for (let z = r.z0 + 0.7; z < r.z1 - 0.4; z += 1.6) k.box('steelDark', x, yC - 0.1, z, 0.1, 0.1, 0.09);
    }
    k.lathe(HAZ, -2.3, yF + 0.005, 6.6, [[1.3, 0], [1.42, 0]], 28);
    for (const x of [-0.95, 2.4]) k.box(HAZ, x, yF + 0.012, 7.0, 0.06, 0.003, 4.4);          // walkway lines to the hold door
    out.coreSpec = { room: 'engine', x: -2.3, y: yF + 1.2, z: 6.6, r: 0.4, h: 1.5 };
    return;
  }
  if (r.id === 'hold') {
    for (const x of [-3.0, 3.0]) k.bevelBox('steelDark', x, yC - 0.3, (r.z0 + r.z1) / 2, 0.22, 0.28, r.z1 - r.z0 - 0.3, 0.02);   // gantry rails
    k.bevelBox('steelDark', 0, yC - 0.3, 12.8, 6.2, 0.26, 0.26, 0.02);
    k.bevelBox(HAZ, 0, yC - 0.58, 12.8, 0.6, 0.3, 0.5, 0.03);
    k.pipe('steel', [0, yC - 0.72, 12.8], [0, yC - 1.9, 12.8], 0.02);
    k.bevelBox('red', 0, yC - 2.0, 12.8, 0.26, 0.13, 0.13, 0.02);
    for (let z = r.z0 + 0.6; z < r.z1 - 0.3; z += 1.6) for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.13, r.h, 0.15, 0.02);
    for (const x of [-1.8, 1.8]) k.box(HAZ, x, yF + 0.012, 13.0, 0.09, 0.003, 5.8);
    for (let z = 10.4; z < 15.8; z += 1.5) for (const sx of [-1, 1]) k.cyl('steel', sx * 2.5, yF + 0.02, z, 0.055, 0.02, 10);
    // a scorched plate and a red patch bolted over the port wall. Thin: the room's collision is the layout, not these meshes.
    k.box('steelDark', r.x0 + 0.02, yF + 1.55, 12.2, 0.018, 0.85, 0.62);
    k.box('red', r.x0 + 0.032, yF + 1.5, 13.15, 0.01, 0.38, 0.26);
    // the stern door: a frame round the ramp opening, with hazard chevrons along its head
    const w = 3.2, h = 3.0;
    k.bevelBox('steelDark', -w / 2 - 0.1, h / 2, r.z1 - 0.06, 0.2, h + 0.2, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.1, h / 2, r.z1 - 0.06, 0.2, h + 0.2, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.1, r.z1 - 0.06, w + 0.4, 0.2, 0.3, 0.02);
    for (let i = 0; i < 8; i++) k.box(i % 2 ? HAZ : 'gunmetal', -w / 2 + 0.2 + i * 0.4, h + 0.1, r.z1 - 0.215, 0.2, 0.16, 0.01);
    return;
  }
  if (r.id === 'airlock') {
    k.box(HAZ, r.x0 + 0.012, yF + 2.3, 0.6, 0.006, 0.12, 1.2);
    k.box('glowAmber', r.x0 + 0.012, yF + 2.55, 0.6, 0.006, 0.08, 0.3);
    return;
  }
  if (r.id === 'armoury') {
    k.box(HAZ, r.x1 - 0.012, yF + 2.3, 0.1, 0.006, 0.1, 1.6);
    k.box('glowRed', r.x1 - 0.012, yF + 2.5, 0.1, 0.006, 0.05, 0.4);
    return;
  }
  if (r.id === 'crew_a' || r.id === 'galley') {
    // a lived-in strip: a pennant on the wall
    const x = r.id === 'crew_a' ? r.x0 + 0.014 : r.x1 - 0.014, n = r.id === 'crew_a' ? 1 : -1;
    k.box('red', x, yF + 2.2, (r.z0 + r.z1) / 2, 0.006, 0.34, 0.9);
    k.box('hazard', x + n * 0.003, yF + 2.2, (r.z0 + r.z1) / 2 + 0.2, 0.004, 0.2, 0.12);
    k.box('steelDark', x + n * 0.004, yF + 1.35, (r.z0 + r.z1) / 2 - 0.55, 0.012, 0.7, 0.42);
  }
}

export const RAIDER_CUSTOM = { dress: dressRaiderRoom };

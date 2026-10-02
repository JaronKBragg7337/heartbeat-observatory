// ============================================================================
// ships/raider/props.js - the furniture only a raider has. Registered into the shared PROPS table (src/ship/shipProps.js), so
// the interior builder draws them like any other piece: each in its own coordinates, centre on the floor, front toward +Z.
//
// NO BARE BOXES: every piece has a second material for the part you touch and a detail that is not the shape.
// ============================================================================

import { PROPS } from '../../ship/shipProps.js';

const led = (k, x, y, z, key = 'glowGreen', s = 0.012) => k.box(key, x, y, z, s * 2, s * 2, s * 0.8);

/** A rack of long guns behind a bar: the armoury wall. */
PROPS.weaponrack = (k, p) => {
  const w = p.w, h = p.h, d = p.d;
  k.bevelBox('steelDark', 0, h / 2, -d / 2 + 0.03, w, h, 0.06, 0.012);
  k.bevelBox('gunmetal', 0, 0.06, 0, w, 0.12, d, 0.015);
  k.bevelBox('gunmetal', 0, h - 0.05, 0, w, 0.1, d, 0.015);
  for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (w / 2 - 0.025), h / 2, 0, 0.05, h, d, 0.01);
  const n = Math.max(2, Math.round((w - 0.2) / 0.2)), pitch = (w - 0.3) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.15 + i * pitch;
    k.pipe('gunmetal', [x, 0.34, 0.03], [x, 1.5, 0.03], 0.018, 6);                      // barrel
    k.bevelBox('wood', x, 0.62, 0.03, 0.06, 0.5, 0.075, 0.01);                          // stock
    k.bevelBox('plasticDark', x, 1.08, 0.04, 0.04, 0.14, 0.06, 0.008);                  // magazine
    k.box('glowAmber', x, 0.86, 0.075, 0.012, 0.012, 0.006);                            // charge light
  }
  k.bevelBox('steel', 0, 1.2, d / 2 - 0.04, w - 0.08, 0.04, 0.04, 0.01);                // the retaining bar
  k.bevelBox('red', 0, 1.2, d / 2 - 0.015, 0.14, 0.05, 0.012, 0.004);                   // padlock
  led(k, w / 2 - 0.08, h - 0.15, d / 2 + 0.01, 'glowRed');
};

/** A pile of what was taken: sealed cases, one open, ingots and a lamp. */
PROPS.loot = (k, p) => {
  k.bevelBox('hazard', 0, 0.05, 0, p.w, 0.1, p.d, 0.015);                               // the pallet
  k.bevelBox('crateB', -0.4, 0.46, -0.1, 0.9, 0.7, 0.8, 0.03);
  k.bevelBox('steelDark', -0.4, 0.46, 0.31, 0.88, 0.05, 0.03, 0.006);
  k.bevelBox('crateC', 0.35, 0.36, 0.2, 0.8, 0.5, 0.7, 0.03);
  k.bevelBox('crateA', -0.35, 1.02, -0.1, 0.7, 0.42, 0.6, 0.03);
  // the open case, with ingots in it
  k.bevelBox('steelDark', 0.4, 0.78, 0.2, 0.7, 0.06, 0.64, 0.01);
  for (let i = 0; i < 6; i++) k.bevelBox('copper', 0.22 + (i % 3) * 0.18, 0.84 + Math.floor(i / 3) * 0.05, 0.12 + (i % 2) * 0.16, 0.16, 0.05, 0.09, 0.008);
  k.bevelBox('steelDark', 0.4, 0.98, -0.1, 0.7, 0.04, 0.5, 0.008);                     // the lid, standing open at the back
  k.box('glowAmber', 0.4, 1.0, 0.18, 0.5, 0.012, 0.012);
};

/** The raider reactor: smaller than the Meridian one, same idea: pedestal, containment rods, coils, the core a separate pulsing mesh. */
PROPS.minireactor = (k, p) => {
  const R = 0.95;
  k.cyl('steelDark', 0, 0.08, 0, R * 1.1, 0.16, 8);
  k.cyl('steel', 0, 0.18, 0, R, 0.04, 8);
  k.cyl('gunmetal', 0, p.h - 0.08, 0, R * 1.05, 0.14, 8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * R * 0.7, z = Math.sin(a) * R * 0.7;
    k.cyl('steel', x, p.h / 2, z, 0.045, p.h - 0.3, 8);
    for (const y of [0.45, p.h / 2, p.h - 0.45]) k.cyl('gunmetal', x, y, z, 0.07, 0.08, 8);
  }
  for (const y of [0.7, 1.2, 1.7]) k.lathe('copper', 0, y, 0, [[R * 0.66, -0.03], [R * 0.74, -0.03], [R * 0.74, 0.03], [R * 0.66, 0.03]], 20);
  for (const a of [0.4, 2.0, 3.6, 5.2]) {
    const x = Math.cos(a) * R * 1.02, z = Math.sin(a) * R * 1.02;
    k.pipe('pipeBlue', [x, 0.16, z], [x, p.h - 0.1, z], 0.06, 8);
    k.cyl('steelDark', x, 0.45, z, 0.085, 0.1, 8); k.cyl('steelDark', x, p.h - 0.45, z, 0.085, 0.1, 8);
  }
  for (let i = 0; i < 18; i++) {                                                        // the catwalk ring posts, with a gap where you walk
    const a = (i / 18) * Math.PI * 2;
    if (Math.abs(a - Math.PI * 1.5) < 0.5) continue;
    k.cyl('steelDark', Math.cos(a) * R * 1.12, 0.4, Math.sin(a) * R * 1.12, 0.016, 0.45, 6);
  }
  k.lathe('hazard', 0, 0.005, 0, [[R * 1.18, 0], [R * 1.28, 0]], 24);
};

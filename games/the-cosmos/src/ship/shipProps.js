// ============================================================================
// shipProps.js — the things people live and work with.
//
// OWNS: the geometry of furniture and machinery, drawn in each piece's own
//       coordinates (centre on the floor, front toward local +Z unless the piece
//       says otherwise) so shipInterior.js can place any of them with one call.
// DOES NOT OWN: where they go (shipSpec.js) or what they are made of (a key
//       into shipTextures.js).
//
// NO BARE BOXES. Anything you can walk up to is a chamfered box or a lathe, has
// a second material for the part you touch, and carries at least one small
// detail that is not the shape itself: a handle, a vent, a status light, a seam.
// ============================================================================

import { mulberry } from './shipTextures.js';

const led = (k, x, y, z, key = 'glowGreen', s = 0.012) => k.box(key, x, y, z, s * 2, s * 2, s * 0.8);

/** Little vent slots on a face. */
function vents(k, key, x, y, z, w, n, gap = 0.03, h = 0.012, depth = 0.012, facing = 'z') {
  for (let i = 0; i < n; i++) {
    const yy = y + i * gap;
    if (facing === 'z') k.box(key, x, yy, z, w, h, depth);
    else k.box(key, x, yy, z, depth, h, w);
  }
}

function handle(k, x, y, z, len = 0.12, vertical = true, key = 'steel') {
  if (vertical) { k.box(key, x, y, z, 0.018, len, 0.018); k.box(key, x, y + len / 2, z - 0.015, 0.012, 0.012, 0.03); k.box(key, x, y - len / 2, z - 0.015, 0.012, 0.012, 0.03); }
  else { k.box(key, x, y, z, len, 0.018, 0.018); k.box(key, x - len / 2, y, z - 0.015, 0.012, 0.012, 0.03); k.box(key, x + len / 2, y, z - 0.015, 0.012, 0.012, 0.03); }
}

export const PROPS = {

  // ------------------------------------------------------------------ locker
  locker(k, p) {
    const w = p.w, h = p.h, d = p.d;
    k.bevelBox('steelDark', 0, h / 2, 0, w, h, d, 0.02);
    // door on the front, slightly proud, with louvres and a handle
    k.bevelBox('steel', 0, h / 2 + 0.02, d / 2 + 0.006, w - 0.06, h - 0.1, 0.016, 0.006);
    vents(k, 'gunmetal', 0, h - 0.34, d / 2 + 0.017, w - 0.2, 5, 0.03);
    vents(k, 'gunmetal', 0, 0.18, d / 2 + 0.017, w - 0.2, 3, 0.03);
    handle(k, w / 2 - 0.09, h * 0.5, d / 2 + 0.03, 0.14);
    k.box('gunmetal', 0, h * 0.5 + 0.0, d / 2 + 0.016, 0.006, h - 0.14, 0.004);
    led(k, -w / 2 + 0.07, h - 0.18, d / 2 + 0.018, 'glowGreen');
    k.box('white', 0, h - 0.12, d / 2 + 0.018, 0.14, 0.05, 0.004);
    k.box('gunmetal', 0, 0.03, 0, w + 0.02, 0.06, d + 0.02);
  },

  // -------------------------------------------------------------------- bunk
  // Long axis along local Z, ladder on local +X.
  bunk(k, p) {
    const w = p.w, d = p.d;
    const post = 0.05;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.bevelBox('steelDark', sx * (w / 2 - post / 2), p.h / 2, sz * (d / 2 - post / 2), post, p.h, post, 0.008);
    }
    for (const y of [0.34, 1.16]) {
      // frame and base
      k.bevelBox('steelDark', 0, y, 0, w - 0.02, 0.07, d - 0.02, 0.012);
      k.pillow('mattress', 0, y + 0.12, 0.02, w - 0.1, 0.17, d - 0.12, 3.6);
      k.pillow('white', 0, y + 0.23, -d / 2 + 0.3, w - 0.26, 0.11, 0.4, 2.4);            // pillow
      k.pillow('blanket', 0, y + 0.22, 0.3, w - 0.12, 0.09, d * 0.52, 3.2);
      // reading lamp
      k.bevelBox('plasticDark', -w / 2 + 0.1, y + 0.55, -d / 2 + 0.07, 0.1, 0.06, 0.05, 0.01);
      k.box('glowAmber', -w / 2 + 0.1, y + 0.55, -d / 2 + 0.096, 0.07, 0.03, 0.004);
    }
    // bunk-end privacy panel
    k.bevelBox('steel', 0, 0.75, -d / 2 + 0.02, w - 0.06, 0.32, 0.02, 0.006);
    // guard rail on the upper bunk
    k.bevelBox('steel', -w / 2 + 0.04, 1.42, 0, 0.03, 0.2, d - 0.3, 0.008);
    // drawer under the lower bunk
    k.bevelBox('steel', 0, 0.14, 0, w - 0.1, 0.16, d - 0.18, 0.012);
    handle(k, 0, 0.14, d / 2 - 0.09 + 0.01, 0.12, false);
    // ladder on +X
    const lx = w / 2 + 0.005;
    for (const dz of [-0.22, 0.22]) k.bevelBox('steel', lx, 0.85, dz, 0.025, 1.5, 0.025, 0.006);
    for (let i = 0; i < 5; i++) k.box('steel', lx, 0.35 + i * 0.26, 0, 0.02, 0.022, 0.5);
    // frame rails between the posts
    for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (w / 2 - 0.025), 1.9 - 0.03, 0, 0.03, 0.05, d - 0.06, 0.008);
  },

  // ------------------------------------------------------------------ medbed
  medbed(k, p) {
    // long axis along X, head at -X
    k.bevelBox('steelDark', 0, 0.16, 0, 1.5, 0.28, 0.55, 0.03);
    k.bevelBox('steel', 0, 0.06, 0, 1.7, 0.12, 0.7, 0.03);
    k.bevelBox('white', 0.05, 0.42, 0, 1.95, 0.1, 0.8, 0.045);
    k.bevelBox('white', -0.72, 0.55, 0, 0.5, 0.06, 0.55, 0.03);                           // raised back
    k.bevelBox('white', -0.85, 0.6, 0, 0.3, 0.09, 0.4, 0.04);                             // pillow
    for (const sz of [-1, 1]) {
      k.bevelBox('steel', 0.1, 0.55, sz * 0.43, 1.3, 0.05, 0.03, 0.008);
      k.box('steel', -0.5, 0.48, sz * 0.43, 0.03, 0.14, 0.03);
      k.box('steel', 0.7, 0.48, sz * 0.43, 0.03, 0.14, 0.03);
    }
    k.bevelBox('plasticDark', 0.95, 0.5, 0, 0.06, 0.12, 0.7, 0.012);                       // foot board
    led(k, 0.93, 0.56, 0.2, 'glowCyan'); led(k, 0.93, 0.56, -0.2, 'glowGreen');
    if (p.arch) {
      // scanner arch straddling the chest
      const ax = -0.15;
      for (const sz of [-1, 1]) k.bevelBox('white', ax, 0.72, sz * 0.52, 0.16, 1.4, 0.09, 0.02);
      k.bevelBox('white', ax, 1.42, 0, 0.16, 0.09, 1.14, 0.02);
      k.bevelBox('white', ax, 1.33, 0.36, 0.16, 0.1, 0.24, 0.02, {}); k.bevelBox('white', ax, 1.33, -0.36, 0.16, 0.1, 0.24, 0.02);
      k.box('glowCyan', ax + 0.081, 1.42, 0, 0.004, 0.03, 0.95);
      k.box('glowCyan', ax + 0.081, 0.9, 0.52, 0.004, 0.9, 0.03);
      k.box('glowCyan', ax + 0.081, 0.9, -0.52, 0.004, 0.9, 0.03);
    }
  },

  monitor_stand(k, p) {
    k.bevelBox('steelDark', 0, 0.04, 0, 0.42, 0.08, 0.42, 0.015);
    k.cyl('steel', 0, 0.75, 0, 0.022, 1.4, 8);
    k.bevelBox('plasticDark', 0, 1.42, 0.02, 0.44, 0.3, 0.05, 0.012);
    k.box('glowCyan', 0, 1.42, 0.05, 0.4, 0.26, 0.002);
  },

  // ------------------------------------------------------------------- table
  table(k, p) {
    const long = p.d > p.w;
    const mess = p.style === 'mess';
    k.bevelBox(mess ? 'wood' : 'counter', 0, p.h - 0.025, 0, p.w, 0.05, p.d, 0.02);
    k.bevelBox('steel', 0, p.h - 0.05, 0, p.w - 0.04, 0.02, p.d - 0.04, 0.008);
    const n = long ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const z = long ? (i === 0 ? -p.d * 0.3 : p.d * 0.3) : 0;
      k.cyl('steelDark', 0, p.h / 2 - 0.02, z, 0.05, p.h - 0.08, 10);
      k.cyl('steelDark', 0, 0.02, z, 0.2, 0.04, 14);
    }
    if (mess) {
      // trays and mugs
      k.bevelBox('plastic', 0.0, p.h + 0.01, -0.5, 0.35, 0.02, 0.25, 0.008);
      k.cyl('white', 0.2, p.h + 0.06, 0.4, 0.04, 0.1, 10);
      k.cyl('white', -0.18, p.h + 0.06, 0.8, 0.04, 0.1, 10);
      k.bevelBox('red', 0.0, p.h + 0.04, 0.05, 0.16, 0.06, 0.16, 0.012);
    }
  },
  bench(k, p) {
    k.bevelBox('fabricGrey', 0, p.h - 0.04, 0, p.w, 0.08, p.d, 0.03);
    const long = p.d > p.w;
    for (const s of [-1, 1]) {
      if (long) k.bevelBox('steelDark', 0, 0.2, s * (p.d / 2 - 0.15), p.w - 0.06, 0.4, 0.05, 0.012);
      else k.bevelBox('steelDark', s * (p.w / 2 - 0.15), 0.2, 0, 0.05, 0.4, p.d - 0.06, 0.012);
    }
  },

  // ----------------------------------------------------------------- counter
  counter(k, p) {
    const w = p.w, d = p.d, h = p.h;
    const style = p.style || 'galley';
    const body = style === 'med' ? 'white' : (style === 'bench' ? 'steelDark' : 'steel');
    // cabinet body with door pairs
    k.bevelBox(body, 0, (h - 0.05) / 2, -0.01, w, h - 0.05, d - 0.02, 0.02);
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + (i + 0.5) * (w / n);
      k.bevelBox(style === 'med' ? 'white' : 'steelDark', cx, (h - 0.16) / 2 + 0.02, d / 2 - 0.01, w / n - 0.03, h - 0.2, 0.014, 0.006);
      handle(k, cx + w / n * 0.3, h * 0.75, d / 2 + 0.02, 0.1, style === 'bench' ? false : false);
    }
    k.box('gunmetal', 0, 0.05, d / 2 - 0.01, w, 0.08, 0.02);                          // kick
    // worktop
    k.bevelBox(style === 'bench' ? 'wood' : 'counter', 0, h - 0.025, 0.01, w + 0.02, 0.05, d + 0.04, 0.012);
    if (style === 'galley') {
      // sink, tap, hob with two lit burners, backsplash
      if (w > 2.3) {
        k.bevelBox('steelDark', -w * 0.25, h + 0.002, 0.02, 0.6, 0.012, 0.42, 0.006);
        k.cyl('steelDark', -w * 0.25, h - 0.01, 0.02, 0.005, 0.02, 4);
        k.pipe('steel', [-w * 0.25, h, -d / 2 + 0.06], [-w * 0.25, h + 0.3, -d / 2 + 0.06], 0.014);
        k.pipe('steel', [-w * 0.25, h + 0.3, -d / 2 + 0.06], [-w * 0.25, h + 0.3, -d / 2 + 0.22], 0.014);
      } else {
        for (const bx of [-0.35, 0.35]) {
          k.cyl('gunmetal', bx, h + 0.006, 0.02, 0.13, 0.014, 16);
          k.cyl('glowAmber', bx, h + 0.014, 0.02, 0.07, 0.004, 14);
        }
      }
      k.bevelBox('tile', 0, h + 0.25, -d / 2 - 0.0, w, 0.5, 0.02, 0.005);
    } else if (style === 'med') {
      k.bevelBox('steelDark', -w * 0.3, h + 0.002, 0.02, 0.5, 0.012, 0.36, 0.006);   // sink
      k.pipe('steel', [-w * 0.3, h, -0.14], [-w * 0.3, h + 0.28, -0.14], 0.012);
      k.pipe('steel', [-w * 0.3, h + 0.28, -0.14], [-w * 0.3, h + 0.28, 0.02], 0.012);
      k.bevelBox('red', w * 0.2, h + 0.09, -0.02, 0.3, 0.16, 0.22, 0.02);             // first-aid case
      k.box('white', w * 0.2, h + 0.09, 0.09, 0.14, 0.03, 0.004);
      k.box('white', w * 0.2, h + 0.09, 0.09, 0.03, 0.14, 0.004);
    } else if (style === 'bench') {
      // vice, tool rail, bins
      k.bevelBox('gunmetal', 0.5, h + 0.07, 0.05, 0.16, 0.14, 0.2, 0.015);
      k.bevelBox('steel', 0.5, h + 0.07, 0.19, 0.06, 0.1, 0.07, 0.01);
      k.bevelBox('steelDark', 0, h + 0.75, -d / 2 + 0.03, w - 0.1, 0.9, 0.03, 0.008);   // pegboard
      for (let i = 0; i < 8; i++) {
        const tx = -w / 2 + 0.25 + i * (w - 0.5) / 7;
        k.box(i % 2 ? 'steel' : 'copper', tx, h + 0.9 - (i % 3) * 0.14, -d / 2 + 0.06, 0.025, 0.24, 0.025);
        k.box('red', tx, h + 0.75 - (i % 3) * 0.14, -d / 2 + 0.06, 0.05, 0.08, 0.04);
      }
      for (let i = 0; i < 3; i++) k.bevelBox(['crateA', 'crateB', 'crateC'][i], -w * 0.3 + i * 0.4, h + 0.08, 0.05, 0.3, 0.16, 0.24, 0.02);
    }
  },

  fridge(k, p) {
    k.bevelBox('white', 0, p.h / 2, 0, p.w, p.h, p.d, 0.03);
    k.box('gunmetal', 0, p.h * 0.62, p.d / 2 + 0.003, p.w - 0.04, 0.008, 0.004);
    handle(k, p.w / 2 - 0.08, p.h * 0.78, p.d / 2 + 0.03, 0.4);
    handle(k, p.w / 2 - 0.08, p.h * 0.35, p.d / 2 + 0.03, 0.3);
    k.box('glowCyan', -p.w / 2 + 0.12, p.h * 0.85, p.d / 2 + 0.003, 0.08, 0.04, 0.003);
  },

  printer(k, p) {
    k.bevelBox('steelDark', 0, 0.4, 0, p.w, 0.8, p.d, 0.02);
    k.bevelBox('plasticDark', 0, 1.05, 0, p.w - 0.06, 0.6, p.d - 0.06, 0.02);
    k.bevelBox('glassTint', 0, 1.05, 0.02, p.w - 0.16, 0.5, p.d - 0.14, 0.01);
    k.pipe('steel', [-0.22, 1.28, 0.0], [0.22, 1.28, 0.0], 0.01);
    k.box('glowAmber', 0.05, 1.2, 0.0, 0.05, 0.02, 0.05);
    k.bevelBox('plastic', 0.0, 0.93, 0.0, 0.32, 0.03, 0.32, 0.01);
    led(k, 0.25, 0.7, p.d / 2 + 0.003, 'glowGreen');
  },

  drill(k, p) {
    k.bevelBox('gunmetal', 0, 0.04, 0, 0.5, 0.08, 0.5, 0.015);
    k.cyl('steelDark', 0, 0.7, -0.15, 0.05, 1.3, 10);
    k.bevelBox('red', 0, 1.35, -0.05, 0.2, 0.22, 0.3, 0.02);
    k.cyl('steel', 0, 1.1, 0.0, 0.02, 0.4, 8);
    k.bevelBox('steel', 0, 0.42, 0.02, 0.28, 0.03, 0.28, 0.008);
  },

  crate(k, p) {
    const hsh = Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233 + p.y * 3.1)) * 3;
    const key = ['crateA', 'crateB', 'crateC'][Math.floor(hsh) % 3];
    k.bevelBox(key, 0, p.h / 2, 0, p.w, p.h, p.d, 0.035);
    // corner brackets and straps
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.bevelBox('steelDark', sx * (p.w / 2 - 0.05), p.h / 2, sz * (p.d / 2 - 0.05), 0.09, p.h + 0.01, 0.09, 0.012);
    }
    k.box('steelDark', 0, p.h * 0.5, p.d / 2 + 0.004, p.w * 0.9, 0.06, 0.006);
    k.box('steelDark', 0, p.h * 0.5, -p.d / 2 - 0.004, p.w * 0.9, 0.06, 0.006);
    k.box('hazard', 0, p.h - 0.16, p.d / 2 + 0.004, p.w * 0.5, 0.05, 0.005);
    k.box('white', -p.w * 0.25, p.h * 0.7, p.d / 2 + 0.005, 0.18, 0.12, 0.004);
    k.box('steelDark', p.w / 2 + 0.003, p.h * 0.5, 0, 0.006, 0.06, p.d * 0.9);
  },
  drum(k, p) {
    const r = p.w / 2;
    k.cyl('crateC', 0, p.h / 2, 0, r, p.h, 14);
    for (const y of [0.18, 0.5, 0.82]) k.cyl('steelDark', 0, y * p.h, 0, r + 0.008, 0.03, 14);
    k.cyl('steelDark', 0, p.h + 0.005, 0, r * 0.9, 0.012, 14);
    k.cyl('hazard', 0, p.h * 0.66, 0, r + 0.004, 0.06, 14);
    k.cyl('steel', 0.1, p.h + 0.015, 0.05, 0.03, 0.02, 8);
  },

  // ---------------------------------------------------------------- cabin bits
  bed(k, p) {
    // long axis X, head at +X
    k.bevelBox('steelDark', 0, 0.18, 0, p.w, 0.3, p.d, 0.03);
    k.pillow('mattress', -0.02, 0.42, 0, p.w - 0.08, 0.2, p.d - 0.08, 3.4);
    k.pillow('blanket', -0.25, 0.53, 0, p.w * 0.6, 0.1, p.d - 0.06, 3.2);
    for (const sz of [-1, 1]) k.pillow('white', p.w / 2 - 0.3, 0.6, sz * 0.32, 0.42, 0.14, 0.42, 2.4);
    k.bevelBox('leather', p.w / 2 - 0.02, 0.62, 0, 0.06, 0.7, p.d, 0.02);
    k.box('glowAmber', p.w / 2 - 0.06, 0.98, 0, 0.02, 0.02, p.d * 0.7);
    k.bevelBox('steelDark', p.w / 2 - 0.25, 0.24, p.d / 2 + 0.22, 0.4, 0.4, 0.35, 0.03);   // night stand
  },
  desk(k, p) {
    k.bevelBox('counter', 0, p.h - 0.025, 0, p.w, 0.05, p.d, 0.015);
    for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (p.w / 2 - 0.04), (p.h - 0.05) / 2, 0, 0.05, p.h - 0.05, p.d - 0.06, 0.012);
    k.bevelBox('steelDark', p.w / 2 - 0.3, 0.3, 0.0, 0.42, 0.5, p.d - 0.08, 0.015);
    for (let i = 0; i < 2; i++) { k.box('steel', p.w / 2 - 0.3, 0.14 + i * 0.22, p.d / 2 - 0.035, 0.36, 0.17, 0.006); handle(k, p.w / 2 - 0.3, 0.14 + i * 0.22, p.d / 2 - 0.02, 0.1, false); }
    // lamp and a small screen
    k.cyl('steelDark', -0.5, p.h + 0.01, -0.18, 0.07, 0.02, 12);
    k.pipe('steel', [-0.5, p.h, -0.18], [-0.42, p.h + 0.35, -0.12], 0.008);
    k.bevelBox('white', -0.4, p.h + 0.37, -0.1, 0.16, 0.05, 0.1, 0.015);
    k.bevelBox('plasticDark', 0.0, p.h + 0.15, -0.2, 0.42, 0.28, 0.03, 0.01);
    k.box('glowCyan', 0.0, p.h + 0.15, -0.18, 0.38, 0.24, 0.002);
    // chair
    k.push(0, 0, 0.6, Math.PI);
    PROPS._swivel(k, 'fabricGrey');
    k.pop();
  },
  _swivel(k, fabric = 'fabricGrey') {
    k.cyl('steelDark', 0, 0.24, 0, 0.03, 0.4, 8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.pipe('steelDark', [0, 0.05, 0], [Math.cos(a) * 0.24, 0.03, Math.sin(a) * 0.24], 0.012, 6);
      k.cyl('rubber', Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24, 0.022, 0.04, 8);
    }
    k.pillow(fabric, 0, 0.51, 0, 0.46, 0.11, 0.46, 3.0);
    k.pillow(fabric, 0, 0.84, -0.2, 0.44, 0.58, 0.1, 3.0);
    for (const s of [-1, 1]) { k.box('steelDark', s * 0.24, 0.66, 0, 0.03, 0.03, 0.34); k.box('steelDark', s * 0.24, 0.58, 0.05, 0.03, 0.14, 0.03); }
  },

  toilet(k, p) {
    k.lathe('white', 0, 0, 0, [[0.12, 0], [0.2, 0.1], [0.22, 0.32], [0.2, 0.42], [0.16, 0.42]], 16);
    k.bevelBox('white', 0, 0.55, -0.28, 0.4, 0.36, 0.16, 0.03);
    k.bevelBox('steel', 0, 0.75, -0.28, 0.1, 0.03, 0.06, 0.01);
    k.bevelBox('white', 0, 0.43, 0, 0.36, 0.03, 0.4, 0.015);
  },
  sink(k, p) {
    k.bevelBox('steel', 0, 0.45, -0.05, 0.6, 0.9, 0.35, 0.02);
    k.bevelBox('white', 0, 0.92, 0.0, 0.5, 0.06, 0.4, 0.025);
    k.pipe('steel', [0, 0.95, -0.15], [0, 1.15, -0.15], 0.012);
    k.pipe('steel', [0, 1.15, -0.15], [0, 1.15, -0.02], 0.012);
    k.bevelBox('steel', 0, 1.45, -0.18, 0.5, 0.7, 0.03, 0.01);          // mirror
    k.box('glassTint', 0, 1.45, -0.163, 0.46, 0.66, 0.003);
  },
  shower(k, p) {
    k.bevelBox('tile', 0, 0.04, 0, p.w, 0.08, p.d, 0.02);
    for (const [sx, sz, w, d] of [[-p.w / 2, 0, 0.04, p.d], [0, -p.d / 2, p.w, 0.04]]) k.bevelBox('tile', sx, 1.1, sz, w, 2.2, d, 0.01);
    k.box('glassTint', p.w / 2 - 0.02, 1.1, 0, 0.02, 2.0, p.d - 0.06);
    k.pipe('steel', [-p.w / 2 + 0.12, 1.2, -p.d / 2 + 0.06], [-p.w / 2 + 0.12, 2.1, -p.d / 2 + 0.06], 0.014);
    k.cyl('steel', -p.w / 2 + 0.12, 2.12, -p.d / 2 + 0.16, 0.08, 0.03, 12);
  },

  // ---------------------------------------------------------------- consoles
  // A console: body, sloped top, screen bezel(s). Front toward +Z.
  console(k, p) {
    const w = p.w, d = p.d, h = p.h;
    const n = p.screens || 0;
    const lift = p.lift ?? 0.27, fh = p.fh ?? 0.5;      // how high the screens stand above the desk, and their frame height
    // Wall-side ones (deep, low) get a sloped desk; long/thin ones get a bank of screens
    k.bevelBox('gunmetal', 0, 0.18, 0, w - 0.04, 0.36, d - 0.06, 0.02);         // plinth
    k.bevelBox('plasticDark', 0, h * 0.5 + 0.1, -d * 0.08, w, h - 0.28, d * 0.82, 0.03);
    // sloped control surface
    k.poly('plasticDark', [[-w / 2, h - 0.12, d * 0.24], [w / 2, h - 0.12, d * 0.24], [w / 2, h - 0.04, d * 0.5 - 0.02], [-w / 2, h - 0.04, d * 0.5 - 0.02]]);
    k.poly('gunmetal', [[-w / 2, h - 0.04, d * 0.5 - 0.02], [w / 2, h - 0.04, d * 0.5 - 0.02], [w / 2, h - 0.3, d * 0.5], [-w / 2, h - 0.3, d * 0.5]]);
    // button strips
    const cols = w > d ? Math.floor(w / 0.09) : Math.floor(d / 0.09);
    for (let i = 0; i < cols; i++) {
      const t = (i + 0.5) / cols - 0.5;
      const key = ['glowCyan', 'glowAmber', 'glowGreen', 'glowBlue', 'glowWhite', 'glowRed'][Math.abs(i * 7 + Math.round(p.x * 3)) % 6];
      if (w >= d) k.box(key, t * (w - 0.12), h - 0.055, d * 0.36, 0.045, 0.006, 0.03);
      else k.box(key, 0, h - 0.055, t * (d - 0.12) + d * 0.0, 0.03, 0.006, 0.045);
    }
    // screen frames rise behind the desk
    if (n) {
      const sw = (w >= d ? w : d) / n - 0.06;
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n - 0.5) * (w >= d ? w : d);
        if (w >= d) {
          k.bevelBox('plasticDark', t, h + lift, -d * 0.05, sw, fh, 0.06, 0.015);
          k.bevelBox('gunmetal', t, h + 0.03, -d * 0.05, 0.08, 0.1, 0.06, 0.01);
        } else {
          k.bevelBox('plasticDark', 0, h + lift, t, 0.06, fh, sw, 0.015);
        }
      }
    }
    if (p.decorative) {
      // decorative consoles show a low-key panel too
      k.box('glowBlue', 0, h + 0.1, d * 0.1, w * 0.6, 0.004, 0.004);
    }
  },

  holotable(k, p) {
    k.cyl('gunmetal', 0, 0.5, 0, 0.62, 1.0, 20, { r2: 0.55 });
    k.cyl('glowCyan', 0, 1.003, 0, 0.5, 0.008, 24);
    k.cyl('gunmetal', 0, 1.012, 0, 0.44, 0.01, 24);
    k.cyl('steelDark', 0, 0.34, 0, 0.66, 0.06, 20);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box('glowCyan', Math.cos(a) * 0.6, 0.72, Math.sin(a) * 0.6, 0.02, 0.4, 0.02); }
  },

  // ------------------------------------------------------------- engineering
  reactor(k, p) {
    // pedestal: octagonal base and cap, both chamfered plates; the core is a separate animated mesh
    k.cyl('steelDark', 0, 0.09, 0, 1.75, 0.18, 8);
    k.cyl('steel', 0, 0.2, 0, 1.55, 0.05, 8);
    k.cyl('gunmetal', 0, 2.62, 0, 1.6, 0.16, 8);
    k.cyl('steel', 0, 2.52, 0, 1.4, 0.04, 8);
    // containment: 8 vertical rods with clamps
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05;
      k.cyl('steel', x, 1.4, z, 0.055, 2.3, 8);
      for (const y of [0.5, 1.4, 2.3]) k.cyl('gunmetal', x, y, z, 0.085, 0.1, 8);
    }
    // horizontal coils
    for (const y of [0.75, 1.4, 2.05]) k.lathe('copper', 0, y, 0, [[1.0, -0.035], [1.09, -0.035], [1.09, 0.035], [1.0, 0.035]], 24);
    // coolant lines up through the ceiling and down into the floor
    for (const a of [0.3, 1.9, 3.5, 5.1]) {
      const x = Math.cos(a) * 1.45, z = Math.sin(a) * 1.45;
      k.pipe('pipeBlue', [x, 0.2, z], [x, 2.62, z], 0.07, 8);
      k.cyl('steelDark', x, 0.5, z, 0.1, 0.12, 8); k.cyl('steelDark', x, 2.2, z, 0.1, 0.12, 8);
    }
    // catwalk ring railing (decor only)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      if (Math.abs(a - Math.PI * 1.5) < 0.4) continue;                // a gap on the walking side
      k.cyl('steelDark', Math.cos(a) * 1.72, 0.45, Math.sin(a) * 1.72, 0.018, 0.5, 6);
    }
    k.lathe('steel', 0, 0.9, 0, [[1.72, 0], [1.74, 0]], 24);
  },

  console_decor() {},

  // a handrail along a gantry edge: it runs along the longer side of its box
  rail(k, p) {
    const alongX = p.w >= p.d;
    const L = alongX ? p.w : p.d;
    const n = Math.max(1, Math.round(L / 1.2));
    const at = (t) => (t - 0.5) * L;
    for (let i = 0; i <= n; i++) {
      const t = at(i / n);
      if (alongX) k.bevelBox('steelDark', t, 0.52, 0, 0.05, 1.04, 0.05, 0.01); else k.bevelBox('steelDark', 0, 0.52, t, 0.05, 1.04, 0.05, 0.01);
    }
    for (const y of [1.0, 0.55]) {
      if (alongX) k.pipe('steel', [-L / 2, y, 0], [L / 2, y, 0], 0.02, 8); else k.pipe('steel', [0, y, -L / 2], [0, y, L / 2], 0.02, 8);
    }
    if (alongX) k.box('plasticDark', 0, 0.08, 0, L, 0.16, 0.02); else k.box('plasticDark', 0, 0.08, 0, 0.02, 0.16, L);
  },

  // a round steel column holding something up
  column(k, p) {
    k.cyl('steelDark', 0, p.h / 2, 0, 0.14, p.h, 12);
    k.cyl('gunmetal', 0, 0.06, 0, 0.3, 0.12, 12);
    k.cyl('gunmetal', 0, p.h - 0.06, 0, 0.3, 0.12, 12);
    k.box('hazard', 0, 0.9, 0.145, 0.16, 0.12, 0.006);
  },

  rug(k, p) {
    const c = p.tone === 'med' ? 'tile' : 'fabricBlue';
    k.bevelBox(c, 0, 0.012, 0, p.w, 0.024, p.d, 0.008);
    k.bevelBox(p.tone === 'med' ? 'steel' : 'fabricGrey', 0, 0.026, 0, p.w - 0.18, 0.006, p.d - 0.18, 0.002, { col: p.tone === 'med' ? undefined : [0.55, 0.55, 0.6] });
  },

  // ------------------------------------------------------- lounge seat
  // A long upholstered seat facing local +X (toward the window), back at -X. w = depth, d = length.
  sofa(k, p) {
    const w = p.w, d = p.d;
    k.bevelBox('gunmetal', 0, 0.16, 0, w - 0.06, 0.32, d - 0.04, 0.03);               // plinth
    k.pillow('fabricBlue', 0.07, 0.4, 0, w - 0.22, 0.16, d - 0.14, 3.0);               // seat cushion
    k.pillow('fabricBlue', -w / 2 + 0.14, 0.7, 0, 0.2, 0.56, d - 0.14, 3.0);           // back
    for (const s of [-1, 1]) {
      k.bevelBox('gunmetal', 0, 0.55, s * (d / 2 - 0.05), w - 0.06, 0.44, 0.1, 0.03);  // arms
      k.pillow('fabricBlue', 0, 0.8, s * (d / 2 - 0.05), w - 0.1, 0.07, 0.11, 2.6);
    }
    k.box('glowCyan', w / 2 - 0.035, 0.1, 0, 0.004, 0.012, d - 0.4);                    // a strip under the front edge
    for (let i = 0; i < 3; i++) k.box('gunmetal', -w / 2 + 0.245, 0.7, (i - 1) * 0.5, 0.004, 0.4, 0.008);   // seams
  },

  // ------------------------------------------------------ binoculars on a stand
  telescope(k, p) {
    k.cyl('gunmetal', 0, 0.05, 0, 0.22, 0.1, 18);
    k.cyl('steelDark', 0, 0.5, 0, 0.035, 0.9, 10);
    k.bevelBox('gunmetal', 0, 1.0, 0, 0.14, 0.12, 0.14, 0.03);
    k.bevelBox('steel', 0, 1.11, 0, 0.18, 0.05, 0.12, 0.012);
    // two barrels pointing out at the glass (+X), eyepieces toward the room
    for (const s of [-1, 1]) {
      k.pipe('plasticDark', [-0.2, 1.17, s * 0.06], [0.3, 1.17, s * 0.06], 0.055, 14);
      k.pipe('steelDark', [0.3, 1.17, s * 0.06], [0.36, 1.17, s * 0.06], 0.062, 14);
      k.pipe('rubber', [-0.2, 1.17, s * 0.06], [-0.26, 1.17, s * 0.06], 0.04, 12);
    }
    k.bevelBox('gunmetal', 0.05, 1.17, 0, 0.22, 0.05, 0.1, 0.012);
    k.cyl('glowCyan', 0, 0.102, 0, 0.19, 0.006, 18);
  },

  extinguisher(k, p) {
    k.cyl('red', 0, 0.25, 0.0, 0.08, 0.42, 12);
    k.dome('red', 0, 0.46, 0.0, 0.08, 12, 4, { thetaMax: Math.PI / 2 });
    k.cyl('steelDark', 0, 0.5, 0.0, 0.03, 0.06, 8);
    k.pipe('steelDark', [0.0, 0.5, 0.0], [0.11, 0.42, 0.04], 0.012, 6);
    k.bevelBox('steelDark', 0, 0.3, -0.09, 0.16, 0.34, 0.03, 0.006);
    k.box('white', 0, 0.28, 0.081, 0.06, 0.09, 0.004);
  },

  firstaid(k, p) {
    k.bevelBox('white', 0, 0.15, 0, p.w, p.h, p.d, 0.02);
    k.box('red', 0, 0.15, p.d / 2 + 0.002, 0.16, 0.05, 0.004);
    k.box('red', 0, 0.15, p.d / 2 + 0.002, 0.05, 0.16, 0.004);
  },

  rack(k, p) {
    // server / power rack, front toward +Z
    k.bevelBox('gunmetal', 0, p.h / 2, 0, p.w, p.h, p.d, 0.02);
    const bays = 8;
    for (let i = 0; i < bays; i++) {
      const y = 0.18 + i * ((p.h - 0.36) / bays);
      k.bevelBox(i % 3 === 0 ? 'steelDark' : 'plasticDark', 0, y + 0.1, p.d / 2 + 0.006, p.w - 0.06, 0.2, 0.014, 0.004);
      vents(k, 'gunmetal', -0.12, y + 0.12, p.d / 2 + 0.015, p.w * 0.5, 3, 0.03, 0.008);
      const key = ['glowGreen', 'glowAmber', 'glowCyan'][Math.abs(i * 5 + Math.round(p.z * 3)) % 3];
      led(k, p.w / 2 - 0.08, y + 0.14, p.d / 2 + 0.017, key);
      led(k, p.w / 2 - 0.12, y + 0.14, p.d / 2 + 0.017, i % 2 ? 'glowGreen' : 'glowWhite');
    }
    handle(k, p.w / 2 - 0.04, p.h * 0.5, p.d / 2 + 0.03, 0.3);
  },

  tank(k, p) {
    const r = p.w / 2 - 0.05;
    k.lathe('steel', 0, 0, 0, [[0.0, 0.02], [r * 0.6, 0.02], [r * 0.95, 0.12], [r, 0.28], [r, p.h - 0.28], [r * 0.95, p.h - 0.12], [r * 0.6, p.h - 0.02], [0.0, p.h - 0.02]], 20);
    for (const y of [0.5, 1.3, 2.1]) k.lathe('steelDark', 0, y, 0, [[r, -0.03], [r + 0.025, -0.03], [r + 0.025, 0.03], [r, 0.03]], 20);
    // gauge and lines
    k.cyl('white', 0.0, 1.5, r + 0.02, 0.09, 0.035, 14, { axis: 'z' });
    k.cyl('glowBlue', 0.0, 1.5, r + 0.042, 0.06, 0.004, 14, { axis: 'z' });
    k.pipe('pipeYellow', [r * 0.4, p.h - 0.05, 0], [r * 0.4, p.h + 0.02, 0], 0.05);
    k.bevelBox('steelDark', 0.0, 0.1, 0, p.w + 0.05, 0.2, p.d + 0.05, 0.02);
    // pipe to the neighbour and the wall
    k.pipe('pipeBlue', [-r - 0.02, 0.9, 0], [-r - 0.02, 0.9, 0.1], 0.05);
    k.pipe('pipeBlue', [-r - 0.02, 0.9, 0], [-r - 0.02, 2.55, 0], 0.045);
  },

  pump(k, p) {
    k.bevelBox('steelDark', 0, 0.12, 0, p.w, 0.24, p.d, 0.02);
    k.bevelBox('gunmetal', -0.2, 0.55, 0, 0.6, 0.6, 0.55, 0.04);
    k.cyl('steel', 0.3, 0.55, 0, 0.32, 0.4, 16, { axis: 'z' });
    k.cyl('steelDark', 0.3, 0.55, 0.21, 0.16, 0.04, 12, { axis: 'z' });
    k.cyl('hazard', 0.3, 0.55, -0.21, 0.24, 0.02, 16, { axis: 'z' });
    k.pipe('pipeRed', [0.3, 0.87, 0], [0.3, 1.3, 0], 0.06);
    k.pipe('pipeRed', [0.3, 1.3, 0], [0.3, 1.3, 0.9], 0.06);
    k.pipe('pipeBlue', [-0.2, 0.85, 0], [-0.2, 1.2, 0], 0.05);
    led(k, -0.45, 0.7, 0.284, 'glowGreen');
  },

  // -------------------------------------------------------------- EVA and cargo
  suitrack(k, p) {
    // a locker frame with a hung suit; front toward +Z. w=0.6 d=0.8
    k.bevelBox('steelDark', 0, p.h / 2, -p.d / 2 + 0.03, p.w, p.h, 0.06, 0.012);
    for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (p.w / 2 - 0.02), p.h / 2, 0, 0.04, p.h, p.d, 0.01);
    k.bevelBox('steelDark', 0, p.h - 0.02, 0, p.w, 0.04, p.d, 0.01);
    // the suit
    const z = -0.1;
    k.lathe('white', 0, 1.0, z, [[0.0, 0.7], [0.22, 0.66], [0.25, 0.4], [0.23, 0.0], [0.2, -0.3], [0.0, -0.32]], 14);   // torso
    k.cyl('white', -0.12, 0.42, z, 0.09, 0.85, 10);
    k.cyl('white', 0.12, 0.42, z, 0.09, 0.85, 10);
    k.dome('white', 0, 1.78, z, 0.17, 14, 8);
    k.dome('steelDark', 0, 1.78, z + 0.05, 0.13, 12, 6, { thetaMax: 1.6 });
    k.bevelBox('steel', 0, 1.15, z - 0.2, 0.34, 0.5, 0.16, 0.02);
    for (const sx of [-1, 1]) k.pipe('white', [sx * 0.24, 1.55, z], [sx * 0.3, 1.0, z + 0.05], 0.06, 8);
    k.box('hazard', 0, 1.35, z + 0.235, 0.16, 0.05, 0.006);
    // helmet shelf
    k.bevelBox('steel', 0, 2.0, 0.1, p.w - 0.1, 0.03, 0.5, 0.008);
  },

  rover(k, p) {
    // a six-wheeled survey rover, nose toward local -Z
    k.bevelBox('white', 0, 0.85, 0.05, 1.5, 0.5, 2.6, 0.08);
    k.bevelBox('steelDark', 0, 0.55, 0.05, 1.3, 0.14, 2.4, 0.04);
    k.bevelBox('plasticDark', 0, 1.2, -0.75, 1.1, 0.32, 0.9, 0.05);                 // cab
    k.bevelBox('glassTint', 0, 1.22, -1.08, 0.95, 0.24, 0.04, 0.01);
    k.bevelBox('hullAccent', 0, 1.13, 0.55, 1.2, 0.1, 1.4, 0.03);
    for (const sz of [-1.15, 0.05, 1.25]) for (const sx of [-1, 1]) {
      k.cyl('rubber', sx * 0.85, 0.4, sz, 0.4, 0.34, 16, { axis: 'x' });
      k.cyl('steelDark', sx * 0.85, 0.4, sz, 0.2, 0.36, 12, { axis: 'x' });
      k.pipe('steelDark', [sx * 0.7, 0.75, sz], [sx * 0.85, 0.42, sz], 0.035);
    }
    k.pipe('steel', [0.5, 1.35, 0.9], [0.5, 2.15, 0.9], 0.02);
    k.dome('steel', 0.5, 2.2, 0.9, 0.16, 12, 5, { thetaMax: 1.5 });
    k.bevelBox('fabricBlue', -0.3, 1.5, 0.3, 0.9, 0.03, 0.9, 0.005);                 // stowed panel
    led(k, 0.6, 0.98, -1.29, 'glowAmber', 0.03); led(k, -0.6, 0.98, -1.29, 'glowAmber', 0.03);
  },
};

/** Draw a prop at its place. Returns false for kinds with no drawing. */
export function drawProp(kit, p) {
  const fn = PROPS[p.kind];
  if (!fn) return false;
  kit.push(p.x, p.y, p.z, (p.rot || 0) * Math.PI / 2);
  fn(kit, p);
  kit.pop();
  return true;
}

// ---------------------------------------------------------------------------
// Seats. Drawn facing local -Z (the ship's forward at yaw 0).
// ---------------------------------------------------------------------------
export const SEAT_DRAW = {
  captain(k) {
    // a command chair: winged back, deep pan, armrest control pods
    k.cyl('gunmetal', 0, 0.09, 0, 0.44, 0.18, 20);
    k.cyl('steel', 0, 0.2, 0, 0.14, 0.4, 12);
    k.cyl('gunmetal', 0, 0.4, 0, 0.26, 0.06, 16);
    k.pillow('leather', 0, 0.53, 0.0, 0.70, 0.2, 0.66, 3.0);                     // pan
    k.pillow('leather', 0, 0.56, -0.25, 0.52, 0.12, 0.16, 2.6);                   // waterfall edge
    k.pillow('leather', 0, 0.99, 0.3, 0.66, 0.92, 0.22, 3.0);                      // back
    for (const s of [-1, 1]) k.pillow('leather', s * 0.32, 0.9, 0.2, 0.14, 0.66, 0.3, 2.6);   // side wings
    k.pillow('leather', 0, 1.55, 0.33, 0.4, 0.34, 0.17, 2.6);                     // headrest
    for (const y of [0.8, 1.0, 1.2]) k.box('gunmetal', 0, y, 0.228, 0.5, 0.006, 0.006);   // stitched seams
    k.box('gunmetal', 0, 0.98, 0.228, 0.006, 0.7, 0.006);
    for (const s of [-1, 1]) {
      k.bevelBox('gunmetal', s * 0.4, 0.7, 0.02, 0.11, 0.12, 0.64, 0.03);       // armrest pod
      k.pillow('leather', s * 0.4, 0.79, 0.0, 0.12, 0.07, 0.58, 3.0);
      k.bevelBox('plasticDark', s * 0.39, 0.815, -0.28, 0.15, 0.045, 0.22, 0.014);
      k.box('glowCyan', s * 0.39, 0.842, -0.28, 0.1, 0.003, 0.15);
      k.bevelBox('gunmetal', s * 0.37, 0.62, 0.12, 0.03, 0.36, 0.32, 0.01);
    }
    k.box('glowCyan', 0.0, 0.5, -0.33, 0.5, 0.012, 0.004);
    k.box('hullAccent', 0, 0.98, 0.395, 0.04, 0.74, 0.006);
    k.pipe('steel', [-0.43, 0.85, -0.05], [-0.43, 1.0, -0.16], 0.014);
    k.bevelBox('red', -0.43, 1.03, -0.18, 0.05, 0.06, 0.08, 0.018);
    k.pipe('steel', [0.43, 0.85, -0.05], [0.43, 1.0, -0.12], 0.014);
    k.bevelBox('plasticDark', 0.43, 1.03, -0.14, 0.06, 0.1, 0.07, 0.02);
    k.box('red', 0.43, 1.05, -0.185, 0.02, 0.02, 0.01);
  },
  pilot(k) {
    // a bucket seat with harness
    k.bevelBox('gunmetal', 0, 0.12, 0.05, 0.6, 0.24, 0.72, 0.05);
    k.pillow('fabricBlue', 0, 0.38, 0.0, 0.6, 0.18, 0.6, 3.0);
    k.pillow('fabricBlue', 0, 0.9, 0.3, 0.56, 0.94, 0.2, 3.0);
    k.pillow('fabricBlue', 0, 1.4, 0.32, 0.34, 0.28, 0.15, 2.6);
    for (const s of [-1, 1]) {
      k.bevelBox('gunmetal', s * 0.33, 0.64, -0.02, 0.09, 0.11, 0.52, 0.03);
      k.pillow('fabricBlue', s * 0.31, 0.75, 0.18, 0.1, 0.54, 0.2, 2.6);       // bolsters
      k.bevelBox('red', s * 0.2, 1.0, 0.235, 0.05, 0.92, 0.008, 0.002);            // harness straps
      k.box('steelDark', s * 0.2, 0.62, 0.235, 0.07, 0.04, 0.012);
    }
    k.pipe('steel', [0.34, 0.7, -0.15], [0.34, 0.9, -0.3], 0.017);
    k.bevelBox('plasticDark', 0.34, 0.95, -0.32, 0.055, 0.11, 0.065, 0.02);
    k.pipe('steel', [-0.34, 0.7, -0.15], [-0.34, 0.84, -0.3], 0.017);
    k.bevelBox('red', -0.34, 0.88, -0.32, 0.055, 0.065, 0.1, 0.02);
    k.box('glowCyan', 0, 0.37, -0.295, 0.4, 0.008, 0.004);
    for (const y of [0.7, 0.9, 1.1]) k.box('gunmetal', 0, y, 0.376, 0.4, 0.005, 0.005);
  },
  swivel(k) {
    // _swivel is drawn facing +Z (for a desk); a station seat faces -Z, toward its screens
    k.push(0, 0, 0, Math.PI);
    PROPS._swivel(k, 'fabricBlue');
    for (const s of [-1, 1]) k.bevelBox('gunmetal', s * 0.26, 0.72, -0.05, 0.08, 0.05, 0.3, 0.02);
    k.pop();
  },
  gunner(k) {
    // a harness seat in front of a pair of grips
    k.bevelBox('gunmetal', 0, 0.14, 0.1, 0.5, 0.28, 0.62, 0.05);
    k.pillow('leather', 0, 0.36, 0.05, 0.48, 0.16, 0.54, 3.0);
    k.pillow('leather', 0, 0.81, 0.3, 0.48, 0.86, 0.16, 3.0);
    k.pillow('leather', 0, 1.32, 0.32, 0.3, 0.24, 0.13, 2.6);
    for (const s of [-1, 1]) {
      k.pipe('steel', [s * 0.29, 0.5, -0.05], [s * 0.29, 0.85, -0.35], 0.017);
      k.bevelBox('plasticDark', s * 0.29, 0.9, -0.38, 0.055, 0.13, 0.065, 0.02);
      k.box('red', s * 0.29, 0.955, -0.415, 0.02, 0.02, 0.008);
      k.bevelBox('red', s * 0.2, 0.9, 0.242, 0.05, 0.82, 0.008, 0.002);
    }
    k.bevelBox('steelDark', 0, 0.16, -0.32, 0.3, 0.22, 0.14, 0.03);
    k.box('glowAmber', 0, 0.24, -0.395, 0.2, 0.03, 0.004);
  },
};

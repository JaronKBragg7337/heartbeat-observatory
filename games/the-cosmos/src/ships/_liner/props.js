// ============================================================================
// ships/_liner/props.js - the furniture of a passenger ship. Registered into the shared PROPS table (src/ship/shipProps.js), so the
// interior builder draws them like any other piece: each in its own coordinates, centre on the floor. Rotation `rot` is in 90 degree
// steps; a seat bank at rot 0 FACES THE NOSE (-Z), the way a passenger faces on a ship under thrust.
//
// NO BARE BOXES: every piece has a second material for the part you touch and a detail that is not the shape.
// ============================================================================

import { PROPS } from '../../ship/shipProps.js';
import { boardMaterial } from './flights.js';

const led = (k, x, y, z, key = 'glowGreen', s = 0.012) => k.box(key, x, y, z, s * 2, s * 2, s * 0.8);

// Seven-segment digit in the glow bucket, so a seat number is not its own draw and not a blank card.
const SEG = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b];
function segDigit(k, x, y, z, n) {
  const bits = SEG[Math.abs(n) % 10];
  const hw = 0.016, hh = 0.02, t = 0.005;
  const bar = (bit, xx, yy, w, h) => { if (bits & bit) k.box('glowCyan', xx, yy, z, w, h, 0.004); };
  // The face the aisle camera sees has ship +X on the viewer's left, so the uprights are swapped.
  bar(0x40, x, y + hh, hw * 2, t);
  bar(0x20, x - hw, y + hh / 2, t, hh);
  bar(0x10, x - hw, y - hh / 2, t, hh);
  bar(0x08, x, y - hh, hw * 2, t);
  bar(0x04, x + hw, y - hh / 2, t, hh);
  bar(0x02, x + hw, y + hh / 2, t, hh);
  bar(0x01, x, y, hw * 2, t);
}

/** A bank of terminal seats, facing local -Z: a steel frame, a cushion, a backed shell, a lap belt, a lit seat number. */
PROPS.paxrow = (k, p) => {
  const n = Math.max(1, p.seats || Math.round(p.w / 0.62)), pitch = p.w / n;
  const tone = p.tone || 'fabricBlue';
  const bz = p.d / 2 - 0.08;
  k.box('steelDark', 0, 0.16, -0.02, p.w - 0.06, 0.028, 0.035);
  k.box('steelDark', 0, 0.16, 0.14, p.w - 0.06, 0.028, 0.035);
  const bays = Math.max(1, Math.ceil(n / 2));
  for (let i = 0; i <= bays; i++) {
    const x = -p.w / 2 + (p.w * i) / bays;
    for (const z of [-0.02, 0.14]) k.cyl('steelDark', x, 0.08, z, 0.015, 0.16, 5);
  }
  for (let i = 0; i < n; i++) {
    const x = -p.w / 2 + pitch * (i + 0.5);
    k.bevelBox('gunmetal', x, 0.26, 0.02, pitch - 0.1, 0.035, p.d - 0.2, 0.008);
    k.bevelBox(tone, x, 0.36, -0.02, pitch - 0.12, 0.09, p.d * 0.52, 0.022);
    k.bevelBox('plasticDark', x, 0.84, bz, pitch - 0.06, 0.74, 0.045, 0.01);
    k.bevelBox(tone, x, 0.82, bz - 0.045, pitch - 0.16, 0.58, 0.05, 0.012);
    k.bevelBox(tone, x, 1.26, bz - 0.02, Math.min(pitch * 0.5, 0.32), 0.13, 0.07, 0.012);
    k.bevelBox('plasticDark', x, 0.44, -0.02, pitch - 0.28, 0.012, 0.028, 0.002);
    k.bevelBox('steel', x, 0.455, -0.004, 0.046, 0.022, 0.026, 0.004);
    k.box('glowAmber', x, 0.468, 0.012, 0.012, 0.006, 0.004);
    segDigit(k, x, 1.0, bz - 0.08, i + 1);
  }
  for (let i = 0; i <= n; i++) {
    const x = -p.w / 2 + pitch * i;
    k.bevelBox('gunmetal', x, 0.56, 0.0, 0.04, 0.045, p.d * 0.48, 0.008);
    k.box('steelDark', x, 0.4, 0.04, 0.028, 0.2, 0.035);
  }
  led(k, 0, 0.22, -p.d / 2 + 0.02, 'glowCyan', 0.008);
};
// looks-r1: the boarding hall uses the same seats. It is not a paxrow, so it stays off the passenger manifest
// (that list is exactly the nose-facing salon seats).
PROPS.terminal = PROPS.paxrow;

/** A raised planter with something green in it (the line's one concession to Earth). */
PROPS.planter = (k, p) => {
  k.bevelBox('white', 0, 0.3, 0, p.w, 0.6, p.d, 0.04, { col: [0.8, 0.82, 0.84] });
  k.bevelBox('steelDark', 0, 0.58, 0, p.w + 0.02, 0.04, p.d + 0.02, 0.012);
  k.bevelBox('wood', 0, 0.62, 0, p.w - 0.12, 0.04, p.d - 0.12, 0.012);
  k.bevelBox('tile', 0, 0.665, 0, p.w - 0.16, 0.05, p.d - 0.16, 0.01);                          // soil bed (pale, it is hydroponic gravel)
  for (let i = 0; i < 7; i++) {
    const x = (((i * 37) % 11) / 11 - 0.5) * (p.w - 0.4), z = (((i * 53) % 13) / 13 - 0.5) * (p.d - 0.4);
    k.dome('pipeBlue', x, 0.69, z, 0.2 + (i % 3) * 0.05, 8, 4, { col: [0.25 + (i % 2) * 0.1, 0.62, 0.3] });
    k.pipe('pipeBlue', [x, 0.69, z], [x + 0.05, 1.15 + (i % 3) * 0.12, z], 0.012, 5, { col: [0.3, 0.7, 0.32] });
  }
  k.box('glowWhite', 0, 0.58, p.d / 2 + 0.003, p.w - 0.3, 0.012, 0.004);
};

/** A vending machine: snacks, a coin slot nobody uses, a screen that makes a promise about the contents. */
PROPS.vending = (k, p) => {
  const w = p.w, h = p.h, d = p.d;
  k.bevelBox('plasticDark', 0, h / 2, 0, w, h, d, 0.03);
  k.bevelBox('glassTint', -w * 0.12, h * 0.58, d / 2 + 0.004, w * 0.62, h * 0.62, 0.02, 0.006);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    k.box(((r + c) % 3 === 0 ? 'hullAccent' : (r + c) % 3 === 1 ? 'hazard' : 'crateC'), -w * 0.12 - w * 0.24 + c * w * 0.16, h * 0.34 + r * h * 0.11, d / 2 - 0.02, w * 0.1, h * 0.06, 0.05);
  }
  k.box('glowCyan', w * 0.34, h * 0.78, d / 2 + 0.004, w * 0.2, h * 0.1, 0.006);
  k.bevelBox('steelDark', w * 0.34, h * 0.5, d / 2 + 0.004, w * 0.2, h * 0.12, 0.02, 0.005);   // keypad
  k.bevelBox('steelDark', 0, 0.16, d / 2 + 0.004, w - 0.1, 0.18, 0.02, 0.005);                 // the drop flap
  k.box('glowAmber', 0, h - 0.06, d / 2 + 0.004, w - 0.2, 0.05, 0.006);
};

/** A wall-standing departures board. looks-r1: the face is the shared flight list. With no canvas, the bezel stays dark. */
PROPS.departboard = (k, p) => {
  const w = p.w, h = p.h;
  k.bevelBox('steelDark', 0, h / 2, 0, w, h, p.d, 0.02);
  k.bevelBox('plasticDark', 0, h / 2, p.d / 2 + 0.004, w - 0.1, h - 0.1, 0.012, 0.004);
  const mat = boardMaterial();
  if (mat) k.plate(mat, 0, h / 2, p.d / 2 + 0.016, w - 0.16, h - 0.18);
};

/** A luggage cage: a steel frame with soft bags in it. */
PROPS.luggage = (k, p) => {
  k.bevelBox('steelDark', 0, 0.06, 0, p.w, 0.12, p.d, 0.015);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bevelBox('steel', sx * (p.w / 2 - 0.03), p.h / 2, sz * (p.d / 2 - 0.03), 0.05, p.h, 0.05, 0.01);
  k.bevelBox('steel', 0, p.h - 0.03, 0, p.w, 0.05, p.d, 0.01);
  const tones = ['crateA', 'crateB', 'crateC', 'red', 'fabricBlue'];
  for (let i = 0; i < 5; i++) {
    const x = (((i * 29) % 7) / 7 - 0.5) * (p.w - 0.5), z = (((i * 41) % 5) / 5 - 0.5) * (p.d - 0.5), y = 0.14 + (i % 2) * 0.44;
    k.pillow(tones[i % 5], x, y + 0.2, z, 0.5 + (i % 3) * 0.08, 0.38, 0.34, 3.0, 5);
    k.box('gunmetal', x, y + 0.42, z, 0.18, 0.02, 0.05);                              // the handle
  }
  k.box('hazard', 0, 0.015, p.d / 2 + 0.01, p.w, 0.004, 0.06);
};

/** An information kiosk: a pillar, a screen with a lit map and a call button. */
PROPS.kiosk = (k, p) => {
  k.cyl('steelDark', 0, 0.06, 0, 0.42, 0.12, 14);
  k.bevelBox('white', 0, 0.62, 0, 0.5, 1.06, 0.36, 0.05);
  k.bevelBox('plasticDark', 0, 1.0, 0.185, 0.4, 0.5, 0.014, 0.01);
  k.box('glowCyan', 0, 1.1, 0.195, 0.3, 0.03, 0.004); k.box('glowAmber', -0.06, 1.0, 0.195, 0.18, 0.03, 0.004); k.box('glowCyan', 0, 0.9, 0.195, 0.28, 0.03, 0.004);
  k.cyl('red', 0.14, 0.62, 0.19, 0.03, 0.02, 10, { axis: 'z' });
  k.bevelBox('hullAccent', 0, 1.2, 0, 0.5, 0.06, 0.37, 0.01);
};

/** A long window-seat bench with a back facing the glass (+X side by default; rotate it). */
PROPS.windowseat = (k, p) => {
  k.bevelBox('gunmetal', 0, 0.2, 0, p.w, 0.4, p.d, 0.04);
  k.pillow('leather', 0, 0.46, 0.03, p.w - 0.06, 0.14, p.d - 0.1, 3.0);
  k.pillow('leather', 0, 0.8, p.d / 2 - 0.08, p.w - 0.06, 0.5, 0.12, 3.0);
  for (let z = -p.w / 2 + 0.7; z < p.w / 2 - 0.3; z += 0.7) k.box('gunmetal', z, 0.8, p.d / 2 - 0.015, 0.006, 0.44, 0.006);
  led(k, 0, 0.24, -p.d / 2 - 0.004, 'glowAmber', 0.008);
};

/** A crew bunk stack against a wall: two bunks, a curtain, a reading light, a hook with a jacket on it. */
PROPS.bunkpair = (k, p) => {
  for (const y of [0.28, 1.28]) {
    k.bevelBox('gunmetal', 0, y, 0, p.w, 0.14, p.d, 0.02);
    k.pillow('mattress', 0, y + 0.14, 0, p.w - 0.1, 0.13, p.d - 0.1, 3.0);
    k.pillow('blanket', 0, y + 0.2, p.d * 0.15, p.w - 0.14, 0.09, p.d * 0.62, 3.0);
    led(k, p.w / 2 - 0.1, y + 0.62, -p.d / 2 + 0.05, 'glowWhite', 0.016);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bevelBox('steelDark', sx * (p.w / 2 - 0.03), 0.9, sz * (p.d / 2 - 0.03), 0.05, 1.8, 0.05, 0.008);
  k.bevelBox('fabricGrey', 0, 1.7, p.d / 2 - 0.02, p.w, 0.14, 0.02, 0.005);
};

/** The boat on its cradle in a descent transport's bay: a capsule hull on three frames with straps, a canopy, a stern bell and a hatch. The nose points to -Z. */
PROPS.lifeboatcradle = (k, p) => {
  const L = p.d, yc = 1.55;
  k.bevelBox('steelDark', 0, 0.1, 0, p.w, 0.2, L, 0.03);
  for (const sx of [-1, 1]) k.bevelBox('gunmetal', sx * (p.w / 2 - 0.1), 0.3, 0, 0.16, 0.2, L - 0.4, 0.02);
  for (const z of [-L * 0.3, 0, L * 0.3]) {
    for (const sx of [-1, 1]) {
      k.bevelBox('steelDark', sx * 1.0, 0.65, z, 0.14, 1.0, 0.2, 0.02);
      k.pipe('steel', [sx * 1.0, 0.95, z], [sx * 0.8, 1.35, z], 0.06, 8);
      k.bevelBox('rubber', sx * 0.78, 1.38, z, 0.28, 0.1, 0.34, 0.03);
    }
    k.bevelBox('hazard', 0, yc + 1.43, z, 0.12, 0.02, 0.2, 0.004);          // the strap over the top
    for (const sx of [-1, 1]) k.pipe('hazard', [sx * 1.3, yc + 0.5, z], [sx * 0.18, yc + 1.43, z], 0.025, 5);
  }
  // the boat: a capsule on its axis, white over a rust-coloured belt, a canopy, a bell
  k.lathe('white', 0, yc, 0, [[0.28, -L / 2 + 0.2], [0.95, -L / 2 + 0.55], [1.3, -L / 2 + 1.5], [1.38, -L / 2 + 3], [1.38, L / 2 - 2.6], [1.25, L / 2 - 1.2], [0.9, L / 2 - 0.35], [0.5, L / 2 - 0.1]], 16, { axis: 'z' });
  k.lathe('hullAccent', 0, yc, 0, [[1.385, -1.4], [1.4, -1.15], [1.4, -0.85], [1.385, -0.6]], 16, { axis: 'z' });
  k.bevelBox('glassTint', 0, yc + 0.55, -L / 2 + 1.3, 1.5, 0.45, 1.1, 0.08);
  k.cyl('engine', 0, yc, L / 2 - 0.05, 0.4, 0.4, 14, { axis: 'z' });
  k.lathe('metal', 0, yc, L / 2 + 0.15, [[0.34, 0], [0.5, 0.25], [0.46, 0.25], [0.3, 0]], 14, { axis: 'z' });
  k.bevelBox('hullDark', 1.38, yc - 0.1, -0.3, 0.06, 1.2, 1.0, 0.02);          // the side hatch
  led(k, 1.42, yc + 0.5, -0.3, 'glowGreen', 0.04);
  k.cyl('steel', 0.3, yc + 1.45, -0.5, 0.03, 0.5, 6); k.dome('white', 0.3, yc + 1.95, -0.5, 0.07, 8, 4);
};

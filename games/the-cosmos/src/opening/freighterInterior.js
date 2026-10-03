// Inside the crashed freighter: seats, aisle, bulkheads, overhead, loose gear. Cabin-local metres, floor at y=0,
// seats face the stern (-z), the door is at +z. Gravity is a few degrees off the floor (the +x side is high), so
// loose things lie flat in the world and have slid toward the low (-x) wall.
import { Kit3, sheet, obox, beam, cable, rng, fbm, noise, sstep, lerp, clamp } from './wreckKit.js';
import { WIN_Z, WIN_HALF, LIN, skinSOf, liningTear } from './freighterHull.js';

const ROLL = -.105;                                  // undo the cabin roll so an object lies flat in the world
export const ROWS = Array.from({ length: 9 }, (_, i) => -10 + 2.6 * i);
export const OCCUPIED = new Set(['4:1', '5:-1', '4:-1', '3:1']);   // (row,side) held by passengers; the people sit here
// row:side -> condition
const STATE = { '0:-1': 'sheared', '1:1': 'torn', '1:-1': 'sheared', '2:1': 'bent', '2:-1': 'ripped', '6:1': 'missing', '6:-1': 'bent', '7:-1': 'torn', '7:1': 'ripped', '8:1': 'bent', '0:1': 'ripped', '8:-1': 'ok' };

const FAB = [.62, .78, 1.1];
function seat(k, sx, z, st, low, rnd) {
  const seg = low ? 5 : 10;
  const side = sx < 0 ? -1 : 1;
  k.push(sx, 0, z, 0);
  const sheared = st === 'sheared';
  if (sheared) { k.push(side * .5, 0, 0, side * .25, 0, -side * .62); k.push(-side * .5, 0, 0); }      // knocked off its rails, lying against the wall: pivots on its low foot, so it rests on the floor
  // rails, feet, pedestal
  for (const dx of [-.46, .46]) {
    k.bevelBox('gunmetal', dx, .02, .05, .13, .04, .56, .012);
    if (st === 'missing' || sheared) { k.pipe('steelDark', [dx, .04, 0], [dx + (rnd() - .5) * .25, .26 + rnd() * .1, (rnd() - .5) * .3], .028, 7); k.cyl('steel', dx, .06, .05, .045, .02, 8); continue; }
    k.pipe('steelDark', [dx, .04, .02], [dx, .34, .02], .03, 8);
    for (const dz of [-.2, .28]) k.cyl('steel', dx, .045, dz, .015, .012, 6);
  }
  if (st === 'missing') { k.pop(); return; }
  k.bevelBox('gunmetal', 0, .34, .03, 1.06, .06, .56, .015);
  k.bevelBox('hazard', 0, .22, .02, .42, .1, .28, .025, { col: [.9, .62, .45] });         // life vest pouch
  k.box('white', 0, .22, -.125, .12, .03, .008);
  // cushion
  const torn = st === 'torn' || st === 'ripped';
  k.pillow('fabricBlue', 0, .455, -.02, 1.02, .16, .56, 4.2, seg, { col: [.9, .88, .85] });
  if (torn) {
    k.bevelBox('mattress', -.28, .52, -.04, .34, .06, .36, .02, { col: [.85, .8, .6] });                // foam showing through
    obox(k, 'fabricBlue', [-.3, .57, -.26], [.38, .012, .26], [.9, 0, .15], [.7, .66, .64]);          // the flap of cover
    k.box('plasticDark', -.06, .56, -.04, .02, .01, .34);
  }
  for (const dx of [-.5, .5]) { k.bevelBox('gunmetal', dx, .64, .04, .06, .06, .5, .018); k.bevelBox('rubber', dx, .685, .0, .07, .028, .3, .012); }
  // back, hinged at the base so it can lean or fold
  const lean = st === 'bent' ? (rnd() < .5 ? -.42 : .5) : sheared ? .35 : (rnd() - .5) * .06 + .08;
  k.push(0, .5, .3, 0, lean);
  k.bevelBox('plasticDark', 0, .48, .05, .98, .96, .08, .03, { col: [2.3, 2.3, 2.5] });
  k.pillow('fabricBlue', 0, .46, -.035, .92, .86, .13, 4, seg, { col: [.9, .88, .85] });
  k.pillow('fabricBlue', 0, .985, -.03, .56, .22, .12, 3.5, seg, { col: [.95, .93, .9] });
  if (st === 'ripped') {
    k.bevelBox('mattress', .22, .6, -.09, .32, .36, .04, .015, { col: [.85, .8, .62] });
    obox(k, 'fabricBlue', [.33, .38, -.11], [.3, .5, .012], [0, .1, .4], [.62, .58, .55]);
  }
  // rear of the back shell (what you see walking the aisle): pocket, tray catch, placard, screen
  k.bevelBox('plasticDark', 0, .3, .105, .62, .2, .035, .012, { col: [1.3, 1.3, 1.4] });
  k.bevelBox('plasticDark', 0, .62, .1, .52, .3, .02, .01, { col: [1.1, 1.1, 1.2] });
  k.box('steel', 0, .78, .112, .12, .025, .012);
  k.box('white', .34, .85, .1, .07, .04, .008);
  k.box('glowCyan', 0, .62, .112, .38, .2, .004, { col: [.12, .2, .24] });
  // belts, hanging
  for (const dx of [-.3, .3]) k.pipe('fabricGrey', [dx, .86, -.05], [dx + (rnd() - .5) * .1, .45, -.25 + rnd() * .1], .018, 4, { col: [.18, .18, .2] });
  k.pop();
  if (sheared) { k.pop(); k.pop(); }
  k.pop();
}

// A bag lying on the floor of the cabin, flat in the world.
function bag(k, x, z, yaw, w, h, d, key, col, rnd, open, roll = ROLL) {
  k.push(x, 0, z, yaw, 0, roll);
  k.bevelBox(key, 0, h / 2, 0, w, h, d, .04, { col });
  k.bevelBox('gunmetal', 0, h / 2, 0, w + .01, .02, d + .01, .008);
  k.pipe('steel', [-w * .16, h, 0], [w * .16, h, 0], .014, 6);
  k.bevelBox('rubber', -w * .26, h + .02, 0, .05, .05, .06, .01); k.bevelBox('rubber', w * .26, h + .02, 0, .05, .05, .06, .01);
  for (const dx of [-w * .4, w * .4]) k.cyl('rubber', dx, .015, d * .4, .02, .03, 6);
  k.box('hazard', w * .3, h * .5, d * .5 + .002, .09, .07, .004);
  if (open) {
    k.box('plasticDark', 0, h + .015, 0, w - .05, .03, d - .05);
    obox(k, key, [0, h + .23, -d / 2 - .06], [w, .035, d * .95], [-1.35, 0, 0], col, 0);
    for (let i = 0; i < 4; i++) k.pillow(['blanket', 'fabricGrey', 'mattress', 'leather'][i], (rnd() - .5) * w * .6, h + .06, (rnd() - .5) * d * .5, .24 + rnd() * .2, .1, .2 + rnd() * .12, 3, 6, { col: [1, 1, 1] });
  }
  k.pop();
}

// A fallen ceiling or lining panel.
function litter(k, x, y, z, w, d, rx, ry, rz, key = 'ceil', col = [.8, .78, .75]) { obox(k, key, [x, y, z], [w, .03, d], [rx, ry, rz], col); }

// A panel leaning on the left wall with its foot on the floor.
function lean(k, x, z, w, d, ang, yaw, key = 'ceil', col = [.8, .78, .75]) { obox(k, key, [x, w / 2 * Math.sin(ang) + .03, z], [w, .03, d], [0, yaw, ang], col); }

function oxygenMask(k, x, z, rnd, long) {
  const top = [x, 3.08, z], hang = (long ? 1.15 : .55) + rnd() * .45;
  k.bevelBox('plasticDark', x, 3.1, z, .34, .04, .22, .01);
  const dx = (rnd() - .5) * .5, dz = (rnd() - .5) * .6, end = [x + dx, 3.08 - hang, z + dz];
  cable(k, [x, 3.08, z], end, .013, .1 + rnd() * .16, rnd, { n: 7, col: [.8, .78, .5], wob: .05 });
  k.cyl('plastic', end[0], end[1] - .03, end[2], .055, .05, 10, { col: [.8, .82, .8] });
  k.cyl('rubber', end[0], end[1] - .06, end[2], .05, .025, 10, { col: [.9, .85, .8] });
  k.pillow('mattress', end[0], end[1] - .16, end[2], .1, .15, .05, 3, 6, { col: [.62, .62, .56] });
}

export function buildInterior(k, low, rnd, pristine = false) {
  const seg = low ? 7 : 10;
  // floor deck and aisle
  k.bevelBox('floor:deck', 0, -.13, 1, 6.2, .26, 26, .06);
  k.box('rubber', 0, .006, 1, 1.02, .012, 25.8, { col: [.55, .55, .6] });
  for (let z = -11.4; z < 13.6; z += .9) for (const sgn of [-1, 1]) if (noise(z * 2, sgn, 3) > .2)
    k.box('emerg', sgn * .64, .014, z, .05, .012, .32, { col: [1.25, .5, .1] });
  for (const sgn of [-1, 1]) k.box('steel', sgn * .56, .008, 1, .02, .014, 25.8, { col: [.7, .68, .6] });
  // seats
  ROWS.forEach((z, ri) => { for (const side of [-1, 1]) {
    const occ = OCCUPIED.has(ri + ':' + side), st = pristine || occ ? 'ok' : (STATE[ri + ':' + side] || 'ok');
    seat(k, side * 1.75, z, st, low, rnd);
  } });
  // overhead: oxygen masks dropped, panel recesses
  ROWS.forEach((z, ri) => { for (const side of [-1, 1]) { if (pristine) { k.bevelBox('plasticDark', side * 1.8, 3.11, z, .34, .03, .22, .01); continue; } if (ri === 8 && side > 0) continue; const roof = (x, zz) => liningTear(zz, x, 3.1) > .45; if (!roof(side * 1.8, z + .05)) continue; if (rnd() < .55) oxygenMask(k, side * 1.8, z + .05, rnd, rnd() < .4); else k.bevelBox('plasticDark', side * 1.8, 3.11, z, .34, .03, .22, .01); if (rnd() < .25 && roof(side * 1.5, z + .5)) oxygenMask(k, side * 1.5, z + .5, rnd, true); } });
  // centre light strips, some dead, one half-fallen
  ROWS.forEach((z, ri) => { if (pristine) { k.box('glowCool', 0, 3.05, z, 1.3, .03, .13); return; } if (liningTear(z, 0, 3.1) < .7 || liningTear(z, .65, 3.1) < .5 || liningTear(z, -.65, 3.1) < .5) return; if (noise(ri, 3, 8) > .32 && ri !== 2 && ri !== 7) k.box(ri % 3 === 0 ? 'flick' : 'glowCool', 0, 3.05, z, 1.3, .03, .13, { col: ri % 3 === 0 ? [.4, .45, .5] : [.6, .65, .7] }); else k.bevelBox('plasticDark', 0, 3.07, z, 1.3, .04, .13, .012); });
  if (!pristine) beam(k, 'plastic', [-.65, 3.08, ROWS[7]], [.55, 2.15, ROWS[7] + .1], .14, .04, [.8, .8, .8]);       // a strip half-fallen, still hanging from one end
  // door end: bulkhead, bent frame, hanging door, signs
  doorEnd(k, low, rnd, pristine);
  aftEnd(k, low, rnd, pristine);
  // luggage, lying low-side and in the aisle
  const bags = pristine ? [] : [[-2.55, -9.2, .3, .7, .32, .45, 'leather', [.9, .55, .35]], [-2.2, -8.1, 1.2, .55, .4, .35, 'crateC', null], [-1.1, -6.4, .6, .8, .26, .55, 'plasticDark', [1, 1.05, 1.2], true],
    [-2.6, -4.2, 2.1, .65, .3, .4, 'red', [.7, .7, .7]], [-.5, -2.9, .1, .5, .3, .3, 'leather', null], [.2, -.8, .8, .7, .28, .5, 'crateA', null, true], [-2.5, 1.7, .4, .75, .4, .5, 'plasticDark', null],
    [-2.3, 2.6, 1.9, .45, .4, .3, 'crateB', [.9, .85, .8]], [-.9, 4.9, 2.7, .6, .3, .4, 'red', [.8, .75, .75]], [.4, 7.4, .5, .78, .3, .52, 'leather', [.7, .6, .55], true], [-2.45, 9.5, .2, .66, .3, .42, 'crateC', [.9, .95, 1]], [-1.4, 11.3, -.3, .55, .26, .38, 'plasticDark', null],
    [1.5, -9.6, 1.0, .6, .3, .4, 'crateA', [.8, .8, .8]]];
  for (const b of bags) bag(k, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7] || undefined, rnd, b[8]);
  if (!pristine) {
  // loose things: bottles, a tablet still lit, shoes, a coat
  const bottle = (x, z, a) => { k.push(x, .045, z, a, 0, ROLL + 1.5708); k.cyl('plastic', 0, 0, 0, .033, .2, 8, { col: [.7, .9, 1] }); k.cyl('hazard', .11, 0, 0, .02, .04, 6, { col: [.4, .4, .9] }); k.pop(); };
  bottle(-1.6, -5.6, .4); bottle(-2.4, 6.1, 1.4); bottle(.5, 2.2, 2.4); bottle(-.2, -8, .1);
  k.push(-1.2, .015, 3.6, .6, 0, ROLL); k.bevelBox('plasticDark', 0, 0, 0, .24, .02, .17, .006); k.box('glowCyan', 0, .0105, 0, .21, .002, .14, { col: [.3, .55, .65] }); k.pop();
  k.pillow('blanket', -2.4, .08, -3.1, .75, .12, .5, 3, seg, { col: [1, .9, .85] });
  k.pillow('fabricGrey', -2.25, .07, 7.9, .5, .1, .4, 3, seg, { col: [.6, .62, .7] });
  k.pillow('mattress', -2.5, .06, -6.0, .42, .09, .3, 3, seg);
  }
  // wall kit: fire extinguisher (one on its bracket, one fallen), first aid, intercom
  k.cyl('red', -2.98, 1.1, 12.5, .09, .42, 10); k.cyl('rubber', -2.98, 1.34, 12.5, .03, .06, 6); k.bevelBox('steel', -3.0, 1.1, 12.5, .04, .06, .22, .01);
  if (!pristine) { k.push(-1.0, .09, -3.6, 1.1, 0, ROLL + 1.5708); k.cyl('red', 0, 0, 0, .09, .42, 10); k.cyl('rubber', 0, .24, 0, .03, .06, 6); k.pop(); }
  k.bevelBox('white', 2.98, 1.35, 11, .05, .34, .34, .012); k.box('glowGreen', 2.955, 1.35, 11, .01, .22, .05, { col: [.3, .5, .3] }); k.box('glowGreen', 2.955, 1.35, 11, .01, .05, .22, { col: [.3, .5, .3] });
  k.bevelBox('plasticDark', 2.97, 1.5, 13, .06, .14, .1, .015); cable(k, [2.93, 1.5, 13], [2.5, .9, 12.7], .01, .25, rnd, { n: 6, col: [.1, .1, .1] }); k.bevelBox('plasticDark', 2.5, .88, 12.7, .06, .12, .05, .012);
  // ripped-down ceiling, hanging cable bundles with live ends
  const sparks = [];
  if (pristine) return { sparks };
  // Every cable starts on something: the exposed duct and conduit above the open roof, or the ceiling at the edge of a hole.
  const duct = (z) => [-1.33 + (rnd() - .5) * .16, 3.42, z], conduit = (z) => [-.45 + (rnd() - .5) * .1, 3.34, z];
  const cab = [[() => duct(-5.4), .9, 1], [() => duct(-8.6), 1.0, 0], [() => conduit(-4.2), .7, 1], [() => duct(-6.6), .9, 0], [() => [2.0, 3.1, -2.5], .55, 1], [() => [-2.0, 3.1, 8.8], .6, 1], [() => conduit(-7.4), .8, 1], [() => duct(-4.6), .7, 0]];
  for (const [from, len, live] of cab) for (let i = 0; i < 3; i++) {
    const a0 = from(), a = [a0[0] + (rnd() - .5) * .08, a0[1], a0[2] + (rnd() - .5) * .12], b = [a[0] + (rnd() - .5) * .35, a[1] - len - rnd() * .6, a[2] + (rnd() - .5) * .35];
    const col = [[.05, .05, .06], [.55, .08, .06], [.1, .2, .5], [.7, .55, .08]][i % 4];
    cable(k, a, b, .014 + rnd() * .008, .18 + rnd() * .2, rnd, { n: 6, col, frayed: i === 0 || rnd() < .5 });
    if (i === 0 && live) sparks.push([b[0], b[1] - .07, b[2]]);
  }
  // exposed duct, conduit and insulation above the open roof
  k.pipe('steel', [-1.3, 3.55, -9.8], [-1.35, 3.43, -3.3], .17, 10, { col: [.7, .68, .64] });
  k.pipe('pipeSteel', [-.4, 3.42, -9.6], [-.5, 3.3, -4.6], .05, 7, { col: [.5, .5, .5] });
  k.pipe('copper', [-2.1, 3.38, -9], [-2.0, 3.3, -3.6], .03, 6);
  for (let i = 0; i < 9; i++) { const bx = -2.6 + rnd() * 2.2, bz = -9.2 + rnd() * 5.2; obox(k, 'mattress', [bx, 3.2 - rnd() * .5, bz], [.45 + rnd() * .4, .04, .9 + rnd() * 1.2], [(rnd() - .5) * .9, rnd() * 3, (rnd() - .5) * .8], [.52, .49, .4]); }
  // litter from above
  lean(k, -2.58, -5.5, 1.1, 1.0, .75, .08); lean(k, -2.58, 9.6, 1.1, 1.0, .75, -.05);
  litter(k, -1.6, .02, -8.1, 1.0, .9, 0, .2, ROLL); litter(k, -.4, .02, -6.1, .7, .6, 0, 1, ROLL); litter(k, -.9, .03, 6.2, .5, .5, 0, .3, ROLL);
  return { sparks };
}

// Door end (+z): a bulkhead with the torn hatch gap, bent frame, a door hanging by one hinge, an exit sign.
function doorEnd(k, low, rnd, pristine) {
  const z = 14.02, cell = low ? .6 : .38;
  if (pristine) {
    for (const x0 of [-3.08, 1.0]) sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z], a0: x0, a1: x0 + 2.08, b0: 0, b1: 3.14, cell: 1, faceTo: () => [0, 0, -1], uv: (x, y) => [x / 1.35, y / 2.7] });
    sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z], a0: -1, a1: 1, b0: 2.74, b1: 3.14, cell: 1, faceTo: () => [0, 0, -1], uv: (x, y) => [x / 1.35, y / 2.7] });
    k.bevelBox('door', 0, 1.36, 13.96, 2.0, 2.72, .08, .03, { col: [.85, .85, .85] }); k.bevelBox('steel', 0, 1.36, 13.915, 1.7, 2.3, .012, .01, { col: [.7, .7, .7] });
    k.box('glassTint', 0, 2.1, 13.905, .5, .5, .01); k.box('hazard', 0, .18, 13.9, 1.8, .06, .008);
    for (const sx of [-1.03, 1.03]) k.bevelBox('steel', sx, 1.36, 13.94, .09, 2.74, .14, .02, { col: [.6, .6, .6] });
    k.bevelBox('plasticDark', 0, 2.92, 13.8, 1.06, .26, .1, .02); k.box('emerg', 0, 2.92, 13.75, .96, .18, .01, { col: [.15, 1, .3] });
    k.box('white', -.28, 2.93, 13.744, .1, .1, .004, { col: [.9, 1, .9] }); k.box('white', 0, 2.93, 13.744, .36, .022, .004, { col: [.9, 1, .9] }); k.box('white', .3, 2.93, 13.744, .1, .1, .004, { col: [.9, 1, .9] });
    k.bevelBox('white', 2.98, 1.35, 11, .05, .34, .34, .012); k.box('glowGreen', 2.955, 1.35, 11, .01, .22, .05, { col: [.3, .5, .3] }); k.box('glowGreen', 2.955, 1.35, 11, .01, .05, .22, { col: [.3, .5, .3] });
    k.cyl('red', -2.98, 1.1, 12.5, .09, .42, 10); k.bevelBox('steel', -3.0, 1.1, 12.5, .04, .06, .22, .01);
    return;
  }
  const f = (x, y) => { const dx = Math.abs(x) - 1.06, dy = y - 2.74; const door = Math.max(dx, dy) + (fbm(x * 2.1, y * 2.1, 3) - .5) * .35 * sstep(1.6, 2.7, y);
    const nick = Math.hypot((x - 2.1) / 1.2, (y - 3.1) / .8) - 1; return Math.min(door, nick * .7); };
  for (const x0 of [-3.08, 1.0]) {
    const x1 = x0 + (x0 < 0 ? 2.08 : 2.08);
    sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z - .18 * (1 - sstep(0, 1.3, f(x, y))) - .12 * fbm(x * .5, y * .5, 5)], field: f, a0: x0, a1: x1, b0: 0, b1: 3.14, cell, faceTo: () => [0, 0, -1], thick: .03,
      col: (p, ff) => { const s = 1 - (1 - sstep(0, 1, ff)) * .75; return [s * .9, s * .88, s * .86]; }, uv: (x, y) => [x / 1.35, y / 2.7], inner: { key: 'steelDark', tint: [.5, .47, .45] }, lip: { key: 'steel', tint: [1, .9, .75] }, nearM: 1.2 });
    // the other face, facing out through the breach
    sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z + .0 + .02 - .18 * (1 - sstep(0, 1.3, f(x, y))) - .12 * fbm(x * .5, y * .5, 5)], field: f, a0: x0, a1: x1, b0: 0, b1: 3.14, cell, faceTo: () => [0, 0, 1], thick: 0,
      col: (p, ff) => { const s = .8 - (1 - sstep(0, 1, ff)) * .5; return [s, s * .94, s * .88]; }, uv: (x, y) => [x / 1.35, y / 2.7] });
  }
  // frame
  obox(k, 'steel', [-1.1, 1.3, z - .05], [.12, 2.7, .22], [0, 0, .015], [.55, .54, .52]);
  obox(k, 'steel', [1.1, 1.38, z - .05], [.12, 2.55, .22], [.03, .02, -.07], [.55, .54, .52]);
  obox(k, 'steel', [.05, 2.72, z - .05], [1.0, .12, .2], [.1, 0, .12], [.5, .5, .48]);
  // the hatch, hung from the left jamb and sprung
  k.push(-1.08, 0, z - .12, 1.42, .05, .05); k.bevelBox('door', .5, 1.28, 0, 1.0, 2.5, .07, .02, { col: [.5, .55, .62] }); k.bevelBox('steel', .5, 1.28, .04, .8, 1.9, .015, .01, { col: [.6, .6, .6] }); k.box('hazard', .5, 2.35, .05, .8, .06, .004); k.pop();
  // exit sign: lit green, running man
  k.bevelBox('plasticDark', 0, 2.92, 13.8, 1.06, .26, .1, .02);
  k.box('emerg', 0, 2.92, 13.75, .96, .18, .01, { col: [.15, 1, .3] });
  k.box('white', -.28, 2.93, 13.744, .1, .1, .004, { col: [.9, 1, .9] }); k.box('white', 0, 2.93, 13.744, .36, .022, .004, { col: [.9, 1, .9] });
  k.box('white', .3, 2.93, 13.744, .1, .1, .004, { col: [.9, 1, .9] });
  // hazard-striped threshold, bent where the hull folded
  k.bevelBox('hazard', 0, .03, 13.96, 2.1, .06, .22, .02, { col: [.8, .75, .6] });
  obox(k, 'steelDark', [.3, .05, 14.45], [1.7, .05, .55], [.15, 0, .1], [.5, .5, .5]);
}

// Stern bulkhead (-z): peeled open, with the crushed hold and the dusk beyond.
function aftEnd(k, low, rnd, pristine) {
  const z = -12.1, cell = low ? .6 : .36;
  if (pristine) {
    sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z], a0: -3.08, a1: 3.08, b0: 0, b1: 3.14, cell: 1, faceTo: () => [0, 0, 1], uv: (x, y) => [x / 1.35, y / 2.7] });
    k.bevelBox('plasticDark', 0, 2.5, -12.05, 1.4, .5, .05, .02); k.box('glowAmber', 0, 2.5, -12.02, 1.2, .3, .006, { col: [.4, .3, .15] });
    k.bevelBox('steel', -2.6, 1.3, -12.05, .3, .5, .06, .02);
    return;
  }
  const f = (x, y) => { const e = Math.hypot((x + .3) / 2.05, (y - 1.65) / 1.2) - 1, e2 = Math.hypot((x - 2.05) / .55, (y - 2.55) / .5) - 1;
    return Math.min(e * 1.1 + (fbm(x * 1.7, y * 1.7, 41) - .5) * .7, e2 * .5 + (fbm(x * 2.3, y * 2.3, 42) - .5) * .3); };
  const bend = (x, y) => .55 * Math.pow(1 - sstep(0, 1.15, f(x, y)), 1.2) + .04 * fbm(x, y, 6);
  sheet(k, 'wall:cabin', { P: (x, y) => [x, y, z + bend(x, y)], field: f, a0: -3.08, a1: 3.08, b0: 0, b1: 3.14, cell, faceTo: () => [0, 0, 1], thick: .03,
    col: (p, ff) => { const s = .5 + .5 * sstep(0, 1.4, ff); return [s * .95, s * .9, s * .86]; }, uv: (x, y) => [x / 1.35, y / 2.7], inner: { key: 'steelDark', tint: [.55, .5, .48] }, lip: { key: 'steel', tint: [1, .85, .7] }, nearM: 1.3 });
  // crushed hold behind the hole: bulkhead ring, containers wedged crooked, a sagging cargo net, girders
  obox(k, 'steelDark', [-.6, 3.0, -13.7], [3.8, .2, .2], [.1, .05, .25], [.5, .5, .5]); obox(k, 'steelDark', [2.5, 1.3, -13.6], [.2, 2.8, .2], [0, .1, .45], [.5, .5, .5]);
  obox(k, 'steelDark', [-2.9, 1.0, -13.8], [.2, 2.4, .2], [.1, 0, -.3], [.5, .5, .5]);
  container(k, [-2.15, .7, -13.4], [1.3, 1.25, 1.2], [.04, .5, .18], [.6, .65, .6]); container(k, [2.0, .62, -13.2], [1.2, 1.1, 1.0], [0, -.35, -.12], [.9, .7, .5]);
  container(k, [-.2, .5, -16.4], [1.3, 1.0, 1.0], [.1, .8, .5], [.6, .62, .7]);
  for (let i = 0; i < 6; i++) cable(k, [-2.6 + i * .15, 3.0, -13.3], [-1.0 + i * .6, 1.8 + noise(i, 1) * .5, -13.0], .012, .5, rnd, { n: 7, col: [.45, .4, .3], wob: .06 });
  for (let i = 0; i < 5; i++) cable(k, [-2.3, 2.55 - i * .25, -13.1], [1.6, 2.5 - i * .25 - .1, -13.1], .01, .35, rnd, { n: 8, col: [.45, .4, .3], wob: .03 });
}

// Windows: a reveal through the double wall, a pane (some blown out, some starred), and bent gaskets.
export function buildWindows(k, rnd, pristine = false) {
  const out = pristine ? new Set() : new Set([0, 2, 5]), starred = pristine ? new Set() : new Set([1, 4]);
  WIN_Z.forEach((z, i) => { for (const side of [-1, 1]) {
    const x0 = side * 3.08, x1 = side * 3.42, xm = (x0 + x1) / 2, y0 = .95, y1 = 2.5, hw = WIN_HALF;
    const miss = out.has(i) ? (side < 0 ? 0 : 1) : -1;
    obox(k, 'plasticDark', [xm, y0 - .02, z], [.36, .05, hw * 2 + .06], [0, 0, 0], [.7, .7, .72]);
    obox(k, 'plasticDark', [xm, y1 + .02, z], [.36, .05, hw * 2 + .06], [0, 0, 0], [.7, .7, .72]);
    for (const dz of [-hw - .015, hw + .015]) obox(k, 'plasticDark', [xm, (y0 + y1) / 2, z + dz], [.36, y1 - y0, .05], [0, 0, 0], [.7, .7, .72]);
    const gone = (miss === 0 && side < 0) || (miss === 1 && side > 0);
    if (!gone) {
      k.box('glassTint', side * 3.24, (y0 + y1) / 2, z, .012, y1 - y0 - .04, hw * 2 - .04);
      if (starred.has(i) || out.has(i)) { const cz = z + (rnd() - .5) * 1.2, cy = 1.4 + rnd() * .6;
        for (let r = 0; r < 7; r++) { const a = r / 7 * Math.PI * 2 + rnd(), len = .35 + rnd() * .5; k.pipe('white', [side * 3.23, cy, cz], [side * 3.23, cy + Math.sin(a) * len, cz + Math.cos(a) * len], .004, 3, { col: [.9, 1, 1] }); } }
    } else { for (let n = 0; n < 5; n++) obox(k, 'glassTint', [side * 2.9, .03, z + (rnd() - .5) * 2], [.12 + rnd() * .1, .008, .1 + rnd() * .1], [0, rnd() * 3, 0]); }
  } });
}

// Pieces for the crash site (flat in the world, so no cabin roll).
export const seatForSite = (k, st, low, rnd) => seat(k, 0, 0, st, low, rnd);
export const bagForSite = (k, x, z, yaw, w, h, d, key, col, rnd, open) => bag(k, x, z, yaw, w, h, d, key, col, rnd, open, 0);

// A cargo container: ribbed body, corner castings, door bars.
export function container(k, c, size, rot, col) {
  k.push(c[0], c[1], c[2], rot[1], rot[0], rot[2]);
  const [w, h, d] = size;
  k.bevelBox('crateA', 0, 0, 0, w, h, d, .03, { col });
  for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) k.box('steelDark', i * w / 7.4, 0, sz * (d / 2 + .008), .04, h * .92, .018, { col: [1, 1, 1] });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) k.bevelBox('gunmetal', sx * (w / 2 - .05), sy * (h / 2 - .05), sz * (d / 2 - .05), .13, .13, .13, .02);
  k.box('hazard', 0, h * .25, -d / 2 - .012, w * .7, .08, .004); k.box('white', -w * .25, -h * .3, -d / 2 - .012, .22, .1, .004, { col: [.8, .8, .8] });
  k.pop();
}

// ============================================================================
// worlds/moon/daedalus.js - DAEDALUS STATION, drawn: Technos Prime's capital on the floor of Daedalus crater, far side (bible v3 4.2 and 7.3: "glass city in a crater, the
// big dishes, chip fabs, embassy ring, the spoof shops nobody admits to"). F0's Technos style sheet is the law: white ceramic panel, smart glass, blue light-lines,
// dark silicon, and neon pink only where the city is competing (the embassy ring, the Back Room). Smooth, seamless, no visible joins, faintly lit from within.
// The dishes face away from the Moon's near side: nothing at Daedalus can ever see Earth, which is why the dishes are here. The crater wall rises to the west.
// Layout numbers are layout.js's DAED.
// ============================================================================
import { makeKit, rng } from './kit.js';
import { DAED } from './layout.js';
import { drawEmblem } from '../../factions/emblems.js';
import { pickLine } from '../../factions/registry.js';

const WHITE = [0.94, 0.96, 0.98], PEARL = [0.84, 0.88, 0.93], SLATE = [0.16, 0.2, 0.28], BLUE = [0.22, 0.66, 1.0], PINK = [1.0, 0.25, 0.64];

export function buildDaedalus(ctx) {
  const K = makeKit(ctx), { k, B, X, cyl, pipe, groundY, low, THREE } = K;
  const R = rng(3312), D = DAED;
  const seg = (n) => (low ? Math.max(8, Math.floor(n * 0.6)) : n);

  // ---- the pad: pale composite with blue guide lines -----------------------------------------------------------------------------
  K.pad(D.MAIN_PAD.w, (g, S) => {
    g.fillStyle = '#c9d2dc'; g.fillRect(0, 0, S, S);
    const rr = rng(8); for (let i = 0; i < 12000; i++) { const v = 190 + Math.floor(rr() * 50); g.fillStyle = `rgba(${v},${v + 4},${v + 10},0.25)`; g.fillRect(Math.floor(rr() * S), Math.floor(rr() * S), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 2)); }
    g.strokeStyle = '#38a8ff'; g.lineWidth = 6; g.strokeRect(40, 40, S - 80, S - 80); g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 40); g.lineTo(i * S / 8, S - 40); g.moveTo(40, i * S / 8); g.lineTo(S - 40, i * S / 8); g.stroke(); }
    g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, 300, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, 340, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.95; drawEmblem(g, 'technos', S / 2, S / 2, 330); g.globalAlpha = 1;
    g.fillStyle = '#2b3a4d'; g.textAlign = 'center'; g.font = '300 76px "Avenir Next", "Segoe UI", Arial, sans-serif'; g.fillText('daedalus station', S / 2, 130); g.font = '300 52px "Avenir Next", "Segoe UI", Arial, sans-serif'; g.fillText('node-01 / bay-1 · please do not feel observed', S / 2, S - 110);
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27, 0.55, sz * 27, 0.17, 1.1, 8); X('glowBlue', sx * 27, 1.15, sz * 27, 0.34, 0.12, 0.34); }
  // light-lines in the floor: from the pad to the hall, to the ring, to the fab; polished plazas
  const line = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0); k.push((x0 + x1) / 2, 0.02, (z0 + z1) / 2, a); X('glowBlue', 0, 0, 0, L, 0.02, 0.18); k.pop(); };
  line(0, -30, 0, -74); line(-30, 0, -60, -30); line(0, 30, -30, 66); line(30, 0, 40, 36);
  for (const [x, z, w, d] of [[10, -62, 40, 40], [-62, -30, 30, 60], [-40, 50, 60, 20], [34, 20, 20, 30]]) X('concrete', x, -0.02, z, w, 0.2, d, [0.84, 0.88, 0.92]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { X('glowBlue', sx * 29.2, 0.05, sz * 14, 0.2, 0.03, 8); }

  // ---- the Glass Hall: a low ring wall and a smart-glass dome on white ribs -------------------------------------------------------------------------------------
  {
    const d = D.DOME, cx = d.cx, cz = d.cz, r = d.r;
    K.plinth(d.x0, d.z0, d.x1, d.z1, [0.84, 0.86, 0.9]);
    for (const [x0, z0, x1, z1] of [[d.x0, d.z0, d.x1, d.z0 + 0.8], [d.x0, d.z0, d.x0 + 0.8, d.z1], [d.x1 - 0.8, d.z0, d.x1, d.z1], [d.x0, d.z1 - 0.8, d.gap.x0, d.z1], [d.gap.x1, d.z1 - 0.8, d.x1, d.z1]]) B('panel', (x0 + x1) / 2, d.h / 2, (z0 + z1) / 2, x1 - x0, d.h, z1 - z0, WHITE, 0.08);
    X('floor', cx, 0.05, cz, 70, 0.02, 70, [0.86, 0.9, 0.95]);
    k.dome('glassTint', cx, d.h, cz, r, seg(36), seg(14), { thetaMax: Math.PI / 2, scaleY: 0.58 });
    // ribs: sixteen meridians and four parallels, in white, and a blue light-line round the base
    for (let i = 0; i < (low ? 10 : 16); i++) {
      const a = i / (low ? 10 : 16) * Math.PI * 2; let prev = null;
      for (let j = 0; j <= 8; j++) { const ph = j / 8 * Math.PI / 2, p = [cx + Math.cos(a) * Math.cos(ph) * r, d.h + Math.sin(ph) * r * 0.58, cz + Math.sin(a) * Math.cos(ph) * r]; if (prev) pipe('panel', prev, p, 0.14, 5); prev = p; }
    }
    for (const ph of [0.35, 0.7, 1.05]) { let prev = null; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, p = [cx + Math.cos(a) * Math.cos(ph) * r, d.h + Math.sin(ph) * r * 0.58, cz + Math.sin(a) * Math.cos(ph) * r]; if (prev) pipe('panel', prev, p, 0.1, 4); prev = p; } }
    cyl('glowBlue', cx, d.h + 0.1, cz, r * 1.001, 0.18, seg(40), { col: BLUE });
    // inside: a central tree sculpture of light, a ring of desks, a holo-table, benches, a few plants of the clean kind
    cyl('panel', cx, 3.5, cz, 0.9, 7, 14, { r2: 0.5 }); k.dome('glowCyan', cx, 7.2, cz, 2.6, 14, 8, { scaleY: 0.5 }); cyl('glowBlue', cx, 0.3, cz, 6, 0.4, 24);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5, bx = cx + Math.cos(a) * 15, bz = cz + Math.sin(a) * 15; k.push(bx, 0, bz, -a); B('counter', 0, 0.55, 0, 7, 1.1, 1.2, WHITE, 0.05); X('glowBlue', 0, 1.15, 0.62, 6.8, 0.03, 0.03); X('glowCyan', 0, 1.6, -0.4, 4, 1.0, 0.04); k.pop(); }
    B('counter', cx, 0.55, d.z1 - 9, 20, 1.1, 1.4, WHITE, 0.06); X('glowBlue', cx, 1.15, d.z1 - 8.3, 19.6, 0.03, 0.03);
    K.signs.add(d.x0 + 0.1, 4.2, cz + 8, 14, 1.2, Math.PI / 2, 'technos', 'the glass hall', 'plate');
    K.signs.add(cx, 3.4, d.z1 + 0.14, 9, 1.0, 0, 'technos', 'daedalus station', 'plate');
    K.signs.add(cx + 15, 2.1, d.z1 + 0.14, 5, 0.7, 0, 'technos', pickLine('technos', 'slogans', 1), 'banner');
  }

  // ---- the glass towers, their light-lines and their tubes ---------------------------------------------------------------------------------------------------------------------
  D.TOWERS.forEach(([x, z, s, h], i) => {
    K.plinth(x - s / 2 - 0.5, z - s / 2 - 0.5, x + s / 2 + 0.5, z + s / 2 + 0.5, [0.84, 0.86, 0.9]);
    X('glassTint', x, h / 2, z, s, h, s);
    B('panel', x, h + 0.5, z, s + 0.8, 1.0, s + 0.8, WHITE, 0.08); B('panel', x, 0.6, z, s + 0.8, 1.2, s + 0.8, WHITE, 0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pipe('panel', [x + sx * s / 2, 0, z + sz * s / 2], [x + sx * s / 2, h, z + sz * s / 2], 0.22, 6); X('glowBlue', x + sx * (s / 2 + 0.18), h / 2, z + sz * (s / 2 + 0.18), 0.05, h, 0.05); }
    for (let y = 5; y < h - 2; y += 4.8) { X('glowCool', x, y, z, s - 0.4, 0.05, s - 0.4, [0.8, 0.9, 1.0]); }
    pipe('panel', [x, h + 1, z], [x, h + 8 + (i % 3) * 3, z], 0.14, 5); X('glowBlue', x, h + 8.4 + (i % 3) * 3, z, 0.4, 0.4, 0.4);
    if (i % 2 === 0) { K.dish(x, z, 2.2, 0.6 + i, 1.2, { _ground: h + 1, pedestal: 0.2, col: WHITE }); }
  });
  { const tube = (x0, y0, z0, x1, y1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0); k.push((x0 + x1) / 2, y0, (z0 + z1) / 2, a); cyl('glassTint', 0, 0, 0, 1.7, L, 14, { axis: 'x' }); for (let t = -L / 2 + 3; t < L / 2; t += 6) cyl('panel', t, 0, 0, 1.78, 0.3, 14, { axis: 'x' }); X('glowBlue', 0, -1.55, 0, L, 0.04, 0.5); k.pop(); };
    tube(-26, 5, -110, -54, 5, -100); tube(46, 5, -110, 64, 5, -118); tube(46, 5, -100, 89, 5, -96); tube(-60, 5, -96, -80, 5, -128); }

  // ---- the embassy ring: eight pavilions round a polished plaza, flags, and the Back Room -----------------------------------------------------------------------------------------------
  {
    const Rg = D.RING;
    k.push(Rg.cx, 0, Rg.cz, 0); for (const rr of [10, 22, 34]) { for (let i = 0; i < 40; i++) { const a0 = i / 40 * Math.PI * 2, a1 = (i + 1) / 40 * Math.PI * 2; pipe('glowBlue', [Math.cos(a0) * rr, 0.04, Math.sin(a0) * rr], [Math.cos(a1) * rr, 0.04, Math.sin(a1) * rr], 0.08, 3); } } k.pop();
    cyl('panel', Rg.cx, 0.05, Rg.cz, 38, 0.12, seg(40), { col: [0.9, 0.94, 0.98] });
    D.RINGS.forEach((p) => {
      const back = p.i === 5, inward = Math.atan2(Rg.cx - p.x, Rg.cz - p.z);                    // the yaw that turns the pavilion's front (+z) toward the ring's centre
      k.push(p.x, 0, p.z, inward);
      B('panel', 0, 2.5, 0, 12, 5, 12, back ? [0.55, 0.58, 0.64] : WHITE, 0.1); B('panel', 0, 5.2, 0, 13, 0.5, 13, [0.85, 0.88, 0.92], 0.08);
      X(back ? 'glowRed' : 'glassTint', 0, 2.2, 6.04, 8, 3.2, 0.05, back ? [0.35, 0.1, 0.2] : undefined); X(back ? 'glowRed' : 'glowBlue', 0, 4.6, 6.06, 12, 0.1, 0.04, back ? PINK : BLUE);
      if (back) { X('glowRed', 0, 1.6, 6.1, 1.4, 2.6, 0.05, [0.5, 0.1, 0.3]); X('glowRed', 0, 3.2, 6.12, 2.6, 0.18, 0.04, PINK); } else X('glowCool', 0, 1.5, 6.1, 1.4, 2.6, 0.05);
      k.pop();
      // a flag pole in front: every pavilion is somebody's embassy, in somebody's colours
      const fx = p.x + (Rg.cx - p.x) * 0.12, fz = p.z + (Rg.cz - p.z) * 0.12, fg = groundY(fx, fz);
      pipe('panel', [fx, fg, fz], [fx, fg + 9, fz], 0.07, 5); const cols = [[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.9, 0.8, 0.2], [0.3, 0.7, 0.4], [0.9, 0.5, 0.2], [0.7, 0.3, 0.7], [0.2, 0.7, 0.8], [0.8, 0.8, 0.85]][p.i];
      X('panel', fx + 0.5, fg + 8.1, fz, 0.02, 1.4, 1.9, cols); X('glowBlue', fx, fg + 9.1, fz, 0.18, 0.18, 0.18);
    });
    K.signs.add(Rg.cx, 3.4, Rg.cz + 20, 8, 1.0, 0, 'technos', 'embassy ring', 'plate');
    K.signs.add(Rg.cx - 40, 2.6, Rg.cz + 38, 6, 0.8, 0, 'technos', 'the back room (no sign)', 'banner');
  }

  // ---- the fab, the supply desk, the servers --------------------------------------------------------------------------------------------------------------------------------------
  { const q = D.FAB, cx = (q.x0 + q.x1) / 2;
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: [0.2, 0.24, 0.32], door: q.door, win: 'glass', winY: 4.8, roof: [0.8, 0.84, 0.88], ribs: false });
    for (let x = q.x0 + 3; x < q.x1 - 2; x += 4) X('glowBlue', x, q.h - 1.2, q.z0 - 0.06, 0.1, 5, 0.04);
    X('floor', cx, 0.05, (q.z0 + q.z1) / 2, 78, 0.02, 20, [0.2, 0.24, 0.3]); for (let x = q.x0 + 6; x < q.x1 - 4; x += 8) { B('plasticDark', x, 1.2, q.z1 - 6, 5, 2.4, 3, [0.2, 0.24, 0.32], 0.06); X('glowBlue', x, 2.0, q.z1 - 4.45, 4.2, 0.08, 0.03); }
    for (let i = 0; i < 6; i++) { B('panel', q.x0 + 8 + i * 12, q.h + 1.5, (q.z0 + q.z1) / 2, 3, 3, 14, WHITE, 0.08); for (let j = 0; j < 8; j++) X('glowCool', q.x0 + 8 + i * 12 + 1.55, q.h + 1.5, q.z0 + 3 + j * 1.5, 0.02, 2.4, 0.5); }
    K.signs.add(cx, q.h - 1.2, q.z0 - 0.12, 10, 1.1, Math.PI, 'technos', 'fab floor 2', 'plate'); K.signs.add(cx + 14, 4.4, q.z0 - 0.12, 7, 0.8, Math.PI, 'technos', 'silicon in, rainbows out', 'banner'); }
  { const q = D.SUPPLY;
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: PEARL, door: q.door, win: 'strip', winY: 3.0, lit: 'glowBlue', roof: [0.8, 0.84, 0.88] });
    X('floor', (q.x0 + q.x1) / 2, 0.05, 41, 26, 0.02, 20, [0.86, 0.9, 0.95]); B('counter', 43.6, 0.55, 41, 1.0, 1.1, 8, WHITE, 0.03); X('glowBlue', 43.1, 1.15, 41, 0.03, 0.03, 8);
    K.signs.add(q.x0 - 0.1, q.h - 1.0, 41, 9, 1.0, -Math.PI / 2, 'technos', 'supply desk', 'plate'); K.signs.add(q.x0 - 0.12, 2.5, 41, 5.5, 0.8, -Math.PI / 2, 'technos', 'we make chips, not groceries', 'banner'); }
  { const q = D.SERVERS;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { const x = q.x0 + 3 + c * 6.2, z = q.z0 + 3.5 + r * 7.2; K.plinth(x - 2.4, z - 1.4, x + 2.4, z + 1.4); B('panel', x, 2.1, z, 4.4, 4.2, 2.4, WHITE, 0.08); for (let j = 0; j < 6; j++) X('glowBlue', x - 1.9 + j * 0.76, 3.6, z + 1.24, 0.3, 0.12, 0.03); X('glowCool', x + 2.22, 2.1, z, 0.03, 3.0, 1.6); }
    K.signs.add((q.x0 + q.x1) / 2, 5.4, q.z0 - 0.4, 8, 0.8, Math.PI, 'technos', 'node-24 · cold storage', 'plate'); }

  // ---- the dishes: five on the floor and the Quiet Dish, turning slowly ---------------------------------------------------------------------------------------------------------------------
  D.DISHES.forEach(([x, z, r], i) => K.dish(x, z, r, 0.4 + i * 1.1, 1.0 + 0.15 * (i % 3), { pedestal: r * 0.7, spin: 0.03 + 0.012 * i, rim: 'white', col: WHITE }));
  { const q = D.QUIET_DISH; K.dish(q.x, q.z, q.r, 2.0, 1.15, { pedestal: q.r * 0.6, spin: 0.012, rim: 'white', col: [0.96, 0.97, 0.99] }); K.signs.add(q.x - 18, 2.2, q.z - 14, 7, 0.9, 0, 'technos', 'the quiet dish', 'plate'); K.signs.add(q.x - 18, 1.0, q.z - 14, 7, 0.7, 0, 'technos', 'please whisper. it is listening.', 'banner'); }
  pipe('panel', [128, 0.8, -4], [128, 0.8, -20], 0.12, 4);
  K.signs.add(138, 2.2, 10, 6, 0.8, 0, 'technos', pickLine('technos', 'places', 4), 'plate');

  // ---- quiet pods, drone cradles, kiosks, lamps, jokes -------------------------------------------------------------------------------------------------------------------------------------------
  D.PODS.forEach(([x, z, r]) => { const g = groundY(x, z); K.plinth(x - r, z - r, x + r, z + r, [0.84, 0.86, 0.9]); k.dome('panel', x, r + 0.6, z, r, seg(18), seg(10), { col: [0.94, 0.96, 0.98] }); k.dome('glassTint', x, r + 0.6, z, r * 1.02, seg(18), seg(8), { thetaMax: Math.PI * 0.55 }); cyl('glowBlue', x, r + 0.7, z, r * 1.005, 0.12, seg(18)); for (const s of [-1, 1]) pipe('panel', [x + s * r * 0.7, 0, z + r * 0.7], [x + s * r * 0.5, r * 0.8, z + r * 0.5], 0.14, 5); });
  K.signs.add(70, 7.8, -58, 4, 0.7, 0, 'technos', 'quiet room · 1 hour at a time', 'banner');
  for (const [x, z] of [[-20, 24], [-14, 24], [-8, 24]]) { const g = groundY(x, z); B('panel', x, g + 0.5, z, 1.4, 1.0, 1.4, WHITE, 0.08); k.dome('panel', x, g + 1.5, z, 0.55, 10, 6, {}); cyl('glowBlue', x, g + 1.5, z, 0.7, 0.05, 12); }
  for (const [x, z] of [[18, -40], [-18, -40], [40, -20]]) { const g = groundY(x, z); cyl('panel', x, g + 1.3, z, 0.45, 2.6, 10, { r2: 0.3 }); B('glassTint', x, g + 2.0, z, 0.9, 0.7, 0.08, null, 0.02); X('glowCyan', x, g + 2.0, z + 0.06, 0.7, 0.5, 0.02); }
  for (let t = -50; t <= 60; t += 14) for (const x of [-36, 36]) K.lampPost(x, t, 4.4, 'glowBlue');
  K.signs.add(-72, 3.2, -26, 5, 0.8, 0, 'technos', pickLine('technos', 'graffiti', 0), 'plate');
  K.signs.add(26, 3.0, 54, 5.6, 0.8, 0, 'technos', pickLine('technos', 'graffiti', 1), 'plate');
  K.signs.add(-60, 2.4, 62, 5, 0.7, 0, 'technos', pickLine('technos', 'graffiti', 2), 'plate');
  K.signs.add(-18, 2.6, 30, 6, 0.8, 0, 'technos', 'drone charging. do not feed the drones.', 'banner');

  // an egg: a black slab, one by four by nine, standing alone on the floor 2.5 km out; nobody at the station will say who put it there
  {
    const x = 2300, z = -1200; let lo = 1e9; for (const [dx, dz] of [[-2, -0.5], [2, -0.5], [-2, 0.5], [2, 0.5], [0, 0]]) lo = Math.min(lo, groundY(x + dx, z + dz));
    B('plasticDark', x, lo + 4.4, z, 4, 9, 1, [0.015, 0.015, 0.02], 0.01); B('concrete', x, lo + 0.1, z, 6, 0.4, 3, [0.3, 0.3, 0.3], 0.05);
    pipe('steelDark', [x + 4, lo, z + 5], [x + 4, lo + 1.4, z + 5], 0.05, 4); K.signs.add(x + 4, lo + 1.7, z + 5.04, 3.4, 0.9, 0, 'technos', 'do not touch. we asked the last one.', 'warning');
  }
  return K.finish();
}

// ============================================================================
// worlds/moon/shackleton.js - SHACKLETON BASE, drawn: Fortis's walled capital on the rim of Shackleton crater (bible v3 4.2 and 7.3: "walls, gates, searchlights,
// red lights, numbered everything... the rim power towers in near-constant sun, the ice mines in permanent shadow, the mass driver, barracks, armory, fleet command,
// the gunship apron"). F0's Fortis style sheet is the law: gunmetal and black-olive, bone stencil, signal red, regolith concrete; wedge emblem; everything numbered.
// The compound sits on a flat bench of the rim; the crater (and its ice) lies away to the south west, the mass driver runs out along the rim to the north.
// Layout numbers are layout.js's SHACK.
// ============================================================================
import { makeKit, rng } from './kit.js';
import { SHACK } from './layout.js';
import { drawEmblem } from '../../factions/emblems.js';
import { pickLine } from '../../factions/registry.js';

const GUN = [0.3, 0.33, 0.36], OLIVE = [0.27, 0.3, 0.27], CONC = [0.5, 0.5, 0.48], BONE = [0.81, 0.78, 0.7], RED = [0.84, 0.17, 0.17], DARK = [0.14, 0.15, 0.17];

export function buildShackleton(ctx) {
  const K = makeKit(ctx), { k, B, X, cyl, pipe, groundY, low, THREE } = K;
  const R = rng(9021), S = SHACK, W = S.WALL;
  const beams = [];

  // ---- the pad: the gunship apron --------------------------------------------------------------------------------------------------
  K.pad(S.MAIN_PAD.w, (g, Sz) => {
    g.fillStyle = '#5b5c5a'; g.fillRect(0, 0, Sz, Sz);
    const rr = rng(5); for (let i = 0; i < 20000; i++) { const v = 70 + Math.floor(rr() * 50); g.fillStyle = `rgba(${v},${v},${v},0.3)`; g.fillRect(Math.floor(rr() * Sz), Math.floor(rr() * Sz), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 2)); }
    g.strokeStyle = '#2a2b2a'; g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * Sz / 8, 0); g.lineTo(i * Sz / 8, Sz); g.moveTo(0, i * Sz / 8); g.lineTo(Sz, i * Sz / 8); g.stroke(); }
    // hazard border: red and black
    const hz = (x, y, w, h) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#14171a'; g.fillRect(x, y, w, h); g.fillStyle = '#d22b2b'; for (let i = -Sz; i < Sz * 2; i += 56) { g.beginPath(); g.moveTo(i, y + h); g.lineTo(i + 28, y + h); g.lineTo(i + 28 + h, y); g.lineTo(i + h, y); g.closePath(); g.fill(); } g.restore(); };
    hz(26, 26, Sz - 52, 22); hz(26, Sz - 48, Sz - 52, 22); hz(26, 26, 22, Sz - 52); hz(Sz - 48, 26, 22, Sz - 52);
    g.strokeStyle = '#cfc8b4'; g.lineWidth = 10; g.beginPath(); g.arc(Sz / 2, Sz / 2, 330, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.92; drawEmblem(g, 'fortis', Sz / 2, Sz / 2, 360); g.globalAlpha = 1;
    g.fillStyle = '#cfc8b4'; g.textAlign = 'center'; g.font = '800 70px "Arial Black", Impact, sans-serif'; g.fillText('FORTIS · SHACKLETON', Sz / 2, 118); g.font = '800 52px "Arial Black", Impact, sans-serif'; g.fillText('GUNSHIP APRON · PAD 01', Sz / 2, Sz - 106); g.font = '800 38px "Arial Black", Impact, sans-serif'; g.fillText('SECTOR 4', 150, Sz / 2);
    for (const [x, y] of [[300, 300], [724, 300], [300, 724], [724, 724]]) { const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(10,10,10,.55)'); gr.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = gr; g.fillRect(x - 100, y - 100, 200, 200); }
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27, 0.55, sz * 27, 0.17, 1.1, 8); X('glowRed', sx * 27, 1.15, sz * 27, 0.34, 0.12, 0.34); }
  // lane lines and sector numbers on the compound's ground, the road out through the gate
  for (const [x, z, w, d] of [[0, -62, 18, 40], [64, 31, 130, 18], [-30, 36, 100, 8], [44, 70, 90, 30], [-92, 70, 40, 12]]) X('concrete', x, -0.02, z, w, 0.2, d, [0.5, 0.5, 0.49]);
  for (let x = 30; x < 200; x += 8) X('mark', x, 0.0, 31, 3.6, 0.02, 0.35, BONE);
  X('hazard', 82, 0.03, 20.5, 2, 0.02, 0.5); X('hazard', 82, 0.03, 41.5, 2, 0.02, 0.5);

  // ---- the wall, the towers, the gate ----------------------------------------------------------------------------------------------------
  const wc = [0.44, 0.44, 0.43];
  K.wallRun(W.x0, W.z0, W.x1, W.z0, W.h, W.t, { col: wc, buttress: -1 }); K.wallRun(W.x1, W.z1, W.x0, W.z1, W.h, W.t, { col: wc, buttress: 1 });
  K.wallRun(W.x0, W.z1, W.x0, W.z0, W.h, W.t, { col: wc, buttress: 1 });
  K.wallRun(W.x1, W.z0, W.x1, W.gate.z0, W.h, W.t, { col: wc, buttress: -1 }); K.wallRun(W.x1, W.gate.z1, W.x1, W.z1, W.h, W.t, { col: wc, buttress: -1 });
  for (let x = W.x0 + 12; x < W.x1; x += 24) for (const z of [W.z0, W.z1]) { X('glowRed', x, W.h + 0.9, z + (z === W.z0 ? -0.9 : 0.9), 0.5, 0.2, 0.05); }
  const tower = (x, z, s, h, id) => {
    K.plinth(x - s / 2 - 0.4, z - s / 2 - 0.4, x + s / 2 + 0.4, z + s / 2 + 0.4);
    B('concrete', x, h / 2, z, s, h, s, [0.42, 0.43, 0.42], 0.1);
    for (let y = 2; y < h - 2; y += 3.4) { X('steelDark', x, y, z + s / 2 + 0.03, s * 0.8, 0.12, 0.04, [0.3, 0.3, 0.3]); X('steelDark', x + s / 2 + 0.03, y, z, 0.04, 0.12, s * 0.8, [0.3, 0.3, 0.3]); }
    B('panel', x, h + 1.4, z, s + 2.2, 2.8, s + 2.2, GUN, 0.12); X('glowRed', x, h + 1.5, z + s / 2 + 1.12, s * 0.9, 0.35, 0.04); X('glowRed', x + s / 2 + 1.12, h + 1.5, z, 0.04, 0.35, s * 0.9); X('glowRed', x, h + 1.5, z - s / 2 - 1.12, s * 0.9, 0.35, 0.04); X('glowRed', x - s / 2 - 1.12, h + 1.5, z, 0.04, 0.35, s * 0.9);
    B('concrete', x, h + 3.0, z, s + 3.0, 0.4, s + 3.0, [0.3, 0.3, 0.3], 0.06);
    cyl('steelDark', x, h + 4.6, z, 0.9, 1.6, 10); B('steelDark', x, h + 5.6, z, 1.5, 0.9, 1.1, null, 0.08); X('glowCool', x + 0.78, h + 5.6, z, 0.05, 0.6, 0.8);
    pipe('steelDark', [x + s / 2, h + 3.2, z - s / 2], [x + s / 2, h + 10, z - s / 2], 0.05, 4); X('glowRed', x + s / 2, h + 10.3, z - s / 2, 0.3, 0.3, 0.3);
    beams.push({ x, y: h + 5.6, z, speed: 0.35 + (id % 3) * 0.1, phase: id * 1.7 });
  };
  S.CORNER_TOWERS.forEach(([x, z], i) => tower(x, z, 6.8, 14, i));
  S.GATE_TOWERS.forEach(([x, z], i) => tower(x, z, 7.6, 13, 10 + i));
  // gate: a lintel between the towers, a boom gate, the checkpoint booth, bone-stencil numbers
  B('panel', W.x1, 11.6, (W.gate.z0 + W.gate.z1) / 2, 4, 2.6, W.gate.z1 - W.gate.z0 + 7, GUN, 0.1);
  X('red', W.x1 + 2.05, 11.6, (W.gate.z0 + W.gate.z1) / 2, 0.06, 0.5, 18, RED);
  B('red', W.x1 + 2, 1.05, 31, 0.14, 0.14, 18, [1, 0.9, 0.9], 0.02); for (let z = 23; z < 40; z += 2.4) X('white', W.x1 + 2, 1.05, z, 1.2, 0.15, 0.15);
  K.signs.add(W.x1 + 2.1, 12.2, 31, 18, 1.6, Math.PI / 2, 'fortis', 'SHACKLETON GATE · NUMBER 7', 'plate');
  K.signs.add(W.x1 + 2.1, 10.4, 31, 18, 1.0, Math.PI / 2, 'fortis', pickLine('fortis', 'slogans', 2), 'warning');
  K.block(W.x1 - 14, W.gate.z1 + 2, W.x1 - 6, W.gate.z1 + 8, 3.6, { col: OLIVE, win: 'slit', lit: 'glowRed', roof: [0.3, 0.3, 0.3] });
  K.bollards([[100, 24], [100, 38], [112, 22], [112, 40], [130, 22], [130, 40], [150, 22], [150, 40], [170, 22], [170, 40]]);
  K.signs.add(W.x1 - 10, 4.6, W.gate.z1 + 8.1, 5.6, 0.8, 0, 'fortis', 'CHECKPOINT · BADGES VISIBLE', 'warning');

  // ---- barracks, mass driver control, armoury ----------------------------------------------------------------------------------------------------
  const door = (x, z0, z1, id, n) => { X('glowRed', x, 3.3, z1 + 0.12, 0.5, 0.25, 0.06); K.signs.add(x, 3.9, z1 + 0.1, 3.0, 0.5, 0, 'fortis', `SECTOR ${n} / BLDG ${id} / DOOR 2`, 'plate'); };
  S.BARRACKS.forEach((b, i) => {
    K.block(b.x0, b.z0, b.x1, b.z1, b.h, { col: OLIVE, door: b.door, win: 'slit', lit: 'glowRed', roof: [0.34, 0.35, 0.34], ribs: true });
    const cx = (b.x0 + b.x1) / 2; door(cx, b.z0, b.z1, 17 + i, 4);
    for (let x = b.x0 + 4; x < b.x1 - 3; x += 7) { B('steelDark', x, b.h + 0.9, (b.z0 + b.z1) / 2, 1.6, 0.9, 1.6, null, 0.05); }
    K.signs.add(cx, b.h - 1.0, b.z1 + 0.12, 8, 0.9, 0, 'fortis', i === 0 ? 'BARRACKS A' : 'BARRACKS B', 'plate');
  });
  { const q = S.DRIVER_CONTROL, cx = (q.x0 + q.x1) / 2;
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: GUN, door: q.door, win: 'slit', lit: 'glowCool', roof: [0.34, 0.35, 0.36], ribs: true });
    K.signs.add(cx, q.h - 1.1, q.z1 + 0.12, 12, 1.1, 0, 'fortis', 'MASS DRIVER CONTROL', 'plate'); door(cx + 8, q.z0, q.z1, 22, 6);
    pipe('steelDark', [q.x0 + 4, q.h, q.z0 + 3], [q.x0 + 4, q.h + 12, q.z0 + 3], 0.1, 5); X('glowRed', q.x0 + 4, q.h + 12.3, q.z0 + 3, 0.35, 0.35, 0.35);
    for (let y = 3; y < q.h; y += 2.5) pipe('pipeYellow', [q.x1, y, q.z0 + 8], [q.x1 + 3, y + 0.3, q.z0 - 4], 0.12, 5);
  }
  { const q = S.ARMOURY, cx = (q.x0 + q.x1) / 2;
    K.berm(q.x0 - 6, q.z0 - 6, q.x1 + 6, q.z0 + 2, 3.0); K.berm(q.x0 - 6, q.z0 - 6, q.x0 + 2, q.z1, 2.6); K.berm(q.x1 - 2, q.z0 - 6, q.x1 + 6, q.z1, 2.6);
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: [0.36, 0.37, 0.36], door: q.door, win: null, roof: [0.3, 0.3, 0.3] });
    for (const s of [-1, 1]) B('steelDark', cx + s * 2.3, 1.9, q.z1 + 0.05, 2.2, 3.8, 0.2, [0.22, 0.24, 0.26], 0.05);
    X('glowRed', cx, 4.1, q.z1 + 0.2, 1.4, 0.3, 0.06); K.signs.add(cx, q.h - 0.8, q.z1 + 0.12, 8, 0.9, 0, 'fortis', 'THE ARMOURY', 'plate'); K.signs.add(cx, 4.9, q.z1 + 0.12, 5, 0.7, 0, 'fortis', 'UNNUMBERED ITEMS: REPORT, THEN LEAVE ALONE', 'warning');
    for (let i = 0; i < 6; i++) K.crate(q.x0 + 4 + i * 1.6, q.z1 + 3.2, 1.5, 1.0, 1.0, [0.24, 0.27, 0.24], 0.1 * i);
  }

  // ---- fleet command ---------------------------------------------------------------------------------------------------------------------------------------
  { const q = S.COMMAND, cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    K.block(q.x0, q.z0, q.x1, q.z1, 8, { col: GUN, door: q.door, win: 'slit', winY: 5.6, lit: 'glowRed', roof: [0.3, 0.31, 0.33], ribs: true });
    B('panel', cx, 11.2, cz, 30, 6, 18, [0.26, 0.28, 0.3], 0.1); for (let x = cx - 12; x <= cx + 12; x += 4.8) X('glowCool', x, 11.2, cz + 9.05, 3.2, 1.4, 0.05); X('glowCool', cx + 15.05, 11.2, cz, 0.05, 1.4, 12);
    B('steelDark', cx, 14.5, cz, 33, 0.6, 21, [0.22, 0.23, 0.25], 0.08); pipe('steelDark', [cx + 10, 14.8, cz - 4], [cx + 10, 26, cz - 4], 0.12, 5); K.dish(cx - 8, cz, 2.8, 1.0, 1.2, { pedestal: 2.5, col: [0.6, 0.62, 0.64] });
    X('glowRed', cx + 10, 26.3, cz - 4, 0.4, 0.4, 0.4);
    // the big red wedge across the front, a flag on a tall pole
    K.signs.add(cx, 5.4, q.z1 + 0.12, 11, 6.5, 0, 'fortis', '', 'plate', { emblem: true });
    K.signs.add(cx, 9.2, q.z1 + 0.12, 16, 1.2, 0, 'fortis', 'FLEET COMMAND', 'plate');
    pipe('steelDark', [q.x1 + 3, 0, q.z1 + 4], [q.x1 + 3, 18, q.z1 + 4], 0.1, 5); X('red', q.x1 + 3, 16.4, q.z1 + 4.04, 0.04, 2.6, 4.2, RED);
    K.signs.add(cx, 1.2, q.z1 + 0.12, 7, 0.8, 0, 'fortis', pickLine('fortis', 'slogans', 3), 'warning');
  }

  // ---- quartermaster ------------------------------------------------------------------------------------------------------------------------------------------
  { const q = S.QUARTER;
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: OLIVE, door: q.door, win: 'slit', lit: 'glowCool', roof: [0.33, 0.34, 0.33], ribs: true });
    X('floor', (q.x0 + q.x1) / 2, 0.05, -16, 36, 0.02, 24, [0.5, 0.52, 0.52]); B('counter', -86, 0.55, -16, 1.0, 1.1, 14, [0.55, 0.55, 0.52], 0.03); X('glowRed', -85.4, 1.15, -16, 0.02, 0.02, 14);
    for (const z of [-26, -6]) for (const y of [0.5, 1.2, 1.9]) B('steelDark', q.x0 + 2, y, z, 1.4, 0.08, 6, null, 0.01);
    for (let i = 0; i < 16; i++) K.crate(q.x0 + 2, q.z0 + 2 + (i % 8) * 3, 0.9, 0.5 + R() * 0.4, 1.0, [[0.24, 0.27, 0.24], [0.4, 0.4, 0.36], [0.3, 0.32, 0.36]][i % 3], 0, 0.1 + (i < 8 ? 0 : 0.8));
    K.signs.add(q.x1 + 0.12, q.h - 1.0, -16, 8, 1.0, Math.PI / 2, 'fortis', 'QUARTERMASTER', 'plate'); K.signs.add(q.x1 + 0.12, 2.5, -16, 5, 0.8, Math.PI / 2, 'fortis', 'FORM 7. FORM 8. FORM 9. NO FORM 10.', 'warning');
  }

  // ---- the ice dock: a weigh bay, a hoist, tanks, and the cable line down toward the dark ----------------------------------------------------------------------
  { const q = S.ICE_DOCK;
    K.block(q.x0, q.z0, q.x1, q.z1, q.h, { col: [0.7, 0.76, 0.82], door: q.door, win: 'strip', winY: 3.4, lit: 'glowCyan', roof: [0.6, 0.64, 0.7] });
    X('floor', (q.x0 + q.x1) / 2, 0.05, 70, 28, 0.02, 24, [0.7, 0.76, 0.82]); B('counter', -82.6, 0.55, 70, 1.0, 1.1, 8, [0.7, 0.78, 0.86], 0.03);
    K.signs.add(q.x1 + 0.12, q.h - 1.0, 70, 8, 1.0, Math.PI / 2, 'fortis', 'SHACKLETON ICE DOCK', 'plate'); K.signs.add(q.x1 + 0.12, 2.5, 70, 5.5, 0.8, Math.PI / 2, 'fortis', 'WEIGH IT. DECLARE IT. DO NOT LICK IT.', 'warning');
    // the weigh bay: four legs, a beam, a hopper on a load cell
    for (const [x, z] of [[-74, 58], [-52, 58], [-74, 82], [-52, 82]]) { B('steelDark', x, 4.5, z, 0.6, 9, 0.6, [0.6, 0.55, 0.3], 0.05); B('concrete', x, 0.25, z, 1.4, 0.5, 1.4, null, 0.05); }
    for (const z of [58, 82]) B('steelDark', -63, 9.2, z, 23, 0.8, 0.8, [0.6, 0.55, 0.3], 0.05);
    for (const x of [-74, -52]) B('steelDark', x, 9.2, 70, 0.8, 0.8, 24, [0.6, 0.55, 0.3], 0.05);
    B('steelDark', -63, 7.6, 70, 3, 1.4, 3, [0.4, 0.4, 0.42], 0.06); pipe('steel', [-63, 6.9, 70], [-63, 3.0, 70], 0.04, 4); B('hazard', -63, 2.6, 70, 2.6, 0.7, 2.6, null, 0.05);
    X('floor', -63, 0.04, 70, 8, 0.03, 8, [0.3, 0.32, 0.32]);
    // heaps of pale ice, frost-white crates, tanks of melt
    for (let i = 0; i < 6; i++) k.dome('concrete', -50 + R() * 6, 0, 52 + R() * 6, 1.6 + R() * 1.4, low ? 8 : 12, low ? 4 : 6, { scaleY: 0.5, col: [0.8, 0.86, 0.92], thetaMax: Math.PI / 2 });
    for (const [x, z, r, h] of S.ICE_TANKS) { K.tank(x, z, r, h, [0.78, 0.86, 0.92], { band: 'glowBlue' }); }
    pipe('pipeBlue', [-96, 1.0, 92], [-82, 1.0, 92], 0.2, 6); pipe('pipeBlue', [-90, 1.0, 92], [-86, 1.2, 84], 0.16, 6);
    // the ice lift: pylons every 38 m to the south west, a cable, a bucket
    let prev = null;
    for (let i = 0; i < 9; i++) { const x = -120 - i * 34, z = 100 + i * 28, g = groundY(x, z), top = g + 12; B('steelDark', x, (g + top) / 2, z, 0.7, top - g, 0.7, [0.55, 0.5, 0.3], 0.05); B('steelDark', x, top, z, 3, 0.3, 0.3, null, 0.03); X('glowRed', x, top + 0.4, z, 0.2, 0.2, 0.2); if (prev) pipe('steelDark', [prev[0], prev[1] + 0.3, prev[2]], [x, top + 0.3, z], 0.04, 4); prev = [x, top, z]; if (i === 4) { B('red', x + 0.2, top - 3.2, z, 2.4, 2.2, 2.4, [0.8, 0.8, 0.8], 0.06); pipe('steelDark', [x, top, z], [x, top - 2, z], 0.03, 4); } }
    K.signs.add(-120, 5.4, 100.2, 6, 0.9, 0, 'fortis', 'ICE LIFT · DOWN IS THAT WAY', 'warning');
  }

  // ---- motor pool, fuel farm, the vehicles ----------------------------------------------------------------------------------------------------------------------------
  {
    const apc = (x, z, yaw, n) => {
      const g = groundY(x, z); k.push(x, g, z, yaw);
      B('panel', 0, 1.35, 0, 4.0, 0.9, 7.0, OLIVE, 0.14); B('panel', 0, 2.2, -0.4, 3.4, 0.9, 4.4, [0.3, 0.33, 0.3], 0.12); X('glowRed', 0, 2.3, -2.62, 2.2, 0.28, 0.05);
      for (const sx of [-1, 1]) for (const wz of [-2.6, 0, 2.6]) { cyl('rubber', sx * 2.1, 0.8, wz, 0.8, 0.7, 14, { axis: 'x' }); cyl('steelDark', sx * 2.12, 0.8, wz, 0.4, 0.74, 8, { axis: 'x' }); }
      B('steelDark', 0, 3.0, 1.0, 1.4, 0.7, 1.6, null, 0.08); pipe('steelDark', [0, 3.0, 1.0], [0, 3.1, -1.4], 0.1, 6); pipe('steelDark', [1.4, 2.7, 2.5], [1.4, 5.0, 2.5], 0.03, 4);
      X('red', 1.3, 1.5, 3.52, 0.9, 0.5, 0.03, RED); k.pop();
      K.signs.add(x + Math.sin(yaw) * 0, g + 1.4, z + 3.56, 1.2, 0.5, yaw, 'fortis', `FT-${String(n).padStart(2, '0')}`, 'plate');
    };
    apc(0, 70, 0, 7); apc(16, 70, 0.04, 12); apc(32, 70, -0.05, 21);
    for (const [x, z, r, h] of S.FUEL) { K.tank(x, z, r, h, GUN, { band: 'red' }); }
    pipe('pipeRed', [60, 1.2, 84], [76, 1.2, 84], 0.18, 6); pipe('pipeYellow', [68, 1.4, 84], [68, 1.4, 96], 0.14, 6);
    K.signs.add(68, 5.2, 70.6, 8, 0.8, 0, 'fortis', 'FUEL · CRYO · NO SMOKING (YES, REALLY)', 'warning');
    K.signs.add(16, 3.4, 78, 6, 0.8, 0, 'fortis', 'GUNSHIP APRON IS THAT WAY. THE WAY WITH THE GUNSHIPS.', 'plate');
    // ammunition and drum stacks by the armoury road
    for (let i = 0; i < 10; i++) K.barrel(-30 + (i % 5) * 0.8, -40 + Math.floor(i / 5) * 0.8, [[0.27, 0.3, 0.27], [0.55, 0.15, 0.15]][i % 2]);
  }

  // ---- the rim power towers and their batteries (outside the walls, on the crest) ------------------------------------------------------------------------------------
  for (const [x, z, h] of [[-70, -176, 72], [10, -206, 86], [100, -186, 64]]) {
    const top = K.mast(x, z, h, [0.42, 0.44, 0.46], 2.4);
    for (let i = 0; i < 3; i++) { const y = groundY(x, z) + h * (0.45 + 0.17 * i); K.solarWing(x + 8, y, z, 16, 6, 0, 0.12, [0.1, 0.17, 0.3]); K.solarWing(x - 8, y, z, 16, 6, 0, 0.12, [0.1, 0.17, 0.3]); pipe('steelDark', [x - 8, y, z], [x + 8, y, z], 0.06, 4); }
    X('glowRed', x, top + 0.5, z, 0.6, 0.6, 0.6);
    K.signs.add(x, groundY(x, z) + 3.5, z + 2.9, 3, 0.6, 0, 'fortis', `RIM TOWER ${[3, 4, 5][[-70, 10, 100].indexOf(x)]}`, 'plate');
    for (let i = 0; i < 4; i++) { const bx = x - 9 + i * 4.2; K.block(bx - 1.8, z + 8, bx + 1.8, z + 12, 3.0, { col: [0.36, 0.38, 0.38], win: null, roof: [0.3, 0.3, 0.3], plinth: true }); }
  }
  pipe('pipeYellow', [-70, 0.8, -140], [-70, 0.8, -168], 0.14, 5); pipe('pipeYellow', [10, 0.8, -140], [10, 0.8, -198], 0.14, 5); pipe('pipeYellow', [100, 0.8, -150], [100, 0.8, -178], 0.14, 5);

  // ---- the mass driver: a straight rail on trestles running north along the rim from control ----------------------------------------------------------------------------
  {
    const x = -10, z0 = -108, z1 = -470, y = 9.0;
    for (let z = z0; z >= z1; z -= 18) {
      const g = groundY(x, z), n = (z0 - z) / 18;
      B('steelDark', x, (g + y) / 2 - 0.4, z, 0.9, y - g, 0.9, [0.4, 0.42, 0.45], 0.06); B('concrete', x, g + 0.4, z, 3.0, 0.8, 3.0, null, 0.08); B('steelDark', x, y - 0.5, z, 6.4, 0.6, 1.0, [0.38, 0.4, 0.42], 0.05);
      if (n % 2 === 0) { cyl('metal', x, y + 0.9, z, 2.6, 0.7, 18, { axis: 'z', col: [0.34, 0.36, 0.4], r2: 2.6 }); cyl('red', x, y + 0.9, z, 2.62, 0.18, 18, { axis: 'z', col: RED }); }
    }
    pipe('steel', [x - 1.1, y + 0.15, z0], [x - 1.1, y + 0.15, z1], 0.16, 6); pipe('steel', [x + 1.1, y + 0.15, z0], [x + 1.1, y + 0.15, z1], 0.16, 6);
    B('panel', x, y + 1.0, z0 + 6, 9, 6, 12, GUN, 0.1); X('glowRed', x, y + 3.6, z0 + 0.1, 5, 0.5, 0.05);
    K.signs.add(x, y + 4.4, z0 + 0.2, 7, 0.9, Math.PI, 'fortis', 'MASS DRIVER · DO NOT STAND IN THE ROAD', 'warning');
    K.signs.add(x, y + 6.4, z0 + 0.2, 9, 1.0, Math.PI, 'fortis', 'THE MASS DRIVER IS NOBODY\'S DOG', 'plate');
  }

  // ---- floodlight masts, bone-stencil places, red lamps, a few jokes -----------------------------------------------------------------------------------------------------
  for (const [x, z] of [[-60, -20], [60, 8], [-30, 40], [30, -60], [-100, -50], [110, -70]]) {
    cyl('steelDark', x, 7, z, 0.22, 14, 8, { r2: 0.14 }); B('concrete', x, 0.25, z, 1.2, 0.5, 1.2, null, 0.05);
    k.push(x, 14.2, z, Math.atan2(-z, -x)); B('steelDark', 0, 0, 0, 0.3, 0.3, 3.0, null, 0.04); for (let j = -1; j <= 1; j++) { B('steelDark', 0.3, 0.1, j * 0.95, 0.3, 0.7, 0.85, null, 0.03); X('glowCool', 0.47, 0.1, j * 0.95, 0.02, 0.55, 0.7); } k.pop();
  }
  K.signs.add(-50, 3.0, -64, 4, 0.7, 0, 'fortis', 'SECTOR 9 IS NOT A SECTOR (WE ASKED)', 'plate');
  K.signs.add(20, 2.6, -66.2, 6, 0.8, 0, 'fortis', pickLine('fortis', 'graffiti', 0), 'plate');
  K.signs.add(-92, 3.0, -2.2, 5.6, 0.8, 0, 'fortis', pickLine('fortis', 'graffiti', 1), 'plate');
  K.signs.add(24, 2.8, 100.2, 7, 0.9, 0, 'fortis', pickLine('fortis', 'places', 5), 'plate');
  for (let i = 0; i < 12; i++) X('mark', -100 + i * 2.2, 0.0, -62.8, 1.0, 0.02, 0.04, BONE);
  K.lampPost(-26, 28, 4.5, 'glowRed'); K.lampPost(26, 28, 4.5, 'glowRed'); K.lampPost(-26, -28, 4.5, 'glowRed'); K.lampPost(26, -28, 4.5, 'glowRed');

  // ---- the searchlight beams (additive cones that sweep), registered to move ---------------------------------------------------------------------------------------------------
  const out = K.finish({
    extra: (root) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      const geo = new THREE.ConeGeometry(3.2, 110, 10, 1, true); geo.rotateX(Math.PI); geo.translate(0, 55, 0); geo.rotateZ(-Math.PI / 2 + 0.10);     // apex at the origin, axis out along +x, tipped a touch down
      for (const b of beams) { const g = new THREE.Group(); g.position.set(b.x, b.y, b.z); const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m); root.add(g); b.group = g; }
      K.animate((dt, t) => { for (const b of beams) b.group.rotation.y = t * b.speed + b.phase; });
    },
  });
  return out;
}

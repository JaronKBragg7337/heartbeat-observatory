// ============================================================================
// worlds/moon/hub.js - TRANQUILITY CIVIL HUB, drawn: the Moon's neutral front door on Mare Tranquillitatis (bible v3 7.3: "the small shared port a new Moon
// player crashes near. Both recruiters wait here"). A grey, weathered, civil port in the Mars port's own neutral style, with the two blocs' recruiting booths
// facing each other across the plaza, a water office that wants ice, a mercantile, a clinic, a rover garage, a tank farm, a solar field and a comms mast; and,
// a kilometre and a half away, the real Apollo 11 landing site behind a rope: the descent stage, the flag, the plaque, the footprints.
// Layout numbers are layout.js's HUB (the walls here are the walls the walker is stopped by).
// ============================================================================
import { makeKit, rng } from './kit.js';
import { HUB } from './layout.js';
import { drawEmblem, drawSign } from '../../factions/emblems.js';
import { factionStyle, signText, pickLine } from '../../factions/registry.js';
import { css } from '../../factions/_kit/style.js';

const GREY = [0.74, 0.75, 0.76], WHITE = [0.9, 0.91, 0.92], DARK = [0.28, 0.3, 0.33], TEAL = [0.18, 0.42, 0.46], ORANGE = [0.9, 0.5, 0.2];

export function buildHub(ctx) {
  const K = makeKit(ctx), { k, B, X, cyl, pipe, groundY, low, THREE } = K;
  const R = rng(4411);
  const fortis = factionStyle('fortis'), technos = factionStyle('technos');
  const FRED = [0.82, 0.17, 0.17], FGUN = [0.23, 0.25, 0.27], FBONE = [0.81, 0.78, 0.7], TBLUE = [0.22, 0.66, 1.0], TWHITE = [0.93, 0.95, 0.97];

  // ---- the main pad: concrete, painted ------------------------------------------------------------------------------------
  K.pad(HUB.MAIN_PAD.w, (g, S) => {
    g.fillStyle = '#7d7c77'; g.fillRect(0, 0, S, S);
    const rr = rng(7); for (let i = 0; i < 20000; i++) { const v = 90 + Math.floor(rr() * 50); g.fillStyle = `rgba(${v},${v},${v - 4},0.3)`; g.fillRect(Math.floor(rr() * S), Math.floor(rr() * S), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 2)); }
    g.strokeStyle = '#34322f'; g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
    g.strokeStyle = '#d6d1c4'; g.lineWidth = 16; g.strokeRect(34, 34, S - 68, S - 68); g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, 340, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.9; drawEmblem(g, 'fortis', S * 0.3, S * 0.5, 190); drawEmblem(g, 'technos', S * 0.7, S * 0.5, 190); g.globalAlpha = 1;
    g.fillStyle = '#d6d1c4'; g.textAlign = 'center'; g.font = 'bold 84px "SF Mono", Menlo, monospace'; g.fillText('TRANQUILITY', S / 2, S * 0.2); g.font = 'bold 58px "SF Mono", Menlo, monospace'; g.fillText('CIVIL HUB · PAD 01', S / 2, S * 0.27);
    g.font = 'bold 40px "SF Mono", Menlo, monospace'; g.fillText('NEUTRAL GROUND. NO WEAPONS BEYOND THIS LINE.', S / 2, S * 0.88); g.fillText('(YES, YOU, SERGEANT.)', S / 2, S * 0.93);
    for (const [x, y] of [[300, 300], [724, 300], [300, 724], [724, 724]]) { const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(20,20,20,.5)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); g.fillStyle = gr; g.fillRect(x - 100, y - 100, 200, 200); }
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27, 0.55, sz * 27, 0.17, 1.1, 8); X('glowAmber', sx * 27, 1.15, sz * 27, 0.34, 0.12, 0.34); }
  // aprons and the paved plaza between the pad and the hall
  for (const [x, z, w, d] of [[-8, -48, 46, 36], [0, 36, 40, 14], [-50, 0, 40, 10], [60, 24, 38, 8]]) X('concrete', x, -0.02, z, w, 0.2, d, [0.76, 0.76, 0.74]);
  for (let i = -26; i <= 26; i += 4.4) for (const z of [-30.2, 30.2]) { if (Math.abs(i) < 6) continue; B('concrete', i, 0.4, z, 3.6, 0.8, 0.5, [0.78, 0.78, 0.76], 0.06); X('hazard', i, 0.55, z + (z > 0 ? 0.26 : -0.26), 3.2, 0.12, 0.01); }

  // ---- the terminal hall: arrivals, customs, the port master's desk --------------------------------------------------------------
  {
    const H = HUB.HALL, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
    K.berm(H.x0 - 7, H.z0 - 7, H.x1 + 7, H.z0 + 3, 3.2); K.berm(H.x0 - 7, H.z0 - 7, H.x0 + 3, H.z1, 2.6); K.berm(H.x1 - 3, H.z0 - 7, H.x1 + 7, H.z1, 2.6);     // regolith banked up the back and sides
    K.block(H.x0, H.z0, H.x1, H.z1, H.h, { col: WHITE, door: H.door, win: 'glass', winY: 3.6, ribs: true, roof: [0.78, 0.8, 0.82] });
    // the long front: a canopy over the door, glass panels, lit strip
    B('steelDark', cx, H.h - 0.6, H.z1 + 1.8, 20, 0.28, 4.2, [0.4, 0.42, 0.46], 0.05);
    for (const sx of [-1, 1]) pipe('steelDark', [cx + sx * 9.4, 0, H.z1 + 3.4], [cx + sx * 9.4, H.h - 0.6, H.z1 + 3.4], 0.1, 6);
    X('glowCool', cx, H.h - 0.8, H.z1 + 3.9, 18, 0.05, 0.05);
    X('glassTint', cx, 3.4, H.z1 + 0.06, 12, 4.8, 0.04);                                  // curtain glass either side of the door
    X('glowAmber', cx - 5, 1.2, H.z1 + 0.1, 0.8, 0.04, 0.04);
    // inside: floor stripes, the port master's long desk, the governor's desk, benches, a departures board, two plants of the plastic kind
    X('floor', cx, 0.05, cz, 40, 0.02, 22, [0.74, 0.76, 0.78]);
    for (let x = H.x0 + 4; x < H.x1 - 3; x += 3) X('glowCool', x, 0.075, H.z1 - 3, 0.9, 0.012, 0.18);
    B('counter', -10, 0.55, -84, 22, 1.1, 1.0, [0.8, 0.82, 0.85], 0.04); X('glowCool', -10, 1.15, -83.4, 21, 0.02, 0.08);
    B('wood', 8, 0.5, -84, 5, 1.0, 1.6, [0.8, 0.7, 0.6], 0.04);
    for (const x of [-22, -14, -6, 2]) for (const z of [-74, -78]) B('fabricGrey', x, 0.28, z, 3.4, 0.56, 0.8, [0.42, 0.5, 0.55], 0.05);
    X('glowCyan', -10, 5.4, -91.6, 12, 2.2, 0.06);                                       // the departures board
    for (const x of [-26, 10]) { cyl('paint', x, 0.4, -89, 0.35, 0.8, 8, { col: [0.6, 0.62, 0.6] }); k.dome('white', x, 0.8, -89, 0.5, 8, 4, { col: [0.2, 0.5, 0.25], scaleY: 1.2 }); }
    // roof: vents, an antenna garden, a beacon
    for (let x = H.x0 + 4; x < H.x1 - 2; x += 8) { B('steelDark', x, H.h + 0.8, cz + 2, 1.4, 0.8, 1.4, null, 0.05); cyl('metal', x + 2.5, H.h + 1.6, cz - 3, 0.35, 2.2, 8, { col: [0.7, 0.72, 0.75] }); }
    pipe('steelDark', [H.x0 + 3, H.h + 0.4, H.z0 + 4], [H.x0 + 3, H.h + 9, H.z0 + 4], 0.1, 5); X('glowRed', H.x0 + 3, H.h + 9.2, H.z0 + 4, 0.3, 0.3, 0.3);
    K.signs.add(cx, H.h - 1.7, H.z1 + 0.12, 14, 1.9, 0, 'mars', 'TRANQUILITY CIVIL HUB', 'plate');
    K.signs.add(cx + 4.5, 3.6, H.z1 + 0.14, 3.6, 0.8, 0, 'mars', 'ARRIVALS', 'plate');
    K.signs.add(cx - 4.5, 3.6, H.z1 + 0.14, 3.6, 0.8, 0, 'mars', 'CUSTOMS (BE NICE)', 'warning');
    K.signs.add(H.x0 - 0.1, 4.4, cz, 22, 1.4, -Math.PI / 2, 'mars', 'THE MOON IS OPEN. PLEASE KEEP IT THAT WAY.', 'plate');
  }

  // ---- the recruiters: two booths facing each other across the plaza ------------------------------------------------------------------
  {
    const F = HUB.FORTIS_BOOTH, T = HUB.TECHNOS_KIOSK;
    // Fortis: a squat gunmetal block with a red stripe, a boom gate, sandbag-grey barriers, a searchlight on a pole
    K.block(F.x0, F.z0, F.x1, F.z1, F.h, { col: FGUN, win: 'slit', lit: 'glowRed', roof: [0.2, 0.22, 0.24], plinth: true });
    X('red', (F.x0 + F.x1) / 2, F.h * 0.35, F.z1 + 0.04, F.x1 - F.x0, 0.35, 0.03, FRED); X('red', (F.x0 + F.x1) / 2, F.h * 0.62, F.z1 + 0.04, F.x1 - F.x0, 0.12, 0.03, FRED);
    for (const dx of [-3, 3]) B('concrete', F.x0 - 2 + (dx > 0 ? 16 : 0), 0.4, F.z1 + 5, 3.4, 0.8, 0.8, [0.5, 0.5, 0.48], 0.05);
    pipe('steelDark', [F.x0 - 1, 0, F.z1 + 2.5], [F.x0 - 1, 1.1, F.z1 + 2.5], 0.1, 6); B('red', F.x0 + 3, 1.05, F.z1 + 2.5, 8, 0.12, 0.12, [1, 0.9, 0.9], 0.02); X('white', F.x0 + 1, 1.05, F.z1 + 2.5, 1.2, 0.13, 0.13);   // a boom gate across the way
    pipe('steelDark', [F.x1 + 1.2, 0, F.z0 + 2], [F.x1 + 1.2, 6.5, F.z0 + 2], 0.12, 6); B('steelDark', F.x1 + 1.2, 6.8, F.z0 + 2, 0.9, 0.8, 0.9, null, 0.05); X('glowCool', F.x1 + 1.2, 6.8, F.z0 + 2.5, 0.6, 0.5, 0.04);
    pipe('steelDark', [F.x0 + 1, F.h, F.z0 + 2], [F.x0 + 1, F.h + 6, F.z0 + 2], 0.07, 5); k.poly('red', [[F.x0 + 1, F.h + 6, F.z0 + 2.0], [F.x0 + 1, F.h + 6, F.z0 + 2.04], [F.x0 + 1, F.h + 4.6, F.z0 + 2.04], [F.x0 + 1, F.h + 4.6, F.z0 + 2.0]], null, FRED);
    X('red', F.x0 + 3, F.h + 5.3, F.z0 + 2.0, 0.02, 1.5, 2.2, FRED);                                                                  // a flag (a banner on the pole)
    K.signs.add((F.x0 + F.x1) / 2, F.h - 0.9, F.z1 + 0.1, 11, 1.1, 0, 'fortis', 'FORTIS RECRUITMENT', 'plate');
    K.signs.add((F.x0 + F.x1) / 2, 1.55, F.z1 + 0.1, 5.4, 0.9, 0, 'fortis', pickLine('fortis', 'slogans', 0), 'warning');
    // Technos Prime: a white pavilion with a glass front, a blue light-line, a dish on the roof
    K.block(T.x0, T.z0, T.x1, T.z1, T.h, { col: TWHITE, win: 'glass', winY: 1.9, roof: [0.85, 0.88, 0.92], plinth: true });
    X('glowBlue', (T.x0 + T.x1) / 2, T.h - 0.6, T.z1 + 0.06, T.x1 - T.x0, 0.07, 0.03); X('glowBlue', (T.x0 + T.x1) / 2, 0.45, T.z1 + 0.06, T.x1 - T.x0, 0.07, 0.03);
    K.dish((T.x0 + T.x1) / 2 - 2, (T.z0 + T.z1) / 2 + 1, 2.2, 0.8, 1.0, { pedestal: 0.2, col: [0.95, 0.97, 1] });
    K.signs.add((T.x0 + T.x1) / 2, T.h - 1.3, T.z1 + 0.1, 10, 1.1, 0, 'technos', 'technos prime recruitment', 'plate');
    K.signs.add((T.x0 + T.x1) / 2, 1.2, T.z1 + 0.1, 5.4, 0.9, 0, 'technos', 'have you tried turning the Moon off and on again?', 'banner');
    // a sleek bench each, and the line that is painted down the middle of the plaza
    X('paint', 0, 0.02, -46, 0.3, 0.02, 30, [0.9, 0.85, 0.5]);
    K.signs.add(0, 2.4, -44, 5, 0.7, 0, 'mars', 'FORTIS <--- ---> TECHNOS. PLEASE DO NOT SHOOT THE STAFF.', 'warning');
  }

  // ---- mercantile, clinic -----------------------------------------------------------------------------------------------------------
  {
    const M = HUB.MERC;
    K.berm(M.x0 - 6, M.z0 - 4, M.x0 + 2, M.z1 + 4, 2.4);
    K.block(M.x0, M.z0, M.x1, M.z1, M.h, { col: [0.78, 0.74, 0.66], door: M.door, win: 'strip', winY: 3.0, lit: 'glowAmber', ribs: false });
    B('paint', M.x1 + 1.2, M.h - 0.8, 5, 3.4, 0.2, 8, [0.9, 0.5, 0.2], 0.04); for (const dz of [-3.4, 3.4]) pipe('steelDark', [M.x1 + 2.6, 0, 5 + dz], [M.x1 + 2.6, M.h - 0.8, 5 + dz], 0.08, 5);        // an awning
    X('floor', (M.x0 + M.x1) / 2, 0.05, 5, 22, 0.02, 20, [0.8, 0.78, 0.7]);
    B('counter', -68, 0.55, 5, 1.0, 1.1, 8, [0.8, 0.7, 0.6], 0.03);
    for (const z of [-3, 13]) for (const y of [0.5, 1.1, 1.7]) B('steelDark', M.x0 + 2, y, z, 1.4, 0.08, 6.5, null, 0.01);
    for (let i = 0; i < 14; i++) K.crate(M.x0 + 2, M.z0 + 2 + R() * 18, 0.6 + R() * 0.5, 0.4 + R() * 0.4, 0.8, [[0.42, 0.49, 0.41], [0.55, 0.48, 0.32], [0.35, 0.44, 0.53]][i % 3], 0, 0.1 + (i % 3) * 0.6);
    K.signs.add(M.x1 + 0.1, M.h - 1.0, 5, 8, 1.1, Math.PI / 2, 'mars', 'TRANQUILITY MERCANTILE', 'plate');
    K.signs.add(M.x1 + 0.12, 2.6, 5, 4, 0.7, Math.PI / 2, 'mars', 'NO REFUNDS. THE MOON IS FAR.', 'warning');
    const C = HUB.CLINIC;
    K.berm(C.x0 - 6, C.z0 - 4, C.x0 + 2, C.z1 + 4, 2.4);
    K.block(C.x0, C.z0, C.x1, C.z1, C.h, { col: WHITE, door: C.door, win: 'strip', winY: 2.9, lit: 'glowCool' });
    X('glowGreen', C.x1 + 0.06, C.h - 1.3, -41, 0.04, 1.8, 0.6); X('glowGreen', C.x1 + 0.06, C.h - 1.3, -41, 0.04, 0.6, 1.8);
    K.signs.add(C.x1 + 0.12, C.h - 2.6, -41, 5, 0.9, Math.PI / 2, 'mars', 'CLINIC (BRING YOUR OWN LUNGS)', 'plate');
  }

  // ---- water office and the tank farm -----------------------------------------------------------------------------------------------
  {
    const W = HUB.WATER;
    K.block(W.x0, W.z0, W.x1, W.z1, W.h, { col: [0.7, 0.78, 0.84], door: W.door, win: 'strip', winY: 3.1, lit: 'glowCyan' });
    X('floor', (W.x0 + W.x1) / 2, 0.05, -14, 24, 0.02, 18, [0.78, 0.82, 0.86]); B('counter', 49, 0.55, -14, 1.0, 1.1, 8, [0.7, 0.78, 0.86], 0.03);
    K.signs.add(W.x0 - 0.1, W.h - 1.0, -14, 9, 1.1, -Math.PI / 2, 'mars', 'HUB WATER OFFICE', 'plate');
    K.signs.add(W.x0 - 0.12, 2.6, -14, 5.5, 0.8, -Math.PI / 2, 'mars', 'ICE BOUGHT HERE. NO QUESTIONS ABOUT WHOSE.', 'warning');
    for (const [x, z, r, h] of HUB.TANKS) { K.tank(x, z, r, h, [0.82, 0.86, 0.9], { band: 'hazard' }); }
    pipe('pipeBlue', [80, 1.2, -30], [72, 1.2, -18], 0.18, 6); pipe('pipeBlue', [95, 1.2, -24], [70, 1.4, -14], 0.2, 6); pipe('pipeBlue', [91, 1.2, -16], [71, 1.4, -12], 0.16, 6);
    for (const [x, z, r] of HUB.SPHERES) { const g = groundY(x, z); K.plinth(x - r, z - r, x + r, z + r); k.dome('white', x, r + 0.6, z, r, low ? 12 : 20, low ? 7 : 12, { col: [0.88, 0.9, 0.93] }); for (const s of [-1, 1]) pipe('steelDark', [x + s * r * 0.7, 0, z + r * 0.7], [x + s * r * 0.5, r * 0.8, z + r * 0.5], 0.16, 6); cyl('hazard', x, r + 0.6, z, r * 1.003, 0.5, 20); }
    K.signs.add(94, 4.8, 8, 7, 0.9, 0, 'mars', 'CRYO. DO NOT LICK.', 'warning');
  }

  // ---- garage and rovers, the gas kiosk ------------------------------------------------------------------------------------------------------
  {
    const G = HUB.GARAGE;
    K.block(G.x0, G.z0, G.x1, G.z1, G.h, { col: [0.62, 0.64, 0.66], win: 'slit', lit: 'glowWhite' });
    for (let i = 0; i < 2; i++) B('steelDark', G.x0 + 8 + i * 16, 2.0, G.z0 - 0.04, 12, 4.0, 0.1, [0.5, 0.52, 0.55], 0.04);
    const rover = (x, z, yaw, col) => {
      const g = groundY(x, z); k.push(x, g, z, yaw);
      B('paint', 0, 1.3, 0, 3.4, 0.7, 6.4, col, 0.1); B('paint', 0, 2.1, -1.5, 3.0, 1.0, 2.8, col, 0.12); X('glassTint', 0, 2.2, -2.95, 2.6, 0.7, 0.05); X('glassTint', 1.55, 2.2, -1.5, 0.05, 0.7, 2.2); X('glassTint', -1.55, 2.2, -1.5, 0.05, 0.7, 2.2);
      for (const sx of [-1, 1]) for (const wz of [-2.3, 0, 2.3]) { cyl('rubber', sx * 1.85, 0.75, wz, 0.75, 0.55, 14, { axis: 'x' }); cyl('steelDark', sx * 1.86, 0.75, wz, 0.38, 0.6, 8, { axis: 'x' }); }
      B('steelDark', 0, 1.0, 2.4, 2.4, 0.6, 1.6, null, 0.06); pipe('steelDark', [1.2, 2.5, 2.6], [1.2, 4.4, 2.6], 0.03, 4); X('glowWhite', 0, 2.65, -2.95, 1.2, 0.08, 0.06); X('glowAmber', 1.5, 1.7, 3.15, 0.3, 0.2, 0.05); X('glowAmber', -1.5, 1.7, 3.15, 0.3, 0.2, 0.05);
      k.pop();
    };
    rover(G.x0 + 8, G.z0 - 9, 0.15, [0.9, 0.9, 0.9]); rover(G.x0 + 22, G.z0 - 8, -0.1, [0.88, 0.6, 0.25]);
    K.signs.add((G.x0 + G.x1) / 2, G.h - 1.0, G.z0 - 0.1, 9, 1.0, Math.PI, 'mars', 'ROVER HIRE · PRESSURISED · NO PETS', 'plate');
    const S = HUB.GAS;
    K.block(S.x0, S.z0, S.x1, S.z1, S.h, { col: [0.82, 0.74, 0.5], win: 'strip', winY: 1.8, lit: 'glowAmber' });
    for (let i = 0; i < 6; i++) cyl('metal', S.x0 + 1.4 + i * 1.8, 1.0, S.z1 + 1.2, 0.3, 1.6, 8, { col: [0.3, 0.55, 0.7] });
    K.signs.add((S.x0 + S.x1) / 2, S.h - 0.8, S.z1 + 0.1, 8, 0.8, 0, 'mars', 'OXYGEN · WATER · SNACKS (THEY ARE FINE)', 'plate');
  }

  // ---- comms mast, solar field, floodlights, lamp posts -----------------------------------------------------------------------------------------
  { const top = K.mast(-96, -76, 40, [0.7, 0.72, 0.76], 1.4); K.dish(-96, -70, 3.2, 2.2, 0.9, { pedestal: 2 }); X('glowRed', -96, top + 0.4, -76, 0.4, 0.4, 0.4); }
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) { const x = -70 + i * 9, z = 74 + row * 9; const g = groundY(x, z); cyl('steelDark', x, g + 0.7, z, 0.07, 1.4, 5); K.solarWing(x, g + 1.5, z, 7.6, 3.4, 0, 0.6 + 0.05 * row); }
  for (const [x, z] of [[-42, -34], [42, -34], [46, 20], [-46, 22], [0, 70], [-60, 66]]) {
    cyl('steelDark', x, 7, z, 0.22, 14, 8, { r2: 0.14 }); B('concrete', x, 0.25, z, 1.2, 0.5, 1.2, null, 0.05);
    k.push(x, 14.2, z, Math.atan2(-z, -x)); B('steelDark', 0, 0, 0, 0.3, 0.3, 3.0, null, 0.04); for (let j = -1; j <= 1; j++) { B('steelDark', 0.3, 0.1, j * 0.95, 0.3, 0.7, 0.85, null, 0.03); X('glowWhite', 0.47, 0.1, j * 0.95, 0.02, 0.55, 0.7); } k.pop();
  }
  for (let t = -48; t <= 48; t += 12) for (const x of [-34, 34]) K.lampPost(x, t < 0 ? t : -t - 6, 4.2, 'glowCool');
  K.bollards([[-8, -62], [-2, -62], [-14, -62], [4, -62], [-26, -58], [10, -58]]);
  for (let i = 0; i < 8; i++) K.barrel(-30 + (i % 4) * 0.8, 40 + Math.floor(i / 4) * 0.8, [[0.5, 0.52, 0.55], [0.3, 0.38, 0.45], [0.55, 0.5, 0.2]][i % 3]);
  for (const [x, z, w, h, d, c] of [[26, 14, 2.4, 1.5, 2.4, [0.4, 0.46, 0.4]], [-38, 8, 1.8, 1.2, 1.8, [0.5, 0.4, 0.28]], [30, 44, 2.6, 1.6, 2.2, [0.36, 0.42, 0.5]]]) K.crate(x, z, w, h, d, c, x * 0.1);
  // freight board by the pilot, a "walk this way" arrow path from the pad to the hall
  pipe('steelDark', [-38, 0, 18], [-38, 3.2, 18], 0.07, 5); K.signs.add(-38, 3.3, 18.12, 4.2, 1.5, 0, 'mars', 'HUB FREIGHT: LANE · HOP · SKY', 'plate');
  for (let z = -26; z > -62; z -= 5) X('glowAmber', -8, 0.06, z, 0.5, 0.02, 1.4);

  // ---- the first footprints: Apollo 11, a kilometre and a half off, behind a rope ------------------------------------------------------------------
  {
    const ax = HUB.APOLLO.x, az = HUB.APOLLO.z, g = groundY(ax, az), lo = 1.0;
    k.push(ax, g, az, 0.4);
    // the descent stage: an octagon in gold foil, four legs with footpads, a ladder, the engine bell under it
    const gold = [0.82, 0.6, 0.2];
    cyl('metal', 0, 2.15, 0, 2.38, 1.9, 8, { col: gold, r2: 2.2 }); cyl('metal', 0, 3.2, 0, 2.0, 0.25, 8, { col: [0.7, 0.7, 0.72] });
    cyl('metal', 0, 1.0, 0, 0.7, 0.8, 10, { r2: 1.1, col: [0.3, 0.3, 0.3] });
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785, lx = Math.cos(a) * 4.0, lz = Math.sin(a) * 4.0; pipe('metal', [Math.cos(a) * 1.6, 2.0, Math.sin(a) * 1.6], [lx, 0.15, lz], 0.07, 5, { col: [0.7, 0.7, 0.7] }); pipe('metal', [Math.cos(a) * 1.9, 1.3, Math.sin(a) * 1.9], [lx, 0.4, lz], 0.05, 4, { col: [0.7, 0.7, 0.7] }); cyl('metal', lx, 0.1, lz, 0.45, 0.12, 10, { col: [0.65, 0.65, 0.65] }); }
    pipe('steel', [2.2, 0.2, 0.4], [2.4, 2.8, 0.3], 0.04, 4); pipe('steel', [2.0, 0.2, -0.2], [2.2, 2.8, -0.3], 0.04, 4); for (let y = 0.5; y < 2.8; y += 0.35) pipe('steel', [2.1, y, -0.25], [2.3, y, 0.35], 0.02, 3);
    X('red', 0, 3.2, 2.2, 1.8, 0.7, 0.05, [0.2, 0.2, 0.24]);
    k.pop();
    // the plaque, on a post at the ladder leg, lettered by the neutral style
    const lx = ax + 3.4, lz = az + 3.4;
    pipe('steelDark', [lx, g, lz], [lx, g + 1.4, lz], 0.05, 5);
    K.signs.add(lx, g + 1.45, lz, 1.5, 0.9, 0.4, 'mars', 'HERE MEN FROM THE PLANET EARTH FIRST SET FOOT UPON THE MOON, JULY 1969. WE CAME IN PEACE FOR ALL MANKIND.', 'plate');
    // the flag, held out on a rod as the first one was
    const fx = ax - 9.5, fz = az - 5; const fg = groundY(fx, fz); pipe('metal', [fx, fg, fz], [fx, fg + 2.4, fz], 0.025, 4, { col: [0.9, 0.9, 0.9] }); pipe('metal', [fx, fg + 2.3, fz], [fx + 1.5, fg + 2.3, fz], 0.015, 4, { col: [0.9, 0.9, 0.9] });
    // the rope: posts every 3 m on a circle, a hazard-yellow rope between them, a notice
    const posts = 16, rr = 15; let prev = null;
    for (let i = 0; i < posts; i++) { const a = i / posts * 6.2832, px = ax + Math.cos(a) * rr, pz = az + Math.sin(a) * rr, pg = groundY(px, pz); cyl('hazard', px, pg + 0.5, pz, 0.05, 1.0, 5, { col: [0.9, 0.85, 0.7] }); if (prev) pipe('hazard', [prev[0], prev[1] + 0.85, prev[2]], [px, pg + 0.85, pz], 0.012, 3); prev = [px, pg, pz]; }
    { const a = 0, px = ax + rr, pz = az, pg = groundY(px, pz); const f = [ax + Math.cos(0) * rr, groundY(ax + rr, az) + 0.85, az]; pipe('hazard', [prev[0], prev[1] + 0.85, prev[2]], f, 0.012, 3); }
    K.signs.add(ax + rr + 0.2, groundY(ax + rr, az) + 1.6, az, 3.6, 1.1, Math.PI / 2, 'mars', 'PROTECTED HERITAGE SITE. LOOK, DO NOT TOUCH.', 'warning');
    // the footprints: a line of dark ovals from the ladder out and back, and a patch beside the flag
    for (let i = 0; i < 46; i++) { const t = i / 46, px = ax + 3 - 11 * Math.cos(t * 5) + R() * 0.3, pz = az + 2 + 9 * Math.sin(t * 5 * 0.7) + R() * 0.3, pg = groundY(px, pz); k.push(px, pg + 0.01, pz, t * 3 + R() * 0.2); X('rubber', 0, 0, 0, 0.14, 0.012, 0.32, [0.25, 0.25, 0.25]); X('rubber', 0.3, 0, 0.1, 0.14, 0.012, 0.32, [0.25, 0.25, 0.25]); k.pop(); }
    // a stone-effect cairn of the camera's tripod and a small cross-hair marker: the Laser Ranging Retroreflector's grey box (it is still there, still working)
    const rx = ax + 8, rz = az - 9, rg = groundY(rx, rz); B('steel', rx, rg + 0.35, rz, 0.7, 0.55, 0.5, [0.7, 0.7, 0.72], 0.04); X('glassTint', rx, rg + 0.64, rz, 0.5, 0.02, 0.4);
    K.signs.add(rx, rg + 1.3, rz + 0.4, 1.8, 0.7, 0, 'mars', 'LASER REFLECTOR: STILL WORKING. STILL IN USE. DO NOT TAP.', 'plate');
  }

  // ---- the flag's cloth, the Eagle's glow of sunlight and the beacons that blink ------------------------------------------------------------------
  const out = K.finish({
    extra: (root) => {
      const THREEm = THREE, fx = HUB.APOLLO.x - 9.5 + 0.75, fz = HUB.APOLLO.z - 5, fy = groundY(HUB.APOLLO.x - 9.5, fz) + 1.85;
      const c = document.createElement('canvas'); c.width = 260; c.height = 170; const g = c.getContext('2d');
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f4f4' : '#b22234'; g.fillRect(0, i * 170 / 13, 260, 170 / 13 + 1); }
      g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 104, 91); g.fillStyle = '#fff'; for (let r = 0; r < 9; r++) for (let q = 0; q < (r % 2 ? 5 : 6); q++) { g.beginPath(); g.arc((r % 2 ? 26 : 17) + q * 17.4, 10 + r * 9.6, 2.3, 0, 6.28); g.fill(); }
      const tex = new THREEm.CanvasTexture(c); tex.colorSpace = THREEm.SRGBColorSpace;
      const flag = new THREEm.Mesh(new THREEm.PlaneGeometry(1.5, 0.98), new THREEm.MeshBasicMaterial({ map: tex, side: THREEm.DoubleSide, toneMapped: false })); flag.position.set(fx, fy, fz); flag.rotation.y = 0; flag.name = 'apollo-flag'; root.add(flag);
    },
  });
  // beacons: the mast's red lamp, the two floodlit booths' lamps blink out of step
  return out;
}

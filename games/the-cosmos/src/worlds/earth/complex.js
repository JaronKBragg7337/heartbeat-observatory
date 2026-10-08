// ============================================================================
// worlds/earth/complex.js - the SKYWARD LAUNCH COMPLEX, drawn: Skyward's arrival pad on Merritt Island, Cape Canaveral (bible v3 4.5: "the launch sites; clean,
// bright, optimistic and a little unhinged; tall, narrow and vertical, towers, gantries and tanks on wide flat pads; low white hangars with big sliding doors").
// A painted landing pad, Range Control with its countdown clock, a training hall, a flight-line hangar, the Vehicle Assembly Hall a long crawlerway away, the launch
// mount with its service tower, a lightning-mast ring and a vehicle ready on the mount, white spheres and a tank farm, windsocks and floodlights, and the Atlantic beyond.
// Layout numbers are layout.js's COMPLEX (the walls here are the walls the walker is stopped by). Drawn with the Moon's kit (a few materials, one mesh each).
// ============================================================================
import { makeKit, rng } from '../moon/kit.js';
import { COMPLEX } from './layout.js';
import { drawEmblem } from '../../factions/emblems.js';

const WHITE = [0.93, 0.94, 0.95], OFFWHITE = [0.86, 0.88, 0.9], ORANGE = [0.91, 0.35, 0.12], BLUE = [0.23, 0.63, 1.0], TRIM = [0.11, 0.15, 0.2], DARK = [0.14, 0.19, 0.24], STEEL = [0.62, 0.68, 0.74], SCORCH = [0.17, 0.16, 0.15];

export function buildComplex(ctx) {
  const K = makeKit(ctx), { k, B, X, cyl, pipe, groundY, low, THREE } = K;
  const R = rng(3901);
  const C = COMPLEX;

  // ---- the arrival pad: concrete, painted ----------------------------------------------------------------------------------------------------------
  K.pad(C.MAIN_PAD.w, (g, S) => {
    g.fillStyle = '#8a8a86'; g.fillRect(0, 0, S, S);
    const rr = rng(11); for (let i = 0; i < 22000; i++) { const v = 108 + Math.floor(rr() * 46); g.fillStyle = `rgba(${v},${v},${v - 3},0.3)`; g.fillRect(Math.floor(rr() * S), Math.floor(rr() * S), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 2)); }
    g.strokeStyle = '#4b4b48'; g.lineWidth = 3; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * S / 6, 0); g.lineTo(i * S / 6, S); g.moveTo(0, i * S / 6); g.lineTo(S, i * S / 6); g.stroke(); }
    // scorch fanned out from the middle, where the engines have been
    const gr = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.5); gr.addColorStop(0, 'rgba(18,16,14,0.55)'); gr.addColorStop(0.5, 'rgba(18,16,14,0.2)'); gr.addColorStop(1, 'rgba(18,16,14,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#f2f4f6'; g.lineWidth = 16; g.strokeRect(34, 34, S - 68, S - 68);
    g.strokeStyle = '#e8591e'; g.lineWidth = 12; g.beginPath(); g.arc(S / 2, S / 2, S * 0.33, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.95; drawEmblem(g, 'skyward', S * 0.5, S * 0.5, S * 0.32); g.globalAlpha = 1;
    g.fillStyle = '#f2f4f6'; g.textAlign = 'center'; g.font = 'bold 74px "Helvetica Neue", Arial, sans-serif'; g.fillText('SKYWARD LAUNCH COMPLEX', S / 2, S * 0.17);
    g.font = 'bold 54px "Helvetica Neue", Arial, sans-serif'; g.fillText('PAD 1 / T-MINUS EVERYTHING', S / 2, S * 0.23);
    g.fillStyle = '#e8591e'; g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif'; g.fillText('CAPE CANAVERAL, FLORIDA', S / 2, S * 0.9);
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27.5, 0.55, sz * 27.5, 0.17, 1.1, 8); X('glowAmber', sx * 27.5, 1.15, sz * 27.5, 0.34, 0.12, 0.34); }
  // aprons, taxi strips and the orange kerb round the pad
  for (const [x, z, w, d] of [[0, -50, 60, 20], [0, 48, 40, 14], [-60, 0, 40, 12], [60, 0, 40, 12]]) X('concrete', x, -0.02, z, w, 0.2, d, [0.76, 0.76, 0.74]);
  for (let i = -26; i <= 26; i += 4) for (const z of [-30.6, 30.6]) { if (Math.abs(i) < 5) continue; B('concrete', i, 0.18, z, 3.4, 0.36, 0.5, [0.9, 0.42, 0.18], 0.04); }

  // ---- Range Control: the long low building, ribbon windows, the countdown clock -------------------------------------------------------------------------
  {
    const O = C.OPS, cx = (O.x0 + O.x1) / 2, cz = (O.z0 + O.z1) / 2;
    K.block(O.x0, O.z0, O.x1, O.z1, O.h, { col: WHITE, door: O.door, win: 'glass', winY: 5.2, roof: [0.78, 0.8, 0.84], ribs: true });
    X('red', cx, O.h * 0.35, O.z1 + 0.05, O.x1 - O.x0, 0.7, 0.03, ORANGE);                                  // the orange stripe along the face
    B('steelDark', cx, O.h - 0.6, O.z1 + 2.2, 24, 0.3, 4.4, TRIM, 0.05);                                      // canopy over the door
    for (const sx of [-1, 1]) pipe('steelDark', [cx + sx * 11.4, 0, O.z1 + 3.9], [cx + sx * 11.4, O.h - 0.6, O.z1 + 3.9], 0.12, 6);
    X('glowBlue', cx, O.h - 0.85, O.z1 + 4.3, 22, 0.06, 0.06);
    // the observation deck on the roof and the range clock on its pole
    B('concrete', cx - 18, O.h + 2.6, cz, 22, 0.3, 11, [0.82, 0.83, 0.84], 0.05); X('glassTint', cx - 18, O.h + 4.0, O.z1 - 0.5, 22, 2.4, 0.06); for (const sx of [-1, 1]) for (const sz of [-1, 1]) pipe('steelDark', [cx - 18 + sx * 10.5, O.h, cz + sz * 5], [cx - 18 + sx * 10.5, O.h + 2.6, cz + sz * 5], 0.1, 5);
    pipe('steelDark', [cx + 22, 0, O.z1 + 6], [cx + 22, 9, O.z1 + 6], 0.18, 6); B('steelDark', cx + 22, 10.4, O.z1 + 6, 6.4, 3.0, 0.5, TRIM, 0.05); K.signs.add(cx + 22, 10.4, O.z1 + 6.3, 5.8, 2.4, 0, 'skyward', 'T-MINUS 00:00:10', 'plate');
    for (let x = O.x0 + 4; x < O.x1 - 3; x += 8) { B('steelDark', x, O.h + 0.8, cz + 3, 1.4, 0.8, 1.4, null, 0.05); }
    pipe('steelDark', [O.x1 - 4, O.h, O.z0 + 6], [O.x1 - 4, O.h + 16, O.z0 + 6], 0.09, 5); X('glowRed', O.x1 - 4, O.h + 16.2, O.z0 + 6, 0.3, 0.3, 0.3);
    K.signs.add(cx, O.h - 1.7, O.z1 + 0.12, 22, 2.0, 0, 'skyward', 'RANGE CONTROL', 'plate');
    K.signs.add(cx + 9, 3.7, O.z1 + 0.14, 5, 0.9, 0, 'skyward', 'ARRIVALS / PAD 1', 'banner');
    K.signs.add(cx - 9, 3.7, O.z1 + 0.14, 5, 0.9, 0, 'skyward', 'HELMETS ON. EGOS OFF.', 'warning');
    X('floor', cx, 0.05, cz, O.x1 - O.x0 - 1.2, 0.02, O.z1 - O.z0 - 1.2, [0.8, 0.82, 0.85]);
    for (let x = O.x0 + 6; x < O.x1 - 5; x += 6) { B('counter', x, 0.5, O.z0 + 8, 4, 1.0, 1.2, [0.85, 0.87, 0.9], 0.04); X('glowCyan', x, 1.3, O.z0 + 8.65, 3.2, 0.7, 0.05); }
  }
  // ---- the training hall: glass facing the mount, so recruits watch the launches --------------------------------------------------------------------------
  {
    const T = C.TRAINING, cz = (T.z0 + T.z1) / 2;
    K.block(T.x0, T.z0, T.x1, T.z1, T.h, { col: OFFWHITE, door: T.door, win: 'glass', winY: 4.2, roof: [0.8, 0.82, 0.86] });
    X('glassTint', T.x1 + 0.06, 4.2, cz, 0.05, 5.4, T.z1 - T.z0 - 5); X('red', (T.x0 + T.x1) / 2, 1.0, T.z1 + 0.05, T.x1 - T.x0, 0.5, 0.03, BLUE);
    K.signs.add(T.x0 - 0.1, T.h - 1.2, cz, 14, 1.3, -Math.PI / 2, 'skyward', 'TRAINING HALL B', 'plate');
    K.signs.add(T.x0 - 0.12, 2.8, cz + 8, 6, 1.0, -Math.PI / 2, 'skyward', 'WE STOPPED SAYING "IF".', 'banner');
    X('floor', (T.x0 + T.x1) / 2, 0.05, cz, T.x1 - T.x0 - 1.2, 0.02, T.z1 - T.z0 - 1.2, [0.82, 0.84, 0.88]);
    for (let i = 0; i < 6; i++) B('fabricGrey', T.x0 + 8 + (i % 3) * 7, 0.3, cz - 5 + Math.floor(i / 3) * 10, 4, 0.6, 1.2, [0.35, 0.45, 0.58], 0.05);
  }
  // ---- the flight-line hangar: low and white, a big sliding door --------------------------------------------------------------------------------------------
  {
    const H = C.HANGAR, cz = (H.z0 + H.z1) / 2;
    K.block(H.x0, H.z0, H.x1, H.z1, H.h, { col: WHITE, door: H.door, win: 'slit', lit: 'glowWhite', roof: [0.8, 0.82, 0.85] });
    for (const dz of [-1, 1]) B('steelDark', H.x1 + 0.1, 5, cz + dz * 12.5, 0.4, 10, 11, [0.82, 0.84, 0.88], 0.04);       // the door's two leaves, slid back either side
    X('red', H.x1 + 0.02, 11.8, cz, 0.04, 0.8, H.z1 - H.z0 - 1, ORANGE);
    K.signs.add(H.x1 + 0.08, H.h - 1.0, cz, 26, 1.7, Math.PI / 2, 'skyward', 'FLIGHT LINE · HANGAR 1', 'plate');
    X('floor', (H.x0 + H.x1) / 2, 0.05, cz, H.x1 - H.x0 - 1.2, 0.02, H.z1 - H.z0 - 1.2, [0.8, 0.82, 0.85]);
  }

  // ---- the Vehicle Assembly Hall ------------------------------------------------------------------------------------------------------------------------------
  {
    const V = C.VAB, cx = (V.x0 + V.x1) / 2, cz = (V.z0 + V.z1) / 2, w = V.x1 - V.x0, d = V.z1 - V.z0;
    K.plinth(V.x0 - 1, V.z0 - 1, V.x1 + 1, V.z1 + 1);
    B('panel', cx, V.h / 2, cz, w, V.h, d, WHITE, 0.2);
    B('concrete', cx, V.h + 0.4, cz, w + 1.2, 0.8, d + 1.2, [0.78, 0.8, 0.83], 0.1);
    // the doors: four tall dark slots up the front (east) face, the big stripe and the rising chevrons
    for (let i = 0; i < 4; i++) X('steelDark', V.x1 + 0.06, 22, V.z0 + 9 + i * 15.5, 0.12, 44, 8.6, DARK);
    for (let y = 8; y < 56; y += 9) X('steelDark', V.x1 + 0.07, y, cz, 0.06, 0.25, d - 2, [0.7, 0.72, 0.76]);
    X('red', V.x1 + 0.05, V.h - 6, cz, 0.1, 3.2, d, ORANGE);
    for (const o of [0, 1]) {                                                           // two stacked chevrons pointing up, Skyward's mark, 14 m wide
      const y0 = 26 + o * 7.5, zc = cz - 7, xx = V.x1 + 0.12, arm = (za, ya, zb, yb) => { const q = [[xx, ya, za], [xx, yb, zb], [xx, yb + 2.7, zb], [xx, ya + 2.7, za]]; k.poly('red', q, null, ORANGE); k.poly('red', q.slice().reverse(), null, ORANGE); };
      arm(zc, y0, zc + 7, y0 + 6); arm(zc + 14, y0, zc + 7, y0 + 6);
    }
    K.signs.add(V.x1 + 0.2, V.h - 12, cz, 46, 7.2, Math.PI / 2, 'skyward', 'SKYWARD', 'plate');
    K.signs.add(V.x1 + 0.2, V.h - 19.5, cz, 36, 2.4, Math.PI / 2, 'skyward', 'VEHICLE ASSEMBLY HALL', 'plate');
    K.signs.add(V.x1 + 0.2, 4.2, cz, 20, 1.8, Math.PI / 2, 'skyward', 'UP IS A DIRECTION. IT IS ALSO A CAREER.', 'banner');
    for (let i = 0; i < 4; i++) X('glowRed', V.x0 + 6 + i * 22, V.h + 1.2, V.z1 - 3, 0.5, 0.5, 0.5);
    pipe('steelDark', [V.x1 - 8, V.h, V.z0 + 6], [V.x1 - 8, V.h + 14, V.z0 + 6], 0.12, 5); X('glowRed', V.x1 - 8, V.h + 14.3, V.z0 + 6, 0.35, 0.35, 0.35);
  }

  // ---- the crawlerway: a wide gravel road from the Hall to the mount ---------------------------------------------------------------------------------------
  {
    const road = (x0, z0, x1, z1, wd, col) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 9), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) { const a = (i + 0.5) / n, mx = x0 + (x1 - x0) * a, mz = z0 + (z1 - z0) * a, g = groundY(mx, mz); k.push(mx, g - 0.28, mz, yaw); B('concrete', 0, 0, 0, L / n + 0.4, 0.6, wd, col, 0.05); k.pop(); }
    };
    road(-124, -176, 112, -168, 20, [0.58, 0.55, 0.5]);                                  // the crawlerway
    road(0, -34, 0, -74, 8, [0.4, 0.4, 0.4]);                                            // pad to Range Control
    road(34, 0, 108, -40, 7, [0.4, 0.4, 0.4]);
    road(-34, 6, -70, 30, 8, [0.4, 0.4, 0.4]);                                           // pad to the hangar door
    for (let x = -118; x < 106; x += 8) { const z = -176 + (x + 124) / 236 * 8, g = groundY(x, z - 10.4); X('rubber', x, g + 0.1, z - 10.4, 3, 0.04, 0.3, [0.85, 0.85, 0.8]); }
  }

  // ---- the launch mount, the service tower, the vehicle on the mount ------------------------------------------------------------------------------------------
  {
    const M = C.MOUNT, TW = C.TOWER, cx = M.cx, cz = M.cz, g = groundY(cx, cz);
    K.plinth(cx - M.w / 2, cz - M.d / 2, cx + M.w / 2, cz + M.d / 2);
    B('concrete', cx, M.h / 2, cz, M.w, M.h, M.d, [0.55, 0.55, 0.53], 0.2);               // the mount: a block of concrete the flame trench is cut through
    B('concrete', cx, M.h + 0.3, cz, M.w - 2, 0.6, M.d - 2, [0.5, 0.5, 0.48], 0.1);
    X('rubber', cx + M.w / 2 + 0.06, 3.4, cz, 0.1, 6.4, 14, SCORCH);                       // the mouth of the flame trench, east face
    for (let i = 0; i < 5; i++) X('rubber', cx + M.w / 2 + 0.05, 0.04, cz + (i - 2) * 0.01, 0.1, 0.1, 0.1, SCORCH);
    X('rubber', cx + M.w / 2 + 14, groundY(cx + M.w / 2 + 14, cz) + 0.03, cz, 24, 0.05, 20, SCORCH);       // the scorch on the ground in front of it
    for (let i = 0; i < 8; i++) X('rubber', cx + M.w / 2 + 6 + i * 4.5, groundY(cx + M.w / 2 + 6 + i * 4.5, cz + (R() - 0.5) * 8) + 0.03, cz + (R() - 0.5) * 12, 3 + R() * 4, 0.05, 2 + R() * 4, [0.13, 0.13, 0.12]);
    // hold-down stand and the vehicle: first stage, black interstage, second stage, fairing, nose; four grid fins at the base
    const y0 = M.h + 0.6;
    B('steelDark', cx, y0 + 1.5, cz, 9, 3.0, 9, TRIM, 0.1);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) pipe('steelDark', [cx + dx * 0.8, y0 + 1.5, cz + dz * 0.8], [cx + dx * 0.4, y0 + 6, cz + dz * 0.4], 0.2, 5);
    const rc = 3.2, s1 = 36, s2 = 15, fair = 7, nose = 11, base = y0 + 3.0;
    cyl('metal', cx, base + 1.0, cz, 3.7, 2.0, 18, { col: [0.2, 0.2, 0.22], r2: 3.0 });                       // the engine skirt
    cyl('metal', cx, base + 2.0 + s1 / 2, cz, rc, s1, 20, { col: WHITE });                                         // first stage
    cyl('hazard', cx, base + 2.0 + s1 * 0.32, cz, rc + 0.03, 3.5, 20, { col: ORANGE });
    cyl('hazard', cx, base + 2.0 + s1 * 0.8, cz, rc + 0.03, 1.4, 20, { col: TRIM });
    X('glowBlue', cx - rc - 0.04, base + 2.0 + s1 * 0.55, cz, 0.04, s1 * 0.5, 0.35);
    cyl('metal', cx, base + 2.0 + s1 + 1.2, cz, rc, 2.4, 20, { col: [0.12, 0.13, 0.15] });                         // interstage
    cyl('metal', cx, base + 2.0 + s1 + 2.4 + s2 / 2, cz, rc * 0.92, s2, 20, { col: WHITE });                      // second stage
    cyl('metal', cx, base + 2.0 + s1 + 2.4 + s2 + fair / 2, cz, rc * 0.92, fair, 20, { col: OFFWHITE });           // payload fairing
    cyl('metal', cx, base + 2.0 + s1 + 2.4 + s2 + fair + nose / 2, cz, rc * 0.92, nose, 20, { col: OFFWHITE, r2: 0.35 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.push(cx + Math.cos(a) * rc, base + 2.6, cz + Math.sin(a) * rc, -a); B('steelDark', 1.0, 0, 0, 2.2, 3.4, 0.25, [0.22, 0.22, 0.25], 0.03); k.pop(); }
    // vapour: a pale venting cloud at the base of the stage (cold fuel boil-off)
    // the service tower: four corner legs, floors every 12 m with cross braces, swing arms toward the vehicle, a lightning rod and a red beacon
    const tx = TW.cx, tz = TW.cz, hw = TW.w / 2 - 0.4, H = TW.h;
    K.plinth(tx - TW.w / 2, tz - TW.w / 2, tx + TW.w / 2, tz + TW.w / 2);
    const legs = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    for (const [lx, lz] of legs) pipe('steel', [tx + lx, g, tz + lz], [tx + lx, H, tz + lz], 0.42, 6, { col: STEEL });
    const lv = Math.round(H / 12);
    for (let j = 0; j <= lv; j++) {
      const y = g + j * (H - g) / lv;
      for (let i = 0; i < 4; i++) { const a = legs[i], b = legs[(i + 1) % 4]; pipe('steel', [tx + a[0], y, tz + a[1]], [tx + b[0], y, tz + b[1]], 0.16, 4, { col: STEEL }); }
      if (j < lv) { const y2 = y + (H - g) / lv; for (let i = 0; i < 4; i++) { const a = legs[i], b = legs[(i + 1) % 4]; pipe('steel', [tx + a[0], y, tz + a[1]], [tx + b[0], y2, tz + b[1]], 0.1, 4, { col: STEEL }); } }
      if (j > 0 && j % 2 === 0) B('paint', tx, y, tz, TW.w - 0.2, 0.25, TW.w - 0.2, ORANGE, 0.03);
    }
    for (const yy of [32, 50, 66]) { B('paint', tx + 9, yy, tz, 18, 1.2, 1.4, ORANGE, 0.06); B('steelDark', tx + 17.4, yy, tz, 2.4, 1.6, 2.4, TRIM, 0.05); }       // swing arms, reaching the vehicle's side
    pipe('steel', [tx, H, tz], [tx, H + 12, tz], 0.1, 4, { col: STEEL }); X('glowRed', tx, H + 12.3, tz, 0.4, 0.4, 0.4);
    B('paint', tx, g + 3, tz + TW.w / 2 + 3, 4, 6, 4, WHITE, 0.08);                         // the tower's base cabin
    // umbilical lines and the cold-fuel pipes along the crawlerway edge to the spheres
    pipe('pipeBlue', [tx - 6, 1.4, tz + 7], [tx - 6, 1.4, tz + 30], 0.3, 6); pipe('pipeBlue', [tx - 6, 1.4, tz + 30], [172, 1.6, -100], 0.3, 6);
    pipe('steel', [tx + 3, 1.0, tz + 7], [tx + 3, 1.0, tz + 20], 0.2, 5); pipe('steel', [tx + 3, 1.0, tz + 20], [190, 1.0, -62], 0.2, 5);
    K.signs.add(cx, M.h - 3.2, cz + M.d / 2 + 0.2, 16, 2.4, 0, 'skyward', 'PAD 1', 'plate');
    K.signs.add(cx - 8, 2.4, cz + M.d / 2 + 0.15, 11, 1.4, 0, 'skyward', 'KEEP OUT: PAD 1 LIVE', 'warning');
  }
  // the lightning masts and the floodlights
  for (const [x, z] of C.MASTS) K.mast(x, z, 100, [0.7, 0.74, 0.78], 1.4);
  for (const [x, z] of [[-44, 30], [44, 30], [-44, -30], [44, -30]]) { const g = groundY(x, z); cyl('steelDark', x, g + 7, z, 0.26, 14, 8, { r2: 0.18 }); B('steelDark', x, g + 14, z, 3.2, 0.5, 1.0, TRIM, 0.04); X('glowWhite', x, g + 13.6, z, 2.8, 0.18, 0.7); }
  K.bollards([[-20, 36], [-10, 36], [0, 36], [10, 36], [20, 36]], 1.0, ORANGE);

  // ---- the spheres and the tank farm ---------------------------------------------------------------------------------------------------------------------------------
  for (const [x, z, r] of C.SPHERES) {
    K.plinth(x - r, z - r, x + r, z + r, [0.7, 0.7, 0.68]);
    k.dome('white', x, r + 0.6, z, r, low ? 14 : 22, low ? 8 : 14, { col: [0.95, 0.96, 0.97] });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; pipe('steel', [x + Math.cos(a) * r * 0.55, 0, z + Math.sin(a) * r * 0.55], [x + Math.cos(a) * r * 0.82, r * 0.6, z + Math.sin(a) * r * 0.82], 0.28, 5, { col: STEEL }); }
    cyl('hazard', x, r + 0.6, z, r * 1.003, 0.6, 22, { col: ORANGE });
    cyl('steelDark', x, r * 2 + 0.7, z, 0.6, 1.2, 8);
  }
  for (const [x, z, r, h] of C.TANKS) K.tank(x, z, r, h, [0.93, 0.94, 0.95], { band: 'hazard' });
  K.signs.add(168, 8, -81.8, 8, 1.4, 0, 'skyward', 'LH2 · DO NOT LICK', 'warning');

  // ---- windsocks, a flag, cones, barrels and crates ----------------------------------------------------------------------------------------------------------------
  const socks = [];
  for (const [x, z] of [[36, 36], [-70, 68]]) {
    const g = groundY(x, z); cyl('steelDark', x, g + 4, z, 0.12, 8, 6, { r2: 0.08 });
    const grp = new THREE.Group(); grp.position.set(x, g + 8, z); K.root.add(grp);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 3.2, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8591e, side: THREE.DoubleSide, roughness: 0.8 }));
    cone.rotation.z = Math.PI / 2; cone.position.x = 1.7; grp.add(cone);
    for (const o of [-0.7, 0.5]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47 - o * 0.13, 0.43 - o * 0.13, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide, roughness: 0.8 })); band.rotation.z = Math.PI / 2; band.position.x = 1.7 + o; grp.add(band); }
    socks.push(grp);
  }
  for (let i = 0; i < 10; i++) { const x = -34 + i * 3, z = 36; cyl('hazard', x, groundY(x, z) + 0.3, z, 0.18, 0.6, 8, { r2: 0.07, col: ORANGE }); }
  for (let i = 0; i < 6; i++) K.barrel(-60 + (i % 3) * 0.8, 40 + Math.floor(i / 3) * 0.8, [[0.9, 0.9, 0.9], [0.9, 0.4, 0.15], [0.3, 0.38, 0.5]][i % 3]);
  for (const [x, z, w, h, d, c] of [[-46, 16, 2.4, 1.5, 2.4, [0.5, 0.55, 0.6]], [48, 14, 2.6, 1.6, 2.2, [0.88, 0.88, 0.9]], [-76, -26, 3, 2, 2.4, [0.91, 0.4, 0.14]]]) K.crate(x, z, w, h, d, c, x * 0.1);
  { const fx = 44, fz = 44, g = groundY(fx, fz); pipe('metal', [fx, g, fz], [fx, g + 10, fz], 0.09, 5, { col: [0.9, 0.9, 0.9] }); X('red', fx + 1.5, g + 9, fz, 3, 1.9, 0.04, ORANGE); X('white', fx + 1.5, g + 9, fz + 0.03, 2.4, 0.5, 0.02); X('glowBlue', fx + 1.5, g + 9.6, fz + 0.03, 2.4, 0.3, 0.02); }

  const out = K.finish({});
  const tick = out.tick;
  out.tick = (dt, t) => { tick(dt, t); for (let i = 0; i < socks.length; i++) { socks[i].rotation.y = 0.9 + Math.sin(t * 0.3 + i) * 0.12; socks[i].children[0].rotation.x = Math.sin(t * 2.2 + i) * 0.03; } };
  return out;
}

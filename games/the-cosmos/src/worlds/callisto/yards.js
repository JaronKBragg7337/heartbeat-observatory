// ============================================================================
// worlds/callisto/yards.js - CALLISTO'S TWO SIDES AT WORK (decoration only; the machinery is worlds/_kit/sideYard.js).
//
//   MYSTARA       the Relay Stand, on the open ice east of the Valhalla Camp, behind the quartermaster's shed: a violet courier comes in
//                 from the east with spares for the relays the storms took, and the row of coil drums by the measuring house grows; the
//                 line crews carry them out before the next one is due. A mast half put together on trestles, standing stones at the corners.
//   THE UNBOUND   the freight pad at the Prospectors' Camp, 1.2 km north (the world's second port, its own level ground): salvaged deck plates
//                 on a scraped pad, core boxes stacked by a tarp awning, and a courier in red primer that lands to carry the cores away.
//   BOTH          a lit board at each that names the two sides of Callisto and says how they stand.
//
// The two places are 1.2 km apart, so they are two yards on ONE rota (`turns: 2`): Mystara's ship has the even slots, the Unbound's the odd,
// and one ship is alive at a time across both.
// REAL AND NOT. Real: Callisto's pull (1.236 m/s2: a long gentle braking burn, a slow lift-off) and that it has no air to speak of (the ships
// are heard only through the ground). Game fiction: both sides, their ships and yards.
// Both grounds were looked at from above before a thing was placed. Nothing here is solid.
// ============================================================================
import { SideYard } from '../_kit/sideYard.js';
import { YARD_TT } from '../yardBook.js';

const PI = Math.PI;
const BK_M = YARD_TT['callisto-mystara'], BK_U = YARD_TT['callisto-unbound'];       // the stands, the flights and the stock numbers: one book for the picture and for the server's count (worlds/yardBook.js)
const BOARD = { title: 'CALLISTO · THE TWO SIDES', sides: ['mystara', 'unbound'], roles: { mystara: 'the Archive · the array · the listening', unbound: 'drills · claims · the open seat' } };

// ---- the Valhalla Camp: Mystara --------------------------------------------------------------------------------------------------------------
const VIOLET = [0.17, 0.15, 0.26], BASALT = [0.22, 0.2, 0.31], GOLD = [0.85, 0.76, 0.48], PARCH = [0.94, 0.9, 0.78], GLV = [0.62, 0.45, 1.0];
const M = BK_M.sides[0].spot;
const drum = (h, x, y, z) => { h.cyl('paint', x, y + 0.55, z, 0.5, 1.1, 12, { col: VIOLET }); h.cyl('paint', x, y + 0.8, z, 0.515, 0.12, 12, { col: GOLD }); h.cyl('paint', x, y + 0.3, z, 0.515, 0.06, 12, { col: GOLD }); h.X('paint', x, y + 1.11, z, 0.4, 0.02, 0.26, PARCH); };
const MYSTARA = {
  name: 'callisto-mystara', homeId: 'callisto', ...BK_M,
  sides: [{ ...BK_M.sides[0],
    hold: (k, b) => { for (const sx of [-1, 1]) for (const dz of [1.2, 2.6]) k.cyl('paint', b.x + sx * b.w * 0.24, b.y0 + 0.55, b.z0 + dz, 0.5, 1.1, 10, { col: VIOLET }); },
    // nine drums: five in a row and four on top of them. The courier's stay builds the row, the line crews take it down.
    stock: { ...BK_M.sides[0].stock, build: (j, h) => (j < 5 ? drum(h, M.x - 6 + j * 1.25, 0.26, M.z + 22) : drum(h, M.x - 5.38 + (j - 5) * 1.25, 1.38, M.z + 22)) } }],
  hands: [
    { side: 'mystara', id: 'coil-hand', push: { a: [M.x - 7, M.z + 25], b: [M.x + 5, M.z + 25], speed: 0.7, gap: 1.2, side: 1.0, rest: [12, 11] },
      cart: (h) => { h.B('paint', 0, 0.3, 0, 1.0, 0.1, 1.5, VIOLET, 0.02); for (const sx of [-0.42, 0.42]) for (const sz of [-0.5, 0.5]) h.cyl('rubber', sx, 0.13, sz, 0.13, 0.08, 8, { axis: 'x' });
        h.pipe('steelDark', [0, 0.35, -0.75], [0, 1.1, -0.92], 0.03, 5); h.pipe('steelDark', [-0.3, 1.1, -0.92], [0.3, 1.1, -0.92], 0.03, 5); drum(h, 0, 0.35, 0.1); } },
    { side: 'mystara', id: 'stand-keeper', beat: { pts: [[M.x - 10.4, M.z - 12], [M.x - 10.4, M.z + 12]], rest: [14, 9] } },
    { side: 'mystara', id: 'measurer', beat: { pts: [[M.x - 7, M.z + 19.6], [M.x + 2, M.z + 19.6]], rest: [16, 10] } },
    { side: 'mystara', id: 'line-walker', full: true, beat: { pts: [[M.x + 10.6, M.z - 12], [M.x + 10.6, M.z + 12]], rest: [8, 8] } },
  ],
  board: { ...BOARD, x: 60, z: 11, yaw: -PI / 2, none: 'Neither the Director nor the prospectors have posted a standing today.' },
  build(h) {
    const { B, X, cyl, pipe, dome, pool, lampPost, sign } = h, glyph = h.has('glyphViolet') ? 'glyphViolet' : 'glowBlue';
    // the stand: polished violet basalt, an old-gold inlay round it, a lit glyph line down the middle
    h.slab(M.x - 8, M.z - 16, M.x + 8, M.z + 18, BASALT, 0.06);
    for (const s of [-1, 1]) { X('paint', M.x + s * 7.7, 0.075, M.z + 1, 0.18, 0.02, 33.6, GOLD); X('paint', M.x, 0.075, M.z + 1 + s * 16.8, 15.6, 0.02, 0.18, GOLD); }
    X(glyph, M.x, 0.078, M.z, 0.12, 0.02, 9); X(glyph, M.x, 0.078, M.z, 5, 0.02, 0.12);
    for (const s of [-1, 1]) X('paint', M.x + s * 2.6, 0.076, M.z, 0.1, 0.02, 9, GOLD);
    // a standing stone at each corner, a lit slot in its face (Mystara marks ground with instruments, not paint)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = M.x + sx * 9, z = M.z + 1 + sz * 17.8; B('paint', x, 0.9, z, 0.7, 1.8, 0.5, VIOLET, 0.1); X(glyph, x, 1.2, z - sz * 0.26, 0.1, 0.7, 0.02); pool(x, z, 3.2, GLV); }
    // the plinth the drums stand on; the measuring house east of it (basalt walls, a gold lintel, shelves of sealed records, open to the stand)
    B('paint', M.x - 3.5, 0.13, M.z + 22, 7.4, 0.26, 1.8, BASALT, 0.05); X('paint', M.x - 3.5, 0.2, M.z + 21.08, 7.2, 0.04, 0.02, GOLD); pool(M.x - 3.5, M.z + 22, 6, GLV);
    {
      const x0 = M.x + 7, x1 = M.x + 17, z0 = M.z + 20, z1 = M.z + 28;
      B('paint', (x0 + x1) / 2, 1.9, z1 - 0.25, x1 - x0, 3.8, 0.5, VIOLET, 0.06); for (const x of [x0 + 0.25, x1 - 0.25]) B('paint', x, 1.9, (z0 + z1) / 2 + 1, 0.5, 3.8, z1 - z0 - 2, VIOLET, 0.06);
      B('paint', (x0 + x1) / 2, 3.95, (z0 + z1) / 2, x1 - x0 + 0.8, 0.3, z1 - z0 + 0.6, BASALT, 0.06); X('paint', (x0 + x1) / 2, 3.72, z0 - 0.32, x1 - x0 + 0.8, 0.14, 0.04, GOLD);
      for (const x of [x0 + 0.3, x1 - 0.3]) B('paint', x, 1.9, z0 + 0.3, 0.4, 3.8, 0.4, VIOLET, 0.06);
      X(glyph, (x0 + x1) / 2, 3.74, (z0 + z1) / 2, 5, 0.04, 0.2); pool((x0 + x1) / 2, z0 + 2, 6, GLV);
      for (let i = 0; i < 3; i++) { const x = x0 + 2 + i * 3; B('steelDark', x, 1.0, z1 - 1.2, 2.4, 0.08, 1.2, null, 0.02); for (const dx of [-0.7, 0, 0.7]) B('paint', x + dx, 1.32, z1 - 1.2, 0.5, 0.56, 0.8, PARCH, 0.03); drum(h, x, 0, z1 - 1.25); }
      sign('mystara', 'plate', 'RELAY SPARES · MEASURED IN', (x0 + x1) / 2, 4.6, z0 - 0.3, 6.4, 0.9, PI, { wall: true });
    }
    // a relay mast half put together: three lengths on trestles, the dish on the ice beside them, a coil of cable
    {
      const x = M.x - 15, z = M.z + 22;
      for (const dx of [-3, 3]) { pipe('steelDark', [x + dx, 0, z - 0.8], [x + dx, 1.0, z], 0.05, 5); pipe('steelDark', [x + dx, 0, z + 0.8], [x + dx, 1.0, z], 0.05, 5); }
      pipe('steel', [x - 4.4, 1.1, z], [x + 4.4, 1.1, z], 0.16, 8); pipe('steel', [x - 3.8, 0.14, z + 1.6], [x + 3.8, 0.14, z + 1.6], 0.13, 8); pipe('steel', [x - 3.2, 0.12, z + 2.2], [x + 3.2, 0.12, z + 2.2], 0.11, 8);
      dome('white', x - 1, 0.05, z - 3.2, 1.5, { col: [0.8, 0.8, 0.84] }); cyl('paint', x + 2.6, 0.2, z - 3, 0.7, 0.4, 12, { col: VIOLET }); cyl('rubber', x + 2.6, 0.42, z - 3, 0.5, 0.06, 12);
    }
    lampPost(M.x - 10.4, M.z - 15, 5, 'glowCool', GLV, 9); lampPost(M.x + 6, M.z + 19.4, 5, 'glowCool', GLV, 9); lampPost(M.x - 19, M.z + 18, 5, 'glowCool', GLV, 9);
    sign('mystara', 'plate', 'RELAY STAND · SPARES IN', M.x - 9.6, 2.4, M.z - 4, 5.4, 0.9, -PI / 2);
    sign('mystara', 'warning', h.style('mystara').signs.slogans[4], M.x - 9.6, 1.6, M.z + 8, 3.6, 0.7, -PI / 2);
  },
};

// ---- the Prospectors' Camp: the Unbound (port-local metres: x east, z south, origin the port's graded centre) ----------------------------------
const PRIMER = [0.48, 0.29, 0.22], ALU = [0.66, 0.67, 0.65], HORANGE = [1.0, 0.42, 0.18], TARP = [0.55, 0.58, 0.59], WELD = [0.25, 0.22, 0.2], SCRAPE = [0.4, 0.38, 0.36], AMB = [1.0, 0.72, 0.4];
const U = BK_U.sides[0].spot;
const coreBox = (h, x, y, z, i = 0) => { h.B('paint', x, y + 0.26, z, 1.8, 0.5, 0.62, i % 4 === 3 ? ALU : PRIMER, 0.03); h.X('paint', x - 0.5, y + 0.26, z - 0.315, 0.16, 0.5, 0.01, HORANGE); h.X('paint', x + 0.6, y + 0.3, z - 0.315, 0.22, 0.12, 0.01, WELD); };
const UNBOUND = {
  name: 'callisto-unbound', homeId: 'callisto', ...BK_U,
  sides: [{ ...BK_U.sides[0],
    hold: (k, b) => { for (const sx of [-1, 1]) for (const dy of [0, 0.56]) k.box('paint', b.x + sx * b.w * 0.24, b.y0 + 0.28 + dy, b.z0 + 1.8, b.w * 0.36, 0.5, 1.8, { col: PRIMER }); },
    // ten core boxes, three to a course: the drills fill the stack, the courier's stay carries it away
    stock: { ...BK_U.sides[0].stock, build: (j, h) => coreBox(h, U.x - 6 + (j % 3) * 2.0, 0.14 + Math.floor(j / 3) * 0.54, U.z + 22, j) } }],
  hands: [
    { side: 'unbound', id: 'core-hand', push: { a: [U.x - 3, U.z + 19.4], b: [U.x - 13, U.z + 19.4], speed: 0.7, gap: 1.2, side: 1.0, rest: [13, 10] },
      cart: (h) => { h.B('metal', 0, 0.28, 0, 0.9, 0.08, 2.0, ALU, 0.02); for (const sx of [-0.4, 0.4]) h.cyl('rubber', sx, 0.16, 0.5, 0.16, 0.1, 8, { axis: 'x' });
        h.pipe('steelDark', [-0.35, 0.3, -0.95], [-0.35, 1.1, -1.1], 0.03, 5); h.pipe('steelDark', [0.35, 0.3, -0.95], [0.35, 1.1, -1.1], 0.03, 5); h.pipe('steelDark', [-0.35, 1.1, -1.1], [0.35, 1.1, -1.1], 0.03, 5);
        h.k.push(0, 0.32, 0, PI / 2); coreBox(h, 0, 0, 0, 0); h.k.pop(); } },
    { side: 'unbound', id: 'pad-hand', beat: { pts: [[U.x - 8.8, U.z - 3], [U.x - 8.8, U.z + 15]], rest: [12, 12] } },
    { side: 'unbound', id: 'bench-hand', beat: { pts: [[U.x - 17, U.z + 25.6], [U.x - 11, U.z + 25.6]], rest: [18, 8] } },
  ],
  board: { ...BOARD, x: 16, z: 25, yaw: PI, none: 'Nobody has posted a standing today. Nobody was asked to.' },
  build(h) {
    const { B, X, cyl, pipe, pool, sign, k } = h;
    // the pad: scraped ice-gravel, and on it salvaged deck plates that do not match, an orange cross brushed on by hand
    h.slab(U.x - 7.5, U.z - 16, U.x + 7.5, U.z + 18, SCRAPE, 0.04);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { const col = [[0.52, 0.53, 0.52], [0.46, 0.47, 0.47], [0.4, 0.33, 0.3], [0.56, 0.57, 0.56], [0.36, 0.35, 0.34], [0.49, 0.5, 0.49]][(r * 2 + c * 3 + (r === 2 ? 1 : 0)) % 6]; B('metal', U.x - 4.7 + c * 4.7, 0.07, U.z - 13.2 + r * 5.5, 4.5 - (r % 2) * 0.2, 0.06, 5.3 - (c % 2) * 0.25, col, 0.01); }
    for (const a of [PI / 4, -PI / 4]) { k.push(U.x, 0.105, U.z, a); X('paint', 0, 0, 0, 0.45, 0.02, 8.5, HORANGE); k.pop(); }
    // an oil drum with a lamp on it at each corner (self-service lighting)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = U.x + sx * 8.2, z = U.z + 1 + sz * 17.4; cyl('metal', x, 0.48, z, 0.3, 0.95, 10, { col: sx * sz > 0 ? PRIMER : [0.32, 0.36, 0.44] }); X('glowAmber', x, 1.02, z, 0.2, 0.14, 0.2); pool(x, z, 3.2, AMB); }
    // two skids the core boxes stand on, and a loose box beside them
    for (const dx of [-5.2, -2.8]) B('steelDark', U.x + dx - 0.2, 0.07, U.z + 22, 0.2, 0.14, 1.2, WELD, 0.02);
    B('steelDark', U.x - 1.1, 0.07, U.z + 22, 0.2, 0.14, 1.2, WELD, 0.02);
    k.push(U.x + 1.6, 0, U.z + 22.6, 0.5); coreBox(h, 0, 0.02, 0, 3); k.pop();
    pool(U.x - 4, U.z + 22, 6, AMB);
    // the awning: four poles that are not the same height, a patched tarp, a bench with a core laid out on it and a lamp hung over it
    {
      const x0 = U.x - 18, x1 = U.x - 10.5, z0 = U.z + 21.5, z1 = U.z + 27;
      pipe('steelDark', [x0, 0, z0], [x0, 3.0, z0], 0.06, 5); pipe('steelDark', [x1, 0, z0], [x1, 3.1, z0], 0.06, 5); pipe('steel', [x0, 0, z1], [x0, 2.6, z1], 0.06, 5, { col: ALU }); pipe('steelDark', [x1, 0, z1], [x1, 2.7, z1], 0.06, 5);
      k.push((x0 + x1) / 2, 2.86, (z0 + z1) / 2, 0); B('paint', 0, 0, 0, x1 - x0 + 0.9, 0.06, z1 - z0 + 0.9, TARP, 0.02); X('paint', 1.6, 0.035, -0.8, 1.6, 0.02, 1.3, [0.46, 0.5, 0.52]); X('paint', -2.1, 0.035, 1.2, 1.1, 0.02, 0.9, PRIMER); k.pop();
      B('steelDark', (x0 + x1) / 2, 0.92, z1 - 1.0, 4.6, 0.08, 1.2, WELD, 0.02); for (const sx of [-2.1, 2.1]) X('metal', (x0 + x1) / 2 + sx, 0.46, z1 - 1.0, 0.1, 0.92, 1.0, ALU);
      cyl('white', (x0 + x1) / 2 - 0.4, 1.05, z1 - 1.0, 0.09, 2.6, 8, { axis: 'x', col: [0.82, 0.88, 0.95] }); B('paint', (x0 + x1) / 2 + 1.6, 1.08, z1 - 1.0, 0.5, 0.24, 0.36, HORANGE, 0.03);
      pipe('steelDark', [(x0 + x1) / 2, 2.84, z1 - 1.4], [(x0 + x1) / 2, 2.2, z1 - 1.4], 0.012, 4); X('glowAmber', (x0 + x1) / 2, 2.12, z1 - 1.4, 0.22, 0.16, 0.22); pool((x0 + x1) / 2, (z0 + z1) / 2, 5.5, AMB);
      cyl('metal', x0 + 0.9, 0.48, z0 + 0.8, 0.3, 0.95, 10, { col: PRIMER }); cyl('metal', x0 + 1.7, 0.48, z0 + 0.5, 0.3, 0.95, 10, { col: ALU });
    }
    // a pole with a rag of orange on it for the pilots (there is no wind: it hangs straight down), and the signs, lettered by hand
    { const x = U.x + 9.4, z = U.z - 15; cyl('steelDark', x, 2.6, z, 0.045, 5.2, 5); X('paint', x + 0.18, 4.5, z, 0.3, 1.2, 0.02, HORANGE); X('glowAmber', x, 5.28, z, 0.18, 0.16, 0.18); pool(x, z, 5, AMB); }
    sign('unbound', 'plate', 'CLAIM FREIGHT · WEIGH IT YOURSELF', U.x - 8.6, 2.3, U.z + 9, 5.6, 0.9, -PI / 2);
    sign('unbound', 'warning', h.style('unbound').signs.slogans[2], U.x - 2.6, 1.5, U.z + 24.2, 3.6, 0.7, PI);
  },
};

/** Callisto's yards: [Mystara's at the camp, the Unbound's at the prospectors' port (null when the world has no such port)]. `camp`: what buildCamp returned. */
export function buildCallistoYards({ engine, world, space, camp }) {
  const o = { engine, world, space, tier: world.tier, clock: { shiftS: 0 } };       // one rota, one clock (a test that moves one yard's timetable moves both)
  return [
    camp.root ? new SideYard({ ...o, parent: camp.root, cfg: MYSTARA }) : null,
    camp.portRoot && camp.portPi ? new SideYard({ ...o, parent: camp.portRoot, pi: camp.portPi, cfg: UNBOUND }) : null,
  ];
}

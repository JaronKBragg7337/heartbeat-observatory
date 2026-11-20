// ============================================================================
// worlds/moon/yards.js - THE MOON'S TWO SIDES AT WORK (decoration only; the machinery is worlds/_kit/sideYard.js).
//
//   SHACKLETON (Fortis)       Supply Stand 6, inside the wall south of the apron, between the ice dock and the motor pool: a ration lighter in Fortis gunmetal lands on a numbered slab,
//                             drops her ramp and the stack of ration and ammunition crates beside the store grows; the base eats it down before
//                             the next one is due. Sintered-block barriers, red lamps, a pallet truck, hands in red-striped suits.
//   DAEDALUS (Technos Prime)  the tray dock on the plaza in front of Fab Floor 2: sealed cases of chips pile up on a white plinth as the fab
//                             prints them, and a white courier lands to carry them away. Blue light-lines, a trolley, hands in blue stripes.
//   BOTH                      a lit board that names the two sides of the Moon and says how they stand (the shared world's balance and home
//                             strength; "no report" in a solo world). In a shared world a strong home stacks its yard higher than a weak one.
//
// REAL AND NOT. Real: the Moon's pull (1.62 m/s2: the braking tilt and the slow lift-off come from it). Game fiction: both sides, their ships and yards.
// Everything stands clear of the main pad, the people of cast.js and the solid boxes of layout.js. Nothing here is solid.
// ============================================================================
import { SideYard } from '../_kit/sideYard.js';

const PI = Math.PI;
const BOARD = { title: 'THE MOON · THE TWO SIDES', sides: ['fortis', 'technos'], roles: { fortis: 'walls · gates · the gunship apron', technos: 'dishes · chips · the signal' },
  none: 'Neither Fleet Command nor the Glass Hall has posted a standing today.' };
const FLY = { V: 50, a: 0.8, af: 1.4, av: 0.35, Hh: 45, HC: 45, hoverS: 10, descentS: 26, strobeY: 4.2 };

// ---- Shackleton: Fortis ----------------------------------------------------------------------------------------------------------------------
const GUN = [0.3, 0.33, 0.36], OLIVE = [0.27, 0.3, 0.27], BONE = [0.81, 0.78, 0.7], RED = [0.84, 0.17, 0.17], BLOCK = [0.46, 0.46, 0.45], COLD = [0.8, 0.86, 1.0], REDL = [1.0, 0.22, 0.2];
const S_SPOT = { id: 'supply-stand-6', name: 'Supply stand 6', type: 'courier', x: -48, z: 62, y: 0.06, clearM: 18, bear: 10, out: 190 };
const ration = (h, x, y, z, i) => { h.B('paint', x, y + 0.45, z, 1.2, 0.9, 1.0, i % 3 === 2 ? GUN : OLIVE, 0.04); h.X('paint', x, y + 0.6, z - 0.505, 0.5, 0.22, 0.01, i % 3 === 2 ? RED : BONE); };
const SHACKLETON = {
  name: 'shackleton', homeId: 'moon', g: 1.62, slotS: 720, visitMaxS: 480,
  origin: { x: 20, z: 0 },       // the yard was drawn 20 m further west, where the ice dock's weigh bay already stands
  sides: [{ side: 'fortis', spot: S_SPOT, fly: { ...FLY, n: 6, name: 'Ration Six' },
    hold: (k, b) => { for (const sx of [-1, 1]) for (const dz of [1.2, 2.6]) k.box('paint', b.x + sx * b.w * 0.24, b.y0 + 0.5, b.z0 + dz, b.w * 0.34, 1.0, 1.1, { col: OLIVE }); },
    // twelve crates on three pallets, two by two: the lighter's stay builds the stack, the base eats it down
    stock: { max: 12, mode: 'bring', low: 0.25, build: (j, h) => { const p = Math.floor(j / 4), layer = Math.floor((j % 4) / 2), slot = j % 2; ration(h, -53.4 + p * 3.3, 0.24 + layer * 0.92, 83 + slot * 1.25, j); } } }],
  hands: [
    { side: 'fortis', id: 'pallet-hand', push: { a: [-47.2, 79.6], b: [-33.5, 86.2], speed: 0.8, gap: 1.3, side: 1.0, rest: [12, 10] },
      cart: (h) => { h.B('steelDark', 0, 0.2, 0, 1.0, 0.1, 1.5, null, 0.02); for (const sx of [-0.4, 0.4]) for (const sz of [-0.55, 0.55]) h.cyl('rubber', sx, 0.1, sz, 0.1, 0.08, 8, { axis: 'x' });
        h.pipe('steelDark', [0, 0.25, -0.75], [0, 1.1, -0.95], 0.03, 5); h.pipe('steelDark', [-0.3, 1.1, -0.95], [0.3, 1.1, -0.95], 0.03, 5); ration(h, 0, 0.25, 0.1, 0); } },
    { side: 'fortis', id: 'stand-guard', beat: { pts: [[-37.8, 50], [-37.8, 76]], rest: [14, 9] } },
    { side: 'fortis', id: 'tally-hand', beat: { pts: [[-55, 90.5], [-43.5, 90.5]], rest: [11, 13] } },
    { side: 'fortis', id: 'wall-walker', full: true, beat: { pts: [[-60.5, 48], [-60.5, 80]], rest: [8, 8] } },
  ],
  board: { ...BOARD, x: -29, z: 46.5, yaw: PI },
  build(h) {
    const { B, X, cyl, pool, lampPost, sign } = h, S = S_SPOT;
    // the stand: a sintered slab with a red edge, a bone cross and its number; four red lamps
    h.slab(S.x - 8, S.z - 16, S.x + 8, S.z + 18, [0.47, 0.47, 0.46], 0.06);
    for (const s of [-1, 1]) { X('paint', S.x + s * 7.8, 0.075, S.z + 1, 0.3, 0.02, 34, RED); X('paint', S.x, 0.075, S.z + 1 + s * 16.85, 15.9, 0.02, 0.3, RED); }
    X('paint', S.x, 0.075, S.z, 7, 0.02, 0.25, BONE); X('paint', S.x, 0.075, S.z, 0.25, 0.02, 7, BONE);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = S.x + sx * 8.6, z = S.z + 1 + sz * 17.6; cyl('steelDark', x, 0.3, z, 0.1, 0.6, 6); X('glowRed', x, 0.66, z, 0.22, 0.12, 0.22); pool(x, z, 3, REDL); }
    // sintered-block barriers along the west and north sides (Fortis puts a wall round everything, even a pallet)
    for (let z = 47; z < 80; z += 3.4) B('concrete', -58.6, 0.5, z, 0.9, 1.0, 2.8, BLOCK, 0.12);
    for (const x of [-55, -51.4, -44.6, -41]) B('concrete', x, 0.5, 44.2, 2.8, 1.0, 0.9, BLOCK, 0.12);
    // the store: three gunmetal walls and a roof, open to the yard, shelves of crates in it, a red lamp over the opening
    {
      const x0 = -36, x1 = -22, z0 = 84, z1 = 95;
      B('metal', (x0 + x1) / 2, 1.9, z1 - 0.2, x1 - x0, 3.8, 0.4, GUN, 0.05); for (const x of [x0 + 0.2, x1 - 0.2]) B('metal', x, 1.9, (z0 + z1) / 2 + 1.5, 0.4, 3.8, z1 - z0 - 3, GUN, 0.05);
      B('concrete', (x0 + x1) / 2, 3.95, (z0 + z1) / 2, x1 - x0 + 0.8, 0.3, z1 - z0 + 0.6, [0.3, 0.31, 0.32], 0.05);
      for (const x of [x0 + 0.3, x1 - 0.3]) cyl('steelDark', x, 1.9, z0 + 0.3, 0.12, 3.8, 6);
      X('glowRed', (x0 + x1) / 2, 3.72, z0 - 0.02, 2.4, 0.16, 0.06); pool((x0 + x1) / 2, z0 - 2, 5, REDL);
      X('glowCool', (x0 + x1) / 2, 3.76, (z0 + z1) / 2, 6, 0.04, 0.3); pool((x0 + x1) / 2, (z0 + z1) / 2, 6, COLD);
      for (let i = 0; i < 4; i++) { const x = x0 + 2.2 + i * 3.2; B('steelDark', x, 1.0, z1 - 1.3, 2.6, 0.08, 1.4, null, 0.02); ration(h, x - 0.6, 0.0, z1 - 1.3, i); ration(h, x + 0.65, 0.0, z1 - 1.3, i + 1); if (i % 2 === 0) ration(h, x, 1.04, z1 - 1.3, i + 2); }
      sign('fortis', 'plate', 'RATION STORE 6', (x0 + x1) / 2, 4.6, z0 - 0.05, 6.4, 0.9, PI, { wall: true });
    }
    // the three pallets the stack stands on; an ammunition stack with its stencil; fuel drums in a rack
    for (let p = 0; p < 3; p++) { const x = -53.4 + p * 3.3; B('paint', x, 0.12, 83.6, 1.5, 0.2, 2.7, [0.42, 0.36, 0.28], 0.02); }
    for (let i = 0; i < 6; i++) { B('paint', -56 + (i % 3) * 1.7, 0.35 + Math.floor(i / 3) * 0.7, 96.5, 1.5, 0.66, 0.9, i === 4 ? OLIVE : GUN, 0.04); X('paint', -56 + (i % 3) * 1.7, 0.42 + Math.floor(i / 3) * 0.7, 96.04, 0.7, 0.2, 0.01, i % 2 ? RED : BONE); }
    for (let i = 0; i < 5; i++) { cyl('metal', -46.5 + i * 0.75, 0.48, 97, 0.3, 0.95, 10, { col: i % 2 ? [0.55, 0.15, 0.15] : OLIVE }); }
    // lamps and signs: cold white work lamps, bone stencil, the orders
    lampPost(-39.4, 48, 5, 'glowCool', COLD, 9); lampPost(-39.4, 79, 5, 'glowCool', COLD, 9); lampPost(-57, 88, 5, 'glowCool', COLD, 9);
    sign('fortis', 'plate', 'SUPPLY STAND 6 · RATIONS IN', -48, 2.6, 44.75, 6.4, 0.9, PI);
    sign('fortis', 'warning', h.style('fortis').signs.slogans[0], -39.7, 1.7, 63, 3.0, 0.7, PI / 2);
    sign('fortis', 'plate', 'COUNT IT IN. COUNT IT AGAIN.', -49, 2.2, 99, 6, 0.8, PI);
  },
};

// ---- Daedalus: Technos Prime --------------------------------------------------------------------------------------------------------------------
const WHITE = [0.94, 0.96, 0.98], PEARL = [0.84, 0.88, 0.93], SLATE = [0.16, 0.2, 0.28], BLUEL = [0.35, 0.7, 1.0];
const D_SPOT = { id: 'tray-dock', name: 'bay-2 / tray dock', type: 'courier', x: -44, z: 40, y: 0.06, clearM: 18, bear: -15, out: 165 };
const trayCase = (h, x, y, z) => { h.B('white', x, y + 0.42, z, 1.1, 0.84, 1.3, WHITE, 0.08); h.X('glowBlue', x, y + 0.5, z - 0.655, 0.7, 0.05, 0.01); h.X('paint', x, y + 0.85, z, 0.5, 0.02, 0.9, SLATE); };
const DAEDALUS = {
  name: 'daedalus', homeId: 'moon', g: 1.62, slotS: 720, visitMaxS: 480,
  origin: { x: 0, y: 0.3, z: 0 },       // the whole dock stands on a low white deck: the crater floor here is not as level as the pad
  sides: [{ side: 'technos', spot: D_SPOT, fly: { ...FLY, V: 54, n: 2, name: 'Quiet Carrier' },
    hold: (k, b) => { for (const sx of [-1, 1]) for (const dz of [1.2, 2.7]) k.box('white', b.x + sx * b.w * 0.24, b.y0 + 0.45, b.z0 + dz, b.w * 0.34, 0.9, 1.2, { col: WHITE }); },
    // ten sealed cases on the plinth, two rows of five: the fab fills it, the courier's stay empties it
    stock: { max: 10, mode: 'take', build: (j, h) => trayCase(h, -39 + (j % 5) * 1.5, 0.36, 57 + Math.floor(j / 5) * 1.8) } }],
  hands: [
    { side: 'technos', id: 'tray-hand', push: { a: [-46.5, 63.4], b: [-41.6, 55.4], speed: 0.8, gap: 1.2, side: 0.95, rest: [11, 12] },
      cart: (h) => { h.B('white', 0, 0.42, 0, 0.8, 0.08, 1.3, PEARL, 0.03); for (const sx of [-0.36, 0.36]) for (const sz of [-0.45, 0.45]) h.cyl('rubber', sx, 0.12, sz, 0.12, 0.07, 8, { axis: 'x' });
        for (const sx of [-0.36, 0.36]) h.pipe('steelDark', [sx, 0.46, -0.62], [sx, 1.05, -0.72], 0.02, 4); h.pipe('steelDark', [-0.36, 1.05, -0.72], [0.36, 1.05, -0.72], 0.02, 4);
        h.B('white', 0, 0.82, 0.05, 0.7, 0.7, 0.95, WHITE, 0.06); h.X('glowBlue', 0, 0.9, -0.43, 0.45, 0.04, 0.01); } },
    { side: 'technos', id: 'dock-hand', beat: { pts: [[-36.6, 30], [-36.6, 52]], rest: [12, 10] } },
    { side: 'technos', id: 'seal-checker', beat: { pts: [[-30.4, 61.5], [-30.4, 55.5]], rest: [16, 9] } },
    { side: 'technos', id: 'floor-walker', full: true, beat: { pts: [[-52.6, 30], [-52.6, 54]], rest: [9, 9] } },
  ],
  board: { ...BOARD, x: -30, z: 26, yaw: PI * 0.75, none: 'Neither the Glass Hall nor Fleet Command has posted a standing today.' },
  build(h) {
    const { B, X, cyl, pool, lampPost, sign } = h, S = D_SPOT;
    // the deck everything stands on (a low white platform with a light-line along its lip), then
    h.slab(-55, 22.5, -26.5, 65, [0.9, 0.92, 0.95], 0);
    for (const z of [22.52, 64.98]) X('glowBlue', -40.75, -0.06, z, 28, 0.04, 0.03); for (const x of [-54.98, -26.52]) X('glowBlue', x, -0.06, 43.75, 0.03, 0.04, 42);
    // the dock: a pale slab with a blue light-line round it, a ring and a centre line (the Technos way: smooth, lit from within)
    h.slab(S.x - 7, S.z - 15, S.x + 7, S.z + 16, [0.86, 0.89, 0.93], 0.06);
    for (const s of [-1, 1]) { X('glowBlue', S.x + s * 6.8, 0.075, S.z + 0.5, 0.14, 0.02, 30.6); X('glowBlue', S.x, 0.075, S.z + 0.5 + s * 15.3, 13.7, 0.02, 0.14); }
    X('glowBlue', S.x, 0.075, S.z, 6, 0.02, 0.1); X('glowBlue', S.x, 0.075, S.z, 0.1, 0.02, 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = S.x + sx * 7.5, z = S.z + 0.5 + sz * 16; cyl('white', x, 0.35, z, 0.12, 0.7, 8, { col: WHITE }); X('glowBlue', x, 0.74, z, 0.2, 0.08, 0.2); pool(x, z, 3, BLUEL); }
    // the plinth the cases stand on, with a light-line under its lip, and the seal reader beside it
    B('white', -36, 0.18, 57.9, 8.2, 0.36, 4.4, PEARL, 0.08); X('glowBlue', -36, 0.3, 55.68, 7.6, 0.04, 0.02); X('glowBlue', -36, 0.3, 60.12, 7.6, 0.04, 0.02);
    pool(-36, 57.9, 6, BLUEL);
    cyl('white', -30.4, 0.65, 58.4, 0.22, 1.3, 10, { col: WHITE }); B('plasticDark', -30.4, 1.45, 58.4, 0.7, 0.5, 0.08, null, 0.03); X('glowBlue', -30.4, 1.45, 58.35, 0.56, 0.36, 0.01);
    // a smooth white arch over the way from the fab door to the dock, a light-line across its top
    for (const x of [-48.6, -42.4]) B('white', x, 1.6, 64.2, 0.4, 3.2, 0.5, WHITE, 0.12);
    B('white', -45.5, 3.3, 64.2, 6.8, 0.4, 0.6, WHITE, 0.14); X('glowBlue', -45.5, 3.08, 64.2, 5.6, 0.04, 0.3); pool(-45.5, 63.2, 4, BLUEL);
    // a light-line in the floor from the arch to the plinth; two spare cases waiting by the arch
    h.k.push(-43.2, 0.03, 61.7, Math.atan2(-(60 - 63.4), -40.9 + 45.5)); X('glowBlue', 0, 0, 0, 5.6, 0.02, 0.14); h.k.pop();
    trayCase(h, -50.4, 0, 61.6); trayCase(h, -50.4, 0, 60);
    // lamps and signs, lettered the Technos way (lower case, polite, slightly worrying)
    lampPost(-36.4, 27, 4.6, 'glowBlue', BLUEL, 8); lampPost(-51.6, 57, 4.6, 'glowBlue', BLUEL, 8); lampPost(-28.2, 62.6, 4.6, 'glowBlue', BLUEL, 8);
    sign('technos', 'plate', 'bay-2 / tray dock · outbound', -44, 2.6, 23.6, 6.4, 0.9, PI);
    sign('technos', 'plate', 'fab floor 2 · sealed trays only', -36, 1.7, 61.4, 4.6, 0.7, PI);
    sign('technos', 'banner', h.style('technos').signs.slogans[0], -53.6, 1.9, 44, 3.4, 0.8, PI / 2);
  },
};

const YARDS = { 'moon-shackleton': SHACKLETON, 'moon-daedalus': DAEDALUS };
/** The yard of a Moon landing, or null (the civil hub is neutral ground: no side works there). `out`: what the settlement's builder returned. */
export function buildMoonYard({ engine, world, space, out }) {
  const cfg = YARDS[world.id]; if (!cfg || !out || !out.root) return null;
  return new SideYard({ engine, world, space, parent: out.root, tier: world.tier, cfg });
}

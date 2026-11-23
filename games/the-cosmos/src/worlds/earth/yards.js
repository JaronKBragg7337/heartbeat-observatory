// ============================================================================
// worlds/earth/yards.js - EARTH'S TWO SIDES AT WORK (decoration only; the machinery is worlds/_kit/sideYard.js).
//
//   SKYWARD     Payload Stand 2, on the grass south-west of the landing pad: a white courier comes in from the south-west, lands on a slab
//               edged in range orange, and the rack of payload canisters beside the prep shelter fills; the launch mount uses them up before
//               the next one is due. A lattice service gantry with an orange arm, a windsock, hands in orange.
//   HOMEGUARD   Sea Wall Depot 1, south-east of the pad: blocks for the sea wall are cast and stacked here, and a harbour-navy courier lands
//               to carry them out to the coast. A brick site hut with a brass lamp, a sandbag line, one finished panel of wall set up as the
//               pattern piece. Homeguard still owns nothing on this coast: the sign says whose ground it is.
//   BOTH        a lit board at the foot of the south apron that names the two sides of Earth and says how they stand.
//
// REAL AND NOT. Real: Earth's pull (9.81 m/s2: a hard, short braking burn, a short hover, a quick climb out), and its air (the only yard ships in
// the game you can hear from kilometres off: `medium: 'earth'`). Game fiction: both sides, their ships and yards.
// Everything stands on the open grass south of the pad (looked at from above before a thing was placed), clear of cast.js and layout.js. Nothing is solid.
// ============================================================================
import { SideYard } from '../_kit/sideYard.js';
import { YARD_TT } from '../yardBook.js';

const PI = Math.PI;
const BK = YARD_TT.earth;       // the stands, the flights and the stock numbers: one book for the picture and for the server's count (worlds/yardBook.js)

// ---- Skyward ------------------------------------------------------------------------------------------------------------------------------------
const WHITE = [0.95, 0.96, 0.96], ORANGE = [0.91, 0.35, 0.12], LATTICE = [0.62, 0.7, 0.77], BLAST = [0.56, 0.56, 0.54], SKYL = [0.75, 0.88, 1.0], WARM = [1.0, 0.86, 0.62];
const S = BK.sides[0].spot;
const canister = (h, x, y, z) => { h.cyl('paint', x, y + 0.95, z, 0.55, 1.9, 12, { col: WHITE }); h.cyl('paint', x, y + 1.5, z, 0.565, 0.22, 12, { col: ORANGE }); h.cyl('paint', x, y + 1.96, z, 0.3, 0.12, 8, { col: [0.2, 0.24, 0.3] }); };       // one material: a canister is one draw call

// ---- Homeguard ----------------------------------------------------------------------------------------------------------------------------------
const NAVY = [0.18, 0.29, 0.39], LIME = [0.79, 0.72, 0.6], BRICK = [0.54, 0.23, 0.17], WALLC = [0.62, 0.63, 0.61], TIDE = [0.4, 0.43, 0.4], BRASSL = [1.0, 0.74, 0.3], TIMBER = [0.42, 0.33, 0.22];
const H = BK.sides[1].spot;
const block = (h, x, y, z) => { h.B('concrete', x, y + 0.55, z, 1.7, 1.1, 1.7, WALLC, 0.1); h.X('concrete', x, y + 0.14, z, 1.72, 0.28, 1.72, TIDE); h.X('concrete', x, y + 1.13, z, 0.5, 0.06, 0.12, [0.2, 0.2, 0.2]); };

const EARTH = {
  name: 'earth', homeId: 'earth', ...BK, medium: 'earth',
  sides: [
    { ...BK.sides[0],
      hold: (k, b) => { for (const sx of [-1, 1]) for (const dz of [1.3, 2.9]) k.cyl('white', b.x + sx * b.w * 0.24, b.y0 + 0.8, b.z0 + dz, 0.5, 1.6, 10, { col: WHITE }); },
      // eight canisters on the rack, two rows of four: the courier's stay fills it, the mount uses it up
      stock: { ...BK.sides[0].stock, build: (j, h) => canister(h, S.x - 4.5 + (j % 4) * 3, 0.3, S.z + 22.5 + Math.floor(j / 4) * 2.3) } },
    { ...BK.sides[1],
      hold: (k, b) => { for (const sx of [-1, 1]) k.box('paint', b.x + sx * b.w * 0.24, b.y0 + 0.55, b.z0 + 2, b.w * 0.36, 1.1, 1.7, { col: WALLC }); },
      // twelve blocks on timber, six to a layer: the yard casts them, the courier's stay carries them off to the wall
      stock: { ...BK.sides[1].stock, build: (j, h) => { const i = j % 6; block(h, H.x - 5.2 + (i % 3) * 1.95, 0.2 + Math.floor(j / 6) * 1.12, H.z + 22.6 + Math.floor(i / 3) * 1.95); } } },
  ],
  hands: [
    { side: 'skyward', id: 'canister-hand', cloth: 0xe8591e, push: { a: [S.x - 6, S.z + 28], b: [S.x + 8, S.z + 28], speed: 0.8, gap: 1.3, side: 1.0, rest: [12, 10] },
      cart: (h) => { h.B('steel', 0, 0.3, 0, 1.2, 0.1, 1.7, LATTICE, 0.02); for (const sx of [-0.5, 0.5]) for (const sz of [-0.6, 0.6]) h.cyl('rubber', sx, 0.15, sz, 0.15, 0.1, 8, { axis: 'x' });
        h.pipe('steelDark', [0, 0.35, -0.85], [0, 1.1, -1.0], 0.03, 5); h.pipe('steelDark', [-0.35, 1.1, -1.0], [0.35, 1.1, -1.0], 0.03, 5); canister(h, 0, 0.35, 0.1); } },
    { side: 'skyward', id: 'stand-marshal', cloth: 0xe8591e, beat: { pts: [[S.x + 10.4, S.z - 12], [S.x + 10.4, S.z + 12]], rest: [14, 9] } },
    { side: 'homeguard', id: 'block-hand', push: { a: [H.x - 6, H.z + 28.4], b: [H.x + 5, H.z + 28.4], speed: 0.7, gap: 1.4, side: 1.1, rest: [11, 13] },
      cart: (h) => { h.B('paint', 0, 0.32, 0, 1.9, 0.14, 2.0, NAVY, 0.03); for (const sx of [-0.8, 0.8]) for (const sz of [-0.7, 0.7]) h.cyl('rubber', sx, 0.16, sz, 0.16, 0.14, 8, { axis: 'x' });
        h.pipe('steelDark', [-0.6, 0.4, -1.0], [-0.6, 1.1, -1.15], 0.03, 5); h.pipe('steelDark', [0.6, 0.4, -1.0], [0.6, 1.1, -1.15], 0.03, 5); h.pipe('steelDark', [-0.6, 1.1, -1.15], [0.6, 1.1, -1.15], 0.03, 5); block(h, 0, 0.39, 0); } },
    { side: 'homeguard', id: 'depot-tally', beat: { pts: [[H.x - 10.4, H.z - 12], [H.x - 10.4, H.z + 12]], rest: [10, 12] } },
    { side: 'skyward', id: 'gantry-hand', cloth: 0xe8591e, full: true, beat: { pts: [[S.x - 14.5, S.z - 12], [S.x - 14.5, S.z + 8]], rest: [8, 8] } },
    { side: 'homeguard', id: 'bag-layer', full: true, beat: { pts: [[H.x + 13.2, H.z - 12], [H.x + 13.2, H.z + 10]], rest: [9, 9] } },
  ],
  board: { title: 'EARTH · THE TWO SIDES', sides: ['skyward', 'homeguard'], roles: { skyward: 'the pad · the tower · the way up', homeguard: 'sea walls · fields · staying' },
    none: 'Neither Range Control nor the Homeguard has posted a standing today.', x: 0, z: 66, yaw: PI },
  build(h) {
    const { B, X, cyl, pipe, pool, lampPost, sign, k } = h;
    // ================= Skyward: Payload Stand 2 =================
    h.slab(S.x - 8, S.z - 16, S.x + 8, S.z + 18, BLAST, 0.06);
    for (const s of [-1, 1]) { X('paint', S.x + s * 7.8, 0.075, S.z + 1, 0.3, 0.02, 34, ORANGE); X('paint', S.x, 0.075, S.z + 1 + s * 16.85, 15.9, 0.02, 0.3, ORANGE); }
    X('paint', S.x, 0.075, S.z, 7, 0.02, 0.3, WHITE); X('paint', S.x, 0.075, S.z, 0.3, 0.02, 7, WHITE);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = S.x + sx * 8.6, z = S.z + 1 + sz * 17.6; cyl('steelDark', x, 0.3, z, 0.1, 0.6, 6); X('glowAmber', x, 0.66, z, 0.22, 0.12, 0.22); pool(x, z, 3, WARM); }
    // the service gantry on the west side: four lattice legs, braces, an orange arm out over the stand, a red light on top
    {
      const gx = S.x - 11.5, gz = S.z - 2, w = 1.5, top = 9.5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pipe('steel', [gx + sx * w, 0, gz + sz * w], [gx + sx * w, top, gz + sz * w], 0.09, 6, { col: LATTICE });
      for (let y = 1.6; y < top; y += 2.6) for (const s of [-1, 1]) {
        pipe('steel', [gx - w, y, gz + s * w], [gx + w, y + 2.4, gz + s * w], 0.045, 4, { col: LATTICE }); pipe('steel', [gx + s * w, y, gz - w], [gx + s * w, y + 2.4, gz + w], 0.045, 4, { col: LATTICE });
        X('steel', gx, y - 0.2, gz + s * w, 2 * w, 0.08, 0.08, LATTICE); X('steel', gx + s * w, y - 0.2, gz, 0.08, 0.08, 2 * w, LATTICE);
      }
      B('paint', gx, top + 0.15, gz, 3.6, 0.3, 3.6, ORANGE, 0.05);
      B('paint', gx + 3.4, 7.2, gz, 4.0, 0.5, 0.7, ORANGE, 0.06); pipe('steelDark', [gx + 1.5, top, gz], [gx + 5.2, 7.4, gz], 0.03, 4); X('glowWhite', gx + 5.1, 6.9, gz, 0.5, 0.06, 0.4); pool(gx + 6, gz, 6, SKYL);
      cyl('steelDark', gx, top + 1.3, gz, 0.04, 2.0, 5); X('glowRed', gx, top + 2.35, gz, 0.2, 0.2, 0.2);
      B('concrete', gx, 0.1, gz, 4.2, 0.2, 4.2, BLAST, 0.04);
    }
    // the rack the canisters stand on; the prep shelter east of it (white, an orange band, open to the yard), spare canisters and a test bench inside
    B('steel', S.x, 0.15, S.z + 23.6, 12.4, 0.3, 5.2, LATTICE, 0.04); for (const z of [S.z + 21.2, S.z + 26]) X('paint', S.x, 0.31, z, 12.2, 0.02, 0.16, ORANGE);
    pool(S.x, S.z + 23.6, 7, SKYL);
    {
      const x0 = S.x + 10, x1 = S.x + 22, z0 = S.z + 20, z1 = S.z + 29;
      B('white', (x0 + x1) / 2, 1.8, z1 - 0.2, x1 - x0, 3.6, 0.4, WHITE, 0.05); for (const x of [x0 + 0.2, x1 - 0.2]) B('white', x, 1.8, (z0 + z1) / 2 + 1.2, 0.4, 3.6, z1 - z0 - 2.4, WHITE, 0.05);
      B('white', (x0 + x1) / 2, 3.75, (z0 + z1) / 2, x1 - x0 + 0.8, 0.3, z1 - z0 + 0.6, WHITE, 0.06); X('paint', (x0 + x1) / 2, 3.45, z0 - 0.32, x1 - x0 + 0.8, 0.3, 0.04, ORANGE);
      for (const x of [x0 + 0.3, x1 - 0.3]) cyl('steel', x, 1.8, z0 + 0.3, 0.1, 3.6, 6, { col: LATTICE });
      X('glowWhite', (x0 + x1) / 2, 3.56, (z0 + z1) / 2, 7, 0.04, 0.3); pool((x0 + x1) / 2, z0 + 2, 6, SKYL);
      canister(h, x0 + 2, 0, z1 - 1.6); canister(h, x0 + 3.4, 0, z1 - 1.6);
      B('steelDark', x1 - 3.4, 0.9, z1 - 1.3, 4.2, 0.08, 1.3, null, 0.02); for (const sx of [-1.9, 1.9]) X('steelDark', x1 - 3.4 + sx, 0.45, z1 - 1.3, 0.08, 0.9, 1.1);
      B('plasticDark', x1 - 4.2, 1.25, z1 - 1.1, 0.9, 0.6, 0.1, null, 0.02); X('glowBlue', x1 - 4.2, 1.25, z1 - 1.16, 0.76, 0.46, 0.01);
      sign('skyward', 'plate', 'PAYLOAD PREP 2', (x0 + x1) / 2, 4.5, z0 - 0.3, 6, 0.9, PI, { wall: true });
    }
    // a windsock (Earth has wind): a pole, a hoop and an orange sleeve hanging out to the east
    { const x = S.x + 12, z = S.z - 14; cyl('steelDark', x, 3.2, z, 0.05, 6.4, 6); B('concrete', x, 0.1, z, 0.5, 0.2, 0.5, null, 0.03); cyl('paint', x + 1.1, 6.15, z, 0.3, 2.2, 8, { axis: 'x', r2: 0.14, col: ORANGE }); cyl('paint', x + 0.45, 6.15, z, 0.31, 0.3, 8, { axis: 'x', col: WHITE }); }
    lampPost(S.x + 10.4, S.z - 16, 6, 'glowWhite', SKYL, 10); lampPost(S.x - 10, S.z + 20, 6, 'glowWhite', SKYL, 10);
    sign('skyward', 'plate', 'PAYLOAD STAND 2 · UPBOUND FREIGHT', S.x, 2.6, S.z - 18.4, 7.4, 0.9, PI);
    sign('skyward', 'warning', h.style('skyward').signs.slogans[1], S.x + 9.8, 1.7, S.z + 2, 3.4, 0.7, PI / 2);

    // ================= Homeguard: Sea Wall Depot 1 =================
    h.slab(H.x - 8, H.z - 16, H.x + 8, H.z + 18, [0.6, 0.61, 0.59], 0.06);
    for (let z = H.z - 14; z <= H.z + 16; z += 3) X('concrete', H.x, 0.068, z, 15.6, 0.02, 0.12, [0.5, 0.51, 0.5]);                     // the ribbing a sea-wall panel is cast with
    for (const s of [-1, 1]) { X('paint', H.x + s * 7.8, 0.075, H.z + 1, 0.3, 0.02, 34, NAVY); X('paint', H.x, 0.075, H.z + 1 + s * 16.85, 15.9, 0.02, 0.3, NAVY); }
    X('paint', H.x, 0.08, H.z, 7, 0.02, 0.3, LIME); X('paint', H.x, 0.08, H.z, 0.3, 0.02, 7, LIME);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = H.x + sx * 8.6, z = H.z + 1 + sz * 17.6; cyl('paint', x, 0.45, z, 0.12, 0.9, 6, { col: NAVY }); X('glowAmber', x, 0.98, z, 0.24, 0.16, 0.24); pool(x, z, 3.4, BRASSL); }
    // the timber the blocks stand on, and a casting form with one block still in it
    for (const z of [H.z + 22, H.z + 23.2, H.z + 24, H.z + 25.2]) B('paint', H.x - 3.25, 0.1, z, 6.2, 0.2, 0.3, TIMBER, 0.02);
    { const x = H.x + 3.6, z = H.z + 23.6; for (const s of [-1, 1]) { B('paint', x + s * 0.95, 0.62, z, 0.1, 1.24, 2.0, TIMBER, 0.02); B('paint', x, 0.62, z + s * 0.95, 2.0, 1.24, 0.1, TIMBER, 0.02); } X('concrete', x, 0.5, z, 1.78, 1.0, 1.78, [0.5, 0.52, 0.5]); }
    pool(H.x - 3.25, H.z + 23.6, 7, BRASSL);
    // the site hut: fired brick, a limestone door surround, a harbour-navy door, a brass lamp over it (every light on, every night)
    {
      const x0 = H.x + 9, x1 = H.x + 17, z0 = H.z + 21, z1 = H.z + 26;
      B('paint', (x0 + x1) / 2, 1.5, (z0 + z1) / 2, x1 - x0, 3.0, z1 - z0, BRICK, 0.05); B('concrete', (x0 + x1) / 2, 3.1, (z0 + z1) / 2, x1 - x0 + 0.5, 0.2, z1 - z0 + 0.5, [0.45, 0.46, 0.46], 0.04);
      B('paint', x0 + 2, 1.2, z0 - 0.06, 1.5, 2.4, 0.12, LIME, 0.03); X('paint', x0 + 2, 1.1, z0 - 0.13, 1.0, 2.1, 0.03, NAVY);
      B('paint', x0 + 5.6, 1.7, z0 - 0.04, 1.8, 1.1, 0.08, LIME, 0.03); X('glowAmber', x0 + 5.6, 1.7, z0 - 0.09, 1.5, 0.8, 0.02, [0.9, 0.8, 0.6]);
      X('glowAmber', x0 + 2, 2.62, z0 - 0.2, 0.34, 0.2, 0.24); pool(x0 + 2, z0 - 1.6, 4.5, BRASSL);
      sign('homeguard', 'plate', 'SEA WALL DEPOT 1 · ON LOAN FROM SKYWARD', (x0 + x1) / 2, 3.9, z0 - 0.1, 7.6, 0.8, PI, { wall: true });
    }
    // the pattern piece: one finished panel of sea wall, ribbed, tide-stained at the foot, with its motto
    {
      const x = H.x - 13.5, z = H.z + 24;
      B('concrete', x, 1.7, z, 6.4, 3.4, 0.9, WALLC, 0.08); X('concrete', x, 0.3, z - 0.02, 6.5, 0.6, 0.98, TIDE); B('concrete', x, 3.5, z, 6.8, 0.25, 1.2, [0.55, 0.56, 0.55], 0.05);
      for (let i = -3; i <= 3; i++) X('concrete', x + i * 0.9, 1.9, z - 0.48, 0.16, 2.9, 0.08, [0.52, 0.53, 0.52]);
      sign('homeguard', 'banner', h.style('homeguard').signs.slogans[1], x, 4.5, z - 0.5, 4.6, 0.8, PI, { wall: true });
    }
    // a sandbag line along the east side, two courses, the top one set back half a bag
    for (let i = 0; i < 12; i++) { const z = H.z - 13 + i * 2.1; B('paint', H.x + 11.4, 0.2, z, 0.8, 0.4, 1.9, LIME, 0.16); if (i < 11) B('paint', H.x + 11.4, 0.58, z + 1.05, 0.74, 0.36, 1.8, [0.72, 0.66, 0.54], 0.15); }
    // a beacon mast (brass lamp on a navy pole) and two work lamps
    { const x = H.x - 10.5, z = H.z - 16; cyl('paint', x, 3.6, z, 0.07, 7.2, 6, { col: NAVY }); B('concrete', x, 0.12, z, 0.5, 0.24, 0.5, null, 0.03); X('glowAmber', x, 7.35, z, 0.36, 0.3, 0.36); pool(x, z, 9, BRASSL); }
    lampPost(H.x + 9.6, H.z + 18.4, 5.4, 'glowAmber', BRASSL, 9); lampPost(H.x - 9.6, H.z + 19.5, 5.4, 'glowAmber', BRASSL, 9);
    sign('homeguard', 'plate', 'SEA WALL DEPOT 1 · BLOCKS OUT', H.x, 2.6, H.z - 18.4, 7.4, 0.9, PI);
    sign('homeguard', 'warning', h.style('homeguard').signs.slogans[3], H.x - 9.8, 1.7, H.z + 2, 3.6, 0.7, -PI / 2);
    void k;
  },
};

/** Earth's yards. `parent`: the launch complex's root (complex.js). */
export function buildEarthYard({ engine, world, space, parent }) {
  if (!parent) return null;
  return new SideYard({ engine, world, space, parent, tier: world.tier, cfg: EARTH });
}

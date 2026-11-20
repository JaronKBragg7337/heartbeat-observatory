// ============================================================================
// worlds/deimos/client.js - the client dressing of Deimos (docs/ADD-A-WORLD.md, "Dressing"): the DEIMOS SURVEY CAMP, a small rough
// camp at the survey pad. Decoration only: the server never loads this file, nobody here talks or trades.
//
// Smaller and rougher than Stickney East on Phobos (whose kit it is drawn with: ../phobos/outpostKit.js). Gravity 0.003 m/s2, a hundred
// metres of dust, no air:
//   * a landing circle of pinned marker panels with low edge lights (dust takes no paint);
//   * EAST of it an inflatable shelter under a bank of regolith bags, strapped down, its rigid airlock facing the circle;
//   * the core drill on a tripod with anchored outriggers (a drill here pushes the rig up, not the bit down), its core rack and
//     control stand, a spoil ring, stakes along the core line;
//   * a guyed beacon mast with a strobe, a small solar array, crates under a net, gas bottles, the hopper;
//   * tether lines between them, and three suited people.
// The west side is left open: that is the approach.
// Outpost-local metres: x EAST, y UP, z SOUTH, origin the middle of the pad.
// ============================================================================
import { makeSite } from '../phobos/outpostKit.js';

const SKIN = [0.84, 0.82, 0.76], HARD = [0.8, 0.81, 0.82];

function build(ctx) {
  const S = makeSite(ctx, { bag: [0.3, 0.28, 0.25], seed: 83 });
  const { K, G } = S, { B, X, cyl, pipe, k, low } = K;

  // ---- the landing circle: twelve orange marker panels pinned to the dust, a cross at the middle, twelve edge lights ----
  const R = 26;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    S.at(x, z, -a + Math.PI / 2, () => { X('paint', 0, 0.02, 0, 3.4, 0.03, 0.7, [0.95, 0.45, 0.12]); X('white', 0, 0.025, 0, 0.5, 0.03, 0.72); for (const sx of [-1.6, 1.6]) for (const sz of [-0.28, 0.28]) cyl('steelDark', sx, 0.04, sz, 0.035, 0.06, 5); });
  }
  for (const [w, d] of [[5, 0.7], [0.7, 5]]) X('paint', 0, G(0, 0) + 0.02, 0, w, 0.03, d, [0.95, 0.45, 0.12]);
  S.edgeLights(R + 1.3, 12, 'glowCyan', [0.25, 0.75, 0.95], 0.5);
  // the camp itself, laid out round the circle's east side and slid 6 m further east to clear a ship the size of the Meridian
  S.shift(6, 0, () => {
  S.sign(25.6, 2.2, -10.4, 3.6, 1.3, -Math.PI / 2, [{ t: 'DEIMOS SURVEY CAMP', s: 0.3, c: '#f4c64a' }, { t: 'CORE LINE D-3 · DRILLING', s: 0.15 }, { t: 'STAY CLIPPED ON · 0.003 m/s²', s: 0.13, c: '#ff8a5a' }]);

  // ---- the shelter: an inflated half-cylinder (4.6 m across, 9 m long) with hoop ribs, banked with regolith bags, strapped to piles ----
  {
    const sx0 = 30.2, sx1 = 39.2, cz = -6, r = 2.3, cx = (sx0 + sx1) / 2, g = G(cx, cz);
    k.cyl('panel', cx, g, cz, r, sx1 - sx0, low ? 16 : 24, { axis: 'x', col: SKIN });
    for (let x = sx0 + 0.5; x < sx1; x += 1.6) k.cyl('panel', x, g, cz, r + 0.05, 0.22, low ? 16 : 24, { axis: 'x', col: [0.62, 0.6, 0.55], capTop: false, capBottom: false });
    for (const x of [sx0 + 1.3, cx, sx1 - 1.3]) {                                                 // the straps over it, each end on a pile
      k.cyl('hazard', x, g, cz, r + 0.09, 0.1, low ? 16 : 24, { axis: 'x', capTop: false, capBottom: false });
      for (const s of [-1, 1]) { pipe('pipeYellow', [x, g + 1.56, cz + s * 1.74], [x, g + 1.56, cz + s * 3.0], 0.02, 4); S.guy([x, g + 1.56, cz + s * 3.0], x, cz + s * 4.7, 0.02, 'pipeYellow'); }
    }
    S.mound([sx0 + 1.2, cz - 3.9, sx1 + 1.9, cz + 3.9], [sx0 + 2.2, cz - 2.9, sx1 + 0.9, cz + 2.9], 1.5);
    // the rigid airlock on the west end: a frame, a dogged hatch, a lamp, a small porch
    B('panel', sx0 - 0.6, g + 1.15, cz, 1.4, 2.3, 2.0, HARD, 0.06);
    B('hazard', sx0 - 1.32, g + 1.08, cz, 0.06, 2.0, 1.3, null, 0.03); B('gunmetal', sx0 - 1.36, g + 1.08, cz, 0.05, 1.85, 1.12, [1.5, 1.5, 1.55], 0.04);
    cyl('steel', sx0 - 1.4, g + 1.15, cz + 0.3, 0.14, 0.05, 10, { axis: 'x' }); X('glowCool', sx0 - 1.395, g + 1.6, cz - 0.22, 0.012, 0.22, 0.22, [0.7, 0.7, 0.7]);
    X('glowWhite', sx0 - 1.34, g + 2.2, cz, 0.06, 0.07, 1.4); X('glowGreen', sx0 - 1.34, g + 1.75, cz + 0.82, 0.02, 0.1, 0.1);
    X('metal', sx0 - 2.6, g + 0.06, cz, 2.4, 0.05, 2.4, [0.5, 0.52, 0.56]);
    // life support on a skid beside it: a scrubber box, two tanks, a small radiator, hoses into the wall
    B('steelDark', 31.6, g + 0.1, cz + 3.6, 3.0, 0.16, 1.2, null, 0.03); B('panel', 30.8, g + 0.75, cz + 3.6, 1.1, 1.1, 0.9, HARD, 0.05);
    for (const x of [31.9, 32.6]) { cyl('white', x, g + 0.85, cz + 3.6, 0.28, 1.3, 10); k.dome('white', x, g + 1.5, cz + 3.6, 0.28, 10, 4, { thetaMax: Math.PI / 2 }); }
    X('white', 31.6, g + 2.1, cz + 4.15, 2.6, 1.1, 0.04); for (const x of [30.5, 32.7]) cyl('steelDark', x, g + 0.95, cz + 4.15, 0.035, 1.5, 5);
    pipe('rubber', [30.8, g + 1.0, cz + 3.15], [30.8, g + 1.5, cz + 2.0], 0.05, 5); pipe('rubber', [32.2, g + 0.9, cz + 3.3], [32.2, g + 1.3, cz + 2.2], 0.05, 5);
    X('glowGreen', 30.24, g + 1.0, cz + 3.6, 0.01, 0.08, 0.3, [0.6, 0.6, 0.6]);
    for (const [x, z] of [[30, cz + 4.5], [33.2, cz + 4.5]]) S.guy([x < 31 ? 30.2 : 33, g + 0.2, cz + 4.1], x, z + 0.4, 0.016, 'pipeYellow');
    S.pool(sx0 - 2.6, cz, 5.5, [1, 0.95, 0.85]);
    S.box(sx0 - 1.3, cz - 1.0, sx0 + 0.1, cz + 1.0, 2.6); S.box(sx0, cz - 2.4, sx1, cz + 2.4, 2.6); S.box(sx0 + 1.2, cz - 3.9, sx1 + 1.9, cz + 3.9, 1.2); S.box(30.1, cz + 3.0, 33.1, cz + 4.3, 2);
  }

  // ---- the core drill: a tripod over the hole, three outriggers pinned with two piles each, the top drive on its rail, the string in the ground ----
  {
    const dx = 36, dz = 11, g = G(dx, dz), H = 6.4;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094 + 0.4, fx = dx + Math.cos(a) * 2.3, fz = dz + Math.sin(a) * 2.3, ox = dx + Math.cos(a) * 4.2, oz = dz + Math.sin(a) * 4.2, fg = G(fx, fz);
      pipe('steel', [fx, fg + 0.15, fz], [dx + Math.cos(a) * 0.25, g + H, dz + Math.sin(a) * 0.25], 0.07, 6);
      B('steelDark', fx, fg + 0.08, fz, 0.6, 0.14, 0.6, null, 0.03);
      pipe('steelDark', [fx, fg + 0.15, fz], [ox, G(ox, oz) + 0.12, oz], 0.05, 5); B('steelDark', ox, G(ox, oz) + 0.07, oz, 0.5, 0.12, 0.5, null, 0.03);
      S.pile(ox + 0.3, oz); S.pile(ox - 0.3, oz); S.guy([dx + Math.cos(a) * 0.9, g + H * 0.62, dz + Math.sin(a) * 0.9], ox + Math.cos(a) * 1.6, oz + Math.sin(a) * 1.6, 0.016);
      const b = (i + 1) * 2.094 + 0.4;                                                            // a brace ring between the legs
      pipe('steelDark', [dx + Math.cos(a) * 1.5, g + H * 0.36, dz + Math.sin(a) * 1.5], [dx + Math.cos(b) * 1.5, g + H * 0.36, dz + Math.sin(b) * 1.5], 0.035, 4);
    }
    B('steelDark', dx, g + H + 0.1, dz, 0.6, 0.3, 0.6, null, 0.04); X('glowAmber', dx, g + H + 0.32, dz, 0.14, 0.1, 0.14);
    B('steel', dx + 0.3, g + H / 2 + 0.3, dz, 0.16, H - 0.8, 0.16, null, 0.02);                    // the feed rail
    B('hazard', dx, g + 3.5, dz, 0.7, 0.8, 0.7, null, 0.05); cyl('gunmetal', dx, g + 4.05, dz, 0.22, 0.3, 10);     // the top drive
    cyl('steel', dx, g + 1.6, dz, 0.055, 3.4, 8);                                                  // the drill string
    cyl('steelDark', dx, g + 0.2, dz, 0.2, 0.5, 10); cyl('steelDark', dx, g + 0.03, dz, 0.5, 0.06, 12);     // casing collar and its plate
    cyl('dust', dx, g + 0.02, dz, 1.5, 0.3, low ? 10 : 16, { r2: 0.7, col: [0.33, 0.31, 0.28] }); S.heap(dx + 1.6, dz - 3.2, 1.3, 0.5);         // the spoil ring
    pipe('rubber', [dx, g + 3.3, dz + 0.35], [dx + 1.0, g + 1.2, dz + 1.6], 0.035, 4); pipe('rubber', [dx + 1.0, g + 1.2, dz + 1.6], [dx - 2.4, g + 0.06, dz + 1.3], 0.035, 4);
    // the control stand the driller works at, west of the rig
    B('steelDark', dx - 2.8, g + 0.5, dz + 0.9, 0.5, 1.0, 0.7, null, 0.03); B('plasticDark', dx - 2.8, g + 1.2, dz + 0.9, 0.62, 0.45, 0.8, null, 0.03); X('glowCyan', dx - 3.115, g + 1.22, dz + 0.9, 0.01, 0.3, 0.6, [0.6, 0.6, 0.6]);
    S.guy([dx - 2.8, g + 0.6, dz + 1.25], dx - 2.8, dz + 1.9, 0.014, 'pipeYellow');
    // the core rack: sealed core tubes laid in a cradle, labelled ends, lashed
    S.at(dx + 3.4, dz + 3.2, 0.25, () => {
      for (const sx of [-1, 1]) { B('steelDark', sx * 0.9, 0.35, 0, 0.1, 0.7, 1.2, null, 0.02); }
      for (let i = 0; i < 5; i++) { const lz = -0.44 + i * 0.22; cyl('white', 0, 0.78, lz, 0.085, 2.3, 8, { axis: 'x' }); cyl(i < 3 ? 'pipeBlue' : 'pipeYellow', 1.1, 0.78, lz, 0.09, 0.14, 8, { axis: 'x' }); }
      for (let i = 0; i < 3; i++) { const lz = -0.22 + i * 0.22; cyl('white', 0, 0.94, lz, 0.085, 2.3, 8, { axis: 'x' }); cyl('pipeBlue', 1.1, 0.94, lz, 0.09, 0.14, 8, { axis: 'x' }); }
      X('hazard', 0.4, 0.9, 0, 0.06, 0.4, 1.24); X('hazard', -0.4, 0.9, 0, 0.06, 0.4, 1.24);
    });
    S.pile(dx + 3.0, dz + 4.3); S.pile(dx + 3.9, dz + 2.2);
    S.lamp(dx + 4.6, dz - 2.6, 4.5, 'glowWhite', 9);
    // stakes along the core line, east of the rig: done holes capped and flagged
    for (let i = 1; i <= 5; i++) { const x = dx + 5 + i * 5.5, z = dz + 0.6 * i, sg = G(x, z); cyl('steelDark', x, sg + 0.45, z, 0.02, 0.9, 4); X('paint', x + 0.14, sg + 0.8, z, 0.26, 0.16, 0.012, [0.95, 0.45, 0.12]); cyl('steelDark', x - 0.4, sg + 0.06, z, 0.12, 0.12, 8); }
    S.box(dx - 0.5, dz - 0.5, dx + 0.5, dz + 0.5, 6); S.box(dx - 3.1, dz + 0.5, dx - 2.5, dz + 1.3, 1.5); S.box(dx + 2.2, dz + 2.5, dx + 4.6, dz + 3.9, 1.1);
  }

  // ---- the beacon mast: a guyed pole, a strobe, the transponder box at its foot ----
  {
    const bx = 27, bz = -19, g = G(bx, bz), H = 9;
    cyl('steelDark', bx, g + H / 2, bz, 0.07, H, 6, { r2: 0.045 }); B('steelDark', bx, g + 0.06, bz, 0.6, 0.1, 0.6, null, 0.03);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.2; S.guy([bx, g + H * 0.92, bz], bx + Math.cos(a) * 4.6, bz + Math.sin(a) * 4.6, 0.014); S.guy([bx, g + H * 0.5, bz], bx + Math.cos(a) * 2.6, bz + Math.sin(a) * 2.6, 0.012); }
    S.strobe(bx, g + H + 0.18, bz); X('glowAmber', bx, g + H * 0.55, bz, 0.12, 0.12, 0.12);
    for (const y of [H - 0.8, H - 1.4]) pipe('steel', [bx - 0.5, g + y, bz], [bx + 0.5, g + y, bz], 0.015, 4);                // a small crossed aerial
    B('panel', bx + 0.9, g + 0.45, bz + 0.4, 0.8, 0.8, 0.6, HARD, 0.04); X('glowGreen', bx + 0.9, g + 0.6, bz + 0.705, 0.2, 0.06, 0.01, [0.6, 0.6, 0.6]);
    S.pool(bx, bz, 4, [0.9, 0.25, 0.15]);
    S.box(bx - 0.3, bz - 0.3, bx + 1.4, bz + 0.8, 2);
  }

  // ---- power: three wings on guyed posts north-east of the shelter, their cable to the shelter's skid ----
  S.solarRow([42, 47.4, 52.8], -18, 4.6, 2.4, Math.PI, 1.15, 1.9);
  S.cable([[56, -17.5], [56.4, -12], [42.6, -0.6], [33.4, -1.2]], 0.04);

  // ---- stores: crates under a net by the airlock, gas bottles, a second small pile by the rig; the hopper ----
  S.cratePile(27.4, 1.4, -0.15, [[-0.7, -0.2, 1.1, 0.9, 1.0, 'crateB'], [0.55, -0.3, 1.0, 0.8, 0.9, 'crateA'], [0.1, 0.65, 1.5, 0.6, 0.7, 'crateC'], [-0.6, -0.2, 0.8, 0.6, 0.7, 'crateA', 0.9]], 2.9, 1.55, 2.2);
  S.bottles(26.2, -2.2, 1.3, 4); S.pile(25.7, -2.4);
  S.cratePile(31.2, 15.2, 0.5, [[-0.4, 0, 1.0, 0.8, 0.9, 'crateC'], [0.6, 0.1, 0.8, 0.6, 0.8, 'crateB']], 2.1, 0.85, 1.2);
  S.hopper(24.6, 10.6, -0.5);
  S.tether([[23.6, -4.6], [27.4, -4.6]]); S.tether([[23.6, -7.4], [27.4, -7.4]]);
  S.tether([[28.4, -3.4], [29.6, 4.6], [32.6, 9.6]]);

  // ---- the people: the driller at her stand, one logging cores at the rack, one walking between the airlock and the rig ----
  S.person({ id: 'de-driller', body: 'zuri', x: 32.2, z: 11.9, face: Math.PI / 2, cloth: 0xd9772b });      // named and talkable: ../phobos/cast.js
  S.person({ id: 'de-geo', body: 'aoi', x: 39.1, z: 15.6, face: Math.PI, cloth: 0x3f6f9a });
  S.person({ body: 'sunita', x: 27.2, z: -3.4, face: 0, cloth: 0xc9b04a, path: [[27.2, -3.4], [28.6, 4.4], [31.6, 9.4]], pause: 14 });
  });

  return S.finish();
}

function dress(world, { engine }) {
  return build({ engine, world, space: world.space, tier: world.tier });
}

export default { dress };

// ============================================================================
// worlds/phobos/client.js - the client dressing of Phobos (docs/ADD-A-WORLD.md, "Dressing"): STICKNEY EAST STATION, a small propellant
// and survey station standing round the survey pad. Decoration only: the server never loads this file, nobody here talks or trades,
// and the pad disc, its four lamps, the sample beacons and the cargo module stay where src/space/jobs.js puts them.
//
// What stands here, and why it looks the way it does (gravity 0.0057 m/s2, no air, hard sunlight, Mars filling the sky):
//   * EAST of the pad: three habitat cylinders (4.5 m across) lying half-buried under a berm of regolith bags (radiation and
//     micrometeorite cover), the airlock of the middle one facing the pad; radiators edge-on along the crown; the comms mast and dish.
//   * SOUTH-EAST: the propellant farm. Three strapped tanks on saddles, a pump skid, a pipe run on sleepers to the hydrant at the
//     pad's edge; behind it the regolith oven that feeds them and its spoil heap.
//   * SOUTH: the solar field, two rows of wings on guyed posts, its cable lying back to the station.
//   * NORTH: the cargo yard. Containers lashed to piles, a netted crate pile, the crew hopper.
//   * Everything is anchored: screw piles, guy cables, lashings, and tether lines to clip on to between the pad and each place.
// The west half of the pad's surroundings is left open: that is the approach.
// Outpost-local metres: x EAST, y UP, z SOUTH, origin the middle of the pad (its painted disc is 31 m in radius).
// ============================================================================
import { makeSite } from './outpostKit.js';

const WHITE = [0.86, 0.87, 0.88], HAB = [0.8, 0.81, 0.82];

function build(ctx) {
  const S = makeSite(ctx, { bag: [0.2, 0.19, 0.18], seed: 61 });
  const { K, G } = S, { B, X, cyl, pipe, k, low } = K, RS = low ? 16 : 24;       // big round things keep their roundness on a phone

  // ---- the pad's edge: a ring of low lights outside the painted disc, and the station's sign beside the way to the airlock ----
  S.edgeLights(32.4, 24);
  S.sign(34.3, 2.5, -8.2, 4.4, 1.5, -Math.PI / 2, [
    { t: 'STICKNEY EAST', s: 0.42, c: '#f4c64a' }, { t: 'PHOBOS SURVEY AND PROPELLANT STATION', s: 0.15 }, { t: 'CLIP ON BEFORE YOU LEAVE THE PAD', s: 0.13, c: '#ff8a5a' }]);

  // ---- the habitats: three cylinders under one berm, their west ends out of it ----
  const HZ = [-9, -3, 3], HY = 2.0, HR = 2.25, BH = 3.8;
  for (const z of HZ) {
    k.cyl('panel', 47, HY, z, HR, 14, RS, { axis: 'x', col: HAB, capBottom: false });
    k.cyl('panel', 39.65, HY, z, 1.75, 0.7, RS, { axis: 'x', r2: HR, col: HAB });                 // the dished west end
    for (const x of [40.1, 43.4]) k.cyl('steelDark', x, HY, z, HR + 0.04, 0.16, RS, { axis: 'x' });
    for (const x of [40.9, 42.6]) { B('steelDark', x, 0.3, z, 0.5, 0.9, 3.4, null, 0.04); S.guy([x, 0.6, z + 1.7], x, z + 2.55, 0.02); S.guy([x, 0.6, z - 1.7], x, z - 2.55, 0.02); }   // saddles, pinned down
    pipe('steel', [46, HY + HR - 0.05, z], [46, HY + HR + 1.9, z], 0.02, 4);                       // whip aerial
    B('steelDark', 49, HY + HR + 0.05, z, 0.9, 0.3, 0.9, null, 0.04); cyl('steelDark', 49, HY + HR + 0.4, z, 0.2, 0.5, 8);   // vent
  }
  cyl('panel', 41.7, HY, -3, 0.95, 12, 12, { axis: 'z', col: HAB });                              // the cross-tube that joins them
  S.mound([42.6, -16.4, 60, 10.4], [44, -13.4, 57, 7.4], BH);
  // the outer two: a lit port in each end, a services box, a red-capped fill line
  for (const z of [-9, 3]) {
    cyl('steelDark', 39.28, HY + 0.4, z, 0.36, 0.06, 12, { axis: 'x' }); cyl('glowAmber', 39.24, HY + 0.4, z, 0.27, 0.04, 12, { axis: 'x', col: [0.75, 0.75, 0.75] });
    B('steelDark', 39.0, 0.75, z + 0.9, 0.5, 1.1, 0.7, [0.9, 0.9, 0.95], 0.03); X('glowGreen', 38.74, 1.05, z + 0.9, 0.01, 0.08, 0.3, [0.6, 0.6, 0.6]);
    pipe('pipeRed', [39.0, 1.3, z + 0.9], [39.3, HY + 0.2, z + 1.2], 0.04, 5);
    S.pool(37.4, z, 3.2, [0.9, 0.5, 0.2]);
  }
  // the airlock on the middle one: a vestibule, a dogged hatch facing the pad, a lamp bar, a grated porch with rails to clip on to
  {
    const z = -3;
    B('panel', 38.3, 1.4, z, 2.2, 2.8, 2.7, HAB, 0.08);
    B('hazard', 37.17, 1.2, z, 0.08, 2.3, 1.5, null, 0.03); B('gunmetal', 37.13, 1.2, z, 0.06, 2.1, 1.3, [1.5, 1.5, 1.55], 0.04);
    cyl('steel', 37.08, 1.25, z + 0.35, 0.16, 0.05, 10, { axis: 'x' }); pipe('steel', [37.06, 1.25, z + 0.2], [37.06, 1.25, z + 0.5], 0.02, 4);      // the hand wheel
    X('glowCool', 37.09, 1.75, z - 0.25, 0.012, 0.26, 0.26, [0.7, 0.7, 0.7]);                     // the hatch port
    X('glowWhite', 37.14, 2.62, z, 0.06, 0.08, 1.8); B('steelDark', 37.1, 2.7, z, 0.2, 0.08, 2.0, null, 0.02);
    X('glowGreen', 37.16, 2.1, z + 1.0, 0.02, 0.12, 0.12); X('glowAmber', 37.16, 1.9, z + 1.0, 0.02, 0.12, 0.12, [0.5, 0.5, 0.5]);
    B('plasticDark', 37.15, 1.3, z - 1.05, 0.06, 0.5, 0.36, null, 0.02); X('glowCyan', 37.11, 1.36, z - 1.05, 0.01, 0.2, 0.26, [0.6, 0.6, 0.6]);   // the lock's panel
    X('metal', 35.4, 0.07, z, 3.5, 0.06, 3.0, [0.5, 0.52, 0.56]);                                 // the porch grating
    for (let x = 33.9; x < 37; x += 0.5) X('steelDark', x, 0.105, z, 0.05, 0.015, 3.0);
    S.tether([[33.3, z - 1.6], [37.0, z - 1.6]]); S.tether([[33.3, z + 1.6], [37.0, z + 1.6]]);
    B('steelDark', 36.6, 0.55, z + 2.1, 0.8, 1.0, 0.5, [0.9, 0.9, 0.95], 0.03); for (let i = 0; i < 3; i++) cyl('white', 36.35 + i * 0.25, 1.25, z + 2.1, 0.09, 0.4, 6);   // the suit-service post: spare packs on charge
    S.pool(35.4, z, 6.5, [1, 0.95, 0.85]);
    S.box(37.2, z - 1.35, 39.4, z + 1.35, 3);
  }
  for (const z of HZ) S.box(39.3, z - HR, 42.2, z + HR, 4.5);
  S.box(42.6, -16.4, 60, 10.4, 5);
  // on the crown: two radiators edge-on to the Sun, and a work lamp
  for (const z of [-6, 0]) { X('white', 50.5, BH + 1.45, z, 5.2, 2.3, 0.05, WHITE); for (const x of [48.2, 52.8]) cyl('steelDark', x, BH + 0.3, z, 0.05, 0.9, 5); pipe('steelDark', [47.9, BH + 0.32, z], [53.1, BH + 0.32, z], 0.04, 5); }
  // regolith that slid off the berm, and the stake line that marks the buried power cable
  S.heap(41.4, 11.4, 1.8, 0.8); S.heap(61.6, -4, 2.2, 1.0);

  // ---- comms: a guyed lattice mast with a strobe, a dish held on Mars (which hangs near the zenith here), their cabinet ----
  {
    const mx = 37.5, mz = -22.5, top = K.mast(mx, mz, 15, undefined, 0.8);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; S.guy([mx, top - 1.2, mz], mx + Math.cos(a) * 8, mz + Math.sin(a) * 8, 0.018); S.guy([mx, top * 0.55, mz], mx + Math.cos(a) * 5, mz + Math.sin(a) * 5, 0.014); }
    cyl('steelDark', mx, top + 0.5, mz, 0.05, 1.0, 5); S.strobe(mx, top + 1.1, mz);
    for (const [a, y] of [[0.6, top - 2], [2.6, top - 2.6], [4.5, top - 3.4]]) { cyl('white', mx + Math.cos(a) * 0.5, y, mz + Math.sin(a) * 0.5, 0.2, 0.12, 8, { axis: 'x' }); }    // link drums
    X('glowAmber', mx, top * 0.5, mz, 0.14, 0.14, 0.14);
    K.dish(43.5, -23.5, 1.7, 0.31, 1.12, { rim: 'steelDark', pedestal: 2.6 });
    for (let i = 0; i < 3; i++) { const a = i * 2.094; S.guy([43.5, 2.2, -23.5], 43.5 + Math.cos(a) * 2.6, -23.5 + Math.sin(a) * 2.6, 0.014); }
    B('panel', 40.2, 0.9, -25.2, 1.6, 1.7, 1.0, HAB, 0.05); X('glowCyan', 40.2, 1.3, -24.69, 0.5, 0.25, 0.01, [0.6, 0.6, 0.6]); X('steelDark', 40.2, 0.06, -25.2, 2.0, 0.1, 1.4);
    S.cable([[40.2, -24.6], [38.2, -22.9]]); S.cable([[40.9, -24.6], [43.3, -23.9]]); S.cable([[40.2, -24.6], [40.6, -17.4], [41.6, -11.6]]);
    S.box(39.4, -25.7, 41, -24.7, 2); S.box(mx - 0.8, mz - 0.8, mx + 0.8, mz + 0.8, 15); S.box(43.1, -23.9, 43.9, -23.1, 3);
  }

  // ---- the propellant farm: three tanks on saddles (oxygen, oxygen, methane), strapped; the manifold, the pump skid, the run to the pad ----
  {
    const TZ = [16.6, 20.6, 24.6], TX = 46, TR = 1.5, TL = 8, TY = 2.1, BAND = [[0.2, 0.42, 0.75], [0.2, 0.42, 0.75], [0.85, 0.6, 0.15]];
    TZ.forEach((z, i) => {
      k.cyl('white', TX, TY, z, TR, TL, RS, { axis: 'x', capTop: false, capBottom: false });
      k.cyl('white', TX - TL / 2 - 0.35, TY, z, 0.8, 0.7, RS, { axis: 'x', r2: TR }); k.cyl('white', TX + TL / 2 + 0.35, TY, z, TR, 0.7, RS, { axis: 'x', r2: 0.8 });
      k.cyl('paint', TX + 2.9, TY, z, TR + 0.02, 0.7, RS, { axis: 'x', col: BAND[i], capTop: false, capBottom: false });
      for (const sx of [-2.4, 2.4]) {
        B('steelDark', TX + sx, 0.45, z, 0.5, 1.1, 2.7, null, 0.04);
        k.cyl('steelDark', TX + sx, TY, z, TR + 0.035, 0.1, RS, { axis: 'x', capTop: false, capBottom: false });
        S.guy([TX + sx, 0.9, z + 1.35], TX + sx, z + 1.9, 0.02, 'pipeYellow'); S.guy([TX + sx, 0.9, z - 1.35], TX + sx, z - 1.9, 0.02, 'pipeYellow');
      }
      cyl('steelDark', TX - 1, TY + TR + 0.12, z, 0.16, 0.3, 8); pipe('steelDark', [TX - 1, TY + TR + 0.25, z], [TX - 1, TY + TR + 0.25, z + 0.5], 0.04, 5);     // relief valve
      const key = i < 2 ? 'pipeBlue' : 'pipeYellow', mxx = i < 2 ? 40.5 : 40.9;
      pipe(key, [TX - TL / 2 - 0.7, TY, z], [mxx, TY, z], 0.08, 6); pipe(key, [mxx, TY, z], [mxx, 0.55, z], 0.08, 6); B('pipeRed', mxx, 1.2, z, 0.3, 0.3, 0.3, null, 0.04);
    });
    pipe('pipeBlue', [40.5, 0.55, 15.6], [40.5, 0.55, 21.4], 0.09, 6); pipe('pipeYellow', [40.9, 0.4, 21.5], [40.9, 0.4, 25.2], 0.09, 6);
    // the pump skid, and its panel a worker stands at
    B('steelDark', 38.2, 0.12, 22.4, 2.4, 0.2, 1.7, null, 0.03); B('panel', 38.5, 0.95, 22.7, 1.2, 1.5, 0.9, HAB, 0.05); cyl('steel', 37.6, 0.6, 22.2, 0.3, 0.8, 10, { axis: 'x' }); cyl('pipeBlue', 37.6, 0.6, 22.2, 0.36, 0.1, 10, { axis: 'x' });
    B('plasticDark', 38.5, 1.3, 22.22, 0.8, 0.5, 0.06, null, 0.02); X('glowCyan', 38.5, 1.34, 22.185, 0.6, 0.3, 0.01, [0.6, 0.6, 0.6]); X('glowGreen', 38.2, 1.02, 22.185, 0.06, 0.06, 0.01); X('glowAmber', 38.35, 1.02, 22.185, 0.06, 0.06, 0.01);
    pipe('pipeBlue', [40.5, 0.55, 21.4], [39.2, 0.55, 22.2], 0.09, 6); pipe('pipeYellow', [40.9, 0.4, 22.6], [39.4, 0.4, 22.9], 0.09, 6);
    for (const [ax, az] of [[37.3, 23.6], [39.2, 23.6], [37.3, 21.4]]) S.pile(ax, az);
    // the run: two lines side by side on sleepers, each sleeper on a pile, to the hydrant at the pad's edge
    const RUN = [[37.2, 22.0], [33.4, 20.6], [29.6, 16.4]];
    for (let i = 0; i < RUN.length - 1; i++) {
      const [ax, az] = RUN[i], [bx, bz] = RUN[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L * 0.14, nz = (bx - ax) / L * 0.14;
      pipe('pipeBlue', [ax + nx, 0.36, az + nz], [bx + nx, 0.36, bz + nz], 0.07, 6); pipe('pipeYellow', [ax - nx, 0.36, az - nz], [bx - nx, 0.36, bz - nz], 0.07, 6);
      const n = Math.round(L / 1.9);
      for (let j = 0; j <= n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n; S.at(x, z, Math.atan2(-(bz - az), bx - ax), () => { B('steelDark', 0, 0.14, 0, 0.16, 0.28, 0.7, null, 0.02); X('hazard', 0, 0.45, 0, 0.1, 0.04, 0.5); }); if (j % 2 === 0) S.pile(x + nx * 3.4, z + nz * 3.4); }
    }
    S.at(29.2, 15.9, 0.84, () => {
      B('hazard', 0, 0.6, 0, 1.3, 1.2, 0.9, null, 0.05); B('plasticDark', -0.66, 0.85, 0, 0.04, 0.5, 0.6, null, 0.01); X('glowCyan', -0.685, 0.9, 0, 0.01, 0.26, 0.4, [0.6, 0.6, 0.6]);
      cyl('rubber', 0, 1.55, 0, 0.42, 0.34, 14, { axis: 'z' }); cyl('steelDark', 0, 1.55, 0, 0.5, 0.05, 14, { axis: 'z' }); cyl('steelDark', 0, 1.55, 0.2, 0.5, 0.04, 14, { axis: 'z' }); cyl('steelDark', 0, 1.55, -0.2, 0.5, 0.04, 14, { axis: 'z' });
      cyl('steelDark', 0.45, 1.45, 0.3, 0.035, 1.3, 5); X('glowAmber', 0.45, 2.14, 0.3, 0.16, 0.1, 0.16);
      pipe('rubber', [-0.2, 1.15, 0.2], [-1.1, 0.1, 0.5], 0.05, 5); pipe('rubber', [-1.1, 0.1, 0.5], [-2.2, 0.08, -0.1], 0.05, 5); cyl('steel', -2.3, 0.1, -0.15, 0.08, 0.3, 6, { axis: 'x' });   // the hose, laid out toward the pad
    });
    for (const [dx, dz] of [[0.9, 0.9], [0.9, -0.9]]) S.guy([29.2, 0.9, 15.9], 29.2 + dx, 15.9 + dz, 0.016, 'pipeYellow');
    S.pool(29.4, 16.2, 4.5, [1, 0.6, 0.2]);
    S.sign(39.3, 3.9, 18.6, 3.0, 1.0, -Math.PI / 2, [{ t: 'PROPELLANT', s: 0.3, c: '#f4c64a' }, { t: 'OXYGEN · METHANE · NO HOT WORK', s: 0.13 }]);
    S.lamp(39.4, 26.6, 5.5, 'glowWhite', 11);
    S.tether([[36.6, 1.6], [36.2, 12], [37.0, 20.4]]);
    S.box(40.2, 14.9, 51.2, 26.3, 4); S.box(37.3, 21.5, 39.3, 23.3, 2); S.box(28.5, 15.3, 29.9, 16.6, 2);

    // the regolith oven behind the farm: a feed hopper, the retort, its stack and radiator, the lines to the tanks; spoil beside it
    B('panel', 55.2, 1.3, 18.6, 3.0, 2.6, 2.6, HAB, 0.08); cyl('steelDark', 55.2, 3.1, 18.6, 0.9, 1.0, 12, { r2: 1.3 }); cyl('steel', 56.2, 3.6, 19.4, 0.16, 2.0, 8);
    X('white', 55.2, 3.3, 16.9, 2.8, 1.5, 0.05, WHITE); for (const x of [54.1, 56.3]) cyl('steelDark', x, 2.75, 16.95, 0.04, 0.5, 5);
    X('glowAmber', 53.69, 1.5, 18.6, 0.01, 0.2, 1.0, [0.6, 0.6, 0.6]); X('steelDark', 55.2, 0.06, 18.6, 3.6, 0.1, 3.2);
    pipe('pipeBlue', [53.7, 0.7, 18.2], [51.2, 0.7, 18.2], 0.07, 6); pipe('pipeBlue', [51.2, 0.7, 18.2], [50.7, TY, 18.6], 0.07, 6); pipe('pipeYellow', [53.7, 0.5, 19.2], [51.4, 0.5, 23.4], 0.07, 6); pipe('pipeYellow', [51.4, 0.5, 23.4], [50.7, TY, 24.6], 0.07, 6);
    for (const [dx, dz] of [[-1.9, -1.7], [1.9, -1.7], [-1.9, 1.7], [1.9, 1.7]]) S.guy([55.2 + dx * 0.78, 1.6, 18.6 + dz * 0.76], 55.2 + dx * 1.25, 18.6 + dz * 1.3, 0.018);
    S.heap(56.4, 25.2, 3.2, 1.7); S.heap(53.2, 27.4, 1.8, 0.9);
    S.box(53.6, 17.2, 56.8, 20, 4);
    // the digger that feeds it: two counter-turning bucket drums on arms (the only way to dig where a blade would lift the machine)
    S.at(53.6, 23.3, 0.5, () => {
      B('white', 0, 0.55, 0, 1.2, 0.4, 0.8, null, 0.05); B('steelDark', 0, 0.8, 0, 0.7, 0.14, 0.5, null, 0.02); X('glowAmber', 0.2, 0.9, 0, 0.1, 0.06, 0.1);
      for (const sx of [-1, 1]) { pipe('steelDark', [sx * 0.5, 0.55, 0.36], [sx * 1.15, 0.32, 0.36], 0.04, 5); pipe('steelDark', [sx * 0.5, 0.55, -0.36], [sx * 1.15, 0.32, -0.36], 0.04, 5); cyl('steel', sx * 1.15, 0.32, 0, 0.3, 0.9, 12, { axis: 'z' }); for (let i = 0; i < 6; i++) { const a = i * 1.047; X('steelDark', sx * 1.15 + Math.cos(a) * 0.3, 0.32 + Math.sin(a) * 0.3, 0, 0.07, 0.07, 0.86); } }
      for (const sx of [-0.4, 0.4]) for (const sz of [-1, 1]) cyl('rubber', sx, 0.24, sz * 0.48, 0.24, 0.14, 10, { axis: 'z' });
    });
  }

  // ---- the solar field: two rows of four wings, leaning north toward the Sun's path, and the cable back to the station ----
  S.solarRow([-17, -8.5, 0, 8.5], 43.5, 7, 3.2, Math.PI, 1.15);
  S.solarRow([-17, -8.5, 0, 8.5], 51, 7, 3.2, Math.PI, 1.15);
  B('panel', 14.2, 0.7, 47.2, 1.2, 1.3, 0.9, HAB, 0.04); X('glowGreen', 13.59, 1.0, 47.2, 0.01, 0.08, 0.3, [0.6, 0.6, 0.6]); X('steelDark', 14.2, 0.05, 47.2, 1.6, 0.08, 1.3);
  S.cable([[13, 44], [14.2, 46.7]]); S.cable([[13, 51.5], [14.2, 47.7]]);
  S.cable([[14.8, 47.2], [27, 37], [35, 28.4], [36.4, 14], [38.4, 8.4], [41.2, 6.2]], 0.045);
  for (const [x, z] of [[20.9, 42.1], [31, 32.7], [35.7, 21.2], [37.4, 11.2]]) { cyl('hazard', x + 0.3, G(x, z) + 0.3, z, 0.02, 0.6, 4); X('hazard', x + 0.3, G(x, z) + 0.62, z, 0.2, 0.12, 0.01); }
  S.lamp(-21.5, 47.2, 4.5, 'glowWhite', 8);
  S.box(13.6, 46.7, 14.8, 47.7, 1.5);

  // ---- the cargo yard: lashed containers (one stacked), a netted crate pile, drums; the hopper parked beside the tether line ----
  S.container(8.2, -44.2, 0, [0.62, 0.3, 0.2]); S.container(8.2, -44.2, 0, [0.72, 0.72, 0.7], 2.4);
  S.container(15, -44.6, 0.05, [0.24, 0.36, 0.5]);
  S.container(11, -50.4, -0.04, [0.7, 0.55, 0.2]); S.container(18.4, -50, 0.03, [0.62, 0.3, 0.2]);
  S.cratePile(22.4, -41.6, 0.2, [[-1, -0.4, 1.3, 1.1, 1.2, 'crateA'], [0.4, -0.5, 1.2, 0.9, 1.1, 'crateB'], [1.25, 0.5, 0.8, 0.8, 0.8, 'crateC'], [-0.2, 0.65, 1.4, 0.7, 0.9, 'crateC'], [-0.9, -0.4, 1.0, 0.7, 0.9, 'crateB', 1.1], [0.4, -0.5, 0.9, 0.6, 0.8, 'crateA', 0.9]], 3.6, 1.85, 2.6);
  S.bottles(4.6, -40.2, 0.3, 5); S.bottles(4.2, -41.6, 0.3, 5, 'pipeYellow');
  for (const [x, z] of [[3.5, -40.6], [5.6, -41.2]]) S.pile(x, z);
  S.sign(12, 3.2, -39.6, 3.2, 1.0, 0, [{ t: 'CARGO YARD', s: 0.3, c: '#f4c64a' }, { t: 'LASH IT OR LOSE IT · 0.006 m/s²', s: 0.13 }]);
  S.lamp(1.4, -44.5, 6, 'glowWhite', 12); S.lamp(25.6, -47, 6, 'glowWhite', 12);
  S.hopper(28.6, -31.4, 0.75);
  S.tether([[35.6, -6.2], [31.2, -22], [23, -33.4], [14.4, -37.4]]);
  // a hand cart on the yard's side of the pad: a flat bed with a push bar, clipped to the line
  S.at(18.2, -35.4, 0.45, () => {
    B('steelDark', 0, 0.42, 0, 1.8, 0.08, 1.0, [1.2, 1.2, 1.25], 0.02); for (const sx of [-0.7, 0.7]) for (const sz of [-0.55, 0.55]) cyl('rubber', sx, 0.2, sz, 0.2, 0.1, 10, { axis: 'z' });
    pipe('steel', [-0.9, 0.45, -0.4], [-1.1, 1.1, -0.4], 0.025, 4); pipe('steel', [-0.9, 0.45, 0.4], [-1.1, 1.1, 0.4], 0.025, 4); pipe('steel', [-1.1, 1.1, -0.4], [-1.1, 1.1, 0.4], 0.025, 4);
    B('crateC', 0.2, 0.75, 0, 0.9, 0.6, 0.7, null, 0.03); X('hazard', 0.2, 0.75, 0, 0.07, 0.62, 0.72);
  });

  // ---- the people: one at the pump panel, one checking lashings in the yard, one walking the tether line between airlock and yard ----
  S.person({ body: 'jorge', x: 38.5, z: 21.4, face: 0, cloth: 0xd9772b });
  S.person({ body: 'ada', x: 14.8, z: -42.4, face: Math.PI, cloth: 0xc9b04a });
  S.person({ body: 'isaiah', x: 34.6, z: -6.6, face: Math.PI, cloth: 0x3f6f9a, path: [[34.6, -6.6], [30.3, -21.8], [22.4, -32.4], [15.2, -36.2]], pause: 12 });

  return S.finish();
}

function dress(world, { engine }) {
  return build({ engine, world, space: world.space, tier: world.tier });
}

export default { dress };

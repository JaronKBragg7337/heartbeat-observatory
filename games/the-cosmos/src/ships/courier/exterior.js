// ============================================================================
// ships/courier/exterior.js - the Wayfarer from outside: a sealed, plated box hull round the rooms of def.js.
//
// SEALED (11/26). The first version was separate boxes (a floor slab, two roof slabs with a gap, side plates with 10 cm gaps, a bridge
// with no outer skin): from outside you saw the sky through the ship and the door frames inside it standing in the dark. Now every face
// of the hull is closed and the only ways in for the eye are the real openings: the flight deck's glass, the stern bay (the boarding
// ramp is its door) and the starboard hatch (the gangway flap and the outer airlock door close it).
//
// How it is built: a dark backing skin (one box per face, overlapping at every corner so no crack can open) with plates in the hull's
// paint set 3 cm proud of it and 4 cm apart, so the seams are the backing showing through. Cargo pods ride on the lower flanks in clamps.
// The flight deck sits lower and narrower than the body (its roof is a visor over the windscreen), the nose is a wedge under the sill
// with the chin guns through it, and the stern has two engine housings either side of the bay and a hood that the raised ramp stands in.
//
// The room boxes (def.js) are: bridge x +-2.4, z -9..-5.2, h 2.7; the body x +-3.4, z -4.8..10.6 (the hold h 3). The skin stands outside
// all of them, so nothing here changes what is walkable. Collision (def.hull.push) is unchanged.
// ============================================================================
import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { COURIER } from './def.js';

// The hull's outer lines (ship metres: x starboard, y up from the deck, z aft).
const W = 3.66, WI = 3.54;                 // body flank outer / inner face (the airlock's outer door leaf lives at x 3.47..3.53)
const YB = -0.55, YT = 3.45;               // belly underside / body roof top
const ZF = -5.35, ZA = 10.85;              // body front bulkhead / stern face (outer)
const BW = 2.55, BI = 2.4;                 // flight deck skin outer / room wall (the side glass is in this plane)
const BZ0 = -9.05, SILL = 1.05, BROOF = 2.98;
const NOSE = -10.0;
const HATCH = { z0: 0.73, z1: 2.07, y1: 2.28 };   // starboard airlock opening (the door frame lines it, the gangway flap closes it)
const RAMP_HW = 1.32;                      // half width of the stern bay mouth (the ramp is 2.6 wide)

export function buildCourierExterior(layout, mats, opts = {}) {
  const root = new THREE.Group(), k = new Kit(); root.name = 'wayfarer-hull'; k.tiles = { hull: 8, metal: 1 };     // hullDark keeps the default 1 m tile: its texture is set for that (shipTextures.js)
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], triangles: 0, airlockX: 3.6 };
  const paint = [0.8, 0.76, 0.66], paintB = [0.74, 0.7, 0.6], paintC = [0.84, 0.8, 0.71];
  const tone = (i, j) => [paint, paintB, paintC][(i * 7 + j * 3) % 3];
  const bx = (key, x0, y0, z0, x1, y1, z1, o) => k.boxMM(key, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), o);

  // ---------------------------------------------------------------------------------------------------------------- the backing skin
  // belly: body and flight deck (the top faces sit 3 cm under the deck, never seen)
  bx('hullDark', -W, YB, ZF, W, -0.03, 10.6);
  for (const s of [-1, 1]) bx('hullDark', s * RAMP_HW, YB, 10.6, s * W, -0.03, ZA);   // (the lowered ramp's root swings through the mouth's sill)
  bx('hullDark', -BW, YB, BZ0, BW, -0.03, ZF + 0.02);
  // body roof: the whole body, except the bay mouth's last 40 cm, where the raised ramp stands
  bx('hullDark', -W, 3.05, ZF, W, YT, 10.45);
  for (const s of [-1, 1]) bx('hullDark', s * RAMP_HW, 3.05, 10.4, s * W, YT, ZA);
  // flanks (port whole; starboard round the hatch)
  for (const s of [-1, 1]) {
    if (s < 0) { bx('hullDark', -W, YB, ZF, -WI, YT, ZA); continue; }
    bx('hullDark', WI, YB, ZF, W, YT, HATCH.z0);
    bx('hullDark', WI, YB, HATCH.z1, W, YT, ZA);
    bx('hullDark', 3.5, YB, HATCH.z0, W, 0, HATCH.z1);            // the sill (it fills the 4 cm slot beside the threshold plate)
    bx('hullDark', WI, HATCH.y1, HATCH.z0, W, YT, HATCH.z1);      // the lintel
  }
  // front bulkhead of the body: either side of the flight deck, and above its roof
  const inner = (s) => ({ skip: s > 0 ? '-x' : '+x' });   // a face in the flight deck's own wall plane is left to the room (no two faces in one plane)
  for (const s of [-1, 1]) bx('hullDark', s * BI, YB, ZF, s * W, YT, -5.2, inner(s));
  bx('hullDark', -BI, BROOF - 0.04, ZF, BI, YT, -5.2);
  // stern face either side of the bay mouth, and the sill under it
  for (const s of [-1, 1]) bx('hullDark', s * RAMP_HW, YB, 10.7, s * W, YT, ZA);
  bx('hullDark', -RAMP_HW, YB, 10.6, RAMP_HW, -0.3, 10.8);
  // the header over the bay mouth (between the hold's ceiling and the roof), forward of the raised ramp
  bx('hullDark', -RAMP_HW, 2.98, 10.38, RAMP_HW, YT, 10.5);
  // flight deck: the lower side skins under the side glass, the roof (a visor over the windscreen), and the pillars aft of the side glass
  for (const s of [-1, 1]) {
    bx('hullDark', s * BI, YB, BZ0, s * BW, SILL, ZF + 0.02, inner(s));
    bx('hullDark', s * BI, SILL - 0.02, -5.62, s * BW, BROOF, ZF + 0.02, inner(s));
  }
  bx('hullDark', -BW, 2.72, BZ0, BW, BROOF, ZF + 0.02);

  // the nose: a wedge from the windscreen's foot to a blunt prow, the chin guns through it
  {
    const a = [[BW, YB], [BW, SILL], [-BW, SILL], [-BW, YB]].map(([x, y]) => [x, y, BZ0]);
    const b = [[1.35, 0.05], [1.35, 0.78], [-1.35, 0.78], [-1.35, 0.05]].map(([x, y]) => [x, y, NOSE]);
    const quad = (p, n, key = 'hullDark') => k._faceQuad(key, p, n);
    quad([a[1], a[2], b[2], b[1]], [0, 1, 0.3]);                   // top deck in front of the glass
    quad([a[0], b[0], b[3], a[3]], [0, -1, -0.5]);                 // underside sweeping up to the prow
    quad([a[0], a[1], b[1], b[0]], [1, 0, -0.4]);
    quad([a[3], b[3], b[2], a[2]], [-1, 0, -0.4]);
    quad([b[0], b[1], b[2], b[3]], [0, 0, -1]);                    // the prow
  }

  // ---------------------------------------------------------------------------------------------------------------- plates (the paint)
  // 3 cm proud of the backing, 4 cm apart: the seams are the dark backing showing through.
  const G = 0.02, T = 0.03;
  const flankPlates = (s, z0, z1, y0, y1, pitch, row) => {
    const n = Math.max(1, Math.round((z1 - z0) / pitch)), L = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const a = z0 + i * L + G, b = z0 + (i + 1) * L - G;
      bx('hull', s * W, y0 + G, a, s * (W + T), y1 - G, b, { col: tone(i, row + (s > 0 ? 1 : 0)) });
    }
  };
  for (const s of [-1, 1]) {
    const spans = s < 0 ? [[ZF, ZA]] : [[ZF, HATCH.z0 - 0.12], [HATCH.z1 + 0.12, ZA]];
    for (const [z0, z1] of spans) {
      flankPlates(s, z0, z1, YB, 0.25, 2.2, 0);                     // the keel band
      flankPlates(s, z0, z1, 0.25, 1.85, 1.6, 1);                   // behind the pods
      flankPlates(s, z0, z1, 1.85, YT, 1.6, 2);                     // the upper flank
    }
  }
  // hatch surround on the starboard flank: a raised frame in the dark finish, a green "pressure good" lamp, two grab rails
  {
    const x = W, zc = (HATCH.z0 + HATCH.z1) / 2;
    // (the raised gangway flap stands x 3.55..3.71, y 0..2.5 in the opening: the frame is round it, not on it)
    bx('gunmetal', x, -0.05, HATCH.z0 - 0.12, x + 0.07, 2.64, HATCH.z0 - 0.01);
    bx('gunmetal', x, -0.05, HATCH.z1 + 0.01, x + 0.07, 2.64, HATCH.z1 + 0.12);
    bx('gunmetal', x, 2.52, HATCH.z0 - 0.01, x + 0.07, 2.64, HATCH.z1 + 0.01);
    k.box('glowGreen', x + 0.075, 2.74, zc, 0.02, 0.08, 0.5);
    bx('hull', x, 2.66, HATCH.z0 - 0.12, x + T, YT - G, HATCH.z1 + 0.12, { col: paintB });     // the plate over it
    for (const z of [HATCH.z0 - 0.22, HATCH.z1 + 0.22]) k.pipe('steel', [x + 0.08, 0.5, z], [x + 0.08, 1.8, z], 0.025, 6);
    for (const z of [HATCH.z0 - 0.22, HATCH.z1 + 0.22]) for (const y of [0.5, 1.8]) k.box('steelDark', x + 0.04, y, z, 0.08, 0.05, 0.05);
  }
  // roof plates, a walkway down the spine, a beacon and two antennae
  {
    const n = 10, L = (10.4 - ZF) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
      const x0 = -W + j * (2 * W / 3) + G, x1 = -W + (j + 1) * (2 * W / 3) - G;
      bx('hull', x0, YT, ZF + i * L + G, x1, YT + T, ZF + (i + 1) * L - G, { col: tone(i, j + 5) });
    }
    for (let z = -4.6; z < 9.8; z += 0.6) k.box('metal', 0, YT + T + 0.01, z, 1.0, 0.02, 0.5, { col: [0.3, 0.29, 0.27] });
    k.cyl('steelDark', 1.6, YT + 0.1, -3.6, 0.22, 0.14, 12); k.box('glowRed', 1.6, YT + 0.22, -3.6, 0.12, 0.1, 0.12);
    k.pipe('steel', [-1.9, YT, 2], [-1.9, YT + 1.1, 2], 0.025, 6); k.pipe('steel', [-2.3, YT, 2.4], [-2.3, YT + 0.7, 2.4], 0.02, 6);
    k.box('glowWhite', -1.9, YT + 1.13, 2, 0.06, 0.06, 0.06);
  }
  // front bulkhead and flight deck plates
  for (const s of [-1, 1]) {
    bx('hull', s * (BW + G), YB + G, ZF - T, s * (W - G), YT - G, ZF, { col: paintB });
    bx('hull', s * BW, YB + G, BZ0 + G, s * (BW + T), SILL - 0.06, ZF - G, { col: paint });
  }
  bx('hull', -BW + G, BROOF, BZ0 + G, BW - G, BROOF + T, ZF - G, { col: paintC });
  bx('hull', -BI + G, BROOF + 0.06, ZF - T, BI - G, YT - G, ZF, { col: paint });
  // stern plates either side of the bay, and a bumper round the mouth
  for (const s of [-1, 1]) {
    bx('hull', s * (RAMP_HW + 0.3), YB + G, ZA, s * (W - G), YT - G, ZA + T, { col: paintB });
    bx('gunmetal', s * RAMP_HW, -0.2, 10.7, s * (RAMP_HW + 0.3), YT, ZA + 0.06);
    k.box('hazard', s * (RAMP_HW + 0.15), 1.4, ZA + 0.065, 0.12, 2.2, 0.01);
  }

  // ---------------------------------------------------------------------------------------------------------------- glass frame
  // The glass itself is the flight deck's own (the ship system draws it for the player; other players' copies get theirs below).
  {
    const zt = -8.5, fr = 'gunmetal';
    bx(fr, -BW, SILL - 0.05, BZ0, BW, SILL + 0.05, -8.96);                       // sill under the windscreen
    bx(fr, -BW, 2.66, -8.58, BW, 2.76, -8.42);                                     // header over it, under the visor
    for (const x of [-0.85, 0.85]) k.pipe(fr, [x, SILL, -9.0], [x, 2.68, zt], 0.035, 8);
    for (const s of [-1, 1]) {
      k.pipe(fr, [s * BI, SILL, -9.0], [s * BI, 2.68, zt], 0.05, 8);            // the corner posts
      bx(fr, s * (BI - 0.02), SILL - 0.05, -9.0, s * (BW + 0.02), SILL + 0.05, -5.6);   // side sills
      bx(fr, s * (BI - 0.02), 2.66, -9.0, s * (BW + 0.02), 2.76, -5.6);             // side headers (they close the 2 cm under the visor)
      k.pipe(fr, [s * (BI + 0.03), SILL, -7.3], [s * (BI + 0.03), 2.7, -7.3], 0.03, 8);   // a mullion in the side window
      k.box('glowWhite', s * 1.6, 0.62, NOSE - 0.005, 0.32, 0.12, 0.01);            // landing lights in the prow
      k.box(s > 0 ? 'glowGreen' : 'glowRed', s * (BW + 0.035), 0.6, -8.6, 0.02, 0.1, 0.22);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- cargo pods
  // Clamped onto the lower flanks between the legs: a pod, two straps round it, a label plate. (Not on the hatch or the bridge.)
  {
    const podCols = [[0.66, 0.58, 0.44], [0.55, 0.6, 0.52], [0.7, 0.62, 0.46], [0.5, 0.55, 0.6]];
    let n = 0;
    for (const s of [-1, 1]) for (let z = -3.9; z < 9.6; z += 1.3) {
      if (s > 0 && z > HATCH.z0 - 1.0 && z < HATCH.z1 + 0.7) continue;
      const x = s * (W + T + 0.17), c = podCols[(n++ * 5) % 4];
      k.bevelBox('hull', x, 0.98, z, 0.34, 1.36, 1.12, 0.05, { col: c });
      for (const dz of [-0.36, 0.36]) {
        bx('gunmetal', s * (W + T), 0.28, z + dz - 0.05, s * (W + T + 0.37), 1.68, z + dz + 0.05);
        k.cyl('steel', s * (W + T + 0.38), 1.6, z + dz, 0.03, 0.03, 6, { axis: 'x' });
      }
      bx('metal', s * (W + T + 0.34), 1.05, z - 0.18, s * (W + T + 0.35), 1.35, z + 0.18, { col: [0.22, 0.2, 0.17] });
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- skirts, engines, guns
  for (const s of [-1, 1]) {
    k.prism('hull', [[s * BW, -9], [s * 3.5, -5.1], [s * 4.5, 6], [s * 3.6, 9]], 0.1, 0.45, 0.08, 0.08);
    // engine housings either side of the bay: a dark nacelle reaching into the stern, the bell behind it
    k.bevelBox('hullDark', s * 2.6, 1.4, 11.25, 1.9, 2.5, 1.0, 0.12);
    bx('hull', s * 1.68, 2.62, 10.85, s * 3.52, 2.7, 11.7, { col: paintB });
    k.cyl('engine', s * 2.6, 1.4, 11.9, 0.65, 0.5, 16, { axis: 'z' });
    k.lathe('metal', s * 2.6, 1.4, 12.1, [[0.5, 0], [0.65, 0.4], [0.75, 0.8], [0.65, 0.8], [0.45, 0]], 16, { axis: 'z' });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3, 12, 1, true), mats.engineGlow.clone());
    flame.rotation.x = -Math.PI / 2; flame.position.set(s * 2.6, 1.4, 14); flame.name = 'exhaust'; root.add(flame);
    const core = flame.clone(); core.material = mats.nozzleInner.clone(); root.add(core); ext.engines.push({ outer: flame, core, side: s });
    k.bevelBox('gunmetal', s * 4.25, 0.5, 6, 0.3, 0.1, 0.4, 0.02); k.box(s === 1 ? 'glowGreen' : 'glowRed', s * 4.25, 0.58, 6, 0.18, 0.06, 0.26);   // nav light: a lens in a housing on the skirt
    // chin gun: a barrel through the prow in a collar
    k.cyl('gunmetal', s, 0.5, NOSE - 0.03, 0.13, 0.08, 12, { axis: 'z' });
    const gun = new THREE.Group(); gun.position.set(s, 0.5, -9.5); const gk = new Kit(); gk.cyl('gunmetal', 0, 0, -0.5, 0.08, 1, 10, { axis: 'z' });
    gun.add(gk.toGroup(mats)); root.add(gun); ext.guns.main.push({ group: gun, muzzle: new THREE.Vector3(0, 0, -1) });
  }
  // the hood the raised ramp stands in (the ramp is 4 m; the roof is at 3.45): open aft and below, so the ramp swings clear
  bx('hullDark', -RAMP_HW - 0.24, 4.04, 10.3, RAMP_HW + 0.24, 4.2, 10.95);
  for (const s of [-1, 1]) bx('hullDark', s * (RAMP_HW - 0.01), YT, 10.3, s * (RAMP_HW + 0.24), 4.2, 10.95);
  k.box('glowAmber', 0, 4.03, 10.9, 1.6, 0.03, 0.06);
  // lift pods under the belly
  for (const [x, z] of [[-2, -3], [2, -3], [-2, 7], [2, 7]]) {
    k.cyl('engine', x, -0.65, z, 0.5, 0.3, 12); const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 10, 1, true), mats.engineGlow.clone());
    mesh.position.set(x, -2.2, z); mesh.name = 'exhaust'; root.add(mesh); const core = mesh.clone(); root.add(core);
    ext.liftPods.push({ x, y: -0.8, z, mesh, core });
  }
  ext.staticGroup = k.toGroup(mats, { name: 'courier-plates', cast: true, receive: true }); root.add(ext.staticGroup); ext.triangles = k.triangles;

  // ---------------------------------------------------------------------------------------------------------------- legs and ramps
  for (const leg of COURIER.gear.legs) {
    const group = new THREE.Group(); group.position.set(leg.x, 0, leg.z);
    const pk = new Kit(); pk.cyl('metal', 0, -0.5, 0, 0.15, 1, 12); const piston = new THREE.Group(); piston.add(pk.toGroup(mats)); group.add(piston);
    const fk = new Kit(); fk.bevelBox('gunmetal', 0, -0.13, 0, 1.3, 0.25, 1.1, 0.05); const foot = fk.toGroup(mats, { cast: true }); group.add(foot); root.add(group);
    ext.legs.push({ ...leg, group, piston, foot });
  }
  for (const [key, R] of Object.entries(COURIER.ramps)) {
    const hinge = new THREE.Group(); hinge.position.set(R.hinge.x, R.hinge.y, R.hinge.z); const rk = new Kit();
    rk.bevelBox('hullDark', 0, -0.08, R.length / 2, R.width, 0.16, R.length, 0.04);
    for (let z = 0.2; z < R.length; z += 0.3) rk.box('metal', 0, 0.02, z, R.width - 0.12, 0.02, 0.06);
    for (const s of [-1, 1]) rk.box('glowAmber', s * (R.width / 2 - 0.04), 0.05, R.length / 2, 0.04, 0.02, R.length - 0.2);
    const mesh = rk.toGroup(mats, { cast: true, receive: true }); hinge.add(mesh); root.add(hinge); ext.ramps[key] = { hinge, mesh, def: R };
  }
  // Other players' copies have no flight deck glass of their own (the ship system adds it only to the ship you are in): theirs is here.
  if (opts.remote) {
    const gk = new Kit(), b = layout.roomById.get('bridge');
    gk.poly('glassTint', [[b.x0, SILL, b.z0], [b.x1, SILL, b.z0], [b.x1, 2.7, b.z0 + 0.5], [b.x0, 2.7, b.z0 + 0.5]]);
    gk.poly('glassTint', [[b.x1, SILL, b.z0], [b.x1, SILL, b.z1 - 0.4], [b.x1, 2.7, b.z1 - 0.4], [b.x1, 2.7, b.z0]]);
    gk.poly('glassTint', [[b.x0, SILL, b.z1 - 0.4], [b.x0, SILL, b.z0], [b.x0, 2.7, b.z0], [b.x0, 2.7, b.z1 - 0.4]]);
    root.add(gk.toGroup(mats)); ext.remoteGlass = true;
  }
  return ext;
}
export function courierNeutral(ext) {
  for (const l of ext.legs) { l.foot.position.y = -1.6; l.piston.scale.y = 1.8; l.piston.position.y = 0.2; }
  ext.ramps.cargo.hinge.rotation.x = -Math.PI / 2; ext.ramps.airlock.hinge.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
}

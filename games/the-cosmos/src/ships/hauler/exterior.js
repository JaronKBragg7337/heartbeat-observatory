// ============================================================================
// ships/hauler/exterior.js - the Drayman's hull, nacelles, gear, chin gun, ramps and engines.
//
// OWNS: everything you see of a Drayman from outside, and every part that moves: landing legs, the two ramps, the chin gun, engine glow.
// DOES NOT OWN: any interior surface (src/ship/shipInterior.js draws the rooms from spec.js), or how it flies.
//
// Built the way the other classes are: the body is lofted from a table of cross sections (spec.js HULL_STATIONS), then dressed. The look is a
// working freighter: pale plate with a safety-orange belly and nacelles, hazard bands, a roof of cooling fins and hatches, a cargo-door
// frame as tall as the hold, and engines slung on pylons either side of the open stern so the ramp can come straight down between them.
//   ext = { root, legs[], ramps{cargo, airlock}, guns{main[]}, engines[], liftPods[], ... }  (the shape the rest of the game animates)
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { HULL, GEAR, GUNS, RAMPS, LAYOUT, HULL_STATIONS } from './spec.js';

export { HULL_STATIONS };

const ORANGE = [1.0, 0.46, 0.14], WHITE = [1.0, 0.99, 0.96], SLATE = [0.36, 0.38, 0.41], DEEP = [0.2, 0.21, 0.23], PALE = [0.9, 0.9, 0.86];

function hullMesh(mats, low) {
  const dz = low ? 1.6 : 0.8;
  const zs = []; for (let z = HULL.z0; z < HULL.z1 - 1e-6; z += dz) zs.push(z); zs.push(HULL.z1);
  const rings = zs.map((z) => HULL.octagon(z));
  const pos = [], uv = [], col = [];
  const cum = rings.map((P) => { const c = [0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; c.push(c[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return c; });
  const push = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u / 8, v / 8); };
  const hash = (a, b) => { const t = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return t - Math.floor(t); };
  const paint = (f, z) => {
    // the eight faces run round the octagon from the right flank: 0 right wall, 1 right upper chamfer, 2 roof, 3 left upper chamfer, 4 left wall, 5 left lower chamfer, 6 belly, 7 right lower chamfer
    if (f === 6) return DEEP;                                                    // belly: deep slate
    if (f === 5 || f === 7) return SLATE;                                        // lower chamfers
    if ((z > 29.6 && z < 31.4) || (z > -12.4 && z < -11.4)) return ORANGE;       // hazard bands: the cargo door and behind the flight deck
    const h = hash(f, Math.floor((z + 20) / 2.4));
    return h > 0.86 ? [0.8, 0.82, 0.82] : h < 0.1 ? [0.86, 0.8, 0.7] : WHITE;    // pale plate, a few mismatched panels
  };
  for (let i = 0; i < zs.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let f = 0; f < 8; f++) {
      const a0 = A[f], a1 = A[(f + 1) % 8], b0 = B[f], b1 = B[(f + 1) % 8];
      const ua0 = cum[i][f], ua1 = cum[i][f + 1], ub0 = cum[i + 1][f], ub1 = cum[i + 1][f + 1];
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(a1[0], a1[1], zs[i], ua1, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]);
      push(a0[0], a0[1], zs[i], ua0, zs[i]); push(b1[0], b1[1], zs[i + 1], ub1, zs[i + 1]); push(b0[0], b0[1], zs[i + 1], ub0, zs[i + 1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let q = 0; q < nrm.count; q += 6) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 6; i++) { x += nrm.getX(q + i); y += nrm.getY(q + i); z += nrm.getZ(q + i); }
    const l = Math.hypot(x, y, z) || 1;
    for (let i = 0; i < 6; i++) nrm.setXYZ(q + i, x / l, y / l, z / l);
  }
  // colour per quad: which of the eight faces, and which z band
  for (let i = 0; i < zs.length - 1; i++) for (let f = 0; f < 8; f++) {
    const q = (i * 8 + f) * 6, zmid = (zs[i] + zs[i + 1]) / 2;
    const c = paint(f, zmid);
    const m = 0.94 + 0.08 * hash(f * 3 + 1, i);
    for (let k = 0; k < 6; k++) col.push(c[0] * m, c[1] * m, c[2] * m);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, mats.hull);
  mesh.name = 'hull'; mesh.castShadow = true; mesh.receiveShadow = true;

  const caps = new THREE.Group(); caps.name = 'hull-caps';
  const makeCap = (z, facing, hole) => {
    const P = HULL.octagon(z);
    const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p[0], p[1])));
    if (hole) { const h = new THREE.Path(); h.moveTo(hole.x0, hole.y0); h.lineTo(hole.x1, hole.y0); h.lineTo(hole.x1, hole.y1); h.lineTo(hole.x0, hole.y1); h.closePath(); shape.holes.push(h); }
    const g = new THREE.ShapeGeometry(shape);
    if (facing < 0) { const index = g.getIndex(); if (index) { const a = index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } }
    g.translate(0, 0, z); g.computeVertexNormals();
    if (facing < 0) { const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setZ(i, -1); }
    const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 8, u.getY(i) / 8);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.4), 3));
    const m = new THREE.Mesh(g, mats.hull); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const R = RAMPS.cargo;
  caps.add(makeCap(HULL.z1, +1, { x0: -R.width / 2 - 0.1, x1: R.width / 2 + 0.1, y0: 0.0, y1: R.raisedHeight }), makeCap(HULL.z0, -1, null));
  return { mesh, caps };
}

export function buildHaulerExterior(layout, mats, opts = {}) {
  const low = opts.tier === 'low';
  const root = new THREE.Group(); root.name = 'ship-exterior';
  const ext = { root, legs: [], ramps: {}, guns: { main: [] }, engines: [], liftPods: [], nav: [], triangles: 0, airlockX: -5.7, type: 'hauler' };
  const hull = hullMesh(mats, low);
  root.add(hull.mesh, hull.caps);

  const k = new Kit(); k.tiles = { hull: 8, metal: 1 };
  const side = [-1, 1];
  const hw = (z) => HULL.halfWidth(z), top = (z) => HULL.top(z);

  // --- the flight deck: roof plate and raked canopy struts (the glass is added for remote views below)
  const C = LAYOUT.roomById.get('cockpit'), ytop = C.y + C.h, ybase = C.y + 1.05;
  k.prism('hull', [[C.x0 - 0.15, C.z0 + 0.2], [C.x1 + 0.15, C.z0 + 0.2], [C.x1 + 0.15, C.z1], [C.x0 - 0.15, C.z1]], ytop - 0.1, ytop + 0.12, 0.2, 0.1, ORANGE);
  for (const x of [-3.1, -2.1, -1.05, 0, 1.05, 2.1, 3.1]) k.pipe('gunmetal', [x, ybase, C.z0], [x, ytop, C.z0 + 0.55], 0.045, 8);
  for (const s of side) for (const z of [C.z0, C.z0 + 1.2, C.z0 + 2.4, C.z1 - 0.4]) k.pipe('gunmetal', [s * C.x1, ybase, z], [s * C.x1, ytop, z], 0.05, 8);
  k.bevelBox('hullDark', 0, ytop + 0.05, (C.z0 + C.z1) / 2, 0.5, 0.1, C.z1 - C.z0 - 0.6, 0.03);
  k.cyl('steel', 0, ytop + 0.6, C.z1 - 0.4, 0.04, 1.0, 8);                                           // mast
  k.box('glowRed', 0, ytop + 1.12, C.z1 - 0.4, 0.1, 0.1, 0.1);
  k.bevelBox('hullDark', 0, ybase - 0.12, C.z0 - 0.05, 6.8, 0.22, 0.16, 0.04);                      // the sill

  // --- the roof over the crew section and the hold: cooling fins, hatches, a spine, floodlights
  const yRoofCrew = top(0) + 0.02, yRoofHold = top(20) + 0.02;
  k.bevelBox('hullDark', 0, yRoofCrew + 0.1, -2.0, 1.2, 0.2, 14, 0.05);                              // spine over the crew section
  k.bevelBox('hullDark', 0, yRoofHold + 0.12, 21.0, 1.4, 0.24, 24, 0.05);                            // spine over the hold
  for (let i = 0; i < 9; i++) for (const s of side) {                                                // radiator fins
    const z = 12 + i * 2.0;
    k.bevelBox('metal', s * 3.0, yRoofHold + 0.2, z, 3.2, 0.12, 0.2, 0.02, { col: SLATE });
    k.box('glowAmber', s * 4.55, yRoofHold + 0.28, z, 0.05, 0.03, 0.12);
  }
  for (const [x, z] of [[-2.4, 17.0], [2.4, 17.0], [-2.4, 27.0], [2.4, 27.0]]) {                    // hold roof hatches
    k.bevelBox('hullDark', x, yRoofHold + 0.06, z, 2.0, 0.12, 3.2, 0.04);
    k.box('glowAmber', x, yRoofHold + 0.13, z - 1.6, 1.8, 0.02, 0.05);
  }
  for (const s of side) for (const z of [-6, 2, 9]) { k.cyl('steelDark', s * 4.6, yRoofCrew + 0.2, z, 0.2, 0.35, 8); k.box('glowWhite', s * 4.6, yRoofCrew + 0.4, z, 0.25, 0.04, 0.25); }

  // --- the flanks: window rows, panel seams, stencilled bars, mooring bollards
  for (const s of side) {
    for (let z = -9.0; z < 6.0; z += 1.5) k.bevelBox('hullDark', s * (hw(z) + 0.03), 1.9, z, 0.08, 0.04, 1.4, 0.01);   // panel seams
    for (const z of [-7.2, -5.0, 0.4]) k.bevelBox('glassTint', s * (hw(z) + 0.02), 2.3, z, 0.06, 0.55, 1.1, 0.03);    // crew section windows (the layout's own are inside)
    k.bevelBox('hullDark', s * (hw(20) + 0.03), 3.4, 20.5, 0.12, 0.09, 24, 0.02);                                    // belt line round the hold
    for (let z = 13.5; z < 31.5; z += 3.0) k.bevelBox('hullDark', s * (hw(z) + 0.05), 2.7, z, 0.12, 4.3, 0.22, 0.03);  // hold frames
    for (let i = 0; i < 6; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', s * (hw(30) + 0.04), 0.7, 29.2 + i * 0.4, 0.06, 0.8, 0.2);
    k.cyl('steel', s * (hw(8) + 0.12), 0.6, 8.0, 0.14, 0.35, 8);                                                    // bollards
    // the airlock hatch outline on the port side only
  }
  k.bevelBox('hullDark', -(hw(-1.2) + 0.03), 1.1, -1.2, 0.1, 2.35, 1.5, 0.04);                       // the airlock hatch frame
  k.bevelBox('hull', -(hw(-1.2) + 0.05), 1.1, -1.2, 0.04, 2.2, 1.35, 0.03, { col: ORANGE });

  // --- safety-orange flank bands (the hauler's mark): a low band along the crew section, a taller one the length of the hold, a stripe on each cowl
  for (const s2 of side) {
    k.bevelBox('hull', s2 * (hw(0) + 0.045), 0.85, -2.0, 0.09, 1.1, 15.4, 0.02, { col: ORANGE });
    k.bevelBox('hull', s2 * (hw(20) + 0.045), 1.15, 20.6, 0.09, 1.7, 23.6, 0.02, { col: ORANGE });
    k.bevelBox('hull', s2 * (hw(20) + 0.045), 4.65, 20.6, 0.09, 0.35, 23.6, 0.02, { col: ORANGE });
  }

  // --- the nose: a sensor blister, nose lights, the chin gun fairing
  k.bevelBox('hullDark', 0, 0.45, -18.2, 1.2, 0.4, 1.8, 0.1);
  k.box('glowCyan', 0, 0.38, -19.14, 0.5, 0.08, 0.04);
  for (const s of side) k.box('glowWhite', s * 0.8, 0.5, -18.9, 0.12, 0.1, 0.06);

  // --- the cargo door frame at the stern: a portal as tall as the hold, hazard chevrons, status lamps
  const w = RAMPS.cargo.width + 0.2, h = 4.4, zs = HULL.z1 + 0.02;
  for (const s of side) k.bevelBox('hullDark', s * (w / 2 + 0.2), h / 2 + 0.1, zs, 0.4, h + 0.4, 0.2, 0.03);
  k.bevelBox('hullDark', 0, h + 0.35, zs, w + 0.8, 0.5, 0.2, 0.03);
  for (let i = 0; i < 14; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -w / 2 + 0.2 + i * 0.35, h + 0.35, zs + 0.11, 0.18, 0.4, 0.01);
  for (const s of side) { k.box('glowAmber', s * (w / 2 + 0.2), 3.0, zs + 0.11, 0.12, 0.12, 0.01); k.box('glowGreen', s * (w / 2 + 0.2), 2.6, zs + 0.11, 0.12, 0.12, 0.01); }

  // --- the engine nacelles: a pylon each side of the hold, a long cowl, two nozzles. The stern between them is open for the ramp.
  for (const s of side) {
    const nx = s * 7.5;
    for (const z of [17.5, 26.0]) k.bevelBox('hullDark', s * 6.8, 1.9, z, 1.6, 0.5, 1.0, 0.08);        // pylons from the hull to the pod
    k.bevelBox('hull', nx, 1.9, 24.0, 2.3, 2.5, 17.0, 0.35, { col: ORANGE });                            // the cowl
    k.bevelBox('hull', nx, 3.25, 24.0, 1.4, 0.3, 14.0, 0.1, { col: PALE });
    k.bevelBox('hullDark', nx, 1.9, 15.2, 1.9, 2.1, 0.6, 0.1);                                           // the intake lip
    k.box('glowAmber', nx, 2.9, 15.55, 1.4, 0.05, 0.05);
    for (const dy of [-0.6, 0.65]) {
      k.cyl('engine', nx, 1.9 + dy, 32.7, 0.62, 1.3, 16, { axis: 'z' });
      k.lathe('metal', nx, 1.9 + dy, 33.35, [[0.5, 0], [0.62, 0.35], [0.7, 0.7], [0.62, 0.7], [0.44, 0]], 16, { axis: 'z' });
    }
    for (let z = 17; z < 31; z += 2.4) k.box('hazard', nx, 0.58, z, 2.36, 0.02, 0.5);                   // underside hazard marks
    k.box(s === 1 ? 'glowGreen' : 'glowRed', nx, 3.45, 16.2, 0.2, 0.12, 0.3);                           // nav lights on the cowl tops
    ext.nav.push({ x: nx, y: 3.5, z: 16.2, side: s });
  }
  // four exhausts: each a pair of additive cones the fleet view animates
  for (const s of side) for (const dy of [-0.6, 0.65]) {
    const nx = s * 7.5, ny = 1.9 + dy;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3.4, 14, 1, true), mats.engineGlow.clone());
    flame.rotation.x = -Math.PI / 2; flame.position.set(nx, ny, 35.4); flame.name = 'exhaust'; root.add(flame);
    const core = flame.clone(); core.material = mats.nozzleInner.clone(); core.scale.set(0.6, 0.6, 0.8); root.add(core);
    ext.engines.push({ outer: flame, core, side: s });
  }

  // --- lift pods under the hull
  for (const [x, z] of [[-3.6, -3.0], [3.6, -3.0], [-3.6, 18.0], [3.6, 18.0]]) {
    k.cyl('engine', x, -0.9, z, 0.62, 0.35, 14);
    k.lathe('metal', x, -1.05, z, [[0.45, 0], [0.62, -0.08], [0.62, 0.0], [0.45, 0.05]], 14);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.2, 12, 1, true), mats.engineGlow.clone());
    mesh.position.set(x, -2.6, z); mesh.name = 'exhaust'; root.add(mesh);
    const core = mesh.clone(); core.material = mats.nozzleInner.clone(); root.add(core);
    ext.liftPods.push({ x, y: -1.0, z, mesh, core });
  }

  // --- chin gun: two barrels in a fairing on a short mount
  for (const s of side) {
    const m = GUNS.main.muzzles[s > 0 ? 1 : 0];
    const gun = new THREE.Group(); gun.position.set(m.x, m.y, GUNS.main.pivot.z);
    const gk = new Kit(); gk.bevelBox('gunmetal', 0, 0, -0.6, 0.3, 0.3, 1.0, 0.05); gk.cyl('gunmetal', 0, 0, -1.8, 0.07, 2.2, 10, { axis: 'z' }); gk.cyl('steelDark', 0, 0, -2.9, 0.1, 0.18, 10, { axis: 'z' });
    gun.add(gk.toGroup(mats)); root.add(gun);
    ext.guns.main.push({ group: gun, muzzle: new THREE.Vector3(0, 0, -1) });
  }

  // --- wing-tip free: the hold's ribbing is the only skin detail on the roof; a stencilled tally on each nacelle top is the decal's job

  ext.staticGroup = k.toGroup(mats, { name: 'hauler-plates', cast: true, receive: true }); root.add(ext.staticGroup);
  ext.triangles = k.triangles;

  // --- landing legs: telescoping, with a splayed brace and a wide foot pad
  for (const leg of GEAR.legs) {
    const group = new THREE.Group(); group.position.set(leg.x, 0, leg.z);
    const pk = new Kit(); pk.cyl('metal', 0, -0.5, 0, 0.2, 1, 12); pk.cyl('steelDark', 0, -0.2, 0, 0.3, 0.4, 12);
    const piston = new THREE.Group(); piston.add(pk.toGroup(mats)); group.add(piston);
    const fk = new Kit(); fk.bevelBox('gunmetal', 0, -0.14, 0, 1.7, 0.28, 1.5, 0.06); fk.cyl('rubber', 0, -0.3, 0, 0.7, 0.04, 14);
    const foot = fk.toGroup(mats, { cast: true }); group.add(foot);
    const bk = new Kit(); const sx = Math.sign(leg.x);
    bk.pipe('steelDark', [0, 0.1, 0], [-sx * 1.4, 1.3, 0], 0.07, 8);
    group.add(bk.toGroup(mats));
    root.add(group); ext.legs.push({ ...leg, group, piston, foot });
  }

  // --- the ramps. The cargo ramp is 4.6 m wide: anti-slip ribs, amber edge lights, guide rails, and a hinge beam.
  for (const [key, R2] of Object.entries(RAMPS)) {
    const hinge = new THREE.Group(); hinge.position.set(R2.hinge.x, R2.hinge.y, R2.hinge.z);
    const rk = new Kit();
    rk.bevelBox('hullDark', 0, -0.1, R2.length / 2, R2.width, R2.panel.thickness, R2.length, 0.04);
    for (let z = 0.2; z < R2.length; z += 0.32) rk.box('metal', 0, 0.02, z, R2.width - 0.2, 0.02, 0.07);
    for (const s of side) rk.box('glowAmber', s * (R2.width / 2 - 0.05), 0.05, R2.length / 2, 0.05, 0.02, R2.length - 0.2);
    if (key === 'cargo') {
      for (const s of side) { rk.bevelBox('steelDark', s * (R2.width / 2 + 0.05), 0.12, R2.length / 2, 0.12, 0.28, R2.length, 0.02); rk.box('hazard', s * (R2.width / 2 - 0.4), 0.03, R2.length / 2, 0.14, 0.01, R2.length - 0.4); }
      rk.bevelBox('steelDark', 0, 0.02, 0.15, R2.width + 0.3, 0.26, 0.3, 0.03);
      rk.bevelBox('hazard', 0, 0.0, R2.length - 0.1, R2.width, 0.2, 0.2, 0.03);
    }
    const mesh = rk.toGroup(mats, { cast: true, receive: true }); hinge.add(mesh); root.add(hinge);
    ext.ramps[key] = { hinge, mesh, def: R2 };
  }

  // --- a remote view adds its own glass, so the people at the stations can be seen through the canopy
  if (opts.remote) {
    const gk = new Kit(), yb = C.y + 1.05, yt = C.y + C.h;
    gk.poly('glassTint', [[C.x0, yb, C.z0], [C.x1, yb, C.z0], [C.x1, yt, C.z0 + 0.5], [C.x0, yt, C.z0 + 0.5]]);
    for (const s of side) {
      const x = s > 0 ? C.x1 : C.x0;
      gk.poly('glassTint', s > 0 ? [[x, yb, C.z0], [x, yb, C.z1 - 0.4], [x, yt, C.z1 - 0.4], [x, yt, C.z0]] : [[x, yb, C.z1 - 0.4], [x, yb, C.z0], [x, yt, C.z0], [x, yt, C.z1 - 0.4]]);
    }
    const gg = gk.toGroup(mats, { name: 'remote-glass' });
    gg.traverse((m) => { if (m.isMesh) m.renderOrder = 6; });
    root.add(gg); ext.remoteGlass = gg;
  }
  // the name on the flank
  if (opts.decal) for (const s of side) {
    const z0 = -8.6, z1 = 5.4, x = s * (hw(0) + 0.1);
    const pts = s > 0 ? [[x, 1.5, z1], [x, 1.5, z0], [x, 2.4, z0], [x, 2.4, z1]] : [[x, 1.5, z0], [x, 1.5, z1], [x, 2.4, z1], [x, 2.4, z0]];
    const dk = new Kit(); dk.poly('decal', pts, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    root.add(dk.toGroup({ decal: opts.decal }, { name: 'decal' }));
  }
  ext.tier = low ? 'low' : 'high';
  return ext;
}

/** The pose the ship size is defined in: gear at its nominal length, both ramps raised, gun level. */
export function haulerNeutral(ext) {
  ext.legs.forEach((leg) => { leg.foot.position.y = -GEAR.nominal; leg.piston.scale.y = GEAR.nominal + 0.2; leg.piston.position.y = 0.2; });
  ext.ramps.cargo.hinge.rotation.set(-Math.PI / 2, 0, 0); ext.ramps.cargo.hinge.scale.set(1, 1, 1);
  const g = ext.ramps.airlock.hinge;
  g.scale.set(1, 1, 2.5 / RAMPS.airlock.length);
  g.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
}

/** The name and registry number painted on the flank. */
export function haulerDecalTexture(THREE_, def, name = 'DRAYMAN', registry = 'COS-MARS-VEH-0070') {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
    const g = c.getContext('2d'); if (!g || typeof g.getImageData !== 'function') return null;
    g.getImageData(0, 0, 1, 1);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#2a2d31'; g.font = '800 150px "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText(String(name).toUpperCase(), 90, 104);
    g.font = '600 48px ui-monospace, Consolas, monospace'; g.fillText(registry, 96, 214);
    g.fillStyle = '#e8841e'; g.fillRect(1300, 50, 640, 34); g.fillRect(1300, 104, 460, 34);
    const t = new THREE_.CanvasTexture(c); t.colorSpace = THREE_.SRGBColorSpace; t.anisotropy = 4; return t;
  } catch { return null; }
}

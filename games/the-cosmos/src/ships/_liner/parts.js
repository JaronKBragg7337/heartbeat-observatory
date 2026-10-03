// ============================================================================
// ships/_liner/parts.js - the parts every ship of this line shares and the game animates: landing legs, the two ramps, engine nozzles
// with flames, lift pods and the neutral pose. Written once so the transport, the descender, the bulker, the escort and the lifeboat
// move the way the game expects (ext = { root, legs[], ramps{cargo, airlock}, guns{main[]}, engines[], liftPods[], ... }).
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';

/** Landing legs: a piston (scaled by the game) and a pad. o = { r, padW, padD, padH } */
export function addLegs(ext, def, mats, o = {}) {
  const r = o.r ?? 0.15, padW = o.padW ?? 1.3, padD = o.padD ?? 1.1, padH = o.padH ?? 0.25;
  for (const leg of def.gear.legs) {
    const group = new THREE.Group(); group.position.set(leg.x, 0, leg.z);
    const pk = new Kit(); pk.cyl('metal', 0, -0.5, 0, r, 1, 12); pk.cyl('steelDark', 0, -0.5, 0, r * 1.5, 0.3, 12);
    const piston = new THREE.Group(); piston.add(pk.toGroup(mats)); group.add(piston);
    const fk = new Kit();
    fk.bevelBox('gunmetal', 0, -padH / 2, 0, padW, padH, padD, Math.min(0.08, padH * 0.3));
    fk.bevelBox('rubber', 0, -padH - 0.02, 0, padW * 0.9, 0.05, padD * 0.9, 0.02);
    fk.box('hazard', 0, -padH * 0.5, padD / 2 + 0.003, padW * 0.8, padH * 0.3, 0.006);
    const foot = fk.toGroup(mats, { cast: true }); group.add(foot);
    ext.root.add(group); ext.legs.push({ ...leg, group, piston, foot });
  }
}

/** The ramps in def.ramps: a hinge group at the hinge point, a plate along local +Z, tread bars, side lights. */
export function addRamps(ext, def, mats, o = {}) {
  for (const [key, R] of Object.entries(def.ramps)) {
    const hinge = new THREE.Group(); hinge.position.set(R.hinge.x, R.hinge.y, R.hinge.z);
    const rk = new Kit();
    rk.bevelBox('hullDark', 0, -0.08, R.length / 2, R.width, 0.16, R.length, 0.04);
    const step = o.step ?? 0.3;
    for (let z = 0.2; z < R.length; z += step) rk.box('metal', 0, 0.02, z, R.width - 0.12, 0.02, 0.06);
    for (const s of [-1, 1]) rk.box('glowAmber', s * (R.width / 2 - 0.04), 0.05, R.length / 2, 0.04, 0.02, R.length - 0.2);
    if (R.width > 3) for (const s of [-1, 1]) { rk.bevelBox('steelDark', s * (R.width / 2 + 0.06), 0.35, R.length / 2, 0.1, 0.7, R.length, 0.02); }
    const mesh = rk.toGroup(mats, { cast: true, receive: true }); hinge.add(mesh);
    ext.root.add(hinge); ext.ramps[key] = { hinge, mesh, def: R };
  }
}

/** One engine: a housing, a bell, and the two additive flame cones the game scales (named 'exhaust'). side is -1 | +1. */
export function addEngine(ext, mats, k, x, y, z, r, len, side = 1) {
  k.bevelBox('hullDark', x, y, z - 0.2, r * 2.2, r * 2.2, 0.5, 0.15);
  k.cyl('engine', x, y, z + len * 0.2, r, len * 0.5, 18, { axis: 'z' });
  k.lathe('metal', x, y, z + len * 0.48, [[r * 0.78, 0], [r * 1.02, len * 0.18], [r * 1.18, len * 0.34], [r * 1.0, len * 0.34], [r * 0.72, 0]], 18, { axis: 'z' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.pipe('copper', [x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, z + len * 0.12], [x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, z + len * 0.5], r * 0.04, 6);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(r * 0.78, len * 2.2, 14, 1, true), mats.engineGlow.clone());
  flame.rotation.x = -Math.PI / 2; flame.position.set(x, y, z + len * 0.82 + len * 1.1); flame.name = 'exhaust'; ext.root.add(flame);
  const core = flame.clone(); core.material = mats.nozzleInner.clone(); core.scale.set(0.5, 0.5, 0.7); ext.root.add(core);
  ext.engines.push({ outer: flame, core, side });
}

/** A lift pod: a ring on the belly and a downward cone. */
export function addLiftPod(ext, mats, k, x, y, z, r = 0.5) {
  k.cyl('engine', x, y - 0.1, z, r, 0.35, 14);
  k.lathe('metal', x, y - 0.3, z, [[r * 0.6, 0], [r * 0.95, -0.08], [r * 0.95, 0.0]], 14);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, r * 6, 10, 1, true), mats.engineGlow.clone());
  mesh.position.set(x, y - r * 3.4, z); mesh.name = 'exhaust'; ext.root.add(mesh);
  const core = mesh.clone(); core.material = mats.engineGlow.clone(); ext.root.add(core);
  ext.liftPods.push({ x, y, z, mesh, core });
}

/** A gun mount on the nose: a small turret ball and two barrels. Fills ext.guns.main as the game expects. */
export function addNoseGuns(ext, mats, def, o = {}) {
  const M = def.guns.main.muzzles, P = def.guns.main.pivot;
  for (const m of M) {
    const gun = new THREE.Group(); gun.position.set(m.x, m.y, m.z + (o.back ?? 0.9));
    const gk = new Kit(); gk.cyl('gunmetal', 0, 0, -0.5 * (o.len ?? 1), o.r ?? 0.08, o.len ?? 1, 10, { axis: 'z' });
    gun.add(gk.toGroup(mats)); ext.root.add(gun); ext.guns.main.push({ group: gun, muzzle: new THREE.Vector3(0, 0, -1) });
  }
  void P;
}

/** The neutral pose the ship is measured in: gear down at nominal, ramps raised. */
export function poseNeutral(ext, def) {
  for (const l of ext.legs) { l.foot.position.y = -def.gear.nominal; l.piston.scale.y = def.gear.nominal + 0.2; l.piston.position.y = 0.2; }
  for (const [key, r] of Object.entries(ext.ramps)) {
    const R = def.ramps[key], h = r.hinge;
    h.scale.set(1, 1, key === 'cargo' ? 1 : 2.5 / R.length);
    h.rotation.set(0, 0, 0);
    h.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    h.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(R.dir.x, R.dir.z)));
  }
}

/** A navigation light pair (red port, green starboard) and a white strobe. k is a Kit. */
export function navLights(k, xPort, xStar, y, z) {
  k.box('glowRed', xPort, y, z, 0.2, 0.14, 0.3); k.box('glowGreen', xStar, y, z, 0.2, 0.14, 0.3);
}

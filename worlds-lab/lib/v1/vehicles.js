// WORLDS LAB · lib v1 · vehicles.js — ground vehicles & boats.
// Vehicles can sit parked, patrol a closed path, or be ridden (the kit's ride
// system attaches the camera to any moving pose). All code-built, no assets.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.15 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

function wheel(r) {
  const w = cyl(r, r, 0.22, M(0x23262b, { roughness: 0.9 }), 12);
  w.rotation.z = Math.PI / 2;
  return w;
}

export function car(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const body = box(2.4, 0.55, 1.2, M(o.color || 0xc24b3e)); body.position.y = 0.55; g.add(body);
  const cabin = box(1.3, 0.5, 1.05, M(o.color || 0xc24b3e)); cabin.position.set(-0.1, 1.05, 0); g.add(cabin);
  const glass = box(1.2, 0.36, 1.06, M(0xbfe2ea, { roughness: 0.2, transparent: true, opacity: 0.8 })); glass.position.set(-0.1, 1.08, 0); g.add(glass);
  const wheels = [];
  for (const [x, z] of [[-0.85, 0.62], [0.85, 0.62], [-0.85, -0.62], [0.85, -0.62]]) {
    const w = wheel(0.3); w.position.set(x, 0.3, z); g.add(w); wheels.push(w);
  }
  const lampMat = M(0xfff1cc, { emissive: 0xfff1cc, emissiveIntensity: 0.6 });
  for (const z of [0.4, -0.4]) { const l = box(0.08, 0.12, 0.18, lampMat); l.position.set(1.21, 0.6, z); g.add(l); }
  g.userData.wheels = wheels;
  g.userData.footprint = { w: 2.6, d: 1.4 };
  return g;
}

export function taxi(opts) {
  const g = car(Object.assign({ color: 0xe8b53a }, opts));
  const topper = box(0.5, 0.18, 0.3, M(0x14181d)); topper.position.set(-0.1, 1.4, 0); g.add(topper);
  return g;
}

export function bus(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const body = box(5.2, 1.7, 1.5, M(o.color || 0x3e7bc2)); body.position.y = 1.15; g.add(body);
  const glass = box(5.0, 0.5, 1.52, M(0xbfe2ea, { roughness: 0.2 })); glass.position.y = 1.55; g.add(glass);
  const wheels = [];
  for (const [x, z] of [[-1.8, 0.78], [1.8, 0.78], [-1.8, -0.78], [1.8, -0.78]]) {
    const w = wheel(0.38); w.position.set(x, 0.38, z); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.footprint = { w: 5.4, d: 1.7 };
  return g;
}

export function truck(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const cab = box(1.4, 1.2, 1.5, M(o.cab || 0x4a7d3f)); cab.position.set(1.4, 0.95, 0); g.add(cab);
  const glass = box(0.5, 0.45, 1.52, M(0xbfe2ea, { roughness: 0.2 })); glass.position.set(1.7, 1.25, 0); g.add(glass);
  const bed = box(3.0, 1.5, 1.6, M(o.box || 0xd8d2c4)); bed.position.set(-0.7, 1.15, 0); g.add(bed);
  const wheels = [];
  for (const [x, z] of [[1.5, 0.8], [-0.2, 0.8], [-1.6, 0.8], [1.5, -0.8], [-0.2, -0.8], [-1.6, -0.8]]) {
    const w = wheel(0.36); w.position.set(x, 0.36, z); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.footprint = { w: 4.6, d: 1.8 };
  return g;
}

export function golfCart(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const base = box(1.7, 0.3, 1.0, M(0xf2ead8)); base.position.y = 0.45; g.add(base);
  const seat = box(0.7, 0.4, 0.95, M(o.seat || 0x3e6b8f)); seat.position.set(-0.3, 0.8, 0); g.add(seat);
  const roof = box(1.5, 0.07, 1.0, M(0xf2ead8)); roof.position.set(-0.05, 1.7, 0); g.add(roof);
  for (const [x, z] of [[0.6, 0.45], [-0.6, 0.45], [0.6, -0.45], [-0.6, -0.45]]) {
    const p = cyl(0.035, 0.035, 0.95, M(0x8a8f96), 6); p.position.set(x, 1.22, z); g.add(p);
  }
  const wheels = [];
  for (const [x, z] of [[0.62, 0.5], [-0.62, 0.5], [0.62, -0.5], [-0.62, -0.5]]) {
    const w = wheel(0.24); w.position.set(x, 0.24, z); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.footprint = { w: 1.9, d: 1.2 };
  return g;
}

export function boat(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const hullMat = M(o.hull || 0x3e6b8f, { roughness: 0.5 });
  const hull = box(3.2, 0.7, 1.3, hullMat); hull.position.y = 0.35; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.2, 4), hullMat);
  bow.rotation.set(Math.PI / 2, 0, Math.PI / 4); bow.position.set(2.0, 0.35, 0); bow.scale.set(1, 1, 0.54); g.add(bow);
  const deck = box(2.9, 0.08, 1.1, M(0xc8a86a)); deck.position.y = 0.74; g.add(deck);
  if (o.sail) {
    const mast = cyl(0.05, 0.05, 3.2, M(0x8a6844)); mast.position.set(0.3, 2.3, 0); g.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.2), M(0xf2ead8, { side: THREE.DoubleSide }));
    sail.position.set(-0.6, 2.6, 0); g.add(sail);
  } else {
    const cabin = box(1.0, 0.7, 1.0, M(0xf2ead8)); cabin.position.set(0.4, 1.1, 0); g.add(cabin);
  }
  g.userData.footprint = { w: 3.6, d: 1.6 };
  return g;
}

// ---- patrol: a vehicle drives a closed path forever (city life, harbor boats) ----
export function patrol(kit, group, points, opts) {
  const o = opts || {};
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1] || 0, p[2])), true, "catmullrom", 0.35);
  const len = curve.getLength();
  const speed = o.speed || 4;
  let u = o.startU || 0;
  kit.scene.add(group);
  kit.addUpdate((dt) => {
    u = (u + (speed * dt) / len) % 1;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    const gy = o.fixedY !== undefined ? o.fixedY : kit.groundHeight(_pos.x, _pos.z);
    group.position.set(_pos.x, gy + (o.lift || 0), _pos.z);
    group.rotation.y = Math.atan2(_tan.x, _tan.z) - Math.PI / 2;
    const ws = group.userData.wheels;
    if (ws) for (let i = 0; i < ws.length; i++) ws[i].rotation.x += (speed * dt) / 0.3;
    if (o.bob) group.position.y += Math.sin((u * len) * 0.8) * 0.06;
  });
  return { curve, setSpeed: (s) => { /* speed is closed over */ }, getU: () => u };
}

// ---- rideable road loop: stand at the stop, press E, ride the loop, hop off ----
// Returns a ride object for kit.addDoor({act:{type:"ride", ride}}).
export function roadRide(kit, group, points, opts) {
  const o = opts || {};
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1] || 0, p[2])), true, "catmullrom", 0.35);
  const len = curve.getLength();
  const speed = o.speed || 6;
  kit.scene.add(group);
  let activeT = -1; // when >= 0, ride in progress drives the mesh
  const parked = points[0];
  group.position.set(parked[0], kit.groundHeight(parked[0], parked[2]), parked[2]);
  const ride = {
    label: o.label || "the shuttle",
    duration: o.laps ? (len / speed) * o.laps : (len / speed),
    dismount: { x: parked[0] + (o.dismountDx || 2), z: parked[2] + (o.dismountDz || 2) },
    pose(t, out) {
      const u = ((t * speed) / len) % 1;
      activeT = t;
      curve.getPointAt(u, _pos);
      curve.getTangentAt(u, _tan);
      const gy = o.fixedY !== undefined ? o.fixedY : kit.groundHeight(_pos.x, _pos.z);
      group.position.set(_pos.x, gy, _pos.z);
      group.rotation.y = Math.atan2(_tan.x, _tan.z) - Math.PI / 2;
      const ws = group.userData.wheels;
      if (ws) for (let i = 0; i < ws.length; i++) ws[i].rotation.x += 0.25;
      out.x = _pos.x; out.y = gy + (o.eye || 1.5); out.z = _pos.z;
      out.yaw = Math.atan2(-_tan.x, -_tan.z);
      out.pitch = 0;
    },
    onEnd() {
      activeT = -1;
      group.position.set(parked[0], kit.groundHeight(parked[0], parked[2]), parked[2]);
      group.rotation.y = o.parkYaw || 0;
    },
  };
  return ride;
}

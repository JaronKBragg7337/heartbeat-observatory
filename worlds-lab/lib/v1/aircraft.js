// WORLDS LAB · lib v1 · aircraft.js — helicopters, hot air balloons, blimps.
// The helicopter sits on its pad with rotors idling; board it and it flies a real
// scripted tour (take off, circuit, land) — phone and desktop identical.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { stripeTexture, textTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.2 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
const sph = (r, mat, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 12, seg || 12), mat);

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

export function helipad(kit, x, z, opts) {
  const o = opts || {};
  const gy = kit.groundHeight(x, z);
  const g = new THREE.Group();
  const pad = cyl(3.4, 3.6, 0.25, M(0x3a3f46), 18); pad.position.y = 0.12; g.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 6, 28), M(0xeec643));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; g.add(ring);
  const hBar = box(0.34, 0.06, 1.7, M(0xeec643)); hBar.position.set(-0.55, 0.27, 0); g.add(hBar);
  const hBar2 = hBar.clone(); hBar2.position.x = 0.55; g.add(hBar2);
  const hMid = box(0.8, 0.06, 0.32, M(0xeec643)); hMid.position.y = 0.27; g.add(hMid);
  g.position.set(x, gy, z);
  kit.scene.add(g);
  return g;
}

export function helicopter(kit, o) {
  const x = o.x, z = o.z;
  const gy = kit.groundHeight(x, z) + 0.25;
  const g = new THREE.Group();
  const bodyMat = M(o.color || 0xc24b3e, { roughness: 0.45, metalness: 0.3 });
  const cabin = sph(1.05, bodyMat, 14); cabin.scale.set(1.25, 0.9, 1); cabin.position.y = 1.35; g.add(cabin);
  const glassMat = M(0xbfe2ea, { roughness: 0.15, transparent: true, opacity: 0.75 });
  const glass = sph(0.95, glassMat, 12); glass.scale.set(0.9, 0.75, 0.9); glass.position.set(0.55, 1.45, 0); g.add(glass);
  const tail = cyl(0.16, 0.34, 3.0, bodyMat, 8); tail.rotation.z = Math.PI / 2; tail.position.set(-2.2, 1.55, 0); g.add(tail);
  const fin = box(0.08, 0.9, 0.5, bodyMat); fin.position.set(-3.6, 1.9, 0); g.add(fin);
  for (const s of [-0.65, 0.65]) {
    const skid = cyl(0.05, 0.05, 2.6, M(0x4a4f57), 6);
    skid.rotation.z = Math.PI / 2; skid.position.set(0, 0.32, s); g.add(skid);
    for (const sx of [-0.7, 0.7]) {
      const strut = cyl(0.04, 0.04, 0.65, M(0x4a4f57), 6);
      strut.position.set(sx, 0.65, s); strut.rotation.x = s > 0 ? -0.3 : 0.3; g.add(strut);
    }
  }
  const rotor = new THREE.Group(); rotor.position.set(0, 2.35, 0);
  for (let i = 0; i < 3; i++) {
    const blade = box(5.4, 0.05, 0.3, M(0x23262b));
    blade.rotation.y = (i / 3) * Math.PI * 2;
    rotor.add(blade);
  }
  g.add(rotor);
  const hub = cyl(0.12, 0.12, 0.5, M(0x23262b), 8); hub.position.set(0, 2.2, 0); g.add(hub);
  const tailRotor = new THREE.Group(); tailRotor.position.set(-3.6, 1.9, 0.28);
  for (let i = 0; i < 2; i++) {
    const blade = box(0.06, 1.1, 0.12, M(0x23262b));
    blade.rotation.x = (i / 2) * Math.PI;
    tailRotor.add(blade);
  }
  g.add(tailRotor);

  g.position.set(x, gy, z);
  g.rotation.y = o.yaw || 0;
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 3.4, d: 2.4 });

  // tour path: lift off, fly a wide circuit over the listed waypoints, return, land
  const tourPts = (o.tour || [[x + 20, 18, z], [x + 30, 24, z - 30], [x, 26, z - 45], [x - 30, 22, z - 25], [x - 18, 16, z + 6]]);
  const path = [[x, 0.0, z]];
  path.push([x, 10, z]); // straight up
  for (const p of tourPts) path.push(p);
  path.push([x, 9, z]); // come home
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], gy + p[1], p[2])), true, "catmullrom", 0.3);
  const len = curve.getLength();
  const speed = o.speed || 9;
  const duration = len / speed;

  let flying = false, ft = 0;
  let rotorSpeed = 2.2; // idle spin — pad feels alive
  kit.addUpdate((dt) => {
    rotor.rotation.y += rotorSpeed * dt;
    tailRotor.rotation.z += rotorSpeed * 2.4 * dt;
    if (flying) {
      ft += dt;
      const u = Math.min(0.9999, ft / duration);
      curve.getPointAt(u, _pos);
      curve.getTangentAt(u, _tan);
      g.position.copy(_pos);
      g.rotation.y = Math.atan2(_tan.x, _tan.z) - Math.PI / 2 + Math.PI;
      g.rotation.z = THREE.MathUtils.clamp(-_tan.y * 0.0, -0.2, 0.2);
      if (ft >= duration) { flying = false; ft = 0; g.position.set(x, gy, z); g.rotation.set(0, o.yaw || 0, 0); }
    }
  });

  const ride = {
    label: o.name || "the helicopter tour",
    duration,
    dismount: { x: x + 3.2, z: z + 3.2 },
    onStart() { flying = true; ft = 0; rotorSpeed = 14; },
    onEnd() { flying = false; ft = 0; rotorSpeed = 2.2; g.position.set(x, gy, z); g.rotation.set(0, o.yaw || 0, 0); },
    pose(t, out) {
      out.x = g.position.x; out.y = g.position.y + 1.55; out.z = g.position.z;
      const yaw = g.rotation.y - Math.PI / 2 + Math.PI / 2;
      out.yaw = Math.atan2(-Math.sin(g.rotation.y + Math.PI / 2) * 1, -Math.cos(g.rotation.y + Math.PI / 2)) ;
      // face along travel: reuse tangent math (yaw of body + half turn corrections)
      out.yaw = g.rotation.y - Math.PI / 2;
      out.pitch = -0.12;
    },
  };
  kit.addDoor({ label: "Fly " + (o.name || "the helicopter tour"), x: x + 2.4, z: z + 2.0, hw: 2.6, hd: 2.6, act: { type: "ride", ride } });
  return { group: g, ride };
}

export function hotAirBalloon(kit, o) {
  const x = o.x, z = o.z;
  const gy = kit.groundHeight(x, z);
  const g = new THREE.Group();
  const envMat = new THREE.MeshStandardMaterial({ map: stripeTexture({ a: o.a || "#c24b3e", b: o.b || "#eec643", n: 12 }), roughness: 0.8 });
  const envelope = sph(2.6, envMat, 16); envelope.scale.y = 1.15; envelope.position.y = 7.2; g.add(envelope);
  const throat = cyl(1.0, 1.8, 1.4, envMat, 12); throat.position.y = 4.6; g.add(throat);
  const basket = box(1.3, 1.0, 1.3, M(0x8a6034)); basket.position.y = 2.9; g.add(basket);
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    const rope = cyl(0.02, 0.02, 1.5, M(0x4a3a2c), 4);
    rope.position.set(sx, 3.9, sz); g.add(rope);
  }
  const flameMat = M(0xffa53e, { emissive: 0xff8a26, emissiveIntensity: 1.2 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 7), flameMat); flame.position.y = 3.9; g.add(flame);
  g.position.set(x, gy, z);
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 1.8, d: 1.8 });

  // gentle tethered rise-and-drift, or a tall vertical sightseeing hop when ridden
  let t0 = 0, ridingNow = false;
  kit.addUpdate((dt, t) => {
    t0 = t;
    flame.scale.setScalar(0.85 + Math.sin(t * 7.3) * 0.2);
    if (!ridingNow) g.position.y = gy + Math.sin(t * 0.5) * 0.18;
  });
  const up = o.height || 26, hold = 6, rise = 10;
  const duration = rise * 2 + hold;
  const ride = {
    label: o.name || "the balloon",
    duration,
    dismount: { x: x + 2.2, z: z + 2.2 },
    onStart() { ridingNow = true; },
    onEnd() { ridingNow = false; g.position.set(x, gy, z); },
    pose(t, out) {
      let h;
      if (t < rise) h = (t / rise) * up;
      else if (t < rise + hold) h = up;
      else h = Math.max(0, up * (1 - (t - rise - hold) / rise));
      g.position.set(x, gy + h, z);
      out.x = x; out.y = gy + h + 3.6; out.z = z;
      out.yaw = t * 0.15; // slow pan — sightseeing
      out.pitch = -0.18;
    },
  };
  kit.addDoor({ label: "Ride " + (o.name || "the balloon"), x: x + 1.8, z: z + 1.6, hw: 2.2, hd: 2.2, act: { type: "ride", ride } });
  return { group: g, ride };
}

export function blimp(kit, o) {
  const g = new THREE.Group();
  const envMat = M(o.color || 0xd8d2c4, { roughness: 0.5 });
  const body = sph(1.0, envMat, 14); body.scale.set(3.2, 1, 1); g.add(body);
  for (const s of [[-0.4, 0.5], [0.4, -0.5]]) { /* fins */ }
  const finV = box(0.08, 1.2, 0.8, M(0xc24b3e)); finV.position.set(-2.8, 0.3, 0); g.add(finV);
  const finH = box(0.08, 0.8, 1.6, M(0xc24b3e)); finH.position.set(-2.8, 0, 0); finH.rotation.x = Math.PI / 2; g.add(finH);
  const gondola = box(1.0, 0.4, 0.5, M(0x4a4f57)); gondola.position.y = -1.1; g.add(gondola);
  if (o.banner) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.0), new THREE.MeshStandardMaterial({ map: textTexture([o.banner], { w: 1024, h: 220, border: false, bg: "#1d2128", accent: "#7bd88f" }), side: THREE.DoubleSide }));
    g.add(sign);
  }
  const pts = o.path || [[0, 30, -40], [40, 34, 0], [0, 30, 40], [-40, 34, 0]];
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.4);
  const len = curve.getLength();
  const speed = o.speed || 3.2;
  let u = 0;
  kit.scene.add(g);
  kit.addUpdate((dt) => {
    u = (u + (speed * dt) / len) % 1;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    g.position.copy(_pos);
    g.rotation.y = Math.atan2(_tan.x, _tan.z) - Math.PI / 2 + Math.PI;
  });
  return { group: g, curve };
}

// WORLDS LAB · lib v1 · rails.js — train tracks, stations, and rideable trains.
// buildTrack lays real rails + ties along a spline; train() runs a locomotive and
// cars around it; makeRide lets a player board at a station and ride the line.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { textTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.1 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

export function makeCurve(points, closed) {
  return new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p[0], p[1] || 0, p[2])),
    closed !== false, "catmullrom", 0.4
  );
}

// rails as two offset tubes + instanced ties; one group, ~3 draw calls
export function buildTrack(kit, curve, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const samples = o.samples || 220;
  const gauge = o.gauge || 0.75;

  const left = [], right = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    _side.crossVectors(_up, _tan).normalize();
    left.push(new THREE.Vector3().copy(_pos).addScaledVector(_side, gauge / 2));
    right.push(new THREE.Vector3().copy(_pos).addScaledVector(_side, -gauge / 2));
  }
  const railMat = M(o.railColor || 0x6b7077, { metalness: 0.6, roughness: 0.4 });
  const leftCurve = new THREE.CatmullRomCurve3(left, o.closed !== false);
  const rightCurve = new THREE.CatmullRomCurve3(right, o.closed !== false);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(leftCurve, samples, 0.05, 6, o.closed !== false), railMat));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(rightCurve, samples, 0.05, 6, o.closed !== false), railMat));

  const tieCount = o.ties || Math.floor(curve.getLength() / 0.9);
  const tieGeo = new THREE.BoxGeometry(gauge + 0.5, 0.07, 0.26);
  const tieMat = M(o.tieColor || 0x4d3d2c);
  const ties = new THREE.InstancedMesh(tieGeo, tieMat, tieCount);
  for (let i = 0; i < tieCount; i++) {
    const u = i / tieCount;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tan.clone().setY(0).normalize());
    _m4.compose(new THREE.Vector3(_pos.x, _pos.y - 0.05, _pos.z), _q, _s);
    ties.setMatrixAt(i, _m4);
  }
  g.add(ties);
  kit.scene.add(g);
  return g;
}

export function station(kit, o) {
  const g = new THREE.Group();
  const w = o.w || 8, d = o.d || 3;
  const platform = box(w, 0.55, d, M(0x9a948a));
  platform.position.y = 0.27; g.add(platform);
  for (const s of [-w / 2 + 0.6, w / 2 - 0.6]) {
    const p = cyl(0.08, 0.08, 2.6, M(0x4a4f57)); p.position.set(s, 1.6, 0); g.add(p);
  }
  const roof = box(w + 0.6, 0.12, d + 0.5, M(o.roof || 0x8a4438)); roof.position.y = 2.95; g.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshStandardMaterial({ map: textTexture([o.name || "STATION"], { w: 512, h: 128, border: false, bg: "#1d2128", accent: "#ffd166" }) }));
  sign.position.set(0, 2.3, d / 2 + 0.05); g.add(sign);
  const y = kit.groundHeight(o.x, o.z);
  g.position.set(o.x, y, o.z);
  if (o.rot) g.rotation.y = o.rot;
  kit.scene.add(g);
  kit.addCollider({ x: o.x, z: o.z, w: w * Math.abs(Math.cos(o.rot || 0)) + d * Math.abs(Math.sin(o.rot || 0)), d: d * Math.abs(Math.cos(o.rot || 0)) + w * Math.abs(Math.sin(o.rot || 0)) });
  return g;
}

export function locomotive(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const bodyMat = M(o.color || 0x2e5e46, { roughness: 0.5, metalness: 0.3 });
  const boiler = cyl(0.62, 0.62, 2.6, bodyMat, 12);
  boiler.rotation.z = Math.PI / 2; boiler.position.set(0.3, 1.05, 0); g.add(boiler);
  const cab = box(1.2, 1.5, 1.35, bodyMat); cab.position.set(-1.25, 1.25, 0); g.add(cab);
  const roofc = box(1.4, 0.1, 1.5, M(0x23262b)); roofc.position.set(-1.25, 2.05, 0); g.add(roofc);
  const chimney = cyl(0.14, 0.2, 0.6, M(0x23262b), 8); chimney.position.set(1.25, 1.95, 0); g.add(chimney);
  const skirt = box(3.6, 0.5, 1.3, M(0x23262b)); skirt.position.set(0, 0.45, 0); g.add(skirt);
  const wheels = [];
  for (const x of [-1.3, -0.4, 0.5, 1.3]) for (const s of [0.6, -0.6]) {
    const w = cyl(0.34, 0.34, 0.12, M(0x3a3f46, { metalness: 0.4 }), 10);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.34, s); g.add(w); wheels.push(w);
  }
  const lampMat = M(0xfff1cc, { emissive: 0xfff1cc, emissiveIntensity: 1.2 });
  const lamp = cyl(0.16, 0.16, 0.1, lampMat, 8); lamp.rotation.z = Math.PI / 2; lamp.position.set(1.68, 1.05, 0); g.add(lamp);
  g.userData.wheels = wheels;
  return g;
}

export function carriage(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const body = box(3.0, 1.4, 1.3, M(o.color || 0x8a4438, { roughness: 0.6 }));
  body.position.y = 1.05; g.add(body);
  const roof = box(3.15, 0.1, 1.45, M(0x23262b)); roof.position.y = 1.8; g.add(roof);
  const winMat = M(0xbfe2ea, { roughness: 0.2, emissive: 0xffe9c4, emissiveIntensity: 0.12 });
  for (const x of [-1.0, 0, 1.0]) { const win = box(0.6, 0.5, 1.32, winMat); win.position.set(x, 1.25, 0); g.add(win); }
  for (const x of [-1.0, 1.0]) for (const s of [0.6, -0.6]) {
    const w = cyl(0.26, 0.26, 0.12, M(0x3a3f46), 10);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.26, s); g.add(w);
  }
  return g;
}

// a train that runs the line forever; players can ride it from any registered stop.
export function train(kit, curve, opts) {
  const o = opts || {};
  const cars = [];
  const head = locomotive(o);
  kit.scene.add(head);
  cars.push({ mesh: head, back: 0 });
  const n = o.cars !== undefined ? o.cars : 2;
  for (let i = 0; i < n; i++) {
    const c = carriage(o);
    kit.scene.add(c);
    cars.push({ mesh: c, back: 4.0 + i * 3.6 });
  }
  const len = curve.getLength();
  const speed = o.speed || 5.5;
  const state = { u: o.startU || 0 };

  function placeAt(mesh, u, lift) {
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    mesh.position.set(_pos.x, _pos.y + (lift || 0), _pos.z);
    mesh.rotation.y = Math.atan2(_tan.x, _tan.z) - Math.PI / 2 + Math.PI;
  }

  kit.addUpdate((dt) => {
    state.u = (state.u + (speed * dt) / len) % 1;
    for (let i = 0; i < cars.length; i++) {
      const u = ((state.u - cars[i].back / len) % 1 + 1) % 1;
      placeAt(cars[i].mesh, u, 0.12);
      const ws = cars[i].mesh.userData.wheels;
      if (ws) for (let k = 0; k < ws.length; k++) ws[k].rotation.z += (speed * dt) / 0.34;
    }
  });

  return {
    curve, cars, state,
    // ride in the cab: pose tracks the locomotive; duration = one full loop
    makeRide(dismount, label) {
      const self = this;
      return {
        label: label || "the train",
        duration: len / speed,
        dismount: dismount,
        pose(t, out) {
          const u = self.state.u;
          curve.getPointAt(u, _pos);
          curve.getTangentAt(u, _tan);
          out.x = _pos.x - _tan.x * 1.2;
          out.y = _pos.y + 2.0;
          out.z = _pos.z - _tan.z * 1.2;
          out.yaw = Math.atan2(-_tan.x, -_tan.z);
          out.pitch = -0.06;
        },
      };
    },
  };
}

export function crossingSign(kit, x, z) {
  const g = new THREE.Group();
  const post = cyl(0.06, 0.07, 2.6, M(0xd8d2c4)); post.position.y = 1.3; g.add(post);
  const a = box(1.1, 0.18, 0.06, M(0xf2ead8)); a.position.y = 2.3; a.rotation.z = 0.7; g.add(a);
  const b = a.clone(); b.rotation.z = -0.7; g.add(b);
  const y = kit.groundHeight(x, z);
  g.position.set(x, y, z);
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 0.3, d: 0.3 });
  return g;
}

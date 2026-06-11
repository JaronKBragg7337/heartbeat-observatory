// WORLDS LAB · lib v1 · coaster.js — a real, rideable roller coaster.
// Hand the builder a list of [x, y, z] track points (y = height ABOVE terrain at
// that spot is the caller's job to bake in); it lays rails, ties and support
// pillars, runs a 4-cart train with an energy-based speed profile (fast in the
// valleys, slow over the crests), and returns a ride for the kit's ride system.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { textTexture, hazardTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.2 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _s = new THREE.Vector3(1, 1, 1);

export function buildCoaster(kit, points, opts) {
  const o = opts || {};
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.5
  );
  const group = new THREE.Group();
  const N = o.samples || 420;
  const len = curve.getLength();

  // ---- speed profile: v = sqrt(2 g (maxY - y) + vMin^2), warped by pace ----
  const g0 = 9.8, vMin = o.vMin || 5.5, pace = o.pace || 1;
  let maxY = -Infinity;
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    curve.getPointAt(i / N, _pos);
    ys[i] = _pos.y;
    if (_pos.y > maxY) maxY = _pos.y;
  }
  const times = new Float32Array(N + 1);
  const ds = len / N;
  for (let i = 0; i < N; i++) {
    const v = Math.sqrt(2 * g0 * Math.max(0, maxY - ys[i]) + vMin * vMin) * pace;
    times[i + 1] = times[i] + ds / v;
  }
  const total = times[N];

  function uAtTime(t) {
    let tt = t % total; if (tt < 0) tt += total;
    let lo = 0, hi = N;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < tt) lo = mid + 1; else hi = mid; }
    const i = Math.max(1, lo);
    const k = (tt - times[i - 1]) / Math.max(1e-6, times[i] - times[i - 1]);
    return (i - 1 + k) / N;
  }

  // ---- rails (two offset tubes) + ties + supports ----
  const gauge = o.gauge || 0.95;
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    _side.crossVectors(_up, _tan);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0); else _side.normalize();
    left.push(new THREE.Vector3().copy(_pos).addScaledVector(_side, gauge / 2));
    right.push(new THREE.Vector3().copy(_pos).addScaledVector(_side, -gauge / 2));
  }
  const railMat = M(o.railColor || 0xc23b4e, { metalness: 0.5, roughness: 0.35 });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(left, true), N, 0.07, 6, true), railMat));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(right, true), N, 0.07, 6, true), railMat));

  const tieCount = Math.floor(len / 1.1);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(gauge + 0.4, 0.08, 0.3), M(0x3a3f46), tieCount);
  for (let i = 0; i < tieCount; i++) {
    const u = i / tieCount;
    curve.getPointAt(u, _pos);
    curve.getTangentAt(u, _tan);
    _q.setFromUnitVectors(_zAxis, _tan.clone().normalize());
    _m4.compose(_pos, _q, _s);
    ties.setMatrixAt(i, _m4);
  }
  group.add(ties);

  const supMat = M(o.supportColor || 0xd8d2c4, { roughness: 0.6 });
  const supStep = o.supportEvery || 14;
  const supGeo = new THREE.CylinderGeometry(0.09, 0.12, 1, 6);
  const supList = [];
  for (let i = 0; i < N; i += supStep) {
    curve.getPointAt(i / N, _pos);
    const gy = kit.groundHeight(_pos.x, _pos.z);
    const h = _pos.y - 0.2 - gy;
    if (h > 0.6) supList.push([_pos.x, gy, _pos.z, h]);
  }
  const sups = new THREE.InstancedMesh(supGeo, supMat, supList.length);
  supList.forEach((sp, i) => {
    _q.identity();
    _m4.compose(new THREE.Vector3(sp[0], sp[1] + sp[3] / 2, sp[2]), _q, new THREE.Vector3(1, sp[3], 1));
    sups.setMatrixAt(i, _m4);
  });
  group.add(sups);

  // ---- the train (always running, so the park feels alive) ----
  const carts = [];
  const nCarts = o.carts || 4;
  for (let i = 0; i < nCarts; i++) {
    const cart = new THREE.Group();
    const body = box(1.15, 0.5, 0.95, M(i === 0 ? (o.cartA || 0xeec643) : (o.cartB || 0xc24b3e), { metalness: 0.3, roughness: 0.5 }));
    body.position.y = 0.32; cart.add(body);
    const back = box(1.15, 0.4, 0.12, M(0x23262b)); back.position.set(0, 0.62, -0.42); cart.add(back);
    group.add(cart);
    carts.push(cart);
  }

  let clockT = 0;
  kit.addUpdate((dt) => {
    clockT += dt;
    for (let i = 0; i < carts.length; i++) {
      const u = uAtTime(clockT - i * 0.42);
      curve.getPointAt(u, _pos);
      curve.getTangentAt(u, _tan);
      carts[i].position.copy(_pos);
      carts[i].position.y += 0.18;
      carts[i].rotation.set(0, 0, 0);
      carts[i].rotation.y = Math.atan2(_tan.x, _tan.z);
      carts[i].rotation.x = -Math.asin(Math.max(-0.9, Math.min(0.9, _tan.y)));
    }
  });

  kit.scene.add(group);

  // ---- boarding platform at points[0] ----
  const p0 = points[0];
  const py = kit.groundHeight(p0[0], p0[2]);
  const deck = box(4.6, 0.5, 3.4, M(0x6b5436));
  deck.position.set(p0[0] + 2.4, py + 0.25, p0[2]);
  kit.scene.add(deck);
  kit.addCollider({ x: p0[0] + 2.4, z: p0[2], w: 4.6, d: 3.4 });
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshStandardMaterial({ map: hazardTexture({}) }));
  gate.position.set(p0[0] + 2.4, py + 1.4, p0[2] + 1.6);
  kit.scene.add(gate);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshStandardMaterial({ map: textTexture([o.name || "COASTER"], { w: 512, h: 128, border: false, bg: "#1d2128", accent: "#ff6ad8" }) }));
  sign.position.set(p0[0] + 2.4, py + 3.0, p0[2]);
  kit.scene.add(sign);

  // ---- the ride: camera locks to the lead cart for laps full circuits ----
  const ride = {
    label: o.name || "the coaster",
    duration: total * (o.laps || 1),
    dismount: { x: p0[0] + 2.4, z: p0[2] + 2.6 },
    pose(t, out) {
      const u = uAtTime(clockT); // ride the live train, exactly what spectators see
      curve.getPointAt(u, _pos);
      curve.getTangentAt(u, _tan);
      out.x = _pos.x; out.y = _pos.y + 1.05; out.z = _pos.z;
      out.yaw = Math.atan2(-_tan.x, -_tan.z);
      out.pitch = Math.asin(Math.max(-0.85, Math.min(0.85, _tan.y)));
    },
  };

  // board door beside the platform
  kit.addDoor({ label: "Ride " + (o.name || "the coaster"), x: p0[0] + 2.4, z: p0[2], hw: 2.6, hd: 2.2, act: { type: "ride", ride } });

  return { group, curve, ride, duration: total };
}

// helper: build a classic out-and-back coaster point list around a center,
// heights given relative to the terrain under each point.
export function classicLoop(kit, cx, cz, scale) {
  const s = scale || 1;
  const raw = [
    [0, 1.2, 0], [10, 1.4, -2], [18, 7.5, -6], [24, 2.0, -14], [30, 9.5, -20],
    [34, 3.0, -30], [28, 5.5, -38], [18, 2.2, -42], [6, 8.0, -40], [-4, 3.2, -34],
    [-12, 6.5, -26], [-16, 2.0, -16], [-12, 4.5, -8], [-6, 1.6, -2],
  ];
  return raw.map(p => {
    const x = cx + p[0] * s, z = cz + p[2] * s;
    return [x, kit.groundHeight(x, z) + p[1] * s, z];
  });
}

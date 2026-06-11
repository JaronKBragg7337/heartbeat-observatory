// WORLDS LAB · lib v1 · space.js — rockets, UFOs, shuttles, launch pads.
// The rocket is a real ride: countdown, rumble, climb to the edge of the sky,
// a quiet float among the stars, then a parachute-easy descent home.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { metalTexture, hazardTexture, textTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.25 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
const sph = (r, mat, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 12, seg || 12), mat);

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

export function launchPad(kit, x, z, opts) {
  const o = opts || {};
  const gy = kit.groundHeight(x, z);
  const g = new THREE.Group();
  const slab = box(8, 0.6, 8, new THREE.MeshStandardMaterial({ map: metalTexture({ color: "#7a828c" }) }));
  slab.position.y = 0.3; g.add(slab);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.6), new THREE.MeshStandardMaterial({ map: hazardTexture({}) }));
  edge.position.set(0, 0.3, 4.01); g.add(edge);
  // gantry tower
  const towMat = M(0xc23b2e, { metalness: 0.4 });
  for (const [sx, sz] of [[-1, -1], [-1, 1]]) {
    const leg = box(0.22, 12, 0.22, towMat);
    leg.position.set(-2.6, 6, sz * 1.2); g.add(leg);
  }
  for (let i = 0; i < 5; i++) {
    const brace = box(0.16, 0.16, 2.6, towMat);
    brace.position.set(-2.6, 1.6 + i * 2.3, 0); g.add(brace);
    const arm = box(1.6, 0.16, 0.16, towMat);
    arm.position.set(-1.9, 1.6 + i * 2.3, 0); g.add(arm);
  }
  g.position.set(x, gy, z);
  kit.scene.add(g);
  kit.addCollider({ x: x - 2.6, z, w: 1.2, d: 3.2 });
  return g;
}

export function rocket(kit, o) {
  const x = o.x, z = o.z;
  const gy = kit.groundHeight(x, z) + 0.6;
  const g = new THREE.Group();
  const hullMat = M(o.hull || 0xe8e2d6, { roughness: 0.4, metalness: 0.3 });
  const stage = cyl(0.9, 1.05, 7.5, hullMat, 14); stage.position.y = 4.3; g.add(stage);
  const band = cyl(0.95, 0.95, 0.5, M(o.band || 0xc23b2e), 14); band.position.y = 6.2; g.add(band);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 14), M(o.band || 0xc23b2e, { roughness: 0.4 }));
  nose.position.y = 9.15; g.add(nose);
  const winMat = M(0x9fd4e8, { emissive: 0xbfe9ff, emissiveIntensity: 0.3, roughness: 0.2 });
  const win = sph(0.28, winMat, 10); win.position.set(0, 6.9, 0.78); g.add(win);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const fin = box(0.12, 2.2, 1.3, M(o.band || 0xc23b2e));
    fin.position.set(Math.cos(a) * 1.0, 1.4, Math.sin(a) * 1.0);
    fin.rotation.y = -a;
    g.add(fin);
  }
  const nozzle = cyl(0.55, 0.8, 0.9, M(0x3a3f46, { metalness: 0.6 }), 12); nozzle.position.y = 0.2; g.add(nozzle);
  const flameMat = M(0xffa53e, { emissive: 0xff7a26, emissiveIntensity: 2.0, transparent: true, opacity: 0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 10), flameMat);
  flame.rotation.x = Math.PI; flame.position.y = -1.6; g.add(flame);

  g.position.set(x, gy, z);
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 2.6, d: 2.6 });

  const apogee = o.apogee || 120;
  const climb = o.climb || 14, hold = o.hold || 8, fall = o.fall || 12, count = 4;
  const duration = count + climb + hold + fall;
  let phase = 0; // live height driver (rocket mesh follows the ride)
  let active = false;

  kit.addUpdate((dt, t) => {
    if (!active) { flameMat.opacity = 0; return; }
  });

  function heightAt(t) {
    if (t < count) return 0;
    const tt = t - count;
    if (tt < climb) { const k = tt / climb; return apogee * k * k * (3 - 2 * k); } // smooth
    if (tt < climb + hold) return apogee;
    const k = Math.min(1, (tt - climb - hold) / fall);
    return apogee * (1 - (k * k * (3 - 2 * k)));
  }

  const ride = {
    label: o.name || "the rocket",
    duration,
    dismount: { x: x + 2.6, z: z + 2.6 },
    onStart() { active = true; },
    onEnd() { active = false; flameMat.opacity = 0; g.position.set(x, gy, z); },
    pose(t, out) {
      const h = heightAt(t);
      const thrust = t > count && t < count + climb;
      flameMat.opacity = thrust ? 0.95 : (t >= count + climb + (o.hold || 8) ? 0.25 : 0);
      const shake = (t < count ? 0.01 : (thrust ? 0.05 : 0.0));
      g.position.set(x + (Math.random() - 0.5) * shake * 2, gy + h, z + (Math.random() - 0.5) * shake * 2);
      out.x = g.position.x; out.y = gy + h + 6.9; out.z = g.position.z + 0.2;
      out.yaw = t * 0.06; // slow majestic pan
      out.pitch = t < count ? 0.5 : (h >= apogee ? -0.45 : 0.35);
    },
  };
  kit.addDoor({ label: "Launch — " + (o.name || "the rocket"), x: x + 2.2, z: z + 2.2, hw: 2.6, hd: 2.6, act: { type: "ride", ride } });
  return { group: g, ride };
}

export function ufo(kit, o) {
  const g = new THREE.Group();
  const hullMat = M(o.hull || 0x8b95a0, { metalness: 0.7, roughness: 0.25 });
  const saucer = sph(1.6, hullMat, 16); saucer.scale.set(1, 0.28, 1); g.add(saucer);
  const domeMat = M(0x9fe8d8, { transparent: true, opacity: 0.7, emissive: 0x4ad8c4, emissiveIntensity: 0.5, roughness: 0.1 });
  const dome = sph(0.62, domeMat, 12); dome.scale.y = 0.8; dome.position.y = 0.3; g.add(dome);
  const glowMat = M(0x9ae8ff, { emissive: 0x36e6ff, emissiveIntensity: 1.5 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lamp = sph(0.09, glowMat, 6);
    lamp.position.set(Math.cos(a) * 1.25, -0.08, Math.sin(a) * 1.25);
    g.add(lamp);
  }
  const pts = o.path || [[-30, 22, -30], [30, 26, -20], [20, 20, 30], [-25, 28, 20]];
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.5);
  const len = curve.getLength();
  const speed = o.speed || 7;
  let u = Math.random();
  kit.scene.add(g);
  kit.addUpdate((dt, t) => {
    u = (u + (speed * dt) / len) % 1;
    curve.getPointAt(u, _pos);
    g.position.copy(_pos);
    g.position.y += Math.sin(t * 2.2) * 0.4;
    g.rotation.y += dt * 1.4;
    g.rotation.z = Math.sin(t * 1.1) * 0.08;
  });
  return { group: g, curve };
}

export function shuttleDisplay(kit, o) {
  const x = o.x, z = o.z;
  const gy = kit.groundHeight(x, z);
  const g = new THREE.Group();
  const hullMat = M(0xe8e2d6, { roughness: 0.45 });
  const body = cyl(0.7, 0.7, 4.6, hullMat, 12);
  body.rotation.z = Math.PI / 2; body.position.y = 1.6; g.add(body);
  const noseC = sph(0.7, hullMat, 12); noseC.scale.set(1.4, 1, 1); noseC.position.set(2.3, 1.6, 0); g.add(noseC);
  const tailMat = M(0x3a3f46);
  const wing = box(2.6, 0.12, 3.6, tailMat); wing.position.set(-1.0, 1.2, 0); g.add(wing);
  const fin = box(1.4, 1.6, 0.12, tailMat); fin.position.set(-2.2, 2.5, 0); g.add(fin);
  for (const s of [-0.4, 0.4]) { const eng = cyl(0.22, 0.3, 0.5, M(0x23262b), 8); eng.rotation.z = Math.PI / 2; eng.position.set(-2.45, 1.45, s); g.add(eng); }
  const stand = box(0.4, 1.0, 0.4, M(0x4a4f57)); stand.position.set(0, 0.5, 0); g.add(stand);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshStandardMaterial({ map: textTexture([o.name || "ORBITER · museum piece"], { w: 512, h: 128, border: false, bg: "#171b21", accent: "#9ae8ff" }) }));
  plaque.position.set(0, 0.8, 1.6); g.add(plaque);
  g.position.set(x, gy, z);
  if (o.rot) g.rotation.y = o.rot;
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 5.4, d: 3.8 });
  return g;
}

export function satelliteDish(kit, x, z, opts) {
  const o = opts || {};
  const gy = kit.groundHeight(x, z);
  const g = new THREE.Group();
  const base = cyl(0.5, 0.7, 1.1, M(0x4a4f57), 10); base.position.y = 0.55; g.add(base);
  const dishGroup = new THREE.Group(); dishGroup.position.y = 1.3;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), M(0xd8d2c4, { side: THREE.DoubleSide, roughness: 0.5 }));
  dish.rotation.x = Math.PI / 1.6;
  dishGroup.add(dish);
  const feed = cyl(0.04, 0.04, 1.2, M(0x8a8f96), 6); feed.rotation.x = Math.PI / 3; feed.position.set(0, 0.4, 0.5); dishGroup.add(feed);
  g.add(dishGroup);
  kit.addUpdate((dt, t) => { dishGroup.rotation.y = Math.sin(t * 0.12) * 1.2; });
  g.position.set(x, gy, z);
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 1.6, d: 1.6 });
  return g;
}

export function moonBuggy(kit, x, z, rot) {
  const g = new THREE.Group();
  const frame = box(1.8, 0.16, 1.2, M(0xc2c8d0, { metalness: 0.5 })); frame.position.y = 0.55; g.add(frame);
  const seat = box(0.6, 0.5, 0.9, M(0xeec643)); seat.position.set(-0.3, 0.95, 0); g.add(seat);
  const dishSmall = sph(0.3, M(0xd8d2c4, { side: THREE.DoubleSide }), 8); dishSmall.scale.y = 0.4; dishSmall.position.set(0.7, 1.2, 0); g.add(dishSmall);
  for (const [sx, sz] of [[0.7, 0.65], [-0.7, 0.65], [0.7, -0.65], [-0.7, -0.65]]) {
    const wheelMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 6, 12), M(0x6b7077));
    wheelMesh.position.set(sx, 0.36, sz);
    g.add(wheelMesh);
  }
  const gy = kit.groundHeight(x, z);
  g.position.set(x, gy, z);
  if (rot) g.rotation.y = rot;
  kit.scene.add(g);
  kit.addCollider({ x, z, w: 2.0, d: 1.5 });
  return g;
}

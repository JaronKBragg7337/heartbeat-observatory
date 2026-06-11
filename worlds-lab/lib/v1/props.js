// WORLDS LAB · lib v1 · props.js — code-built props, no asset library (house rule).
// Every prop returns a THREE.Group. group.userData.footprint = {w,d} marks solid props;
// place() drops a prop on the terrain and registers its collider with the kit.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { textTexture, stripeTexture, mulberry32 } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
const sph = (r, mat, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 12, seg || 12), mat);

// drop a prop on the ground at (x,z); registers a collider when the prop is solid
export function place(kit, group, x, z, rotY) {
  const y = kit.groundY ? kit.groundHeight(x, z) : 0;
  group.position.set(x, y, z);
  if (rotY) group.rotation.y = rotY;
  kit.scene.add(group);
  const fp = group.userData.footprint;
  if (fp) kit.addCollider({ x, z, w: fp.w, d: fp.d });
  return group;
}

export function streetLamp(kit, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const post = cyl(0.07, 0.09, 3.6, M(o.post || 0x2c333b)); post.position.y = 1.8; g.add(post);
  const arm = box(0.9, 0.08, 0.08, M(o.post || 0x2c333b)); arm.position.set(0.4, 3.5, 0); g.add(arm);
  const bulbMat = M(o.warm || 0xffd9a0, { emissive: o.warm || 0xffd9a0, emissiveIntensity: 0.1 });
  const bulb = sph(0.16, bulbMat, 10); bulb.position.set(0.82, 3.42, 0); g.add(bulb);
  if (kit && kit.bindEmissive) kit.bindEmissive(bulbMat, 2.2, 0.08);
  g.userData.footprint = { w: 0.3, d: 0.3 };
  return g;
}

export function bench(opts) {
  const o = opts || {};
  const wood = M(o.wood || 0x8a6844);
  const iron = M(0x33383f);
  const g = new THREE.Group();
  const seat = box(1.7, 0.08, 0.5, wood); seat.position.y = 0.5; g.add(seat);
  const back = box(1.7, 0.45, 0.07, wood); back.position.set(0, 0.85, -0.22); back.rotation.x = -0.16; g.add(back);
  for (const s of [-0.7, 0.7]) { const leg = box(0.08, 0.5, 0.45, iron); leg.position.set(s, 0.25, 0); g.add(leg); }
  g.userData.footprint = { w: 1.8, d: 0.7 };
  return g;
}

export function fenceSegment(opts) {
  const o = opts || {};
  const mat = M(o.color || 0xd8d2c4);
  const g = new THREE.Group();
  for (let i = 0; i <= 4; i++) { const p = box(0.09, 0.85, 0.09, mat); p.position.set(-1.4 + i * 0.7, 0.42, 0); g.add(p); }
  for (const y of [0.32, 0.68]) { const r = box(3.0, 0.07, 0.06, mat); r.position.y = y; g.add(r); }
  g.userData.footprint = { w: 3.0, d: 0.25 };
  return g;
}

export function planter(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const pot = box(1.1, 0.5, 1.1, M(o.pot || 0x7a6f60)); pot.position.y = 0.25; g.add(pot);
  const soil = box(0.95, 0.08, 0.95, M(0x4a3a2c)); soil.position.y = 0.52; g.add(soil);
  const rnd = mulberry32(o.seed || 5);
  for (let i = 0; i < 5; i++) {
    const f = sph(0.12, M([0xe2574c, 0xeec643, 0xc06ad8, 0xe8855e][i % 4]), 8);
    f.position.set((rnd() - 0.5) * 0.7, 0.66, (rnd() - 0.5) * 0.7);
    g.add(f);
  }
  g.userData.footprint = { w: 1.2, d: 1.2 };
  return g;
}

export function tree(kind, opts) {
  const o = opts || {};
  const rnd = mulberry32(o.seed || 9);
  const g = new THREE.Group();
  const k = kind || "oak";
  if (k === "pine" || k === "snowy") {
    const trunk = cyl(0.12, 0.2, 1.4, M(0x6b4a30)); trunk.position.y = 0.7; g.add(trunk);
    const leaf = M(k === "snowy" ? 0x4d6b52 : 0x3f6b3f);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25 - i * 0.34, 1.25, 9), leaf);
      cone.position.y = 1.45 + i * 0.85; g.add(cone);
      if (k === "snowy") { const cap = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.3, 0.35, 9), M(0xeef3f8)); cap.position.y = 1.95 + i * 0.85; g.add(cap); }
    }
  } else if (k === "palm") {
    const trunk = cyl(0.1, 0.18, 2.6, M(0x9a7a54)); trunk.position.y = 1.3; trunk.rotation.z = 0.12; g.add(trunk);
    const leaf = M(0x4d8f4a);
    for (let i = 0; i < 6; i++) {
      const frond = box(1.7, 0.04, 0.34, leaf);
      frond.position.set(Math.cos(i) * 0.7 + 0.28, 2.66, Math.sin(i) * 0.7);
      frond.rotation.set(0, (i / 6) * Math.PI * 2, -0.5);
      g.add(frond);
    }
  } else if (k === "dead") {
    const trunk = cyl(0.1, 0.22, 2.2, M(0x4d4339)); trunk.position.y = 1.1; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const b = cyl(0.04, 0.07, 1.1, M(0x4d4339));
      b.position.set((rnd() - 0.5) * 0.6, 1.5 + rnd() * 0.7, (rnd() - 0.5) * 0.6);
      b.rotation.z = 0.6 + rnd(); g.add(b);
    }
  } else { // oak / broadleaf
    const trunk = cyl(0.14, 0.24, 1.5, M(0x6b4a30)); trunk.position.y = 0.75; g.add(trunk);
    const leaf = M(o.autumn ? 0xc78f3a : 0x4d7d3f);
    for (let i = 0; i < 3; i++) {
      const puff = sph(0.95 - i * 0.12, leaf, 9);
      puff.position.set((rnd() - 0.5) * 0.8, 1.9 + i * 0.55, (rnd() - 0.5) * 0.8);
      g.add(puff);
    }
  }
  g.userData.footprint = { w: 0.55, d: 0.55 };
  return g;
}

export function rock(opts) {
  const o = opts || {};
  const rnd = mulberry32(o.seed || 13);
  const g = new THREE.Group();
  const m = M(o.color || 0x84817a);
  for (let i = 0; i < 3; i++) {
    const r = sph(0.34 + rnd() * 0.4, m, 6);
    r.scale.y = 0.65;
    r.position.set((rnd() - 0.5) * 0.9, 0.2, (rnd() - 0.5) * 0.9);
    g.add(r);
  }
  g.userData.footprint = { w: 1.3, d: 1.3 };
  return g;
}

export function fountain(kit, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const basin = cyl(2.2, 2.4, 0.55, M(o.stone || 0x9a958c), 18); basin.position.y = 0.27; g.add(basin);
  const water = cyl(1.95, 1.95, 0.1, M(0x4aa6d8, { transparent: true, opacity: 0.85, roughness: 0.25 }), 18); water.position.y = 0.5; g.add(water);
  const column = cyl(0.22, 0.3, 1.3, M(o.stone || 0x9a958c)); column.position.y = 1.1; g.add(column);
  const top = cyl(0.75, 0.85, 0.18, M(o.stone || 0x9a958c), 14); top.position.y = 1.8; g.add(top);
  const jetMat = M(0x9fd8f2, { transparent: true, opacity: 0.8 });
  const jet = cyl(0.07, 0.16, 0.9, jetMat, 8); jet.position.y = 2.3; g.add(jet);
  if (kit && kit.addUpdate) kit.addUpdate((dt, t) => { jet.scale.y = 0.85 + Math.sin(t * 3.1) * 0.15; water.position.y = 0.5 + Math.sin(t * 2.2) * 0.012; });
  g.userData.footprint = { w: 4.6, d: 4.6 };
  return g;
}

export function signPost(lines, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const post = cyl(0.06, 0.08, 1.7, M(0x4a4036)); post.position.y = 0.85; g.add(post);
  const tex = textTexture(lines, { w: 512, h: 256, accent: o.accent || "#7bd88f" });
  const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), boardMat);
  board.position.y = 2.15; g.add(board);
  const back = box(2.0, 1.0, 0.06, M(0x2c2620)); back.position.set(0, 2.15, -0.04); g.add(back);
  g.userData.footprint = { w: 0.3, d: 0.3 };
  return g;
}

export function bigSign(lines, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const w = o.w || 6, h = o.h || 2.6;
  for (const s of [-w / 2 + 0.3, w / 2 - 0.3]) { const p = cyl(0.12, 0.14, 3.4, M(0x3a3f46)); p.position.set(s, 1.7, 0); g.add(p); }
  const tex = textTexture(lines, { w: 1024, h: 420, accent: o.accent || "#ffd166", font: "bold 84px system-ui, sans-serif", subFont: "44px system-ui, sans-serif" });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  face.position.y = 3.4 + h / 2 - 1.4; g.add(face);
  const back = box(w, h, 0.12, M(0x23262b)); back.position.set(0, face.position.y, -0.08); g.add(back);
  g.userData.footprint = { w: w, d: 0.5 };
  return g;
}

export function foodCart(name, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const body = box(2.0, 1.1, 1.1, M(o.color || 0xd8623e)); body.position.y = 0.95; g.add(body);
  for (const s of [-0.7, 0.7]) { const wheel = cyl(0.3, 0.3, 0.1, M(0x23262b), 12); wheel.rotation.z = Math.PI / 2; wheel.position.set(s, 0.3, 0.5); g.add(wheel); }
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2), new THREE.MeshStandardMaterial({ map: stripeTexture({ a: o.stripeA || "#e2574c", b: "#f2ead8", n: 6 }), side: THREE.DoubleSide }));
  awning.position.set(0, 2.2, 0.35); awning.rotation.x = -0.5; g.add(awning);
  for (const s of [-1.05, 1.05]) { const p = cyl(0.04, 0.04, 1.7, M(0x8a8f96)); p.position.set(s, 1.3, 0.52); g.add(p); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: textTexture([name || "SNACKS"], { w: 512, h: 128, border: false, bg: "#1d2128", accent: "#ffd166" }) }));
  sign.position.set(0, 1.62, 0.561); g.add(sign);
  g.userData.footprint = { w: 2.2, d: 1.3 };
  return g;
}

export function trashBin() {
  const g = new THREE.Group();
  const b = cyl(0.32, 0.28, 0.85, M(0x3e6b4f), 10); b.position.y = 0.42; g.add(b);
  const rim = cyl(0.36, 0.36, 0.08, M(0x2c333b), 10); rim.position.y = 0.88; g.add(rim);
  g.userData.footprint = { w: 0.7, d: 0.7 };
  return g;
}

export function hydrant() {
  const g = new THREE.Group();
  const b = cyl(0.18, 0.22, 0.7, M(0xc23b2e), 10); b.position.y = 0.35; g.add(b);
  const cap = sph(0.16, M(0xc23b2e), 8); cap.position.y = 0.74; g.add(cap);
  for (const s of [-0.2, 0.2]) { const n = cyl(0.07, 0.07, 0.16, M(0xd8d2c4), 8); n.rotation.z = Math.PI / 2; n.position.set(s, 0.5, 0); g.add(n); }
  g.userData.footprint = { w: 0.5, d: 0.5 };
  return g;
}

export function picnicTable(opts) {
  const o = opts || {};
  const wood = M(o.wood || 0x9a7048);
  const g = new THREE.Group();
  const top = box(1.8, 0.07, 0.9, wood); top.position.y = 0.72; g.add(top);
  for (const s of [-0.62, 0.62]) { const seat = box(1.8, 0.06, 0.3, wood); seat.position.set(0, 0.44, s); g.add(seat); }
  for (const s of [-0.7, 0.7]) { const leg = box(0.08, 0.72, 1.5, wood); leg.position.set(s, 0.36, 0); g.add(leg); }
  g.userData.footprint = { w: 2.0, d: 1.7 };
  return g;
}

export function statue(kit, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const base = box(1.4, 0.9, 1.4, M(0x8d8d86)); base.position.y = 0.45; g.add(base);
  const figMat = M(o.bronze || 0x8a6f3e, { metalness: 0.6, roughness: 0.4 });
  const body = cyl(0.22, 0.34, 1.2, figMat); body.position.y = 1.5; g.add(body);
  const head = sph(0.24, figMat, 10); head.position.y = 2.25; g.add(head);
  const arm = cyl(0.07, 0.07, 0.8, figMat); arm.position.set(0.3, 1.8, 0); arm.rotation.z = -1.1; g.add(arm);
  if (o.plaque) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.45), new THREE.MeshStandardMaterial({ map: textTexture(o.plaque, { w: 512, h: 200, border: false }) }));
    p.position.set(0, 0.62, 0.71); g.add(p);
  }
  g.userData.footprint = { w: 1.6, d: 1.6 };
  return g;
}

export function snowman() {
  const g = new THREE.Group();
  const snow = M(0xf2f6fa);
  const a = sph(0.62, snow, 12); a.position.y = 0.55; g.add(a);
  const b = sph(0.45, snow, 12); b.position.y = 1.4; g.add(b);
  const c = sph(0.3, snow, 12); c.position.y = 2.0; g.add(c);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), M(0xe2853e)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.0, 0.32); g.add(nose);
  for (const s of [-0.1, 0.1]) { const e = sph(0.035, M(0x23262b), 6); e.position.set(s, 2.1, 0.27); g.add(e); }
  g.userData.footprint = { w: 1.2, d: 1.2 };
  return g;
}

export function cactus(opts) {
  const o = opts || {};
  const m = M(0x4d8f4a);
  const g = new THREE.Group();
  const body = cyl(0.22, 0.26, 1.9, m, 9); body.position.y = 0.95; g.add(body);
  for (const s of [-1, 1]) {
    const arm = cyl(0.13, 0.13, 0.8, m, 8);
    arm.position.set(0.34 * s, 1.25, 0); arm.rotation.z = s * 0.5; g.add(arm);
    const tip = cyl(0.12, 0.13, 0.5, m, 8); tip.position.set(0.55 * s, 1.7, 0); g.add(tip);
  }
  g.userData.footprint = { w: 0.7, d: 0.7 };
  return g;
}

export function marketStall(name, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const counter = box(2.6, 1.0, 1.2, M(o.wood || 0x8a6844)); counter.position.y = 0.5; g.add(counter);
  for (const s of [-1.2, 1.2]) { const p = cyl(0.06, 0.06, 2.4, M(0x6b5436)); p.position.set(s, 1.2, -0.5); g.add(p); }
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.6), new THREE.MeshStandardMaterial({ map: stripeTexture({ a: o.stripeA || "#c06ad8", b: "#f2ead8", n: 8 }), side: THREE.DoubleSide }));
  roof.position.set(0, 2.45, -0.1); roof.rotation.x = -0.35; g.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshStandardMaterial({ map: textTexture([name || "STALL"], { w: 512, h: 128, border: false, bg: "#1d2128", accent: "#7bd88f" }) }));
  sign.position.set(0, 1.3, 0.62); g.add(sign);
  g.userData.footprint = { w: 2.8, d: 1.4 };
  return g;
}

export function balloonBunch(kit, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const colors = o.colors || [0xe2574c, 0xeec643, 0x4aa6d8, 0xc06ad8];
  const balls = [];
  colors.forEach((c, i) => {
    const b = sph(0.28, M(c, { roughness: 0.4 }), 10);
    b.position.set(Math.cos(i * 1.7) * 0.3, 2.3 + (i % 2) * 0.34, Math.sin(i * 1.7) * 0.3);
    g.add(b); balls.push(b);
    const string = cyl(0.008, 0.008, 1.6, M(0xd8d2c4), 4);
    string.position.set(b.position.x * 0.5, 1.35, b.position.z * 0.5);
    g.add(string);
  });
  if (kit && kit.addUpdate) kit.addUpdate((dt, t) => { balls.forEach((b, i) => { b.position.y = 2.3 + (i % 2) * 0.34 + Math.sin(t * 1.3 + i) * 0.06; }); });
  g.userData.footprint = { w: 0.4, d: 0.4 };
  return g;
}

export function torch(kit) {
  const g = new THREE.Group();
  const post = cyl(0.05, 0.07, 1.5, M(0x4a3a2c)); post.position.y = 0.75; g.add(post);
  const flameMat = M(0xff9a3e, { emissive: 0xff7a26, emissiveIntensity: 1.4 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 7), flameMat);
  flame.position.y = 1.7; g.add(flame);
  if (kit && kit.addUpdate) kit.addUpdate((dt, t) => { flame.scale.setScalar(0.9 + Math.sin(t * 9.7 + g.position.x) * 0.13); });
  g.userData.footprint = { w: 0.25, d: 0.25 };
  return g;
}

export function crateStack(opts) {
  const o = opts || {};
  const rnd = mulberry32(o.seed || 21);
  const wood = M(0x9a7a54);
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = box(0.7, 0.7, 0.7, wood);
    c.position.set((rnd() - 0.5) * 0.4, 0.35 + i * 0.7 * (i < 2 ? 1 : 0.99), (rnd() - 0.5) * 0.4);
    if (i === 2) c.position.set(0.1, 1.05, 0.1);
    c.rotation.y = rnd() * 0.5; g.add(c);
  }
  g.userData.footprint = { w: 1.2, d: 1.2 };
  return g;
}

export function barrel() {
  const g = new THREE.Group();
  const b = cyl(0.34, 0.34, 0.95, M(0x8a6034), 12); b.position.y = 0.47;
  b.scale.x = 1.08; g.add(b);
  for (const y of [0.2, 0.75]) { const ring = cyl(0.37, 0.37, 0.05, M(0x3a3f46), 12); ring.position.y = y; g.add(ring); }
  g.userData.footprint = { w: 0.75, d: 0.75 };
  return g;
}

export function beachUmbrella(opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const pole = cyl(0.04, 0.05, 2.3, M(0xd8d2c4)); pole.position.y = 1.15; pole.rotation.z = 0.12; g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 10), new THREE.MeshStandardMaterial({ map: stripeTexture({ a: o.a || "#e2574c", b: "#f2ead8", n: 10 }), side: THREE.DoubleSide }));
  top.position.set(0.26, 2.3, 0); g.add(top);
  const towel = box(1.7, 0.03, 0.8, M(o.towel || 0x4aa6d8)); towel.position.set(0.9, 0.03, 0.5); g.add(towel);
  g.userData.footprint = { w: 0.3, d: 0.3 };
  return g;
}

export function coralCluster(opts) {
  const o = opts || {};
  const rnd = mulberry32(o.seed || 27);
  const g = new THREE.Group();
  const colors = [0xe2574c, 0xc06ad8, 0xeec643, 0x4ad8c4];
  for (let i = 0; i < 6; i++) {
    const c = cyl(0.05 + rnd() * 0.1, 0.12, 0.5 + rnd() * 1.0, M(colors[i % 4], { roughness: 0.6 }), 7);
    c.position.set((rnd() - 0.5) * 1.4, (0.5 + rnd() * 0.4) / 2, (rnd() - 0.5) * 1.4);
    c.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5);
    g.add(c);
  }
  g.userData.footprint = { w: 1.6, d: 1.6 };
  return g;
}

export function arcadeCabinet(name, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const body = box(0.9, 1.9, 0.8, M(o.color || 0x3a3f6b)); body.position.y = 0.95; g.add(body);
  const screenMat = M(0x101820, { emissive: o.glow || 0x36e6ff, emissiveIntensity: 0.7 });
  const screen = box(0.7, 0.5, 0.04, screenMat); screen.position.set(0, 1.35, 0.41); screen.rotation.x = -0.12; g.add(screen);
  const deck = box(0.8, 0.08, 0.34, M(0x23262b)); deck.position.set(0, 0.98, 0.46); g.add(deck);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.26), new THREE.MeshStandardMaterial({ map: textTexture([name || "GAME"], { w: 512, h: 128, border: false, bg: "#0d1018", accent: "#ff6ad8" }) }));
  sign.position.set(0, 1.78, 0.42); g.add(sign);
  g.userData.footprint = { w: 1.0, d: 0.95 };
  return g;
}

export function telescope() {
  const g = new THREE.Group();
  const legs = M(0x4a4f57);
  for (let i = 0; i < 3; i++) {
    const l = cyl(0.03, 0.03, 1.3, legs, 6);
    l.position.set(Math.cos((i / 3) * 6.28) * 0.3, 0.6, Math.sin((i / 3) * 6.28) * 0.3);
    l.rotation.z = Math.cos((i / 3) * 6.28) * 0.4;
    l.rotation.x = -Math.sin((i / 3) * 6.28) * 0.4;
    g.add(l);
  }
  const tube = cyl(0.1, 0.13, 1.0, M(0xc2c8d0, { metalness: 0.5, roughness: 0.35 }), 10);
  tube.position.y = 1.35; tube.rotation.x = -0.7; g.add(tube);
  g.userData.footprint = { w: 0.8, d: 0.8 };
  return g;
}

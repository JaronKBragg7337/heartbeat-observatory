// WORLDS LAB · lib v1 · rides.js — fairground rides: ferris wheel, carousel, swings.
// All three run continuously (an alive park) and are boardable through the kit's
// ride system. Phone + desktop identical: walk close, tap/press E, ride, hop off.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { stripeTexture, textTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.12 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);

export function ferrisWheel(kit, o) {
  const x = o.x, z = o.z, R = o.r || 9, n = o.gondolas || 8;
  const gy = kit.groundHeight(x, z);
  const root = new THREE.Group();
  root.position.set(x, gy, z);

  // A-frame supports
  const supMat = M(o.frame || 0x4a6b8f, { metalness: 0.4, roughness: 0.5 });
  for (const s of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const leg = cyl(0.14, 0.2, R + 3.4, supMat, 8);
      leg.position.set(lean * (R * 0.32), (R + 3) / 2, s * 1.3);
      leg.rotation.z = lean * 0.32;
      root.add(leg);
    }
  }
  const axle = cyl(0.22, 0.22, 3.2, supMat, 10);
  axle.rotation.x = Math.PI / 2;
  axle.position.y = R + 1.2;
  root.add(axle);

  // the wheel (rotates about the z axis of the root)
  const wheel = new THREE.Group();
  wheel.position.y = R + 1.2;
  const rimMat = M(o.rim || 0xd8d2c4, { metalness: 0.3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 8, 40), rimMat);
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.45, 0.08, 6, 28), rimMat);
  wheel.add(rim2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spoke = box(0.1, R, 0.1, rimMat);
    spoke.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
  }
  root.add(wheel);

  // gondolas hang level (counter-rotated every frame)
  const colors = [0xc24b3e, 0xeec643, 0x3e7bc2, 0x4d8f4a, 0xc06ad8, 0xe8855e];
  const gondolas = [];
  for (let i = 0; i < n; i++) {
    const gn = new THREE.Group();
    const cab = box(1.3, 0.9, 1.0, M(colors[i % colors.length]));
    cab.position.y = -0.85;
    gn.add(cab);
    const roof = box(1.45, 0.08, 1.15, M(0x23262b)); roof.position.y = -0.36; gn.add(roof);
    const arm = cyl(0.05, 0.05, 0.5, rimMat, 6); arm.position.y = -0.18; gn.add(arm);
    wheel.add(gn);
    gondolas.push(gn);
  }

  const speed = o.speed || 0.16; // radians/sec — gentle
  let angle = 0;
  kit.addUpdate((dt) => {
    angle += speed * dt;
    wheel.rotation.z = angle;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      gondolas[i].position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      gondolas[i].rotation.z = -angle; // stay level
    }
  });

  kit.scene.add(root);
  kit.addCollider({ x, z, w: 3.2, d: 3.0 });

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ map: textTexture([o.name || "SKY WHEEL"], { w: 512, h: 128, border: false, bg: "#1d2128", accent: "#7bd8ff" }) }));
  sign.position.set(x, gy + 2.6, z + 2.4);
  kit.scene.add(sign);

  // ride gondola 0: world-space pose mirrors the running wheel
  const ride = {
    label: o.name || "the ferris wheel",
    duration: (Math.PI * 2 / speed) * (o.revolutions || 1.25),
    dismount: { x: x + 3.4, z: z + 3.4 },
    pose(t, out) {
      const a = angle; // live wheel angle
      const gx = Math.cos(a) * R, gyy = Math.sin(a) * R;
      out.x = x + gx;
      out.y = gy + R + 1.2 + gyy - 0.55;
      out.z = z;
      out.yaw = Math.PI / 2 + (o.faceOut ? 0 : 0);
      out.pitch = -0.05;
    },
  };
  kit.addDoor({ label: "Ride " + (o.name || "the ferris wheel"), x: x + 2.6, z: z + 2.4, hw: 2.4, hd: 2.4, act: { type: "ride", ride } });
  return { root, ride };
}

export function carousel(kit, o) {
  const x = o.x, z = o.z, R = o.r || 4.2, n = o.horses || 8;
  const gy = kit.groundHeight(x, z);
  const root = new THREE.Group();
  root.position.set(x, gy, z);

  const base = cyl(R + 0.8, R + 1.0, 0.4, M(0x8a4438), 20); base.position.y = 0.2; root.add(base);
  const spinner = new THREE.Group(); spinner.position.y = 0.4; root.add(spinner);
  const floor = cyl(R + 0.5, R + 0.5, 0.14, new THREE.MeshStandardMaterial({ map: stripeTexture({ a: "#c24b3e", b: "#f2ead8", n: 16 }) }), 20);
  floor.position.y = 0.07; spinner.add(floor);
  const pole = cyl(0.3, 0.34, 3.4, M(0xd8b021, { metalness: 0.5 }), 10); pole.position.y = 1.8; spinner.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(R + 1.0, 1.4, 18), new THREE.MeshStandardMaterial({ map: stripeTexture({ a: "#e8b53a", b: "#c24b3e", n: 18 }) }));
  top.position.y = 4.1; spinner.add(top);

  const horseColors = [0xf2ead8, 0x9ac4e8, 0xe8a0b4, 0xc8b8e8];
  const horses = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = new THREE.Group();
    const body = box(0.95, 0.45, 0.34, M(horseColors[i % 4])); body.position.y = 1.25; h.add(body);
    const head = box(0.3, 0.45, 0.26, M(horseColors[i % 4])); head.position.set(0.55, 1.6, 0); head.rotation.z = -0.4; h.add(head);
    for (const lx of [-0.32, 0.32]) for (const lz of [-0.1, 0.1]) {
      const leg = cyl(0.05, 0.04, 0.55, M(horseColors[i % 4]), 6); leg.position.set(lx, 0.9, lz); h.add(leg);
    }
    const hp = cyl(0.035, 0.035, 2.6, M(0xd8b021, { metalness: 0.6 }), 6); hp.position.set(0, 1.7, 0); h.add(hp);
    h.position.set(Math.cos(a) * R, 0.14, Math.sin(a) * R);
    h.rotation.y = -a - Math.PI / 2;
    spinner.add(h);
    horses.push({ g: h, phase: i });
  }

  const speed = o.speed || 0.42;
  let angle = 0;
  kit.addUpdate((dt, t) => {
    angle += speed * dt;
    spinner.rotation.y = angle;
    for (let i = 0; i < horses.length; i++) {
      horses[i].g.position.y = 0.14 + Math.abs(Math.sin(t * 1.6 + horses[i].phase)) * 0.3;
    }
  });

  kit.scene.add(root);
  kit.addCollider({ x, z, w: (R + 1) * 2 * 0.5, d: (R + 1) * 2 * 0.5 });

  const ride = {
    label: o.name || "the carousel",
    duration: (Math.PI * 2 / speed) * (o.revolutions || 2),
    dismount: { x: x + R + 2.2, z: z + 1.5 },
    pose(t, out) {
      const a = angle; // live spinner angle; horse 0 sits at local angle 0
      const hx = Math.cos(a) * R, hz = -Math.sin(a) * R;
      out.x = x + hx;
      out.y = gy + 0.54 + 1.25 + Math.abs(Math.sin((t) * 1.6)) * 0.3;
      out.z = z + hz;
      out.yaw = a + Math.PI; // face direction of travel (tangent)
      out.pitch = -0.04;
    },
  };
  kit.addDoor({ label: "Ride " + (o.name || "the carousel"), x: x + R + 1.6, z: z, hw: 2.2, hd: 2.2, act: { type: "ride", ride } });
  return { root, ride };
}

export function swingRide(kit, o) {
  const x = o.x, z = o.z, R = o.r || 3.4, n = o.chairs || 8;
  const gy = kit.groundHeight(x, z);
  const root = new THREE.Group();
  root.position.set(x, gy, z);
  const mast = cyl(0.3, 0.42, 7.2, M(0x4a6b8f, { metalness: 0.4 }), 10); mast.position.y = 3.6; root.add(mast);
  const hub = new THREE.Group(); hub.position.y = 6.8; root.add(hub);
  const disc = cyl(R + 0.6, R + 0.6, 0.25, new THREE.MeshStandardMaterial({ map: stripeTexture({ a: "#3e7bc2", b: "#f2ead8", n: 14 }) }), 16);
  hub.add(disc);
  const chairs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.position.set(Math.cos(a) * R, -0.1, Math.sin(a) * R);
    const chain = cyl(0.02, 0.02, 2.6, M(0x8a8f96), 4); chain.position.y = -1.3; arm.add(chain);
    const seat = box(0.5, 0.12, 0.45, M(0xeec643)); seat.position.y = -2.65; arm.add(seat);
    const back = box(0.5, 0.45, 0.08, M(0xeec643)); back.position.set(0, -2.42, -0.2); arm.add(back);
    hub.add(arm);
    chairs.push(arm);
  }
  const speed = o.speed || 0.8;
  let angle = 0;
  kit.addUpdate((dt) => {
    angle += speed * dt;
    hub.rotation.y = angle;
    const tilt = 0.42; // chains swing outward
    for (let i = 0; i < chairs.length; i++) {
      const a = (i / n) * Math.PI * 2;
      chairs[i].rotation.x = Math.sin(a + Math.PI / 2) * 0; // keep simple: uniform outward lean below
      chairs[i].rotation.z = -tilt * Math.cos(a + 0);
      chairs[i].rotation.x = tilt * Math.sin(a);
    }
  });
  kit.scene.add(root);
  kit.addCollider({ x, z, w: 1.4, d: 1.4 });

  const ride = {
    label: o.name || "the sky swings",
    duration: (Math.PI * 2 / speed) * (o.revolutions || 3),
    dismount: { x: x + R + 2.0, z: z + 1.2 },
    pose(t, out) {
      const a = angle;
      const lean = 0.9; // riders fly a little wider than the hub radius
      out.x = x + Math.cos(a) * (R + lean);
      out.y = gy + 6.8 - 2.4;
      out.z = z - Math.sin(a) * (R + lean);
      out.yaw = a + Math.PI / 2;
      out.pitch = -0.06;
    },
  };
  kit.addDoor({ label: "Ride " + (o.name || "the sky swings"), x: x + R + 1.8, z: z, hw: 2.2, hd: 2.2, act: { type: "ride", ride } });
  return { root, ride };
}
